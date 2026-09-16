import { USER_AGENT } from '../utils/helpers.js';

const API_BASE = 'https://api.wecollege.net';
const REFERER = 'https://www.movy.bz/';
const ORIGIN = 'https://www.movy.bz';
const MAGIC = [109, 118, 109, 49];

const SERVERS = [
    { endpoint: 'miami', name: 'Miami', note: 'Original audio (Up to 4K)' },
    { endpoint: 'seattle', name: 'Seattle', note: 'Original audio' },
    { endpoint: 'denver', name: 'Denver', note: 'Original audio' },
    { endpoint: 'chicago', name: 'Chicago', note: 'Original audio' },
    { endpoint: 'dallas', name: 'Dallas', note: 'Original audio' },
    { endpoint: 'atlanta', name: 'Atlanta', note: 'Original audio' },
    { endpoint: 'houston', name: 'Houston', note: 'Original audio' },
    { endpoint: 'austin', name: 'Austin', note: 'Original audio' },
    { endpoint: 'boston', name: 'Boston', note: 'Original audio' },
    { endpoint: 'munich', name: 'Munich', note: 'German audio', extra: 'language=german' },
    { endpoint: 'berlin', name: 'Berlin', note: 'German audio' },
    { endpoint: 'paris', name: 'Paris', note: 'French audio' },
    { endpoint: 'delhi', name: 'Delhi', note: 'Hindi audio' },
    { endpoint: 'cancun', name: 'Cancun', note: 'Spanish audio' },
];

const seedCache = new Map();

function _l(e) {
    let v = e >>> 0;
    v = (v ^ (v >>> 16)) >>> 0;
    v = Math.imul(v, 0x85ebca6b) >>> 0;
    v = (v ^ (v >>> 13)) >>> 0;
    v = Math.imul(v, 0xc2b2ae35) >>> 0;
    return (v ^ (v >>> 16)) >>> 0;
}

function _u(e, t) {
    const shift = t & 31;
    if (shift === 0) return e >>> 0;
    return (((e << shift) >>> 0) | (e >>> (32 - shift))) >>> 0;
}

function _fnv1a(str) {
    let t = 0x811c9dc5 >>> 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        t = Math.imul((t ^ code) >>> 0, 0x1000193) >>> 0;
    }
    return _l(t);
}

function _initKeyState(seed, tmdbId) {
    const s = new Array(61).fill(0);
    const isSet = new Array(61).fill(false);
    const idVal = ((tmdbId >>> 0) ^ 0x9e3779b9) >>> 0;
    let r = _l((_fnv1a(seed) ^ _l(idVal)) >>> 0);

    for (let e = 0; e < 8; e++) {
        const t = r % 61;
        r = _u((r + 0x9e3779b9) >>> 0, 7 + (7 & e));
        s[t] = (r ^ _l(r)) >>> 0;
        isSet[t] = true;
        r = _l((r + t) >>> 0);
    }

    const acc = _l((0xa5a5a5a5 ^ r) >>> 0);
    return { s, isSet, acc };
}

function _nextKeystreamWord(state, t) {
    const r = state.s;
    let nState = state.acc;
    const i = nState % 61;
    const d = state.isSet[i] ? r[i] : 0;
    const c = Math.imul((t + 1) >>> 0, 0x9e3779b9) >>> 0;
    const a = nState;
    const sVal = (d ^ c) >>> 0;
    const h = state.isSet[i] ? ((a | sVal) >>> 0) : ((a ^ sVal) >>> 0);
    const term1 = _u((h + nState) >>> 0, 31 & i);
    const term2 = _u(nState, 31 & (i * 7));
    nState = _l((((term1 ^ term2) >>> 0) + 0x9e3779b9) >>> 0);
    r[i] = nState;
    state.isSet[i] = true;
    state.acc = nState;
    return nState >>> 0;
}

function _generateKeyStream(seed, tmdbId, len) {
    const state = _initKeyState(seed, tmdbId);
    const out = new Uint8Array(len);
    let wordIdx = 0;
    let byteIdx = 0;

    while (byteIdx < len) {
        const word = _nextKeystreamWord(state, wordIdx++);
        out[byteIdx++] = word & 0xFF;
        if (byteIdx < len) out[byteIdx++] = (word >>> 8) & 0xFF;
        if (byteIdx < len) out[byteIdx++] = (word >>> 16) & 0xFF;
        if (byteIdx < len) out[byteIdx++] = (word >>> 24) & 0xFF;
    }
    return out;
}

