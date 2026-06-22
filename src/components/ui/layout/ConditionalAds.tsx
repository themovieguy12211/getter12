"use client";

import { usePathname } from "next/navigation";
import AdNetworkScript from "./AdNetworkScript";

const AUTH_PATHS = ["/auth"];

const ConditionalAds: React.FC = () => {
  const pathname = usePathname();

  // Skip ads on auth pages
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return <AdNetworkScript />;
};

export default ConditionalAds;
