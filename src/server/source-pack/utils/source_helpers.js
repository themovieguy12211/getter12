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
