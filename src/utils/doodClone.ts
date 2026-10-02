// PrimeWire -> Dood -> your Dood account, fully automatic.
//
// Env vars required:
//   DOOD_API_KEY   = your Doodstream API key (Dood -> Settings -> API Key)
//   TMDB_API_KEY   = already used by the source-pack

const PRIMEWIRE = "https://primewire.pw";
const DOOD_API = "https://doodapi.com/api";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function doodKey(): string {
  const k = process.env.DOOD_API_KEY;
  if (!k) throw new Error("DOOD_API_KEY env var is not set");
  return k;
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Extract the Dood file code from any dood URL (dood.watch/d/xxx, playmogo.com/d/xxx, etc.) */
export function doodFileCode(url: string): string | null {
  return url.match(/\/(?:d|e|f)\/([a-zA-Z0-9]+)/i)?.[1] ?? null;
}

/** Clone a Dood file (by code) into your account. Returns the API response. */
export async function cloneDoodFile(fileCode: string, folderId?: string) {
  const p = new URLSearchParams({ key: doodKey(), file_code: fileCode });
  if (folderId) p.set("fld_id", folderId);
  const res = await fetch(`${DOOD_API}/file/clone?${p}`, { signal: AbortSignal.timeout(20_000) });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || String(json.status) !== "200") {
    throw new Error(`Dood clone failed: ${JSON.stringify(json)}`);
  }
  return json;
}

/** TMDB id -> { title, imdbId } */
async function tmdbMeta(tmdbId: string, type: "movie" | "tv" = "movie") {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY env var is not set");
  const res = await fetch(
    `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${key}&append_to_response=external_ids`,
    { signal: AbortSignal.timeout(10_000) },
  );
  const d = (await res.json()) as {
    title?: string;
    name?: string;
    imdb_id?: string;
    external_ids?: { imdb_id?: string };
  };
  return {
    title: (d.title || d.name || "").trim(),
    imdbId: d.external_ids?.imdb_id || d.imdb_id || null,
  };
}

/** IMDb id / title -> PrimeWire movie page URL (via PrimeWire search). */
async function primewireFindMovie(imdbId: string | null, title: string): Promise<string> {
  const queries = [imdbId, title].filter(Boolean) as string[];
  for (const q of queries) {
    try {
      const html = await getText(`${PRIMEWIRE}/filter?s=${encodeURIComponent(q)}`);
      const m = html.match(/href="(\/movie\/\d+-[^"]+)"/i);
      if (m) return `${PRIMEWIRE}${m[1]}`;
    } catch {
      // try next query
    }
  }
  throw new Error(`PrimeWire: no movie found for "${title}"`);
}

/** PrimeWire movie page -> the dood.watch "gos" link. */
async function primewireDoodGos(movieUrl: string): Promise<string> {
  const html = await getText(movieUrl);
  const blocks = html.split(/<table[^>]*class="movie_version"/i).slice(1);
  for (const block of blocks) {
    const isDood = /host_id="42"/i.test(block) || /dood/i.test(block);
    if (!isDood) continue;
    const gos = block.match(/href="(\/links\/gos\/[^"]+)"/i)?.[1];
    if (gos) return `${PRIMEWIRE}${gos}`;
  }
  throw new Error("PrimeWire: no dood link on this page");
}

/** Resolve a /links/gos/<hash> link to the dood.watch URL (meta-refresh or JS redirect). */
async function resolveGos(gosUrl: string): Promise<string> {
  const html = await getText(gosUrl);
  const patterns: RegExp[] = [
    /url=([^"'>\s]+)/i,
    /window\.location(?:\s*\.href)?\s*=\s*['"]([^'"]+)['"]/i,
    /location\.replace\(['"]([^'"]+)['"]\)/i,
    /href="(https?:\/\/[^"]*dood[^"]*)"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  const anyDood = html.match(/https?:\/\/[^"'\s>]+dood[^"'\s>]*/i);
  if (anyDood) return anyDood[0];
  throw new Error("PrimeWire: could not resolve gos redirect to a dood URL");
}

export interface CloneResult {
  source: string;
  fileCode: string;
  result: Record<string, unknown>;
}

/** Full automation: TMDB id -> clone the Dood copy into your account. */
export async function cloneFromTmdb(
  tmdbId: string,
  options?: { folderId?: string; type?: "movie" | "tv" },
): Promise<CloneResult> {
  const meta = await tmdbMeta(tmdbId, options?.type ?? "movie");
  const movieUrl = await primewireFindMovie(meta.imdbId, meta.title);
  const gosUrl = await primewireDoodGos(movieUrl);
  const doodUrl = await resolveGos(gosUrl);
  const code = doodFileCode(doodUrl);
  if (!code) throw new Error(`Could not extract dood file code from ${doodUrl}`);
  const result = await cloneDoodFile(code, options?.folderId);
  return { source: doodUrl, fileCode: code, result };
}
