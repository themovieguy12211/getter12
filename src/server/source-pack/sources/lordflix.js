const LORDFLIX_HEADERS = {
    'Accept': '*/*',
    'Origin': 'https://lordflix.org',
    'Referer': 'https://lordflix.org/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
};

const LORDFLIX_API = 'https://snowhouse.lordflix.club';
const MULTI_DECRYPT_API = 'https://enc-dec.app/api';
const SERVERS = ['Phoenix'];

function encodeQuote(str) {
    return encodeURIComponent(str).replace(/%20/g, '+').replace(/\+/g, '%20');
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } catch {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function getStream(tmdbId, season, episode, clientIp) {
    const mediaType = season ? 'tv' : 'movie';
    const seasonNum = season ? parseInt(season) : null;
    const episodeNum = episode ? parseInt(episode) : null;
    
    console.log(`[Lordflix] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);

    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) {
        console.error('[Lordflix] No TMDB API key configured.');
        return null;
    }

    let info;
    try {
        const type = mediaType === 'tv' ? 'tv' : 'movie';
        const res = await fetchWithTimeout(
            `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${tmdbKey}&append_to_response=external_ids`,
            { headers: { 'User-Agent': LORDFLIX_HEADERS['User-Agent'] } }
        );
        if (!res?.ok) return null;
        const data = await res.json();
        info = {
            title: data.title || data.name || '',
            year: (data.release_date || data.first_air_date || '').split('-')[0],
            imdbId: (data.external_ids && data.external_ids.imdb_id) || ''
        };
    } catch (err) {
        console.error(`[Lordflix] TMDB lookup failed: ${err.message}`);
        return null;
    }

    if (!info.title || !info.imdbId) {
        console.error('[Lordflix] Missing title or IMDb ID from TMDB.');
        return null;
    }

    const typeParam = mediaType === 'tv' ? 'series' : 'movie';
    const titleEnc = encodeQuote(info.title);
    const streams = [];

    await Promise.all(SERVERS.map(async (server) => {
        try {
            let serverUrl = `${LORDFLIX_API}/?title=${titleEnc}&type=${typeParam}&year=${info.year || ''}` +
                `&imdb=${info.imdbId}&tmdb=${tmdbId}&server=${server}`;
            
            if (mediaType === 'tv') {
                serverUrl += `&season=${seasonNum}&episode=${episodeNum}`;
            }

            const encBridgeRes = await fetchWithTimeout(
                `${MULTI_DECRYPT_API}/enc-lordflix?url=${encodeQuote(serverUrl)}`,
                {}
            );
            if (!encBridgeRes?.ok) return;
            const encBridgeJson = await encBridgeRes.json();
            if (!encBridgeJson || encBridgeJson.status !== 200 || !encBridgeJson.result) return;

            const { url: proxyEncUrl, sign: signature } = encBridgeJson.result;
            if (!proxyEncUrl || !signature) return;

            const remoteEncRes = await fetchWithTimeout(proxyEncUrl, {
                headers: LORDFLIX_HEADERS,
            });
            if (!remoteEncRes?.ok) return;
            const remoteEncData = await remoteEncRes.text();

            const decRes = await fetchWithTimeout(
                `${MULTI_DECRYPT_API}/dec-lordflix`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: remoteEncData, sign: signature })
                }
            );
            if (!decRes?.ok) return;
            const finalJson = await decRes.json();
            if (!finalJson || finalJson.status !== 200 || !finalJson.result || finalJson.result.error) return;

            const streamList = finalJson.result.stream;
            if (!Array.isArray(streamList) || streamList.length === 0) return;

            const topStream = streamList[0];
            if (topStream.type === 'hls' && topStream.playlist) {
                streams.push({
                    name: `Lordflix[${server}]`,
                    title: `Lordflix[${server}]`,
                    url: topStream.playlist,
                    quality: 'Auto',
                    provider: 'Lordflix',
                    headers: LORDFLIX_HEADERS
                });
                console.log(`[Lordflix] Server ${server}: got stream.`);
            }
        } catch (err) {
            console.error(`[Lordflix] Server ${server} error: ${err.message}`);
        }
    }));

    console.log(`[Lordflix] Total streams: ${streams.length}`);
    
    if (streams.length === 0) return null;
    
    return {
        allUrls: streams.map(s => ({
            url: s.url,
            headers: s.headers,
            quality: s.quality
        }))
    };
}
