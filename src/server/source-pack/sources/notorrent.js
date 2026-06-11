const NOTORRENT_API = 'https://addon-osvh.onrender.com';

async function fetchJson(url, headers = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

function cleanText(str) {
    if (!str) return '';
    return str.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, '').trim();
}

function extractQuality(titleText) {
    const raw = titleText || '';
    const match = raw.match(/(\d{3,4}p)/);
    if (match) return match[0];
    if (raw.toUpperCase().includes('FREE')) return 'Auto';
    return 'Unknown';
}

export async function getStream(tmdbId, season, episode, clientIp) {
    const mediaType = season ? 'tv' : 'movie';
    const seasonNum = season ? parseInt(season) : null;
    const episodeNum = episode ? parseInt(episode) : null;
    
    console.log(`[NoTorrent] Searching for ${mediaType} ${tmdbId}`);

    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) {
        console.error('[NoTorrent] No TMDB API key configured.');
        return null;
    }

    let imdbId;
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const data = await fetchJson(
            `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${tmdbKey}&append_to_response=external_ids`
        );
        if (!data) return null;
        imdbId = (data.external_ids && data.external_ids.imdb_id) || null;
    } catch (err) {
        console.error(`[NoTorrent] TMDB lookup failed: ${err.message}`);
        return null;
    }

    if (!imdbId) {
        console.warn('[NoTorrent] Failed to map IMDB ID from TMDB.');
        return null;
    }

    const apiUrl = (mediaType === 'tv' && seasonNum != null)
        ? `${NOTORRENT_API}/stream/series/${imdbId}:${seasonNum}:${episodeNum}.json`
        : `${NOTORRENT_API}/stream/movie/${imdbId}.json`;

    try {
        const data = await fetchJson(apiUrl);
        if (!data) return null;
        const rawList = data.streams || [];
        const streams = [];

        for (const item of rawList) {
            if (item.externalUrl || !item.url) continue;
            if (item.url.includes('github.com') || item.url.includes('googleusercontent')) continue;

            const cleanTitleStr = cleanText(item.title || '');
            const quality = extractQuality(cleanTitleStr);

            let language = 'Default';
            const langMatch = cleanTitleStr.match(/\(([^)]+)\)/);
            if (langMatch) {
                language = langMatch[1].charAt(0).toUpperCase() + langMatch[1].slice(1).toLowerCase();
            }

            const proxyHeaders = (item.behaviorHints?.proxyHeaders?.request) || {};
            const headers = { ...(item.behaviorHints?.headers || {}), ...proxyHeaders };

            const nameParts = ['Nexus', language !== 'Default' ? language : ''].filter(p => p.trim() !== '');
            streams.push({
                name: nameParts.join(' • '),
                title: quality,
                url: item.url,
                quality,
                provider: 'Nexus',
                headers: Object.keys(headers).length > 0 ? headers : undefined
            });
        }

        console.log(`[NoTorrent] Total results found: ${streams.length}`);
        
        if (streams.length === 0) return null;
        
        return {
            allUrls: streams.map(s => ({
                url: s.url,
                headers: s.headers,
                quality: s.quality
            }))
        };
    } catch (err) {
        console.error(`[NoTorrent] Fetch failed: ${err.message}`);
        return null;
    }
}
