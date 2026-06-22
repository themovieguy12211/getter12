'use strict';

/**
 * Client-side source scrapers.
 * These run in the USER'S BROWSER — not the server.
 * That means scraper targets see a real user IP + browser TLS fingerprint.
 *
 * Each scraper is a single function: (id, season?, episode?) => Promise<stream | null>
 */

const TIMEOUT_MS = 15000;

// CORS forwarder — your CF Worker that forwards requests and adds CORS headers.
// Requests go through this when the target doesn't allow cross-origin fetches.
const CORS_FORWARDER = 'https://cdn.piracy.cloud/cors-forward';

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs: number = TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...opts, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Fetch through the CORS forwarder. The worker forwards the request
 * with the browser's User-Agent and adds CORS response headers.
 */
async function fetchViaCors(url: string, headers: Record<string, string> = {}) {
    const params = new URLSearchParams({ url });
    if (Object.keys(headers).length > 0) {
        params.set('headers', JSON.stringify(headers));
    }
    return fetchWithTimeout(`${CORS_FORWARDER}?${params.toString()}`);
}

// ─── Aether ──────────────────────────────────────────────────────────────────

const AETHER_HOSTS = [
    'https://tiki.aether.bar',
    'https://cow.aether.bar',
    'https://gallic.aether.bar',
];

async function scrapeAether(id: string, season: string | null, episode: string | null): Promise<ClientSourceResult | null> {
    const path = season && episode
        ? `/tv/${id}/${season}/${episode}`
        : `/movie/${id}`;

    for (const host of AETHER_HOSTS) {
        try {
            // Aether doesn't have CORS → use forwarder
            const res = await fetchViaCors(`${host}${path}`, {
                'Referer': host + '/',
                'Origin': host,
            });
            if (!res.ok) continue;
            const data = await res.json();
            if (!data?.stream) continue;
            return {
                url: data.stream,
                headers: {
                    'Referer': host + '/',
                    'Origin': host,
                },
                provider: 'aether',
                label: 'Aether',
            };
        } catch {
            continue;
        }
    }
    return null;
}

// ─── VidSrc (RapidCloud CDN) ─────────────────────────────────────────────────

const VIDSRC_BASE = 'https://vsembed.ru';
const VIDSRC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36';

const VIDSRC_DOMAINS = {
    '{v1}': 'neonhorizonworkshops.com',
    '{v2}': 'wanderlynest.com',
    '{v3}': 'orchidpixelgardens.com',
    '{v4}': 'cloudnestra.com',
};

async function scrapeVidsrc(id: string, season: string | null, episode: string | null): Promise<ClientSourceResult | null> {
    try {
        // Step 1: Get RapidCloud CDN URL from vsembed (HAS CORS → direct)
        const pageUrl = season
            ? `${VIDSRC_BASE}/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`
            : `${VIDSRC_BASE}/embed/movie?tmdb=${id}`;

        // vsembed.ru has CORS → direct fetch
        const res1 = await fetchWithTimeout(pageUrl, {
            headers: { 'User-Agent': VIDSRC_UA, 'Referer': VIDSRC_BASE + '/' },
            redirect: 'follow',
        });
        if (!res1.ok) return null;
        const html1 = await res1.text();
        const iframeMatch = html1.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i);
        if (!iframeMatch?.[1]) return null;

        let rcpUrl = iframeMatch[1];
        if (rcpUrl.startsWith('//')) rcpUrl = 'https:' + rcpUrl;

        // Step 2: Get player page from RapidCloud CDN (NO CORS → via forwarder)
        const res2 = await fetchViaCors(rcpUrl, {
            'User-Agent': VIDSRC_UA,
            'Referer': VIDSRC_BASE + '/',
        });
        if (!res2.ok) return null;
        const html2 = await res2.text();

        // Try to find /prorcp/ path, or convert /rcp/ → /prorcp/
        let prorcpMatch = html2.match(/src:\s*['"]([^'"]*\/prorcp\/[^'"]+)['"]/i);
        let playerUrl;

        if (prorcpMatch?.[1]) {
            const base = rcpUrl.slice(0, rcpUrl.indexOf('/', rcpUrl.indexOf('//') + 2));
            playerUrl = prorcpMatch[1].startsWith('http') ? prorcpMatch[1] : base + prorcpMatch[1];
        } else {
            playerUrl = rcpUrl.replace('/rcp/', '/prorcp/');
        }

        // Step 3: Extract m3u8 from player JS (NO CORS → via forwarder)
        const res3 = await fetchViaCors(playerUrl, {
            'User-Agent': VIDSRC_UA,
            'Referer': rcpUrl,
        });
        if (!res3.ok) return null;
        const html3 = await res3.text();
        const fileMatch = html3.match(/file\s*:\s*["']([^"']+)["']/i);
        if (!fileMatch?.[1]) return null;

        // Resolve domain placeholders
        let url = fileMatch[1];
        for (const [placeholder, domain] of Object.entries(VIDSRC_DOMAINS)) {
            url = url.replace(placeholder, domain);
        }
        if (url.includes('{') || url.includes('}')) return null;

        return {
            url,
            headers: {
                'Referer': 'https://cloudnestra.com/',
                'Origin': 'https://cloudnestra.com',
                'User-Agent': VIDSRC_UA,
            },
            provider: 'vidsrc',
            label: 'Phantom',
        };
    } catch {
        return null;
    }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

const SCRAPERS = {
    aether: scrapeAether,
    vidsrc: scrapeVidsrc,
};

export type ClientSourceResult = {
    url: string;
    headers: Record<string, string>;
    provider: string;
    label: string;
};

export type SourceKey = keyof typeof SCRAPERS;

/**
 * Run all client-side scrapers for a given media request.
 * Returns results as they complete (doesn't wait for all).
 */
export async function* runClientScrapers(
    id: string,
    season?: string | null,
    episode?: string | null,
    sources?: SourceKey[],
): AsyncGenerator<ClientSourceResult> {
    const keys = sources || (Object.keys(SCRAPERS) as SourceKey[]);

    // Run all scrapers concurrently
    const promises = keys.map(async (key) => {
        const scraper = SCRAPERS[key];
        if (!scraper) return null;
        try {
            return await scraper(id, season ?? null, episode ?? null);
        } catch {
            return null;
        }
    });

    for (const promise of promises) {
        const result = await promise;
        if (result) yield result;
    }
}

/**
 * Run client scrapers and report results back to the server for caching.
 */
export async function scrapeAndReport(
    id: string,
    type: 'movie' | 'tv',
    season?: string | null,
    episode?: string | null,
): Promise<ClientSourceResult[]> {
    const results: ClientSourceResult[] = [];

    for await (const result of runClientScrapers(id, season, episode)) {
        results.push(result);
    }

    // Report to server for caching
    if (results.length > 0) {
        try {
            await fetch('/api/player/report-sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    id,
                    season: season || undefined,
                    episode: episode || undefined,
                    sources: results.map(r => ({
                        type: r.url.includes('.m3u8') || r.url.includes('m3u8') ? 'hls' as const : 'mp4' as const,
                        file: r.url,
                        label: r.label,
                        provider: r.provider,
                    })),
                }),
            });
        } catch {
            // Silent — reporting is best-effort
        }
    }

    return results;
}

export { scrapeAether, scrapeVidsrc };
