"use client";

import MovieDiscoverList from "./MovieList";
import useDiscoverFilters from "@/hooks/useDiscoverFilters";
import DiscoverFilters from "./Filters";
import TvShowDiscoverList from "./TvShowList";
import SponsorBanner from "@/components/ui/other/SponsorBanner";

const DiscoverListGroup = () => {
  const { content } = useDiscoverFilters();

  return (
    <div className="flex flex-col gap-10">
      <DiscoverFilters />
      <SponsorBanner />
      {content === "movie" && <MovieDiscoverList />}
      {content === "tv" && <TvShowDiscoverList />}
    </div>
  );
};

export default DiscoverListGroup;
