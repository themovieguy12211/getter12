import { NextPage } from "next";
import dynamic from "next/dynamic";
import SponsorBanner from "@/components/ui/other/SponsorBanner";
const ContinueWatching = dynamic(() => import("@/components/sections/Home/ContinueWatching"));
const HomePageList = dynamic(() => import("@/components/sections/Home/List"));
const AppDownload = dynamic(() => import("@/components/sections/Home/AppDownload"));

const HomePage: NextPage = () => {
  return (
    <div className="flex flex-col gap-3 md:gap-8">
      <ContinueWatching />
      <AppDownload />

      <SponsorBanner />

      <div className="flex flex-col gap-4">
        <HomePageList />
      </div>
    </div>
  );
};

export default HomePage;
