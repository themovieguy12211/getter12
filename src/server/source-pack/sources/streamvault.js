const BASE = 'https://streamvaultsrc.click';

export const SKIP_VERIFY = true;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function getStream(id, season, episode, clientIp) {
    // Determine if movie or tv based on presence of season/episode
    const isMovie = !season;
    
    const url = isMovie
        ? `${BASE}/api/embed-streams/movie/${id}`
        : `${BASE}/api/embed-streams/tv/${id}/${season || 1}/${episode || 1}`;
    
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': UA,
                'Referer': `${BASE}/`,
                'Origin': BASE,
                ...(clientIp && { 'X-Forwarded-For': clientIp, 'X-Real-IP': clientIp }),
            },
            signal: AbortSignal.timeout(10000),
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        
        if (!data.streams || data.streams.length === 0) {
            throw new Error('No streams found');
        }
        
        // Get first available stream (usually best quality)
        const stream = data.streams[0];
        
        if (!stream.url) throw new Error('No stream URL');
        
        return {
            url: stream.url,
            headers: {
                'Referer': `${BASE}/`,
                'Origin': BASE,
            },
        };
    } catch (error) {
        throw new Error(`streamvault error: ${error.message}`);
    }
}
