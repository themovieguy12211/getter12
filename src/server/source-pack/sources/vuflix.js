import { USER_AGENT } from '../utils/helpers.js';

const API_BASE = 'https://vuflix.co';
const REFERER = 'https://vuflix.co/';
const ORIGIN = 'https://vuflix.co';

let cachedProviders = null;
let lastProvidersFetch = 0;

const FALLBACK_PROVIDERS = [
    { id: 'vsembed', name: 'Sigma' },
    { id: 'moonflix', name: 'Source 40' },
    { id: 'megasource', name: 'Source 39' },
    { id: 'hdghar', name: 'Source 44' },
    { id: 'moviebox', name: 'Pi' },
    { id: 'cineplay', name: '4K' },
    { id: 'huhu', name: 'Beta' },
    { id: 'bingr', name: 'Upsilon' },
    { id: 'onlyflix', name: 'Gamma' },
    { id: 'vaplayer', name: 'Alpha' },
    { id: 'flixhqz', name: 'Gamma' },
    { id: 'castle', name: 'Source 40' },
    { id: 'cinejoy', name: '4K2' },
    { id: 'filesun', name: 'Tau' },
    { id: 'yoru', name: 'Yoru' },
];

async function getProviders(ua) {
    if (cachedProviders && Date.now() - lastProvidersFetch < 900000) {
        return cachedProviders;
    }

    try {
        const res = await fetch(`${API_BASE}/api/player/providers`, {
            headers: {
                'User-Agent': ua,
                Referer: REFERER,
                Origin: ORIGIN,
                Accept: 'application/json, text/plain, */*',
            },
            signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
            const data = await res.json();
            if (data?.ok && Array.isArray(data.providers)) {
                const list = data.providers
                    .filter(p => p && typeof p.id === 'string' && p.id.trim().length > 0)
                    .map(p => ({
                        id: p.id.trim(),
                        name: p.publicLabel || p.providerName || p.name || p.id,
                    }));

                if (list.length > 0) {
                    cachedProviders = list;
                    lastProvidersFetch = Date.now();
                    return list;
                }
            }
        }
    } catch { }

    return FALLBACK_PROVIDERS;
}

function unwrapUrl(rawUrl, ua) {
    const defaultHeaders = {
        'User-Agent': ua,
        Referer: REFERER,
        Origin: ORIGIN,
    };

    if (!rawUrl || typeof rawUrl !== 'string') {
        return { url: '', headers: defaultHeaders };
    }

    if (!rawUrl.includes('v-relay?t=') && !rawUrl.includes('a-relay?t=')) {
        return { url: rawUrl, headers: defaultHeaders };
    }

    try {
        const parsedUrl = new URL(rawUrl);
        const t = parsedUrl.searchParams.get('t');
        if (!t) return { url: rawUrl, headers: defaultHeaders };

        let b64 = t.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4 !== 0) {
            b64 += '=';
        }

        const jsonStr = Buffer.from(b64, 'base64').toString('utf8');
        const parsed = JSON.parse(jsonStr);

        if (parsed && typeof parsed === 'object') {
            const directUrl = (parsed.u || '').trim();
            const headersMap = { ...defaultHeaders };

            if (parsed.h && typeof parsed.h === 'object') {
                for (const [key, value] of Object.entries(parsed.h)) {
                    headersMap[key] = String(value);
                }
            }

            if (directUrl) {
                return { url: directUrl, headers: headersMap };
            }
        }
    } catch { }

    return { url: rawUrl, headers: defaultHeaders };
}

