// GET /api/sync/all — dispara todos os syncs em background e retorna imediatamente

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — necessário para syncs longos no Vercel

import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
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

  // waitUntil garante que o Vercel mantém a função viva até todos os syncs terminarem
  waitUntil(
    Promise.allSettled([
      syncKommoData(),
      syncFacebookAds(startDate, endDate),
      syncGoToData(startDate, endDate),
    ])
  );

  return NextResponse.json({ data: { started: true }, updatedAt, error: null });
}
