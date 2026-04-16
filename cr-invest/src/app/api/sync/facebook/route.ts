// GET /api/sync/facebook — syncs last 30 days
// Retorna 202 imediatamente e roda em background para não bloquear a navegação.

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { syncFacebookAds } from "@/services/facebook";
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

  // Disparar em background — não aguarda conclusão
  syncFacebookAds(startDate, endDate).catch((err) => {
    console.error("[sync/facebook] background error:", err?.message);
  });

  return NextResponse.json({ data: { started: true }, updatedAt, error: null });
}
