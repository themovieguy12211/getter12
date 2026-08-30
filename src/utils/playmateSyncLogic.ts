import { createAdminClient } from "@/utils/supabase/admin";

const PLAYMATE_API = "https://playmate.to/api";
const TMDB_API = "https://api.themoviedb.org/3";

interface ParsedFilename {
  title: string;
  year: number | null;
  season: number | null;
  episode: number | null;
  type: "movie" | "tv";
}

export function parseFilename(raw: string): ParsedFilename {
  // Strip extension
  let name = raw.replace(/\.[a-z0-9]{2,4}$/i, "");

  // Strip everything from quality/codec tags onwards
  name = name
    .replace(/\b(2160p|1080p|720p|480p|360p|4k|uhd|hdr10|hdr|sdr|bluray|blu-ray|bdrip|webrip|web-dl|webdl|web\b|hdtv|dvdrip|dvdscr|telesync|ts\b|x264|x265|h264|h265|hevc|avc|aac|ac3|dts|remux|proper|repack|extended|theatrical|directors\.cut|unrated|multi|dubbed|atvp|amzn|nf|hmax|dsnp|10bit)\b.*/i, "")
    .trim();

  // SxxExx — also handles "S03E06 Episode Title" after the code (space or dot separated)
  const seMatch =
    name.match(/[._\s-]S(\d{1,2})E(\d{1,3})/i) ??
    name.match(/^S(\d{1,2})E(\d{1,3})/i) ??       // starts with SxxExx
    name.match(/[._\s-](\d{1,2})x(\d{1,3})\b/i);

  if (seMatch) {
    const title = name
      .slice(0, seMatch.index! + (seMatch[0].startsWith("S") ? 0 : 0))
      .replace(/[._]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      // strip the SxxExx itself if it crept into the title
      .replace(/\s*S\d{1,2}E\d{1,3}.*/i, "")
      .trim();

    return {
      title,
      year: null,
      season: parseInt(seMatch[1], 10),
      episode: parseInt(seMatch[2], 10),
      type: "tv",
    };
  }

  // Year-based movie detection
  const yearMatch = name.match(/[._\s(](\d{4})(?:[._\s)]|$)/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  const title = (yearMatch ? name.slice(0, yearMatch.index!) : name)
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { title, year, season: null, episode: null, type: "movie" };
}

async function searchTmdb(parsed: ParsedFilename, tmdbToken: string) {
  const endpoint = parsed.type === "tv" ? `${TMDB_API}/search/tv` : `${TMDB_API}/search/movie`;
  const params = new URLSearchParams({ query: parsed.title, page: "1" });
  if (parsed.year) params.set("year", String(parsed.year));

  const res = await fetch(`${endpoint}?${params}`, {
    headers: { Authorization: `Bearer ${tmdbToken}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const result = data.results?.[0];
  if (!result) return null;
  return { id: result.id as number, title: (result.title ?? result.name ?? parsed.title) as string };
}

async function fetchAllPlaymateFiles(apiKey: string) {
  const files: any[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${PLAYMATE_API}/file/list?key=${apiKey}&page=${page}&per_page=100`,
      { signal: AbortSignal.timeout(10000) },
    );

    if (!res.ok) {
      throw new Error(`Playmate API error: HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.status !== 200) {
      throw new Error(`Playmate API error: ${data.msg ?? `status ${data.status}`}`);
    }

    const batch: any[] = data.result ?? [];
    if (!batch.length) break;
    files.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return files;
}

export async function runPlaymateSync(targetCodes?: string[]) {
  const apiKey = process.env.PLAYMATE_API_KEY;
  const tmdbToken = process.env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
  if (!apiKey) throw new Error("PLAYMATE_API_KEY is not set in environment variables");
  if (!tmdbToken) throw new Error("NEXT_PUBLIC_TMDB_ACCESS_TOKEN is not set");

  const adminSupabase = createAdminClient();
  const files = await fetchAllPlaymateFiles(apiKey);

  const { data: existing } = await adminSupabase
    .from("custom_embeds" as any)
    .select("embed_url")
    .ilike("embed_url", "%playmate.to%");

  const savedCodes = new Set(
    (existing ?? []).map((e: any) => {
      const match = e.embed_url?.match(/embed\/([a-zA-Z0-9]+)/);
      return match?.[1] ?? "";
    }),
  );

  const toProcess = files.filter(
    (f) =>
      f.canplay === 1 &&
      f.state === "active" &&
      !savedCodes.has(f.filecode) &&
      (!targetCodes || targetCodes.includes(f.filecode)),
  );

  const results: {
    filecode: string;
    name: string;
    status: string;
    embed_id?: number;
    tmdb_id?: number;
    reason?: string;
  }[] = [];

  for (const file of toProcess) {
    const parsed = parseFilename(file.name);

    if (!parsed.title) {
      results.push({ filecode: file.filecode, name: file.name, status: "skipped", reason: "could not parse title" });
      continue;
    }

    const match = await searchTmdb(parsed, tmdbToken);
    if (!match) {
      results.push({ filecode: file.filecode, name: file.name, status: "no_match", reason: `no TMDB result for "${parsed.title}"` });
      continue;
    }

    const embedUrl = `https://playmate.to/embed/${file.filecode}`;
    const { data: inserted, error } = await adminSupabase
      .from("custom_embeds" as any)
      .insert({
        media_type: parsed.type,
        media_id: match.id,
        season: parsed.season ?? null,
        episode: parsed.episode ?? null,
        title: match.title,
        embed_url: embedUrl,
        active: true,
      })
      .select("id")
      .single();

    if (error) {
      results.push({ filecode: file.filecode, name: file.name, status: "error", reason: error.message });
    } else {
      results.push({ filecode: file.filecode, name: file.name, status: "created", embed_id: (inserted as any)?.id, tmdb_id: match.id });
    }
  }

  return {
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status !== "created").length,
    results,
  };
}

export async function getPlaymatePending() {
  const apiKey = process.env.PLAYMATE_API_KEY;
  if (!apiKey) throw new Error("PLAYMATE_API_KEY is not set in environment variables");

  const adminSupabase = createAdminClient();
  const files = await fetchAllPlaymateFiles(apiKey);

  const { data: existing } = await adminSupabase
    .from("custom_embeds" as any)
    .select("embed_url")
    .ilike("embed_url", "%playmate.to%");

  const savedCodes = new Set(
    (existing ?? []).map((e: any) => {
      const match = e.embed_url?.match(/embed\/([a-zA-Z0-9]+)/);
      return match?.[1] ?? "";
    }),
  );

  const pending = files
    .filter((f) => f.canplay === 1 && f.state === "active" && !savedCodes.has(f.filecode))
    .map((f) => ({ filecode: f.filecode, name: f.name, uploaded: f.uploaded, parsed: parseFilename(f.name) }));

  return { total: files.length, pending: pending.length, files: pending };
}
