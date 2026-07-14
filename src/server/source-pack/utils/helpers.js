export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

export async function fetchJson(url, opts = {}) {
    const res = await fetch(url, {
        ...opts,
        headers: { 'Accept': 'application/json', ...opts.headers },
        signal: opts.signal || AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchText(url, opts = {}) {
    const res = await fetch(url, {
        ...opts,
        signal: opts.signal || AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

const tmdbInfoCache = new Map();
const anilistCache = new Map();

export async function getTmdbInfo(tmdbId, mediaType, season) {
    const key = `${tmdbId}-${mediaType}-${season || ''}`;
    if (tmdbInfoCache.has(key)) return tmdbInfoCache.get(key);
    const k = process.env.TMDB_API_KEY;
    if (!k) return { isAnime: false, titles: [], year: null, imdbId: null };
    try {
        const [mainRes, seasonRes] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${k}&append_to_response=external_ids`, { signal: AbortSignal.timeout(5000) }),
            season && mediaType === 'tv' ? fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${k}`, { signal: AbortSignal.timeout(5000) }) : Promise.resolve(null),
        ]);
        let mainData = null;
        let seasonData = null;
        if (mainRes.ok) mainData = await mainRes.json(); else mainRes.body?.cancel();
        if (seasonRes) {
            if (seasonRes.ok) seasonData = await seasonRes.json(); else seasonRes.body?.cancel();
        }

        const genres = mainData?.genres || [];
        const originCountry = mainData?.origin_country || [];
        const originalLanguage = mainData?.original_language || '';
        const isAnime = genres.some(g => g.id === 16) && (originCountry.includes('JP') || originalLanguage === 'ja');
        const titles = [];
        if (seasonData?.name) titles.push(seasonData.name);
        const title = mainData?.title || mainData?.name || '';
        const originalTitle = mainData?.original_title || mainData?.original_name || '';
        if (title) titles.push(title);
        if (originalTitle && originalTitle !== title) titles.push(originalTitle);

        let year = null;
        const dateStr = seasonData?.air_date || mainData?.release_date || mainData?.first_air_date || '';
        if (dateStr) year = parseInt(dateStr.slice(0, 4), 10);

        const result = {
            isAnime,
            titles: [...new Set(titles.filter(Boolean))],
            year,
            imdbId: mainData?.imdb_id || mainData?.external_ids?.imdb_id || null,
        };
        tmdbInfoCache.set(key, result);
        setTimeout(() => tmdbInfoCache.delete(key), 600000);
        return result;
    } catch {
        return { isAnime: false, titles: [], year: null, imdbId: null };
    }
}

export async function tmdbToAnilist(tmdbId, mediaType, season, titles = [], year = null) {
    const key = `${tmdbId}-${mediaType}-${season || ''}`;
    if (anilistCache.has(key)) return anilistCache.get(key);
    try {
        const res = await fetch(`https://api.ani.zip/mappings?tmdb_id=${tmdbId}&type=${mediaType}&season=${season || 1}`, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
            const data = await res.json();
            const id = data?.mappings?.[0]?.anilist_id;
            if (id) {
                anilistCache.set(key, id);
                setTimeout(() => anilistCache.delete(key), 600000);
                return id;
            }
        } else {
            res.body?.cancel();
        }
    } catch { }

    if (!titles.length) return null;
    const query = `query ($s: String) { Page(page:1,perPage:10) { media(search:$s,type:ANIME) { id title { romaji english native } startDate { year } format } } }`;
    let bestId = null;
    let bestScore = -1;

    for (const searchTitle of titles) {
        try {
            const res = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ query, variables: { s: searchTitle } }),
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) {
                res.body?.cancel();
                continue;
            }
            const data = await res.json();
            for (const entry of data?.data?.Page?.media || []) {
                const entryTitles = [entry.title?.romaji, entry.title?.english, entry.title?.native]
                    .filter(Boolean)
                    .map(t => t.toLowerCase());
                const normalizedTitle = searchTitle.toLowerCase();
                let score = 0;
                if (entryTitles.some(t => t === normalizedTitle)) score += 5;
                else if (entryTitles.some(t => t.includes(normalizedTitle) || normalizedTitle.includes(t))) score += 3;
                else if (entryTitles.some(t => {
                    const words = normalizedTitle.split(/\s+/).filter(x => x.length > 3);
                    return words.length > 0 && words.every(x => t.includes(x));
                })) score += 2;
                else continue;

                if (year && entry.startDate?.year) {
                    const diff = Math.abs(entry.startDate.year - year);
                    if (diff === 0) score += 3;
                    else if (diff === 1) score += 1;
                    else if (diff > 2) score -= 3;
                }
                if (mediaType === 'tv' && ['TV', 'TV_SHORT', 'ONA', 'OVA'].includes(entry.format)) score += 1;
                if (mediaType === 'movie' && entry.format === 'MOVIE') score += 1;
                if (score > bestScore) {
                    bestScore = score;
                    bestId = entry.id;
                }
            }
            if (bestScore >= 8) break;
        } catch { }
    }

    if (bestId) {
        anilistCache.set(key, bestId);
        setTimeout(() => anilistCache.delete(key), 600000);
    }
    return bestId;
}

export function unwrapTulnexProxy(url) {
    if (!url) return { unwrapped: url, headers: null };
    if (url.includes('pronhub.tulnex.com/m3u8-proxy') || url.includes('prxy.tulnex.com')) {
        try {
            const parsed = new URL(url);
            const inner = parsed.searchParams.get('url');
            const headersRaw = parsed.searchParams.get('headers');
            if (inner) return {
                unwrapped: decodeURIComponent(inner),
                headers: headersRaw ? JSON.parse(decodeURIComponent(headersRaw)) : null,
            };
        } catch { }
    }
    return { unwrapped: url, headers: null };
}
