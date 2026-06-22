import { ADS_WARNING_STORAGE_KEY, SpacingClasses } from "@/utils/constants";
import { siteConfig } from "@/config/site";
import useBreakpoints from "@/hooks/useBreakpoints";
import { cn } from "@/utils/helpers";
import { mutateMovieTitle } from "@/utils/movies";
import { getMoviePlayers, type CustomEmbed } from "@/utils/players";
import { Card, Skeleton } from "@heroui/react";
import { useDisclosure, useDocumentTitle, useIdle, useLocalStorage } from "@mantine/hooks";
import dynamic from "next/dynamic";
import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MovieDetails } from "tmdb-ts/dist/types/movies";
import { usePlayerEvents } from "@/hooks/usePlayerEvents";
import useSupabaseUser from "@/hooks/useSupabaseUser";
import { isPremiumUser } from "@/utils/billing/premium";
import { createPartyRoom } from "@/actions/party";
import { markMediaVisited } from "@/actions/histories";
import { useRouter } from "next/navigation";
const AdsWarning = dynamic(() => import("@/components/ui/overlay/AdsWarning"));
const AdBlockBanner = dynamic(() => import("@/components/ui/notice/AdBlockBanner"));
const HlsJsonPlayer = dynamic(() => import("@/components/ui/player/HlsJsonPlayer"));
const VylaPlayer = dynamic(() => import("@/components/ui/player/VylaPlayer"));
const NetflixPlayer = dynamic(() => import("@/components/ui/player/NetflixPlayer"));
const ArtPlayerWrapper = dynamic(() => import("@/components/ui/player/ArtPlayerWrapper"));
const MoviePlayerHeader = dynamic(() => import("./Header"));
const MoviePlayerSourceSelection = dynamic(() => import("./SourceSelection"));

interface MoviePlayerProps {
  movie: MovieDetails;
  startAt?: number;
  piracyEmbedUrl?: string | null;
  customEmbeds?: CustomEmbed[];
}

