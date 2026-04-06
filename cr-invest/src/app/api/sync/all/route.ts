// GET /api/sync/all — runs all 4 sync functions

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { syncKommoData } from "@/services/kommo";
import { syncFacebookAds } from "@/services/facebook";
import { syncGoToData } from "@/services/goto";
import { syncThreeCData } from "@/services/threec";

export async function GET() {
  const updatedAt = new Date().toISOString();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const results: Record<string, { success: boolean; error?: string; synced?: number }> = {};

  // Run all syncs, catching individual errors
  const [kommo, facebook, goto, threec] = await Promise.allSettled([
    syncKommoData(),
    syncFacebookAds(startDate, endDate),
    syncGoToData(startDate, endDate),
    syncThreeCData(startDate, endDate),
  ]);

  results.kommo =
    kommo.status === "fulfilled"
      ? { success: true, synced: kommo.value.synced }
      : { success: false, error: (kommo as PromiseRejectedResult).reason?.message };

  results.facebook =
    facebook.status === "fulfilled"
      ? { success: true, synced: facebook.value.synced }
      : { success: false, error: (facebook as PromiseRejectedResult).reason?.message };

  results.goto =
    goto.status === "fulfilled"
      ? { success: true, synced: goto.value.synced }
      : { success: false, error: (goto as PromiseRejectedResult).reason?.message };

  results.threec =
    threec.status === "fulfilled"
      ? { success: true, synced: threec.value.synced }
      : { success: false, error: (threec as PromiseRejectedResult).reason?.message };

  const allSuccess = Object.values(results).every((r) => r.success);

  return NextResponse.json({
    data: { success: allSuccess, results },
    updatedAt,
    error: allSuccess ? null : "One or more syncs failed",
  });
}
