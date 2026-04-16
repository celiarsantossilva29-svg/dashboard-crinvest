// GET /api/sync/all — dispara todos os syncs em background e retorna imediatamente

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { syncKommoData } from "@/services/kommo";
import { syncFacebookAds } from "@/services/facebook";
import { syncGoToData } from "@/services/goto";
import { syncProgress } from "@/lib/sync-progress";

export async function GET() {
  const updatedAt = new Date().toISOString();

  if (syncProgress.running) {
    return NextResponse.json({
      data: { started: false, reason: "Sync já em andamento" },
      updatedAt,
      error: null,
    });
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  // Disparar todos em background — não aguarda conclusão
  Promise.allSettled([
    syncKommoData(),
    syncFacebookAds(startDate, endDate),
    syncGoToData(startDate, endDate),
  ]).catch((err) => {
    console.error("[sync/all] background error:", err?.message);
  });

  return NextResponse.json({ data: { started: true }, updatedAt, error: null });
}
