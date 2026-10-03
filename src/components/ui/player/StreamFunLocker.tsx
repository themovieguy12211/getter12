"use client";

import { RefObject, useEffect } from "react";

declare global {
  interface Window {
    StreamSharkLockerAPI?: {
      mount: (options: StreamFunLockerOptions) => () => void;
      check?: () => void;
      lock?: () => void;
      unlock?: () => void;
    };
  }
}

interface StreamFunLockerOptions {
  mount: HTMLElement;
  apiUrl?: string;
  vpnUrl?: string;
  canClose?: boolean;
  platforms?: string[];
  [key: string]: unknown;
}

interface StreamFunLockerProps {
  mountRef: RefObject<HTMLElement | null>;
  playerKey: string;
}

// Advertiser-supplied config: the VPN CTA points at the securevpb tracking
// link, and the locker only targets phone/tablet users.
const config = {
  apiUrl: "https://api.streamfun.io/api/v1/connection/status",
  vpnUrl:
    "https://securevpb.online/Q4PJpQPd?cost={cost}&currency=usd&external_id=${SUBID}&creative_id={bannerid}&ad_campaign_id={campaignid}&source={zoneid}",
  lockDelay: 2000,
  canClose: true,
  platforms: ["android", "desktop"],
};

let scriptPromise: Promise<void> | null = null;

function ensureScriptLoaded(): Promise<void> {
  if (window.StreamSharkLockerAPI) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve) => {
      const done = () => resolve();
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="/streamfun-locker.js"]',
      );
      if (existing) {
        existing.addEventListener("load", done, { once: true });
        existing.addEventListener("error", done, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "/streamfun-locker.js";
      script.async = true;
      script.addEventListener("load", done, { once: true });
      script.addEventListener("error", done, { once: true });
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

const StreamFunLocker: React.FC<StreamFunLockerProps> = ({ mountRef, playerKey }) => {
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void ensureScriptLoaded().then(() => {
      if (cancelled) return;
      cleanup = window.StreamSharkLockerAPI?.mount({
        ...config,
        mount,
      });
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [mountRef, playerKey]);

  return null;
};

export default StreamFunLocker;
