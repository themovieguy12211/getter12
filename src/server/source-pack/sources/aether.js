'use strict';

const HOSTS = [
    'https://tiki.aether.bar',
    'https://cow.aether.bar',
    'https://gallic.aether.bar',
];

async function tryHost(host, path) {
    try {
        const url = `${host}${path}`;
        const res = await fetch(url, {
            headers: {
                'Referer': host + '/',
                'Origin': host,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!res.ok) return null;

        const data = await res.json();
        if (!data?.stream) return null;

        return {
            url: data.stream,
            host,
        };
    } catch {
        return null;
    }
}

async function getStream(id, s, e, title) {
    const path = s && e
        ? `/tv/${id}/${s}/${e}`
        : `/movie/${id}`;

    // Try all hosts, return first success
    for (const host of HOSTS) {
        const result = await tryHost(host, path);
        if (result) {
            return {
                url: result.url,
                headers: {
                    'Referer': result.host + '/',
                    'Origin': result.host,
                },
            };
        }
    }

    return null;
}

async function getSources(id, s, e, title) {
    const stream = await getStream(id, s, e, title);
    return stream ? [stream.url] : [];
}

async function proxyStream(url, res, { fetchUpstream, rewriteM3u8 }) {
    try {
        const host = HOSTS.find(h => url.startsWith(h)) || HOSTS[0];
        const headers = {
            'Referer': host + '/',
            'Origin': host,
        };

        const upstream = await fetch(url, 0, headers);

        if (!upstream) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            return res.end('No upstream');
        }

        const ct = (upstream.headers?.['content-type'] || '').toLowerCase();
        const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u8') || /\.m3u8?(\?|$)/i.test(url);

        if (isM3u8) {
            const chunks = [];
            for await (const c of upstream) {
                chunks.push(c);
            }
            const body = Buffer.concat(chunks).toString('utf8');
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.end(rewriteM3u8(body, url, '&aether=1'));
        }

        res.setHeader('Content-Type', ct || 'application/octet-stream');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        upstream.pipe(res);
    } catch (err) {
        if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Proxy failed');
        }
    }
}

const VERIFY_HEADERS = {
    'Referer': 'https://tiki.aether.bar/',
    'Origin': 'https://tiki.aether.bar',
};

export { getStream, getSources, proxyStream, VERIFY_HEADERS };

export const SKIP_VERIFY = false;
