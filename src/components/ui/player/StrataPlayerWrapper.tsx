import dynamic from "next/dynamic";
import React, { useMemo, useCallback, useEffect } from "react";
import { HlsPlugin } from "strataplayer/hls";
import { DashPlugin } from "strataplayer/dash";
import { decodePlayerStreamUrl } from "@/utils/playerUrlCodec";

// Lazy load StrataPlayer component to reduce bundle
const StrataPlayerComponent = dynamic(
  () => import("strataplayer").then((mod) => mod.StrataPlayer),
  { ssr: false }
);

interface StrataPlayerWrapperProps {
  playlistUrl: string;
  mediaId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  startAt?: number;
  className?: string;
  title?: string;
  showFloatingSourceButton?: boolean;
  openSourceMenuSignal?: number;
  onFatalError?: () => void;
  disableVastAds?: boolean;
}

/**
 * StrataPlayer wrapper component
 * Fetches from your `/api/player/vixsrc-playlist` API and adapts sources for StrataPlayer
 */
export const StrataPlayerWrapper: React.FC<StrataPlayerWrapperProps> = ({
  playlistUrl,
  mediaId,
  mediaType,
  season,
  episode,
  startAt = 0,
  className = "",
  title = "Video",
  onFatalError,
  showFloatingSourceButton = true,
  openSourceMenuSignal = 0,
}) => {
  const [sources, setSources] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const playerRef = React.useRef<any>(null);

  // Fetch playlist and adapt to StrataPlayer format
  const adaptedSources = useMemo(() => {
    console.log("[StrataPlayer] adaptedSources called with", sources.length, "sources");
    
    const adapted = sources.map((source, idx) => {
      const rawUrl = source.file || source.url;
      console.log(`[StrataPlayer] Source ${idx} raw URL:`, rawUrl?.substring(0, 100));
      
      const decodedUrl = decodePlayerStreamUrl(rawUrl);
      console.log(`[StrataPlayer] Source ${idx} decoded URL:`, decodedUrl?.substring(0, 100));
      
      return {
        name: source.label || source.provider || "Source",
        url: decodedUrl,
        type: source.type || "hls",
        default: source.default || false,
      };
    });
    
    if (adapted.length > 0) {
      console.log("[StrataPlayer] Adapted sources:", adapted);
    }
    
    return adapted;
  }, [sources]);

  // Load sources on mount
  useEffect(() => {
    const loadSources = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(playlistUrl);
        if (!response.ok) {
          throw new Error(`Failed to load playlist: ${response.status}`);
        }

        const data = await response.json();
        if (!data.playlist || !Array.isArray(data.playlist)) {
          throw new Error("Invalid playlist format");
        }

        const allSources: any[] = [];
        data.playlist.forEach((item: any) => {
          if (item.sources && Array.isArray(item.sources)) {
            allSources.push(...item.sources);
          }
        });

        console.log("[StrataPlayer] Raw sources from API:", allSources);

        if (allSources.length === 0) {
          throw new Error("No playable sources found");
        }

        setSources(allSources);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setError(errorMsg);
        onFatalError?.();
      } finally {
        setLoading(false);
      }
    };

    loadSources();
  }, [playlistUrl, onFatalError]);

  // Handle source menu signal (for external trigger)
  useEffect(() => {
    if (openSourceMenuSignal > 0 && playerRef.current) {
      // Trigger settings/source menu
      playerRef.current.store?.setState?.({
        _openSettingsMenu: "sources",
      });
    }
  }, [openSourceMenuSignal]);

  if (loading) {
    return (
      <div className={`${className} bg-black flex items-center justify-center`}>
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2" />
          <p>Loading player...</p>
        </div>
      </div>
    );
  }

  if (error || adaptedSources.length === 0) {
    return (
      <div className={`${className} bg-black flex items-center justify-center`}>
        <div className="text-red-400 text-center">
          <p className="text-lg font-semibold">Playback Error</p>
          <p className="text-sm">{error || "No sources available"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-visible z-50`} style={{ overflow: "visible", zIndex: 50 }}>
      <div className="w-full h-full overflow-visible z-50 flex flex-col" style={{ overflow: "visible", zIndex: 50 }}>
        <StrataPlayerComponent
          sources={adaptedSources}
          plugins={[new HlsPlugin(), new DashPlugin()]}
          autoPlay={false}
          volume={0.8}
          theme="hacker"
          themeColor="#e50914" // Netflix red
          backdrop
          setting
          pip
          fullscreen
          fullscreenWeb
          screenshot={false}
          hotKey
          gestureSeek={false}
          fetchTimeout={30000}
        onGetInstance={(instance: any) => {
          playerRef.current = instance;

          // Handle startAt - ensure it's a valid number
          const validStartAt = typeof startAt === 'number' && isFinite(startAt) && startAt > 0 ? startAt : 0;
          if (validStartAt > 0) {
            instance.on("ready", () => {
              try {
                instance.currentTime = validStartAt;
              } catch (e) {
                console.warn("[StrataPlayer] Could not set currentTime:", e);
              }
            });
          }

          // Track events
          instance.on("error", (err: any) => {
            console.error("[StrataPlayer] Error:", err);
            onFatalError?.();
          });

          instance.on("timeupdate", () => {
            // Could track playback progress here
          });
        }}
      />
      </div>
    </div>
  );
};

export default StrataPlayerWrapper;