const MoviePlayer: React.FC<MoviePlayerProps> = ({ movie, startAt, piracyEmbedUrl, customEmbeds }) => {
  const router = useRouter();
  const [seen] = useLocalStorage<boolean>({
    key: ADS_WARNING_STORAGE_KEY,
    getInitialValueInEffect: false,
  });

  const { data: user } = useSupabaseUser();
  const isPremium = isPremiumUser(user);

  const allPlayers = useMemo(
    () => getMoviePlayers(movie.id, startAt, piracyEmbedUrl, customEmbeds),
    [movie.id, startAt, piracyEmbedUrl, customEmbeds],
  );
  const players = allPlayers;

  const title = mutateMovieTitle(movie);
  const idle = useIdle(3000);
  const { mobile } = useBreakpoints();
  const [opened, handlers] = useDisclosure(false);
  const [selectedSource, setSelectedSource] = useQueryState<number>(
    "src",
    parseAsInteger.withDefault(0),
  );
  const [streamSourceMenuSignal, setStreamSourceMenuSignal] = useState(0);
  const [partyCreating, setPartyCreating] = useState(false);

  usePlayerEvents({
    saveHistory: true,
    trackUiState: false,
    media: { id: movie.id, type: "movie" },
  });
  useDocumentTitle(`Play ${title} | ${siteConfig.name}`);


  // Prevent page scroll on player pages
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (!players.length) return;
    if (selectedSource < players.length) return;
    void setSelectedSource(0);
  }, [players.length, selectedSource, setSelectedSource]);

  const PLAYER = useMemo(() => players[selectedSource] || players[0], [players, selectedSource]);
  const isPlaylistJsonPlayer = PLAYER.mode === "playlist_json";
  const isNativeHlsPlayer = PLAYER.mode === "native_hls";
  const showServerButton = isPlaylistJsonPlayer || isNativeHlsPlayer;

  useEffect(() => {
    void markMediaVisited("movie", movie.id);
  }, [movie.id]);
  const handlePrimaryPlayerError = useCallback(() => {
    const fallbackIndex = players.findIndex((_, index) => index > selectedSource);
    if (fallbackIndex < 0) return;
    void setSelectedSource(fallbackIndex);
  }, [players, selectedSource, setSelectedSource]);

  const handleNetflixError = useCallback((_msg: string) => {
    handlePrimaryPlayerError();
  }, [handlePrimaryPlayerError]);

  const handleOpenStreamSourceMenu = useCallback(() => {
    setStreamSourceMenuSignal((value) => value + 1);
  }, []);

  const handleStartParty = useCallback(async () => {
    if (partyCreating) return;
    setPartyCreating(true);
    const res = await createPartyRoom({
      mediaId: movie.id,
      mediaType: "movie",
      mediaTitle: movie.title,
      mediaPoster: movie.poster_path
        ? `https://image.tmdb.org/t/p/w185${movie.poster_path}`
        : undefined,
    });
    setPartyCreating(false);
    if (res.success && res.data) router.push(`/party/${res.data.code}`);
  }, [partyCreating, movie, router]);

  return (
    <>
      <AdsWarning />
      <AdBlockBanner />

      <div className={cn("relative flex flex-col overflow-hidden", SpacingClasses.reset)} style={{ height: "100dvh" }}>
        <MoviePlayerHeader
          id={movie.id}
          movieName={title}
          onOpenSource={handlers.open}
          onOpenServer={showServerButton ? handleOpenStreamSourceMenu : undefined}
          showServerButton={showServerButton}
          hidden={idle && !mobile}
          onStartParty={showServerButton ? handleStartParty : undefined}
          partyCreating={partyCreating}
        />
        <Card shadow="md" radius="none" className="relative min-h-0 flex-1 overflow-visible" style={{ overflow: "visible" }}>
          <Skeleton className="absolute h-full w-full" />
          {seen && (
            PLAYER.mode === "playlist_json" ? (
              <HlsJsonPlayer
                key={PLAYER.source}
                playlistUrl={PLAYER.source}
                mediaId={movie.id}
                mediaType="movie"
                disableVastAds={isPremium}
                startAt={startAt}
                onFatalError={handlePrimaryPlayerError}
                className="absolute inset-0 z-10 h-full w-full"
                showFloatingSourceButton={false}
                openSourceMenuSignal={streamSourceMenuSignal}
              />
            ) : PLAYER.mode === "native_hls" ? (
              <VylaPlayer
                key={PLAYER.source}
                playlistUrl={PLAYER.source}
                mediaId={movie.id}
                mediaType="movie"
                startAt={startAt}
                onFatalError={handlePrimaryPlayerError}
                className="absolute inset-0 z-10 h-full w-full"
                openSourceMenuSignal={streamSourceMenuSignal}
                backdropUrl={movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : undefined}
                title={title}
              />
            ) : PLAYER.mode === "netflix" ? (
              <NetflixPlayer
                key={PLAYER.source}
                playlistUrl={PLAYER.source}
                mediaId={movie.id}
                mediaType="movie"
                startAt={startAt}
                onFatalError={handleNetflixError}
                className="absolute inset-0 z-10 h-full w-full"
                openSourceMenuSignal={streamSourceMenuSignal}
                backdropUrl={movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : undefined}
                title={title}
              />
            ) : PLAYER.mode === "strata" || PLAYER.mode === "strata_testing" || PLAYER.mode === "artplayer" ? (
              <ArtPlayerWrapper
                key={PLAYER.source}
                playlistUrl={PLAYER.source}
                mediaId={movie.id}
                mediaType="movie"
                startAt={startAt}
                onFatalError={handlePrimaryPlayerError}
                className="absolute inset-0 z-10 h-full w-full"
              />
            ) : (
              <iframe
                allowFullScreen
                key={PLAYER.title}
                src={PLAYER.source}
                className={cn("absolute inset-0 z-10 h-full w-full", {
                  "pointer-events-none": idle && !mobile,
                })}
              />
            )
          )}
        </Card>
      </div>

      <MoviePlayerSourceSelection
        opened={opened}
        onClose={handlers.close}
        players={players}
        selectedSource={selectedSource}
        setSelectedSource={setSelectedSource}
      />
    </>
  );
};

MoviePlayer.displayName = "MoviePlayer";

export default MoviePlayer;
