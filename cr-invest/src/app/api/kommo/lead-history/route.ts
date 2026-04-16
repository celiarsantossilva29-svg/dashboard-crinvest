export const dynamic = 'force-dynamic';

// GET /api/kommo/lead-history?leadId=xxx
//
// Enriquece um lead específico com timestamps de mudança de etapa
// buscando o changelog via GET /leads/{id}/events.
//
// Use quando quiser preencher contactedAt, qualifiedAt, scheduledAt, meetingAt
// para um lead específico sem fazer um sync completo.

import { NextRequest, NextResponse } from "next/server";
import { syncLeadHistory } from "@/services/kommo";

export async function GET(req: NextRequest) {
  const leadId = new URL(req.url).searchParams.get("leadId");

  if (!leadId) {
    return NextResponse.json(
      { error: "Parâmetro leadId é obrigatório" },
      { status: 400 }
    );
  }

  try {
    await syncLeadHistory(leadId);
    return NextResponse.json({ data: { ok: true, leadId }, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err?.message ?? "Erro ao buscar histórico" },
      { status: 500 }
    );
  }
}
