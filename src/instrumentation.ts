export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runPlaymateSync } = await import("@/utils/playmateSyncLogic");

  const INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

  const run = async () => {
    try {
      const result = await runPlaymateSync();
      if (result.created > 0) {
        console.log(`[Playmate Sync] Auto-created ${result.created} embeds`);
      }
    } catch (err) {
      console.error("[Playmate Sync] failed:", err instanceof Error ? err.message : err);
    }
  };

  // Run once shortly after startup, then on interval
  setTimeout(run, 30_000);
  setInterval(run, INTERVAL_MS);
}
