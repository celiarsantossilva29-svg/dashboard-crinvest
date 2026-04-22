export const dynamic = 'force-dynamic';

// GET /api/kpis/vendas?start=YYYY-MM-DD&end=YYYY-MM-DD

import { NextRequest, NextResponse } from "next/server";
import {
  calcCAC,
  calcTicketMedio,
  calcTaxaConversao,
  calcCicloVendas,
  calcLTV,
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

    const [cac, ticketMedio, taxaConversao, cicloVendas] = await Promise.all([
      calcCAC(period),
      calcTicketMedio(period),
      calcTaxaConversao(period),
      calcCicloVendas(period),
    ]);

    // Default retention: 12 months
    const ltv = calcLTV(ticketMedio.value, 12);

    return NextResponse.json({
      data: { cac, ticketMedio, taxaConversao, cicloVendas, ltv },
      updatedAt,
      error: null,
    }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
