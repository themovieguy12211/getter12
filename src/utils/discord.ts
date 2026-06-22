import { env } from "./env";

type EmbedPayload = {
  media_type: "movie" | "tv";
  media_id: number;
  season?: number | null;
  episode?: number | null;
  title: string;
  embed_url: string;
};

export async function sendNewEmbedNotification(payload: EmbedPayload) {
  const webhookUrl =
    payload.media_type === "movie" ? env.DISCORD_WEBHOOK_MOVIES : env.DISCORD_WEBHOOK_TV;

  if (!webhookUrl) return;

  const tmdbToken = env.NEXT_PUBLIC_TMDB_ACCESS_TOKEN;
  let tmdbTitle = "";
  let tmdbOverview = "";
  let tmdbPoster = "";
  let tmdbYear = "";

  try {
    if (payload.media_type === "movie") {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${payload.media_id}`, {
        headers: { Authorization: `Bearer ${tmdbToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        tmdbTitle = data.title ?? "";
        tmdbOverview = data.overview ?? "";
        tmdbPoster = data.poster_path
          ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
          : "";
        tmdbYear = data.release_date ? data.release_date.slice(0, 4) : "";
      }
    } else {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${payload.media_id}`, {
        headers: { Authorization: `Bearer ${tmdbToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        tmdbTitle = data.name ?? "";
        tmdbOverview = data.overview ?? "";
        tmdbPoster = data.poster_path
          ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
          : "";
        tmdbYear = data.first_air_date ? data.first_air_date.slice(0, 4) : "";
      }
    }
  } catch {
    // TMDB fetch failed, send notification without details
  }

  const displayTitle = tmdbTitle || `TMDB #${payload.media_id}`;
  const episodeInfo =
    payload.media_type === "tv" && payload.season && payload.episode
      ? `Season ${payload.season}, Episode ${payload.episode}`
      : null;

  const embed = {
    title:
      payload.media_type === "movie"
        ? `🎬 New Movie Added: ${displayTitle} (${tmdbYear})`
        : `📺 New Episode Added: ${displayTitle} (${tmdbYear})`,
    description: [
      episodeInfo ? `**${episodeInfo}**` : null,
      tmdbOverview ? tmdbOverview.slice(0, 200) + (tmdbOverview.length > 200 ? "..." : "") : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    color: payload.media_type === "movie" ? 0x3b82f6 : 0x10b981,
    thumbnail: tmdbPoster ? { url: tmdbPoster } : undefined,
    fields: [
      { name: "Source", value: payload.title, inline: true },
      { name: "TMDB ID", value: String(payload.media_id), inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
}