function decrypt(cipherB64, seed, tmdbId) {
    try {
        let normalized = cipherB64.replace(/-/g, '+').replace(/_/g, '/');
        while (normalized.length % 4 !== 0) normalized += '=';
        const cipherBytes = Buffer.from(normalized, 'base64');
        if (cipherBytes.length <= MAGIC.length) return null;

        const ks = _generateKeyStream(seed, tmdbId, cipherBytes.length);
        const decrypted = new Uint8Array(cipherBytes.length);
        for (let i = 0; i < cipherBytes.length; i++) {
            decrypted[i] = cipherBytes[i] ^ ks[i];
        }

        for (let k = 0; k < MAGIC.length; k++) {
            if (decrypted[k] !== MAGIC[k]) return null;
        }

        return Buffer.from(decrypted.subarray(MAGIC.length)).toString('utf8');
    } catch {
        return null;
    }
}

async function getSeed(tmdbId, ua) {
    const now = Date.now();
    const cached = seedCache.get(tmdbId);
    if (cached && cached.expiresAt > now + 5000) {
        return cached.seed;
    }

    try {
        const res = await fetch(`${API_BASE}/seed?mediaId=${tmdbId}`, {
            headers: {
                'User-Agent': ua,
                Referer: REFERER,
                Origin: ORIGIN,
            },
            signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
            const data = await res.json();
            const seed = data?.seed ? String(data.seed) : '';
            const ttlMs = typeof data?.ttlMs === 'number' ? data.ttlMs : 30000;
            if (seed) {
                seedCache.set(tmdbId, { seed, expiresAt: now + ttlMs });
                return seed;
            }
        }
    } catch { }

    return null;
}

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

function formatQuality(raw) {
    const lower = String(raw).toLowerCase();
    if (lower.includes('2160') || lower.includes('4k')) return '4K';
    if (lower.includes('1080')) return '1080p';
    if (lower.includes('720')) return '720p';
    if (lower.includes('480')) return '480p';
    if (lower.includes('360')) return '360p';
    if (raw) return String(raw);
    return 'Auto';
}

export async function getStream({ id, s, e, sdk }) {
    const isTv = Boolean(s && e);
    const mediaType = isTv ? 'tv' : 'movie';
    const tmdbId = parseInt(id, 10);
    const ua = USER_AGENT;

    const details = await resolveDetails(sdk, id, isTv);
    const title = details?.title || String(id);
    const year = details?.year;
    const imdbId = details?.imdbId;

    const seed = await getSeed(tmdbId, ua);
    if (!seed) return null;

    const params = new URLSearchParams({
        title,
        mediaType,
        tmdbId: String(tmdbId),
        enc: '2',
        seed,
    });

    if (year) params.set('year', String(year));
    if (isTv) {
        if (s) params.set('seasonId', String(s));
        if (e) params.set('episodeId', String(e));
    }
    if (imdbId) params.set('imdbId', imdbId);

    const baseQuery = params.toString();
    const seenUrls = new Set();
    const allUrls = [];

    const defaultHeaders = {
        'User-Agent': ua,
        Referer: REFERER,
        Origin: ORIGIN,
    };

    const tasks = SERVERS.map(async (server) => {
        let fullUrl = `${API_BASE}/${server.endpoint}/sources?${baseQuery}`;
        if (server.extra) fullUrl += `&${server.extra}`;

        try {
            const res = await fetch(fullUrl, {
                headers: defaultHeaders,
                signal: AbortSignal.timeout(8000),
            });

            if (!res.ok) return;
            const encText = (await res.text()).trim();
            if (!encText || encText.startsWith('<')) return;

            const decJsonStr = decrypt(encText, seed, tmdbId);
            if (!decJsonStr) return;

            const parsed = JSON.parse(decJsonStr);
            if (!Array.isArray(parsed?.sources)) return;

            for (const src of parsed.sources) {
                if (!src || typeof src !== 'object') continue;
                const streamUrl = String(src.url || '').trim();
                if (!streamUrl || seenUrls.has(streamUrl)) continue;

                seenUrls.add(streamUrl);

                const cleanQuality = formatQuality(src.quality || 'Auto');
                const isSpecificAudio = server.note.toLowerCase().includes('audio') && !server.note.toLowerCase().includes('original');
                const langLabel = isSpecificAudio ? server.note.split(' ')[0] : '';
                const label = isSpecificAudio
                    ? `${server.name} (${langLabel}) · ${cleanQuality}`
                    : `${server.name} · ${cleanQuality}`;

                allUrls.push({
                    url: streamUrl,
                    label,
                    headers: {
                        'User-Agent': ua,
                        Referer: REFERER,
                    },
                });
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