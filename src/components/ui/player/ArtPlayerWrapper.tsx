"use client";

import React, { useEffect, useRef, useState } from "react";
import ArtPlayer from "artplayer";
import artplayerPluginHlsControl from "artplayer-plugin-hls-control";
import Hls from "hls.js";
import { decodePlayerStreamUrl } from "@/utils/playerUrlCodec";

interface ArtPlayerWrapperProps {
  playlistUrl: string;
  mediaId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  startAt?: number;
  className?: string;
  onFatalError?: () => void;
  onNextEpisode?: (season: number, episode: number) => void;
}

interface ExternalSubtitleTrack {
  url: string;
  lang: string;
  label: string;
  format: string;
}

interface Segment {
  type: "intro" | "recap" | "credits" | "preview";
  start: number;
  end: number;
  label: string;
}

interface SegmentData {
  intro?: Array<{ start_ms?: number; end_ms?: number }>;
  recap?: Array<{ start_ms?: number; end_ms?: number }>;
  credits?: Array<{ start_ms?: number; end_ms?: number }>;
  preview?: Array<{ start_ms?: number; end_ms?: number }>;
}

export const ArtPlayerWrapper: React.FC<ArtPlayerWrapperProps> = ({
  playlistUrl,
  mediaId,
  mediaType,
  season,
  episode,
  startAt,
  className = "",
  onFatalError,
  onNextEpisode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<ArtPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Starting...");
  const [loadError, setLoadError] = useState<string | null>(null);



  useEffect(() => {
    let cancelled = false;

    const initPlayer = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        setLoadingStatus("Fetching playlist...");
        const response = await fetch(playlistUrl);
        if (!response.ok) {
          throw new Error(`Failed to load: ${response.status}`);
        }
        const data = await response.json();
        if (cancelled) return;

        if (!data.playlist || data.playlist.length === 0) {
          throw new Error("No playlist found");
        }

        // Collect all sources
        const allSources: any[] = [];
        data.playlist.forEach((item: any) => {
          if (item.sources && Array.isArray(item.sources)) {
            allSources.push(...item.sources);
          }
        });
        if (allSources.length === 0) {
          throw new Error("No sources available");
        }

        // Decode sources
        setLoadingStatus("Decoding sources...");
        const decoded = allSources.map((source: any, idx: number) => ({
          idx,
          default: source.default || idx === 0,
          html: source.label || source.provider || `Source ${idx + 1}`,
          url: decodePlayerStreamUrl(source.file || source.url),
        }));
        if (decoded.length === 0) throw new Error("No sources available");

        const qualities = decoded.map((s, i) => ({
          default: i === 0,
          html: s.html,
          url: s.url,
        }));

        const defaultSource = qualities.find((q) => q.default) || qualities[0];
        const isMp4 = defaultSource.url.includes("/mp4-proxy") || /\.mp4(?:\?|$)/i.test(defaultSource.url);

        // Fetch external subtitles
        setLoadingStatus("Loading subtitles...");
        const subtitleTracks: ExternalSubtitleTrack[] = [];
        try {
          const subParams = new URLSearchParams({
            id: String(mediaId),
            type: mediaType === "movie" ? "movie" : "tv",
          });
          if (mediaType === "tv" && season) subParams.set("season", String(season));
          if (mediaType === "tv" && episode) subParams.set("episode", String(episode));

          const subRes = await fetch(`/api/player/subtitles?${subParams.toString()}`);
          const subData: { tracks?: ExternalSubtitleTrack[] } = await subRes.json();
          if (!cancelled && Array.isArray(subData?.tracks)) {
            subtitleTracks.push(...subData.tracks);
          }
        } catch {
          // Subtitles are optional
        }

        if (cancelled) return;

        // Build subtitle setting if tracks exist
        const subtitleSetting = subtitleTracks.length > 0 ? {
          html: "Subtitles",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" height="18"><path fill="#fff" d="M0 96C0 60.7 28.7 32 64 32H512c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM200 208c-22.1 0-40 17.9-40 40s17.9 40 40 40h48c0 9.4 1.4 18.3 4.1 26.8c6.5 20.4 25.5 37.2 48.1 37.2c27.9 0 50.4-22.6 50.4-50.4V296c0-22.1-17.9-40-40-40H200zm142 56v.1l0-.1zm-8 0c0 0 0 0 0 0H376c22.1 0 40 17.9 40 40s-17.9 40-40 40c-22.6 0-41.6-16.8-48.1-37.2c-2.7-8.5-4.1-17.4-4.1-26.8h0zm-160 88H200c-61.9 0-112-50.1-112-112s50.1-112 112-112h56c9.4 0 18.3 1.4 26.8 4.1c27.6 8.8 47.4 31.5 51.6 59.3c2 13.5-7.3 26.6-20.8 28.6s-26.6-7.3-28.6-20.8c-.7-4.9-3-9.3-6.3-12.7c-5.1-5.3-12.2-8.5-19.9-8.5H200c-30.9 0-56 25.1-56 56s25.1 56 56 56h55.3c9.4 0 18.3-1.4 26.8-4.1c13.5-4.3 28.3 3.1 32.6 16.6s-3.1 28.3-16.6 32.6c-14.6 4.7-30 7.1-46 6.8H342zM518.6 336c0 22.1-17.9 40-40 40c-22.6 0-41.6-16.8-48.1-37.2c-2.7-8.5-4.1-17.4-4.1-26.8H376c-22.1 0-40-17.9-40-40s17.9-40 40-40h50.4c0-9.4-1.4-18.3-4.1-26.8c-6.5-20.4-25.5-37.2-48.1-37.2c-27.9 0-50.4 22.6-50.4 50.4V264c0 22.1 17.9 40 40 40h88c8.5 0 16.6-2.3 23.5-6.3c2.4-3.9 8.2-1.8 6.5 2.4c-6.5 20.4-20.7 37.6-39.5 46.9c-8.2 4-17.2 6.2-26.6 6.9c2.7-.1 5.4-.2 8.1-.2c22.1 0 40 17.9 40 40z"/></svg>',
          tooltip: "Off",
          selector: [
            { html: "Off", default: true },
            ...subtitleTracks.map((track) => ({
              html: track.label,
              default: false,
            })),
          ],
          onSelect: function (this: ArtPlayer, item: any) {
            if (item.html === "Off") {
              const art = this as any;
              const $track = art.template?.$track;
              if ($track) {
                $track.track.mode = "disabled";
                $track.remove();
                art.template.$track = null;
              }
              const $subtitle = art.template?.$subtitle;
              if ($subtitle) $subtitle.innerHTML = "";
              if (art.subtitle) art.subtitle.url = null;
            } else {
              const track = subtitleTracks.find((t) => t.label === item.html);
              if (track) {
                const url = track.url.startsWith("http")
                  ? `/api/player/subtitle-proxy?url=${encodeURIComponent(track.url)}`
                  : track.url;
                (this as any).subtitle.switch(url, { name: track.label });
              }
            }
            return item.html;
          },
        } : undefined;

        const settings: any[] = [];
        if (subtitleSetting) settings.push(subtitleSetting);

        // Create ArtPlayer instance
        setLoadingStatus("Starting player...");
        const willSeek = typeof startAt === "number" && isFinite(startAt) && startAt > 0;
        const art = new ArtPlayer(
          {
            container: containerRef.current!,
            url: defaultSource.url,
            ...(isMp4 ? {} : { type: "m3u8" as const }),
            quality: qualities,
            settings: settings,
            subtitleOffset: true,
            setting: true,
            fullscreen: true,
            fullscreenWeb: true,
            autoplay: true,
            moreVideoAttr: { preload: "auto" } as any,
            volume: 0.8,
            playbackRate: true,
            screenshot: false,
            flip: true,
            aspectRatio: true,
            hotkey: true,
            pip: true,
            theme: "#e50914",
            plugins: isMp4 ? [] : [
              artplayerPluginHlsControl({
                quality: { control: false, setting: true, title: "Quality" },
              }),
            ],
            customType: {
              m3u8: function (this: ArtPlayer, video: HTMLVideoElement, url: string) {
                const existing = (this as any).hls as Hls | undefined;
                if (existing) existing.destroy();
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(video);
                (this as any).hls = hls;
              },
            },
          },
          willSeek
            ? (art: ArtPlayer) => {
                let seeked = false;
                const doSeek = () => {
                  if (seeked) return;
                  seeked = true;
                  art.seek = startAt!;
                };
                if (art.video && isFinite(art.video.duration) && art.video.duration > 0) {
                  doSeek();
                }
                art.on("video:loadedmetadata", doSeek);
              }
            : undefined,
        );

        artRef.current = art;
        setLoading(false);

        // ── Handle source errors ─────────────────────────────────────────
        let errorRetries = 0;
        art.on("error", () => {
          const qualities = art.quality;
          const currentIdx = qualities.findIndex((q: any) => q.url === art.url);
          if (currentIdx >= 0 && currentIdx < qualities.length - 1 && errorRetries < 3) {
            errorRetries++;
            const next = qualities[currentIdx + 1];
            art.notice.show = `Source unavailable, trying ${next.html}...`;
            art.switchQuality(next.url);
          }
        });

        // ── Fetch and setup skip segments ────────────────────────────────
        setLoadingStatus("Loading segments...");
        let skipSegments: Segment[] = [];
        let activeSegment: Segment | null = null;
        let skipBtn: HTMLButtonElement | null = null;
        let skipLabel: HTMLSpanElement | null = null;

        const fetchSegments = async () => {
          try {
            const apiUrl = new URL("https://api.theintrodb.org/v3/media");
            apiUrl.searchParams.set("tmdb_id", String(mediaId));
            if (mediaType === "tv" && season != null && episode != null) {
              apiUrl.searchParams.set("season", String(season));
              apiUrl.searchParams.set("episode", String(episode));
            }
            if (art.video && isFinite(art.video.duration)) {
              apiUrl.searchParams.set("duration_ms", Math.round(art.video.duration * 1000).toString());
            }

            const response = await fetch(apiUrl.toString(), { signal: AbortSignal.timeout(5000) });
            if (!response.ok) throw new Error("Failed to fetch segments");

            const data: SegmentData = await response.json();

            // Parse all segment types
            const segTypeConfig = {
              intro: { label: "Skip Intro", icon: "🎬" },
              recap: { label: "Skip Recap", icon: "⏮️" },
              credits: { label: "Skip Credits", icon: "🎞️" },
              preview: { label: "Skip Preview", icon: "▶️" },
            };

            (["intro", "recap", "credits", "preview"] as const).forEach((type) => {
              const arr = data[type];
              if (arr && Array.isArray(arr)) {
                arr.forEach((seg) => {
                  skipSegments.push({
                    type,
                    start: (seg.start_ms ?? 0) / 1000,
                    end: (seg.end_ms ?? art.video.duration) / 1000,
                    label: segTypeConfig[type].label,
                  });
                });
              }
            });
          } catch {
            // Segments are optional
          }
        };

        await fetchSegments();

        // Create skip button if segments exist
        if (skipSegments.length > 0) {
          skipBtn = document.createElement("button");
          skipLabel = document.createElement("span");
          skipLabel.textContent = "Skip";
          skipBtn.appendChild(skipLabel);
          skipBtn.className =
            "art-skip-segment absolute right-4 bottom-24 z-50 rounded border-2 border-white/70 bg-black/60 px-5 py-2 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white hover:text-black pointer-events-auto";
          skipBtn.style.display = "none";
          containerRef.current?.appendChild(skipBtn);

          skipBtn.onclick = () => {
            if (activeSegment && art.video) {
              art.seek = activeSegment.end;
              skipBtn!.style.display = "none";
              activeSegment = null;
            }
          };

          art.on("video:timeupdate", () => {
            if (!skipSegments.length) return;
            const ct = art.currentTime;
            let current: Segment | null = null;

            for (const seg of skipSegments) {
              if (ct >= seg.start && ct < seg.end) {
                current = seg;
                break;
              }
            }

            if (current !== activeSegment) {
              activeSegment = current;
              if (current) {
                skipLabel!.textContent = current.label;
                skipBtn!.style.display = "";
              } else {
                skipBtn!.style.display = "none";
              }
            }
          });
        }

        // ── Auto Next Episode ────────────────────────────────────────────
        if (mediaType === "tv" && season != null && episode != null) {
          let nextEpisodeTimer: NodeJS.Timeout | null = null;
          let showingNextEp = false;

          const showNextEpisodePrompt = () => {
            if (showingNextEp) return;
            showingNextEp = true;

            const nextEpisode = (episode || 1) + 1;
            const nextEpDiv = document.createElement("div");
            nextEpDiv.className =
              "art-next-episode fixed bottom-4 right-4 z-50 bg-black/80 backdrop-blur-sm rounded-lg p-5 border border-white/20 text-white";
            nextEpDiv.innerHTML = `
              <div class="font-semibold mb-2">Next Episode</div>
              <div class="text-sm text-white/70 mb-3">Season ${season} • Episode ${nextEpisode}</div>
              <div class="flex gap-2">
                <button class="art-next-cancel text-sm px-3 py-1 bg-white/10 hover:bg-white/20 rounded">Cancel</button>
                <button class="art-next-play text-sm px-3 py-1 bg-red-600 hover:bg-red-700 rounded font-semibold">Play</button>
              </div>
              <div class="text-xs text-white/50 mt-2">Plays in <span class="art-next-countdown">5</span>s</div>
            `;

            containerRef.current?.appendChild(nextEpDiv);

            let countdown = 5;
            const countdownEl = nextEpDiv.querySelector(".art-next-countdown");

            const cancelBtn = nextEpDiv.querySelector(".art-next-cancel") as HTMLButtonElement;
            const playBtn = nextEpDiv.querySelector(".art-next-play") as HTMLButtonElement;

            cancelBtn?.addEventListener("click", () => {
              nextEpDiv.remove();
              if (nextEpisodeTimer) clearTimeout(nextEpisodeTimer);
            });

            playBtn?.addEventListener("click", () => {
              onNextEpisode?.(season, nextEpisode);
              nextEpDiv.remove();
              if (nextEpisodeTimer) clearTimeout(nextEpisodeTimer);
            });

            const countInterval = setInterval(() => {
              countdown--;
              if (countdownEl) countdownEl.textContent = countdown.toString();
              if (countdown <= 0) {
                clearInterval(countInterval);
                if (nextEpDiv.parentElement) {
                  onNextEpisode?.(season, nextEpisode);
                  nextEpDiv.remove();
                }
              }
            }, 1000);
          };

          art.on("video:ended", () => {
            showNextEpisodePrompt();
          });
        }

        // ── Position saving (history) ──────────────────────────────────────
        const emitEvent = (eventType: string) => {
          const ct = art.currentTime;
          const d = art.duration;
          window.postMessage(
            {
              type: "LOCAL_PLAYER_EVENT",
              data: {
                event: eventType,
                currentTime: ct,
                duration: d,
                mediaId,
                mediaType,
                season: season ?? undefined,
                episode: episode ?? undefined,
                progress: d > 0 ? ct / d : 0,
                playerSource: "321movies",
              },
            },
            "*",
          );
        };

        art.on("play", () => emitEvent("play"));
        art.on("pause", () => emitEvent("pause"));
        art.on("seek", () => emitEvent("seeked"));
        art.on("video:timeupdate", () => emitEvent("timeupdate"));
        art.on("video:ended", () => emitEvent("ended"));
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load player");
          setLoading(false);
        }
      }
    };

    initPlayer();

    return () => {
      cancelled = true;
      if (artRef.current) {
        artRef.current.destroy(false);
        artRef.current = null;
      }
      const btn = containerRef.current?.querySelector(".art-skip-segment");
      if (btn) btn.remove();
      const nextEpDiv = containerRef.current?.querySelector(".art-next-episode");
      if (nextEpDiv) nextEpDiv.remove();
    };
  }, [playlistUrl, onNextEpisode]);

  return (
    <div style={{ 
      position: "relative", 
      width: "100%", 
      height: "100%", 
      overflow: "hidden",
      maxWidth: "100vw",
      boxSizing: "border-box"
    }}>
      <div
        ref={containerRef}
        className={className}
        style={{ 
          width: "100%", 
          height: "100%", 
          minHeight: "100%",
          overflow: "hidden",
          boxSizing: "border-box",
          maxWidth: "100vw"
        }}
      />

      {loading && (
        <div className={`${className} bg-black flex items-center justify-center`} style={{ position: "absolute", inset: 0, zIndex: 10 }}>
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-3" />
            <p className="text-sm text-white/80 font-medium">{loadingStatus}</p>
            <p className="text-xs text-white/40 mt-1">Loading player...</p>
          </div>
        </div>
      )}
      {loadError && (
        <div className={`${className} bg-black flex items-center justify-center`} style={{ position: "absolute", inset: 0, zIndex: 10 }}>
          <div className="text-red-400 text-center">
            <p className="text-lg font-semibold">Playback Error</p>
            <p className="text-sm mt-1">{loadError}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtPlayerWrapper;
