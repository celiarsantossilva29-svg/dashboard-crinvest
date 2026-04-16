// GET /api/kpis/tentativas?start=YYYY-MM-DD&end=YYYY-MM-DD&sdr=nome
// Retorna tentativas de contato por lead, combinando:
//   contactAttempts → campo customizado do Kommo (preenchido pelo SDR)
//   goToCalls       → ligações mapeadas pelo GoTo Connect (por telefone)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { USE_MOCK, getMockLeads } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const updatedAt = new Date().toISOString();

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end   = searchParams.get("end");
    const sdr   = searchParams.get("sdr") ?? undefined;

    const now = new Date();
    const startDate = start
      ? new Date(start + "T00:00:00-03:00")
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = end
      ? new Date(end + "T23:59:59-03:00")
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // ── Mock ─────────────────────────────────────────────────────────────────
    if (USE_MOCK) {
      let leads = getMockLeads().filter(
        (l) => l.createdAt >= startDate && l.createdAt <= endDate
      );
      if (sdr) leads = leads.filter((l) => l.assignedTo === sdr);

      return NextResponse.json({
        data: buildResponse(
          leads.map((l) => ({
            id: l.id,
            assignedTo: l.assignedTo ?? "—",
            status: l.status,
            campaignName: l.campaignName ?? "—",
            createdAt: l.createdAt.toISOString(),
            contactAttempts: l.interactionCount ?? 0,
            goToCalls: 0,
            firstCallAt: l.contactedAt?.toISOString() ?? null,
            contactedAt: l.contactedAt?.toISOString() ?? null,
            scheduledAt: l.scheduledAt?.toISOString() ?? null,
            hasPhone: false,
          }))
        ),
        updatedAt,
        error: null,
      });
    }

    // ── Real DB ───────────────────────────────────────────────────────────────
    const where: Record<string, unknown> = {
      createdAt: { gte: startDate, lte: endDate },
    };
    if (sdr) where.assignedTo = sdr;

    const rows = await prisma.lead.findMany({
      where,
      select: {
        id: true,
        assignedTo: true,
        status: true,
        campaignName: true,
        createdAt: true,
        contactAttempts: true,
        goToCalls: true,
        firstCallAt: true,
        contactedAt: true,
        scheduledAt: true,
        leadPhones: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const leads = rows.map((l) => ({
      id: l.id,
      assignedTo: l.assignedTo ?? "—",
      status: l.status,
      campaignName: l.campaignName ?? "—",
      createdAt: l.createdAt.toISOString(),
      contactAttempts: l.contactAttempts,
      goToCalls: l.goToCalls,
      firstCallAt: l.firstCallAt?.toISOString() ?? null,
      contactedAt: l.contactedAt?.toISOString() ?? null,
      scheduledAt: l.scheduledAt?.toISOString() ?? null,
      hasPhone: l.leadPhones.length > 0,
    }));

    return NextResponse.json({
      data: buildResponse(leads),
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

// ─── helpers ─────────────────────────────────────────────────────────────────

interface LeadRow {
  id: string;
  assignedTo: string;
  status: string;
  campaignName: string;
  createdAt: string;
  contactAttempts: number;
  goToCalls: number;
  firstCallAt: string | null;
  contactedAt: string | null;
  scheduledAt: string | null;
  hasPhone: boolean;
}

function buildResponse(leads: LeadRow[]) {
  const withTotal = leads.map((l) => ({
    ...l,
    // Total = maior valor entre os dois. Se tiver ambos, soma (evita dupla contagem
    // só quando as fontes divergem muito — aqui usamos o máximo como estimativa conservadora).
    totalAttempts: Math.max(l.contactAttempts, l.goToCalls),
  }));

  const total = withTotal.length;
  const comTentativas   = withTotal.filter((l) => l.totalAttempts > 0).length;
  const semTentativas   = total - comTentativas;
  const semTelefone     = withTotal.filter((l) => !l.hasPhone).length;
  const avgAttempts     = total > 0
    ? parseFloat((withTotal.reduce((s, l) => s + l.totalAttempts, 0) / total).toFixed(1))
    : 0;

  // Distribuição por faixa
  const faixas: Record<string, number> = { "0": 0, "1–3": 0, "4–7": 0, "8–10": 0, ">10": 0 };
  for (const l of withTotal) {
    const t = l.totalAttempts;
    if (t === 0)       faixas["0"]++;
    else if (t <= 3)   faixas["1–3"]++;
    else if (t <= 7)   faixas["4–7"]++;
    else if (t <= 10)  faixas["8–10"]++;
    else               faixas[">10"]++;
  }

  // Resumo por SDR
  const sdrSet = Array.from(new Set(withTotal.map((l) => l.assignedTo).filter((s) => s !== "—")));
  const bySdr = sdrSet.map((nome) => {
    const sl  = withTotal.filter((l) => l.assignedTo === nome);
    const avg = sl.length > 0
      ? parseFloat((sl.reduce((s, l) => s + l.totalAttempts, 0) / sl.length).toFixed(1))
      : 0;
    return {
      sdr: nome,
      totalLeads:       sl.length,
      avgAttempts:      avg,
      kommoTotal:       sl.reduce((s, l) => s + l.contactAttempts, 0),
      gotoTotal:        sl.reduce((s, l) => s + l.goToCalls, 0),
      semTentativas:    sl.filter((l) => l.totalAttempts === 0).length,
      semTelefone:      sl.filter((l) => !l.hasPhone).length,
    };
  }).sort((a, b) => b.avgAttempts - a.avgAttempts);

  return {
    leads: withTotal,
    summary: {
      totalLeads:    total,
      comTentativas,
      semTentativas,
      semTelefone,
      avgAttempts,
      distribuicao:  Object.entries(faixas).map(([faixa, count]) => ({ faixa, count })),
      bySdr,
    },
  };
}
