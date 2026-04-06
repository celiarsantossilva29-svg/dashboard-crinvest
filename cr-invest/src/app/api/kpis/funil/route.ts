// GET /api/kpis/funil?start=YYYY-MM-DD&end=YYYY-MM-DD

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockLeads, USE_MOCK } from "@/lib/mock-data";

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

    let leads: Array<{ status: string }>;

    if (USE_MOCK) {
      leads = getMockLeads()
        .filter((l) => l.createdAt >= startDate && l.createdAt <= endDate)
        .map((l) => ({ status: l.status }));
    } else {
      leads = await prisma.lead.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        select: { status: true },
      });
    }

    const leadsGerados = leads.length;
    const contatados = leads.filter((l) =>
      ["contacted", "qualified", "scheduled", "meeting", "won", "lost"].includes(l.status)
    ).length;
    const qualificados = leads.filter((l) =>
      ["qualified", "scheduled", "meeting", "won", "lost"].includes(l.status)
    ).length;
    const agendamentos = leads.filter((l) =>
      ["scheduled", "meeting", "won", "lost"].includes(l.status)
    ).length;
    const reunioes = leads.filter((l) =>
      ["meeting", "won", "lost"].includes(l.status)
    ).length;
    const vendas = leads.filter((l) => l.status === "won").length;

    const conversions = {
      contactRate: leadsGerados > 0 ? parseFloat(((contatados / leadsGerados) * 100).toFixed(1)) : 0,
      qualRate: contatados > 0 ? parseFloat(((qualificados / contatados) * 100).toFixed(1)) : 0,
      scheduleRate: qualificados > 0 ? parseFloat(((agendamentos / qualificados) * 100).toFixed(1)) : 0,
      meetingRate: agendamentos > 0 ? parseFloat(((reunioes / agendamentos) * 100).toFixed(1)) : 0,
      closeRate: reunioes > 0 ? parseFloat(((vendas / reunioes) * 100).toFixed(1)) : 0,
    };

    return NextResponse.json({
      data: { leadsGerados, contatados, qualificados, agendamentos, reunioes, vendas, conversions },
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
