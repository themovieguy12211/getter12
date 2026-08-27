const BASE = 'https://api.moviebite.cc/api';
const TIMEOUT = 15000;

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Origin': 'https://moviebite.cc',
            'Referer': 'https://moviebite.cc/',
        },
        signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) throw new Error(`moviebite: ${res.status}`);
    return res.json();
}

function normalizeSources(data) {
    if (!data || !data.success) return null;
    const stream = data.stream;
    if (!stream) return null;

    const seen = new Set();
    const all = [stream.primary, ...(stream.sources ?? [])].filter(Boolean);
    const urls = [];

    for (const source of all) {
        if (!source?.url || seen.has(source.url)) continue;
        seen.add(source.url);
        const entry = { url: source.url, skipHlsCheck: true };
        if (source.headers && typeof source.headers === 'object' && Object.keys(source.headers).length > 0) {
            entry.headers = source.headers;
        }
        urls.push(entry);
    }

    if (urls.length === 0) return null;
    return { url: urls[0].url, headers: urls[0].headers, skipHlsCheck: true, allUrls: urls };
}

export async function getStream({ id, s, e }) {
    const url = s ? `${BASE}/tv/${id}/${s}/${e ?? 1}` : `${BASE}/movies/${id}`;
    const data = await fetchJson(url);
    return normalizeSources(data);
}
