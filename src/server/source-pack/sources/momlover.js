'use strict';

import { createHash, createDecipheriv } from 'crypto';

const BASE = 'https://momlover.notyourtype.dad';
const REFERER = 'https://player.cinezo.live/';
const ORIGIN = 'https://player.cinezo.live';

const GCM_KEY = 'Sn00pD0g#RESP_B4SE_K3y_2026!';

const PROVIDERS = [
    { name: 'tulnex1', label: 'NovaStream' },
    { name: 'moviebox', label: 'VaultFlix' },
    { name: 'flix', label: 'CineWave' },
    { name: 'fabric', label: 'ForgeCast' },
    { name: 'flax', label: 'Thorn' },
    { name: 'ngflix', label: 'NeoFlix' },
    { name: 'png', label: 'Goat' },
];

// ─── Token ───────────────────────────────────────────────────────────────────

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
    if (cachedToken && Date.now() < tokenExpiresAt - 1000) {
        return cachedToken;
    }
    const res = await fetch(`${BASE}/auth/generate-token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Referer: REFERER,
            Origin: ORIGIN,
        },
        body: JSON.stringify({ clientData: {} }),
    });
    if (!res.ok) throw new Error(`Token HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.token) throw new Error('No token in response');
    cachedToken = data.token;
    tokenExpiresAt = Date.now() + (data.expiresMs || 25000);
    return data.token;
}

// ─── Decrypt ─────────────────────────────────────────────────────────────────

function decryptGcm(payload) {
    const bytes = Buffer.from(payload, 'base64');
    if (bytes.length < 44) throw new Error('Payload too short');

    const salt = bytes.subarray(0, 16);
    const iv = bytes.subarray(16, 28);
    const tag = bytes.subarray(bytes.length - 16);
    const encrypted = bytes.subarray(28, bytes.length - 16);

    const keyBytes = Buffer.from(GCM_KEY, 'utf8');
    const derived = createHash('sha256').update(Buffer.concat([keyBytes, salt])).digest();

    const decipher = createDecipheriv('aes-256-gcm', derived, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return JSON.parse(decrypted.toString('utf8'));
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function fetchProvider(name, id, season, episode) {
    try {
        const token = await getToken();

        const path = season != null && episode != null
            ? `/${name}/tv/${id}/${season}/${episode}`
            : `/${name}/movie/${id}`;

        const res = await fetch(`${BASE}${path}`, {
            headers: {
                'Accept': 'application/json, */*',
                'x-request-token': token,
                'x-response-encryption': 'aes-gcm',
                Referer: REFERER,
                Origin: ORIGIN,
            },
        });

        if (!res.ok) return null;

        let data = await res.json().catch(() => null);
        if (!data) return null;

        // AES-GCM encrypted response
        if ((data.v === 4 || data.v === 'gcm') && data.payload) {
            try {
                data = decryptGcm(data.payload);
            } catch {
                return null;
            }
        }

        if (!data?.success || !Array.isArray(data?.sources)) return null;

        return data.sources
            .filter(s => s.url && (s.url.startsWith('http://') || s.url.startsWith('https://')))
            .map(s => {
                // Extract real URL from Cinezo's worker proxy wrapper
                let realUrl = s.url;
                let realHeaders = {};

                try {
                    const parsed = new URL(s.url);
                    // hxshuu workers: /?url=REAL_URL&referer=REAL_REFERER
                    // google.notyourtype.dad: /proxy?url=REAL_URL or /mp4-proxy?url=REAL_URL
                    const innerUrl = parsed.searchParams.get('url');
                    if (innerUrl) {
                        realUrl = decodeURIComponent(innerUrl);
                        const referer = parsed.searchParams.get('referer');
                        if (referer) {
                            realHeaders['Referer'] = decodeURIComponent(referer);
                            realHeaders['Origin'] = new URL(decodeURIComponent(referer)).origin;
                        }
                    }
                } catch {
                    // Keep original URL if parsing fails
                }

                return {
                    url: realUrl,
                    quality: s.quality || provider.label,
                    type: s.type,
                    provider: s.provider || name,
                    headers: Object.keys(realHeaders).length > 0 ? realHeaders : undefined,
                };
            });
    } catch {
        return null;
    }
}

// ─── getStream ───────────────────────────────────────────────────────────────

// Accepts optional 4th arg for provider name (when used with multiBase)
async function getStream(id, season, episode, providerName) {
    // If a specific provider is requested (via multiBase), only query that one
    if (providerName && PROVIDERS.some(p => p.name === providerName)) {
        const provider = PROVIDERS.find(p => p.name === providerName);
        const sources = await fetchProvider(providerName, id, season, episode);
        if (!sources || sources.length === 0) return null;

        return {
            allUrls: sources.map(s => ({
                url: s.url,
                headers: s.headers && Object.keys(s.headers).length > 0
                    ? s.headers
                    : { Referer: ORIGIN, Origin: ORIGIN },
                quality: s.quality,
            })),
        };
    }

    // Fallback: query all providers
    const results = [];

    const promises = PROVIDERS.map(async (provider) => {
        const sources = await fetchProvider(provider.name, id, season, episode);
        if (sources && sources.length > 0) {
            results.push(...sources);
        }
    });

    await Promise.allSettled(promises);

    if (results.length === 0) return null;

    return {
        allUrls: results.map(r => ({
            url: r.url,
            headers: r.headers && Object.keys(r.headers).length > 0
                ? r.headers
                : { Referer: ORIGIN, Origin: ORIGIN },
            quality: r.quality,
        })),
    };
}

async function getSources(id, s, e, title) {
    const stream = await getStream(id, s, e);
    return stream ? stream.allUrls.map(u => u.url) : [];
}

async function proxyStream(url, res, { fetchUpstream, rewriteM3u8 }) {
    try {
        const headers = {
            Referer: ORIGIN,
            Origin: ORIGIN,
        };

        const upstream = await fetch(url, 0, headers);
        if (!upstream) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            return res.end('No upstream');
        }

        const ct = (upstream.headers?.['content-type'] || '').toLowerCase();
        const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8?(\?|$)/i.test(url);

        if (isM3u8) {
            const chunks = [];
            for await (const c of upstream) chunks.push(c);
            const body = Buffer.concat(chunks).toString('utf8');
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.end(rewriteM3u8(body, url, '&ml=1'));
        }

        res.setHeader('Content-Type', ct || 'application/octet-stream');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        upstream.pipe(res);
    } catch (err) {
        if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Proxy failed');
        }
    }
}

const VERIFY_HEADERS = {
    Referer: ORIGIN,
    Origin: ORIGIN,
};

export const SKIP_VERIFY = true;
export const MULTI_URL = true;

export { getStream, getSources, proxyStream, VERIFY_HEADERS };
