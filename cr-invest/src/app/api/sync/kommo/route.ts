// GET /api/sync/kommo?mode=full|incremental
//
// mode=full        → sync todos os leads (padrão na primeira vez)
// mode=incremental → sync apenas leads atualizados nas últimas 2h (padrão)

import { NextRequest, NextResponse } from "next/server";
import { syncKommoData } from "@/services/kommo";

export async function GET(req: NextRequest) {
  const updatedAt = new Date().toISOString();
  const mode = new URL(req.url).searchParams.get("mode") ?? "incremental";

  try {
    const since =
      mode === "full"
        ? undefined
        : new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 horas atrás

    const result = await syncKommoData({ since });

    return NextResponse.json({
      data: { success: true, mode, ...result },
      updatedAt,
      error: null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Sync falhou" },
      { status: 500 }
    );
  }
}
