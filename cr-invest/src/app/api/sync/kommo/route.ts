// GET /api/sync/kommo?mode=full|incremental
//
// Retorna imediatamente com { started: true } e roda o sync em background.
// O progresso pode ser acompanhado via GET /api/sync/status (syncProgress).

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — necessário para syncs longos no Vercel

import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { syncKommoData } from "@/services/kommo";
import { prisma } from "@/lib/prisma";
import { syncProgress } from "@/lib/sync-progress";

export async function GET(req: NextRequest) {
  const updatedAt = new Date().toISOString();
  const mode = new URL(req.url).searchParams.get("mode") ?? "incremental";

  // Não iniciar segundo sync se já há um em andamento
  if (syncProgress.running) {
    return NextResponse.json({
      data: { started: false, reason: "Sync já em andamento" },
      updatedAt,
      error: null,
    });
  }

  // Calcular `since` antes de disparar em background
  let since: Date | undefined;
  if (mode !== "full") {
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const midnightBRT = new Date(todayStr + "T00:00:00-03:00");

    const lastLog = await prisma.syncLog.findFirst({
      where: { source: "kommo", status: "success" },
      orderBy: { syncedAt: "desc" },
    });
    const lastSyncMs = lastLog ? lastLog.syncedAt.getTime() - 5 * 60 * 1000 : Infinity;
    since = new Date(Math.min(lastSyncMs, midnightBRT.getTime()));
  }

  // Disparar em background — waitUntil garante que o Vercel mantém a função viva até terminar
  waitUntil(
    syncKommoData({ since }).catch((err) => {
      console.error("[sync/kommo] background error:", err?.message);
    })
  );

  return NextResponse.json({
    data: { started: true, mode },
    updatedAt,
    error: null,
  });
}
