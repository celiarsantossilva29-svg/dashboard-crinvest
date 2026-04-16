/**
 * Sync scheduler for CR Invest.
 *
 * Since Next.js does not have built-in cron support, sync is triggered
 * by checking whether 1 hour has passed since the last sync whenever
 * the /api/sync/all route (or this module) is called.
 *
 * For production, consider using Vercel Cron Jobs (vercel.json) or an
 * external scheduler to call GET /api/sync/all on the desired interval.
 */

import { prisma } from "@/lib/prisma";
import { syncKommoData } from "@/services/kommo";
import { syncFacebookAds } from "@/services/facebook";
import { syncGoToData } from "@/services/goto";

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 min

/**
 * Run all sync functions sequentially, catching errors individually.
 * Each failure is logged to SyncLog but does not prevent other syncs.
 */
export async function runAllSyncs(): Promise<
  Record<string, { success: boolean; error?: string; synced?: number }>
> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const results: Record<string, { success: boolean; error?: string; synced?: number }> = {};

  // Kommo — meia-noite de hoje (BRT) ou último sync (o mais antigo dos dois)
  try {
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const midnightBRT = new Date(todayStr + "T00:00:00-03:00");
    const lastKommo = await prisma.syncLog.findFirst({
      where: { source: "kommo", status: "success" },
      orderBy: { syncedAt: "desc" },
    });
    const lastSyncMs = lastKommo ? lastKommo.syncedAt.getTime() - 5 * 60 * 1000 : Infinity;
    const since = new Date(Math.min(lastSyncMs, midnightBRT.getTime()));
    const r = await syncKommoData({ since });
    results.kommo = { success: true, synced: r.synced };
  } catch (err: any) {
    results.kommo = { success: false, error: err?.message };
    await prisma.syncLog.create({
      data: {
        source: "kommo",
        status: "error",
        message: `Scheduler error: ${err?.message}`,
      },
    });
  }

  // Facebook
  try {
    const r = await syncFacebookAds(startDate, endDate);
    results.facebook = { success: true, synced: r.synced };
  } catch (err: any) {
    results.facebook = { success: false, error: err?.message };
    await prisma.syncLog.create({
      data: {
        source: "facebook",
        status: "error",
        message: `Scheduler error: ${err?.message}`,
      },
    });
  }

  // GoTo
  try {
    const r = await syncGoToData(startDate, endDate);
    results.goto = { success: true, synced: r.synced };
  } catch (err: any) {
    results.goto = { success: false, error: err?.message };
    await prisma.syncLog.create({
      data: {
        source: "goto",
        status: "error",
        message: `Scheduler error: ${err?.message}`,
      },
    });
  }

  return results;
}

/**
 * Check if 1 hour has passed since the last successful sync of any source.
 * If yes, trigger runAllSyncs().
 * Designed to be called at the start of /api/sync/all GET handler.
 */
export async function scheduleSync(): Promise<{
  triggered: boolean;
  results?: Record<string, { success: boolean; error?: string; synced?: number }>;
}> {
  // Find the most recent sync log entry
  const latest = await prisma.syncLog.findFirst({
    orderBy: { syncedAt: "desc" },
  });

  const now = Date.now();
  const lastSyncTime = latest ? latest.syncedAt.getTime() : 0;
  const elapsed = now - lastSyncTime;

  if (elapsed < SYNC_INTERVAL_MS) {
    const remainingMins = Math.ceil((SYNC_INTERVAL_MS - elapsed) / 60000);
    console.log(
      `[scheduleSync] Skipping — last sync was ${Math.floor(elapsed / 60000)}m ago. ` +
        `Next sync in ~${remainingMins}m.`
    );
    return { triggered: false };
  }

  console.log("[scheduleSync] 30min interval reached — starting all syncs.");
  const results = await runAllSyncs();
  return { triggered: true, results };
}
