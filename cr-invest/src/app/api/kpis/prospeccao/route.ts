export const dynamic = 'force-dynamic';

// GET /api/kpis/prospeccao?start=YYYY-MM-DD&end=YYYY-MM-DD

import { NextRequest, NextResponse } from "next/server";
import {
  calcLeadsGerados,
  calcTaxaAgendamento,
  calcNoShow,
  calcTaxaQualificacao,
  calcContatosPorLead,
} from "@/lib/kpis";

export async function GET(req: NextRequest) {
  const updatedAt = new Date().toISOString();

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const now = new Date();
    const startDate = start
      ? new Date(start + "T00:00:00-03:00")
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = end
      ? new Date(end + "T23:59:59-03:00")
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const period = { startDate, endDate };

    const [leadsGerados, taxaAgendamento, noShow, taxaQualificacao, contatosPorLead] =
      await Promise.all([
        calcLeadsGerados(period),
        calcTaxaAgendamento(period),
        calcNoShow(period),
        calcTaxaQualificacao(period),
        calcContatosPorLead(period),
      ]);

    return NextResponse.json({
      data: { leadsGerados, taxaAgendamento, noShow, taxaQualificacao, contatosPorLead },
      updatedAt,
      error: null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
