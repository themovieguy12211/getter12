import { PlayersProps } from "@/types";

export type CustomEmbed = { title: string; url: string };

/**
 * Pinned order for custom embeds: "vidara" first, "dood" second, then the
 * rest in their original order. Matching is case-insensitive.
 */
const PINNED_CUSTOM_EMBED_ORDER = ["vidara", "dood"];

const sortCustomEmbeds = (embeds: CustomEmbed[]): CustomEmbed[] =>
  [...embeds].sort((a, b) => {
    const aIndex = PINNED_CUSTOM_EMBED_ORDER.findIndex((p) =>
      a.title.toLowerCase().includes(p),
    );
    const bIndex = PINNED_CUSTOM_EMBED_ORDER.findIndex((p) =>
      b.title.toLowerCase().includes(p),
    );
    const aRank = aIndex === -1 ? PINNED_CUSTOM_EMBED_ORDER.length : aIndex;
    const bRank = bIndex === -1 ? PINNED_CUSTOM_EMBED_ORDER.length : bIndex;
    return aRank - bRank;
  });

const get321MoviePlaylistUrl = (id: string | number): string => {
  const params = new URLSearchParams({
    type: "movie",
    id: String(id),
  });
  return `/api/player/vixsrc-playlist?${params.toString()}`;
};

const get321TvPlaylistUrl = (
  id: string | number,
  season: number,
  episode: number,
): string => {
  const params = new URLSearchParams({
    type: "tv",
    id: String(id),
    season: String(season),
    episode: String(episode),
  });
  return `/api/player/vixsrc-playlist?${params.toString()}`;
};





/**
 * Generates a list of movie players with their respective titles and source URLs.
 * Each player is constructed using the provided movie ID.
 *
 * @param {string | number} id - The ID of the movie to be embedded in the player URLs.
 * @param {number} [startAt] - The start position in seconds to be embedded in the player URLs. Optional.
 * @returns {PlayersProps[]} - An array of objects, each containing
 * the title of the player and the corresponding source URL.
 */
export const getMoviePlayers = (
  id: string | number,
  startAt?: number,
  piracyEmbedUrl?: string | null,
  customEmbeds?: CustomEmbed[],
): PlayersProps[] => {
  const players: PlayersProps[] = [];
  players.push(
    {
      title: "321movies",
      source: get321MoviePlaylistUrl(id),
      mode: "netflix",
      recommended: true,
      fast: true,
      ads: false,
      resumable: true,
    },
    //{
   //  title: "FMoviez",
   //  source: `https://fmoviez.online/embed/movie/${id}${startAt ? `&startAt=${startAt}` : ""}`,
   //   recommended: true,
     // fast: true,
    //  ads: true,
    // resumable: true,
  // },
    {
      title: "VidLink",
      source: `https://vidlink.pro/movie/${id}?player=jw&primaryColor=006fee&secondaryColor=a2a2a2&iconColor=eefdec&autoplay=false&startAt=${startAt || ""}`,
      recommended: true,
      fast: true,
      ads: true,
      resumable: true,
    },
    {
      title: "VidLink 2",
      source: `https://vidlink.pro/movie/${id}?primaryColor=006fee&autoplay=false&startAt=${startAt}`,
      recommended: true,
      fast: true,
      ads: true,
      resumable: true,
    },
    {
      title: "SuperEmbed",
      source: `https://multiembed.mov/?video_id=${id}&tmdb=1`,
      fast: true,
      ads: true,
    },
    {
      title: "2Embed",
      source: `https://www.2embed.cc/embed/${id}`,
      ads: true,
    },
    {
      title: "VidSrc",
      source: `https://vidsrc.to/embed/movie/${id}`,
      ads: true,
    },
    {
      title: "vueeti",
      source: `https://vumeto.xyz/embed/movie/${id}`,
      ads: true,
    },
  );
  if (piracyEmbedUrl) {
    players.push({
      title: "MixDrop",
      source: piracyEmbedUrl,
      recommended: true,
      fast: true,
      ads: true,
    });
  }
  if (customEmbeds?.length) {
    const customPlayers = sortCustomEmbeds(customEmbeds).map((embed) => ({
      title: embed.title,
      source: embed.url,
      recommended: true,
      fast: true,
      ads: false,
      resumable: false,
    }));
    return [
      ...customPlayers,
      ...players.filter((player) => player.title !== "321movies"),
    ];
  }
  return players;
};

/**
 * Generates a list of TV show players with their respective titles and source URLs.
 * Each player is constructed using the provided TV show ID, season, and episode.
 *
 * @param {string | number} id - The ID of the TV show to be embedded in the player URLs.
 * @param {string | number} [season] - The season number of the TV show episode to be embedded.
 * @param {string | number} [episode] - The episode number of the TV show episode to be embedded.
 * @param {number} [startAt] - The start position in seconds to be embedded in the player URLs. Optional.
 * @returns {PlayersProps[]} - An array of objects, each containing
 * the title of the player and the corresponding source URL.
 */
export const getTvShowPlayers = (
  id: string | number,
  season: number,
  episode: number,
  startAt?: number,
  piracyEmbedUrl?: string | null,
  customEmbeds?: CustomEmbed[],
): PlayersProps[] => {
  const players: PlayersProps[] = [];
  players.push(
    {
      title: "321movies",
      source: get321TvPlaylistUrl(id, season, episode),
      mode: "netflix",
      recommended: true,
      fast: true,
      ads: false,
      resumable: true,
    },
   // {
   //   title: "FMoviez",
   //   source: `https://fmoviez.online/embed/tv/${id}/${season}/${episode}${startAt ? `&startAt=${startAt}` : ""}`,
   //   recommended: true,
   //   fast: true,
   //   ads: true,
   //   resumable: true,
  //  },
    {
      title: "VidLink",
      source: `https://vidlink.pro/tv/${id}/${season}/${episode}?player=jw&primaryColor=f5a524&secondaryColor=a2a2a2&iconColor=eefdec&autoplay=false&startAt=${startAt || ""}`,
      recommended: true,
      fast: true,
      ads: true,
      resumable: true,
    },
    {
      title: "VidLink 2",
      source: `https://vidlink.pro/tv/${id}/${season}/${episode}?primaryColor=f5a524&autoplay=false&startAt=${startAt}`,
      recommended: true,
      fast: true,
      ads: true,
      resumable: true,
    },
    
    {
      title: "SuperEmbed",
      source: `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`,
      fast: true,
      ads: true,
    },

    {
      title: "2Embed",
      source: `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`,
      ads: true,
    },
    {
      title: "VidSrc",
      source: `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`,
      ads: true,
    },
     {
      title: "vueeti",
      source: `https://vumeto.xyz/embed/tv/${id}/${season}/${episode}`,
      ads: true,
    },
   
  );
  if (piracyEmbedUrl) {
    players.push({
      title: "MixDrop",
      source: piracyEmbedUrl,
      recommended: true,
      fast: true,
      ads: true,
    });
  }
  if (customEmbeds?.length) {
    const customPlayers = sortCustomEmbeds(customEmbeds).map((embed) => ({
      title: embed.title,
      source: embed.url,
      recommended: true,
      fast: true,
      ads: false,
      resumable: false,
    }));
    return [
      ...customPlayers,
      ...players.filter((player) => player.title !== "321movies"),
    ];
  }
  return players;
};
