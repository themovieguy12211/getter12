import { USER_AGENT } from '../utils/helpers.js';

const BASE_URL = 'https://movienig.ht';

const PRIORITY_SERVERS = [
    { id: 'dallas', label: 'Dallas 4K' },
    { id: 'austin', label: 'Austin' },
    { id: 'helena', label: 'Helena' },
    { id: 'seattle', label: 'Seattle 4K' },
    { id: 'vixsrc-1', label: 'Newport Beach' },
    { id: 'tucson', label: 'Tucson' },
    { id: 'salem', label: 'Salem' },
];

async function resolveDetails(sdk, id, isTv) {
    const apiKey = sdk?.tmdbApiKey || process.env.TMDB_API_KEY;
    if (!apiKey) return null;
    const type = isTv ? 'tv' : 'movie';
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}&append_to_response=external_ids`, {
            signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const title = isTv ? data.name : data.title;
        const releaseDate = isTv ? data.first_air_date : data.release_date;
        const year = releaseDate ? parseInt(releaseDate.split('-')[0], 10) : null;
        const imdbId = data.imdb_id || data.external_ids?.imdb_id || null;
        return { title, year, imdbId };
    } catch {
        return null;
    }
}

export async function getStream({ id, s, e, sdk }) {
    const isTv = Boolean(s && e);
    const ua = USER_AGENT;

    const details = await resolveDetails(sdk, id, isTv);
    const title = details?.title || String(id);
    const year = details?.year;
    const imdbId = details?.imdbId;

    const encTitle = encodeURIComponent(title);
    const yearQuery = year ? `&year=${year}` : '';
    const imdbQuery = imdbId ? `&imdbId=${imdbId}` : '';

    const seenUrls = new Set();
    const allUrls = [];

    const defaultHeaders = {
        'User-Agent': ua,
        Referer: `${BASE_URL}/`,
        Origin: BASE_URL,
        Accept: 'text/event-stream',
    };

    const tasks = PRIORITY_SERVERS.map(async (server) => {
        try {
            const url = isTv
                ? `${BASE_URL}/api/stream/v1/tv/${id}/${s}/${e}?title=${encTitle}${yearQuery}${imdbQuery}&server=${server.id}&only=1`
                : `${BASE_URL}/api/stream/v1/movie/${id}?title=${encTitle}${yearQuery}${imdbQuery}&server=${server.id}&only=1`;

            const res = await fetch(url, {
                headers: defaultHeaders,
                signal: AbortSignal.timeout(6000),
            });

            if (!res.ok) return;
            const bodyStr = await res.text();

            if (bodyStr.includes('event: done')) {
                const doneIdx = bodyStr.indexOf('event: done');
                const dataIdx = bodyStr.indexOf('data: ', doneIdx);

                if (dataIdx !== -1) {
                    const jsonStart = dataIdx + 6;
                    const jsonEnd = bodyStr.indexOf('\n', jsonStart);
                    const jsonText = (jsonEnd !== -1 ? bodyStr.substring(jsonStart, jsonEnd) : bodyStr.substring(jsonStart)).trim();

                    const data = JSON.parse(jsonText);
                    if (Array.isArray(data?.sources)) {
                        for (const src of data.sources) {
                            if (!src || typeof src !== 'object') continue;
                            const rawUrl = String(src.url || '').trim();
                            if (!rawUrl || seenUrls.has(rawUrl)) continue;

                            seenUrls.add(rawUrl);

                            const quality = src.quality ? String(src.quality) : 'Auto';
                            const titleQuality = quality !== 'Auto' ? ` (${quality})` : '';

                            allUrls.push({
                                url: rawUrl,
                                label: `MovieNight ${server.label}${titleQuality}`,
                                headers: {
                                    'User-Agent': ua,
                                    Referer: `${BASE_URL}/`,
                                },
                            });
                        }
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