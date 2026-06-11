const BASE = 'https://toustream.xyz/tou';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const SKIP_VERIFY = true;

// Servers to try in order of reliability
const SERVERS = ['snake', 'vulture', 'viper', 'panther', 'eagle', 'turtle', 'phoenix'];

export const CDN_HEADERS = [
    {
        pattern: /cdn\.1shows\.app/,
        headers: {
            'Referer': 'https://1shows.app/',
            'Origin': 'https://1shows.app',
            'User-Agent': UA,
        },
    },
    {
        pattern: /toustream\.xyz/,
        headers: {
            'Referer': 'https://toustream.xyz/',
            'Origin': 'https://toustream.xyz',
            'User-Agent': UA,
        },
    },
];

export async function getStream(id, season, episode, clientIp) {
    const isMovie = !season;
    
    console.log(`[TouStream] Fetching ${isMovie ? 'movie' : 'tv'} ${id}${season ? ` S${season}E${episode}` : ''}`);
    
    try {
        const allUrls = [];
        
        // Try all servers and collect working streams
        for (const server of SERVERS) {
            try {
                const sourceUrl = isMovie
                    ? `${BASE}/get-source/movie/${id}?server=${server}`
                    : `${BASE}/get-source/tv/${id}/${season}/${episode}?server=${server}`;
                
                console.log(`[TouStream] Trying server: ${server}`);
                
                const res = await fetch(sourceUrl, {
                    headers: {
                        'User-Agent': UA,
                        'Referer': BASE,
                    },
                    signal: AbortSignal.timeout(15000),
                });
                
                if (!res.ok) {
                    console.log(`[TouStream] Server ${server}: HTTP ${res.status}`);
                    continue;
                }
                
                const data = await res.json();
                console.log(`[TouStream] Server ${server} response: isHls=${data.isHls}`);
                
                if (!data.Auto) {
                    console.log(`[TouStream] Server ${server}: No Auto URL in response`);
                    continue;
                }
                
                // Decode the URL (it's URL encoded)
                let streamUrl = decodeURIComponent(data.Auto);
                
                // Extract CDN URL and origin from proxy wrapper if present
                // Format: https://toustream.xyz/tou/bp/?url=https://cdn.1shows.app/...&origin=https://...
                const urlParam = streamUrl.match(/[?&]url=([^&]+)/);
                const originParam = streamUrl.match(/[?&]origin=([^&]+)/);
                
                if (urlParam) {
                    streamUrl = decodeURIComponent(urlParam[1]);
                }
                
                // If it's a relative proxy path, make it absolute
                if (streamUrl.startsWith('/tou/')) {
                    streamUrl = 'https://toustream.xyz' + streamUrl;
                }
                
                // Determine the correct referrer based on the CDN host
                let referer = 'https://toustream.xyz';
                if (streamUrl.includes('cdn.1shows.app')) {
                    referer = 'https://1shows.app';
                } else if (originParam) {
                    referer = decodeURIComponent(originParam[1]);
                }
                
                console.log(`[TouStream] Found stream from ${server}: ${streamUrl.substring(0, 80)}...`);
                
                allUrls.push({
                    url: streamUrl,
                    headers: {
                        'Referer': referer,
                        'Origin': referer.replace(/\/$/, ''),
                    },
                });
            } catch (e) {
                console.log(`[TouStream] Server ${server} failed: ${e.message}`);
                continue;
            }
        }
        
        if (allUrls.length === 0) {
            console.log(`[TouStream] All servers exhausted`);
            throw new Error('No working server found');
        }
        
        console.log(`[TouStream] Collected ${allUrls.length} working streams`);
        return { allUrls };
    } catch (error) {
        console.log(`[TouStream] Error: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
