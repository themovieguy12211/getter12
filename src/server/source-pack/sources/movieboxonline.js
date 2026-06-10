const BASE = 'https://netnaija.film';

export const SKIP_VERIFY = true;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Helper to get title from TMDB
async function getTmdbTitle(id, isMovie) {
    const tmdbKey = process.env.TMDB_API_KEY || '338a47b75eab45d9e64e67088f910f93';
    try {
        const url = isMovie
            ? `https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbKey}`
            : `https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const data = await res.json();
        return isMovie ? data.title : data.name;
    } catch (e) {
        console.log(`[MovieBoxOnline] TMDB fetch failed: ${e.message}`);
        return null;
    }
}

// Search netnaija for the movie to get the real URL with correct ID
async function searchNetnaija(query, isMovie) {
    try {
        const searchUrl = `${BASE}/search-result?keyword=${encodeURIComponent(query)}`;
        console.log(`[MovieBoxOnline] Searching: ${searchUrl}`);
        
        const res = await fetch(searchUrl, {
            headers: { 'User-Agent': UA, 'Referer': BASE },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        
        const html = await res.text();
        
        // Look for /movieDetail/{title}-{id} links in search results
        const match = html.match(/href=["']\/movieDetail\/([^"']+)["']/i);
        if (match?.[1]) {
            // Convert movieDetail link to videoPlayPage (the actual player page)
            const slug = match[1];
            const url = `${BASE}/videoPlayPage/${slug}?type=${isMovie ? '/movie/detail' : '/tv/detail'}`;
            console.log(`[MovieBoxOnline] Found via search: ${url}`);
            return url;
        }
        return null;
    } catch (e) {
        console.log(`[MovieBoxOnline] Search failed: ${e.message}`);
        return null;
    }
}

// Helper to slugify title
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
}

export async function getStream(id, season, episode, clientIp) {
    const isMovie = !season;
    
    console.log(`[MovieBoxOnline] Fetching ${isMovie ? 'movie' : 'tv'} ${id}`);
    
    try {
        // Get title from TMDB
        const title = await getTmdbTitle(id, isMovie);
        if (!title) {
            console.log(`[MovieBoxOnline] Could not get title from TMDB`);
            throw new Error('Could not fetch title from TMDB');
        }
        console.log(`[MovieBoxOnline] Got title: ${title}`);
        
        // Search netnaija for the real URL with correct ID
        let videoPageUrl = await searchNetnaija(title, isMovie);
        
        if (!videoPageUrl) {
            console.log(`[MovieBoxOnline] Search failed, cannot construct correct URL`);
            throw new Error('Movie not found on netnaija');
        }
        
        console.log(`[MovieBoxOnline] Using URL: ${videoPageUrl}`);
        
        // Fetch the video page
        const res = await fetch(videoPageUrl, {
            headers: {
                'User-Agent': UA,
                'Referer': BASE,
                'Origin': BASE,
                ...(clientIp && { 'X-Forwarded-For': clientIp, 'X-Real-IP': clientIp }),
            },
            signal: AbortSignal.timeout(10000),
        });
        
        if (!res.ok) {
            console.log(`[MovieBoxOnline] HTTP ${res.status} for ${videoPageUrl}`);
            throw new Error(`HTTP ${res.status}`);
        }
        
        const html = await res.text();
        console.log(`[MovieBoxOnline] Received HTML, length: ${html.length}`);
        
        // Find video URL - look for class="art-video" which has the correct CDN
        let videoUrl = null;
        
        // The page renders video via Artplayer JS
        // Video tag should be in HTML: <video class="art-video" src="https://...mp4...">
        
        // Pattern: grab any URL from src attribute that points to hakunaymatata CDN
        let match = html.match(/src=["']?(https:\/\/[^"'\s>]*bcdnxw\.hakunaymatata\.com[^"'\s>]*\.mp4[^"'\s>]*?)["'\s>]/i);
        if (match?.[1]) {
            videoUrl = match[1];
            console.log(`[MovieBoxOnline] Found via src attribute`);
        }
        
        // Fallback: look for full hakunaymatata URL anywhere  
        if (!videoUrl) {
            match = html.match(/(https:\/\/bcdnxw\.hakunaymatata\.com[^"'<>\s]*\.mp4[^"'<>\s]*)/i);
            if (match?.[1]) {
                videoUrl = match[1];
                console.log(`[MovieBoxOnline] Found via full URL pattern`);
            }
        }
        
        if (!videoUrl) {
            // Log first 500 chars to help debug
            const sample = html.substring(0, 500);
            console.log(`[MovieBoxOnline] No hakunaymatata URL in page (${html.length} bytes)`);
            console.log(`[MovieBoxOnline] Sample: ${sample.substring(0, 200)}`);
            throw new Error('No video URL found');
        }
        
        // Handle HTML entities (including &amp;)
        videoUrl = videoUrl.replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"');



        
        console.log(`[MovieBoxOnline] Found video URL: ${videoUrl.substring(0, 100)}...`);
        
        // Ensure absolute URL
        if (!videoUrl.startsWith('http')) {
            videoUrl = videoUrl.startsWith('/') ? BASE + videoUrl : BASE + '/' + videoUrl;
        }
        
        return {
            url: videoUrl,
            headers: {
                'Referer': BASE,
                'Origin': BASE,
            },
        };
    } catch (error) {
        console.log(`[MovieBoxOnline] Error: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
