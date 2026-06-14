"use client";

import { useState } from "react";
import useAdBlockDetector from "@/hooks/useAdBlockDetector";
import useSupabaseUser from "@/hooks/useSupabaseUser";
import { isPremiumUser } from "@/utils/billing/premium";

const AdBlockBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const { isAdBlockDetected, isChecking } = useAdBlockDetector();
  const { data: user, isLoading } = useSupabaseUser();
  const isPremium = isPremiumUser(user);

  if (isChecking || isLoading || isPremium || !isAdBlockDetected || dismissed) return null;

  return (
    <div className="bg-warning-50/10 border-warning-200/30 absolute top-2 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2 backdrop-blur-sm">
      <p className="text-warning-300 text-xs">
        Support us by disabling your ad blocker — it helps keep the site free.
      </p>
      <button
        type="button"
        className="text-warning-400 hover:text-white text-xs font-semibold"
        onClick={() => setDismissed(true)}
      >
        Dismiss
      </button>
    </div>
  );
};

export default AdBlockBanner;
