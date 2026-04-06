/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts. Registers a 30-minute background sync loop.
 * Only runs in Node.js runtime (not Edge).
 */

let _syncRegistered = false;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (_syncRegistered) return;
  _syncRegistered = true;

  const { scheduleSync } = await import("./lib/sync-scheduler");

  // Initial sync attempt on startup (after 10s delay for DB to be ready)
  setTimeout(async () => {
    try {
      await scheduleSync();
    } catch (err) {
      console.error("[cron] Initial sync failed:", err);
    }
  }, 10_000);

  // Then every 30 minutes
  setInterval(async () => {
    try {
      await scheduleSync();
    } catch (err) {
      console.error("[cron] Scheduled sync failed:", err);
    }
  }, 30 * 60 * 1000);

  console.log("[cron] Background sync registered — interval: 30min");
}