export async function getStream({ id, s, e }) {
    const isTv = Boolean(s && e);
    const mediaType = isTv ? 'tv' : 'movie';
    const ua = USER_AGENT;

    const baseParams = new URLSearchParams({
        type: mediaType,
        tmdbId: String(id),
    });

    if (isTv) {
        baseParams.set('season', String(s));
        baseParams.set('episode', String(e));
    }

    const providers = await getProviders(ua);
    const seenUrls = new Set();
    const allUrls = [];

    const defaultHeaders = {
        'User-Agent': ua,
        Referer: REFERER,
        Origin: ORIGIN,
        Accept: 'application/json, text/plain, */*',
    };

    const tasks = providers.map(async (prov) => {
        try {
            const url = `${API_BASE}/api/player/sources?${baseParams.toString()}&provider=${encodeURIComponent(prov.id)}`;
            const res = await fetch(url, {
                headers: defaultHeaders,
                signal: AbortSignal.timeout(8000),
            });

            if (!res.ok) return;
            const data = await res.json();
            if (!data?.ok || !Array.isArray(data.sources)) return;

            for (const item of data.sources) {
                if (!item || typeof item !== 'object') continue;

                const providerName = item.providerName || item.publicLabel || prov.name;
                const primaryRawUrl = (item.url || '').trim();
                const itemType = (item.type || 'hls').toLowerCase();
                const itemLabel = item.label || '';

                if (Array.isArray(item.qualities) && item.qualities.length > 0) {
                    for (const q of item.qualities) {
                        if (!q || typeof q !== 'object') continue;
                        const qRawUrl = (q.url || '').trim();
                        if (!qRawUrl) continue;

                        const unwrapped = unwrapUrl(qRawUrl, ua);
                        if (!unwrapped.url || seenUrls.has(unwrapped.url)) continue;
                        seenUrls.add(unwrapped.url);

                        const qQuality = q.quality || 'Auto';
                        allUrls.push({
                            url: unwrapped.url,
                            label: `${providerName} · ${qQuality}`,
                            headers: unwrapped.headers,
                        });
                    }
                }

                if (Array.isArray(item.candidates) && item.candidates.length > 0) {
                    let candIndex = 1;
                    for (const c of item.candidates) {
                        if (!c || typeof c !== 'object') continue;
                        const cRawUrl = (c.url || '').trim();
                        if (!cRawUrl) continue;

                        const unwrapped = unwrapUrl(cRawUrl, ua);
                        if (!unwrapped.url || seenUrls.has(unwrapped.url)) continue;
                        seenUrls.add(unwrapped.url);

                        const cQuality = c.quality || '1080p';
                        allUrls.push({
                            url: unwrapped.url,
                            label: `${providerName} · Mirror ${candIndex} · ${cQuality}`,
                            headers: unwrapped.headers,
                        });
                        candIndex++;
                    }
                }

                if (Array.isArray(item.audioTracks) && item.audioTracks.length > 0) {
                    for (const a of item.audioTracks) {
                        if (!a || typeof a !== 'object') continue;
                        const aRawUrl = (a.switchUrl || a.url || '').trim();
                        if (!aRawUrl) continue;

                        const unwrapped = unwrapUrl(aRawUrl, ua);
                        if (!unwrapped.url || seenUrls.has(unwrapped.url)) continue;
                        seenUrls.add(unwrapped.url);

                        const rawLabel = (a.label || a.name || a.language || 'Audio').trim();
                        const cleanLabel = rawLabel.replace(/\s*audio\s*$/i, '').trim() || 'Audio';

                        allUrls.push({
                            url: unwrapped.url,
                            label: `${providerName} · ${cleanLabel} Audio`,
                            headers: unwrapped.headers,
                        });
                    }
                }

                if (primaryRawUrl) {
                    const unwrapped = unwrapUrl(primaryRawUrl, ua);
                    if (unwrapped.url && !seenUrls.has(unwrapped.url)) {
                        seenUrls.add(unwrapped.url);

                        let displayQuality = item.quality || (itemType === 'mp4' ? 'MP4' : 'HD');
                        let cleanLabel = itemLabel || providerName;
                        let label = cleanLabel.startsWith('[') ? cleanLabel : `${providerName} · ${displayQuality}`;

                        allUrls.push({
                            url: unwrapped.url,
                            label,
                            headers: unwrapped.headers,
                        });
                    }
                }
            }
        } catch { }
    });

    await Promise.all(tasks);

    if (allUrls.length === 0) return null;

    return {
        url: allUrls[0].url,
        allUrls,
        headers: allUrls[0].headers,
    };
}