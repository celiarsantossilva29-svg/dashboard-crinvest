export const dynamic = 'force-dynamic';

// GET /api/kpis/performance-closer?start=YYYY-MM-DD&end=YYYY-MM-DD

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { USE_MOCK, getMockLeads, getMockSales } from "@/lib/mock-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CloserStats {
  agentName: string;
  vendas: number;
  totalReunioes: number;
  totalReunioes2: number;
  totalNegociacoes: number;
  receita: number;
  ticketMedio: number;
  taxaWin: number;
  reunioesPorVenda: number;
  taxaNoShow: number;
  leadTimeTotalDias: number;
}

export interface DealCard {
  id: string;
  clientName: string;
  assignedTo: string;
  value: number;
  closedAt: string;
  status: "won" | "lost";
  lostReason: string | null;
  campaignName: string | null;
}

export interface LossReason {
  reason: string;
  count: number;
}

export interface CloserApiResponse {
  agents: CloserStats[];
  deals: DealCard[];
  lossReasons: LossReason[];
  totals: {
    vendas: number;
    receita: number;
    ticketMedioGeral: number;
    taxaWinGeral: number;
    totalWon: number;
    totalReunioes: number;
    totalReunioes2: number;
    totalNegociacoes: number;
    noShowGeral: number;
    leadTimeMedioGeral: number;
  };
}

// ─── Deterministic pseudo-random para mock ────────────────────────────────────

function seeded(seed: number, min: number, max: number): number {
  const a = 1664525, c = 1013904223, m = 2 ** 32;
  const v = ((a * seed + c) % m) / m;
  return Math.floor(v * (max - min + 1)) + min;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

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

    const result: CloserApiResponse = USE_MOCK
      ? buildMockResult(startDate, endDate)
      : await buildRealResult(startDate, endDate);

    return NextResponse.json({ data: result, updatedAt, error: null }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

// ─── Mock ─────────────────────────────────────────────────────────────────────

function buildMockResult(startDate: Date, endDate: Date): CloserApiResponse {
  const sales = getMockSales().filter(
    (s) => s.closedAt >= startDate && s.closedAt <= endDate
  );
  const leads = getMockLeads().filter(
    (l) => l.createdAt >= startDate && l.createdAt <= endDate
  );

  const agentNames = Array.from(
    new Set<string>([
      ...sales.map((s) => s.assignedTo),
      ...(leads.map((l) => l.assignedTo).filter(Boolean) as string[]),
    ])
  );

  // Per-agent stats
  const agents: CloserStats[] = agentNames
    .map((name, idx) => {
      const agentSales = sales.filter((s) => s.assignedTo === name);
      const agentLeads = leads.filter((l) => l.assignedTo === name);

      const wonLeads = agentLeads.filter((l) => l.status === "won");
      const lostLeads = agentLeads.filter((l) => l.status === "lost");
      const meetingLeads = agentLeads.filter((l) =>
        l.meetingAt != null || ["meeting", "won", "lost"].includes(l.status)
      );
      const scheduledLeads = agentLeads.filter((l) =>
        l.scheduledAt != null || ["scheduled", "meeting", "won", "lost"].includes(l.status)
      );

      const vendas = wonLeads.length;
      const totalReunioes = meetingLeads.length;
      const receita = agentSales.reduce((s, sale) => s + sale.value, 0);
      const ticketMedio = vendas > 0 ? receita / vendas : 0;
      const taxaWin =
        totalReunioes > 0
          ? (vendas / totalReunioes) * 100
          : 0;
      const reunioesPorVenda =
        vendas > 0 ? parseFloat((totalReunioes / vendas).toFixed(1)) : 0;

      // No-show: ~18% seeded
      const noShowCount = scheduledLeads.filter(
        (_, i) => seeded(idx * 41 + i, 0, 4) === 0
      ).length;
      const taxaNoShow =
        scheduledLeads.length > 0
          ? parseFloat(((noShowCount / scheduledLeads.length) * 100).toFixed(1))
          : 0;

      const leadTimeTotalDias = parseFloat((seeded(idx * 61, 14, 60) + Math.random() * 5).toFixed(1));
      return {
        agentName: name,
        vendas,
        totalReunioes,
        totalReunioes2: 0,
        totalNegociacoes: 0,
        receita: parseFloat(receita.toFixed(2)),
        ticketMedio: parseFloat(ticketMedio.toFixed(2)),
        taxaWin: parseFloat(taxaWin.toFixed(1)),
        reunioesPorVenda,
        taxaNoShow,
        leadTimeTotalDias,
      };
    })
    .sort((a, b) => b.receita - a.receita);

  // Deal cards: won sales + lost leads
  const wonDeals: DealCard[] = sales.map((s) => ({
    id: s.id,
    clientName: s.clientName,
    assignedTo: s.assignedTo,
    value: s.value,
    closedAt: s.closedAt.toISOString(),
    status: "won",
    lostReason: null,
    campaignName: s.campaignId ?? null,
  }));

  const lostDeals: DealCard[] = leads
    .filter((l) => l.status === "lost")
    .map((l) => ({
      id: l.id,
      clientName: `Lead #${l.id.slice(-4).toUpperCase()}`,
      assignedTo: l.assignedTo ?? "—",
      value: l.dealValue ?? 0,
      closedAt: (l.closedAt ?? l.createdAt).toISOString(),
      status: "lost",
      lostReason: l.lostReason ?? "Não informado",
      campaignName: l.campaignName ?? null,
    }));

  const deals: DealCard[] = [...wonDeals, ...lostDeals].sort(
    (a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
  );

  // Loss reasons summary
  const reasonMap: Record<string, number> = {};
  for (const d of lostDeals) {
    const r = d.lostReason ?? "Não informado";
    reasonMap[r] = (reasonMap[r] ?? 0) + 1;
  }
  const lossReasons: LossReason[] = Object.entries(reasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // Totals
  const totalVendas   = agents.reduce((s, a) => s + a.vendas, 0);
  const totalReceita  = agents.reduce((s, a) => s + a.receita, 0);
  const totalReunioes = agents.reduce((s, a) => s + a.totalReunioes, 0);
  const mockTotalReunioes2 = 0;
  const mockTotalNegociacoes = 0;
  const totalWon = leads.filter((l) => l.status === "won").length;

  return {
    agents,
    deals,
    lossReasons,
    totals: {
      vendas: totalVendas,
      receita: parseFloat(totalReceita.toFixed(2)),
      ticketMedioGeral: totalVendas > 0 ? parseFloat((totalReceita / totalVendas).toFixed(2)) : 0,
      taxaWinGeral:
        totalReunioes > 0 ? parseFloat(((totalVendas / totalReunioes) * 100).toFixed(1)) : 0,
      totalWon,
      totalReunioes,
      totalReunioes2: mockTotalReunioes2,
      totalNegociacoes: mockTotalNegociacoes,
      noShowGeral: parseFloat(
        (agents.reduce((s, a) => s + a.taxaNoShow, 0) / Math.max(agents.length, 1)).toFixed(1)
      ),
      leadTimeMedioGeral: parseFloat(
        (agents.filter((a) => a.leadTimeTotalDias > 0).reduce((s, a) => s + a.leadTimeTotalDias, 0) /
          Math.max(agents.filter((a) => a.leadTimeTotalDias > 0).length, 1)).toFixed(1)
      ),
    },
  };
}

// ─── Real DB ──────────────────────────────────────────────────────────────────

async function buildRealResult(startDate: Date, endDate: Date): Promise<CloserApiResponse> {
  const [salesRows, leadsRows, closerVendedores] = await Promise.all([
    prisma.sale.findMany({
      where: { closedAt: { gte: startDate, lte: endDate } },
      orderBy: { closedAt: "desc" },
    }),
    prisma.lead.findMany({
      where: {
        OR: [
          { meetingAt:   { gte: startDate, lte: endDate } },
          { scheduledAt: { gte: startDate, lte: endDate } },
          { closedAt:    { gte: startDate, lte: endDate } },
          { noShowAt:    { gte: startDate, lte: endDate } },
        ],
      },
      select: {
        id: true,
        assignedTo: true,
        status: true,
        createdAt: true,
        arrivalAt: true,
        closedAt: true,
        dealValue: true,
        lostReason: true,
        campaignName: true,
        scheduledAt: true,
        meetingAt: true,
        meeting2At: true,
        negociacaoAt: true,
        noShow: true,
        noShowAt: true,
        sdrScore: true,
      },
    }),
    // Apenas closers ativos cadastrados
    prisma.vendedor.findMany({
      where: { role: "CLOSER", status: "ATIVO" },
      select: { nome: true },
    }),
  ]);

  // Resolve se um assignedTo (lead ou sale) pertence a um closer cadastrado.
  // Usa match parcial: "Célia Santos" bate com vendedor "Célia", e vice-versa.
  const matchesCloser = (assigned: string | null | undefined, closerNome: string | null | undefined): boolean => {
    if (!assigned || !closerNome) return false;
    const a = assigned.toLowerCase();
    const c = closerNome.toLowerCase();
    return a.startsWith(c) || c.startsWith(a.split(" ")[0]);
  };

  // Usa o nome do vendedor (cadastro) como nome canônico para exibição
  const agentNames = closerVendedores.map((v) => v.nome);

  const agents: CloserStats[] = agentNames
    .map((name) => {
      const agentSales = salesRows.filter((s) => matchesCloser(s.assignedTo, name));
      const agentLeads = leadsRows.filter((l) => l.assignedTo != null && matchesCloser(l.assignedTo, name));

      // Reuniões realizadas NO PERÍODO: apenas leads com meetingAt dentro do range
      const meetingLeads = agentLeads.filter((l) =>
        l.meetingAt != null && l.meetingAt >= startDate && l.meetingAt <= endDate
      );

      // 2ª Reunião e Negociação no período
      const meeting2Leads = agentLeads.filter((l) =>
        (l as any).meeting2At != null && (l as any).meeting2At >= startDate && (l as any).meeting2At <= endDate
      );
      const negociacaoLeads = agentLeads.filter((l) =>
        (l as any).negociacaoAt != null && (l as any).negociacaoAt >= startDate && (l as any).negociacaoAt <= endDate
      );

      // Agendamentos no período
      const scheduledLeads = agentLeads.filter((l) =>
        l.scheduledAt != null && l.scheduledAt >= startDate && l.scheduledAt <= endDate
      );

      // Fonte de verdade para vendas = tabela Sale
      const vendas           = agentSales.length;
      const totalReunioes    = meetingLeads.length;
      const totalReunioes2   = meeting2Leads.length;
      const totalNegociacoes = negociacaoLeads.length;
      const receita          = agentSales.reduce((s, sale) => s + sale.value, 0);
      const ticketMedio      = vendas > 0 ? receita / vendas : 0;
      // Win rate = vendas fechadas no período / reuniões realizadas no período
      const taxaWin          = totalReunioes > 0 ? (vendas / totalReunioes) * 100 : 0;
      const reunioesPorVenda = vendas > 0 ? parseFloat((totalReunioes / vendas).toFixed(1)) : 0;

      // No-show: noShowAt no período
      const noShowCount = agentLeads.filter(
        (l) => l.noShowAt != null && l.noShowAt >= startDate && l.noShowAt <= endDate
      ).length;
      const taxaNoShow =
        scheduledLeads.length > 0
          ? parseFloat(((noShowCount / scheduledLeads.length) * 100).toFixed(1))
          : 0;

      // Lead Time: createdAt → closedAt para leads fechados no período
      const leadTimeSamples = agentLeads
        .filter((l) => l.closedAt != null && l.closedAt >= startDate && l.closedAt <= endDate)
        .map((l) => (l.closedAt!.getTime() - l.createdAt.getTime()) / 86400000)
        .filter((v) => v >= 0);
      const leadTimeTotalDias =
        leadTimeSamples.length > 0
          ? parseFloat((leadTimeSamples.reduce((s, v) => s + v, 0) / leadTimeSamples.length).toFixed(1))
          : 0;

      return {
        agentName: name,
        vendas,
        totalReunioes,
        totalReunioes2: (typeof totalReunioes2 !== 'undefined' ? totalReunioes2 : 0),
        totalNegociacoes: (typeof totalNegociacoes !== 'undefined' ? totalNegociacoes : 0),
        receita: parseFloat(receita.toFixed(2)),
        ticketMedio: parseFloat(ticketMedio.toFixed(2)),
        taxaWin: parseFloat(taxaWin.toFixed(1)),
        reunioesPorVenda,
        taxaNoShow,
        leadTimeTotalDias,
      };
    })
    .sort((a, b) => b.receita - a.receita);

  // Deal cards
  const wonDeals: DealCard[] = salesRows.map((s) => ({
    id: s.id,
    clientName: s.clientName,
    assignedTo: s.assignedTo,
    value: s.value,
    closedAt: s.closedAt.toISOString(),
    status: "won",
    lostReason: null,
    campaignName: s.campaignId ?? null,
  }));

  const lostDeals: DealCard[] = leadsRows
    .filter((l) => l.status === "lost")
    .map((l) => ({
      id: l.id,
      clientName: `Lead #${l.id.slice(-4).toUpperCase()}`,
      assignedTo: l.assignedTo ?? "—",
      value: l.dealValue ?? 0,
      closedAt: (l.closedAt ?? l.createdAt).toISOString(),
      status: "lost",
      lostReason: l.lostReason ?? "Não informado",
      campaignName: l.campaignName ?? null,
    }));

  const deals: DealCard[] = [...wonDeals, ...lostDeals].sort(
    (a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()
  );

  const reasonMap: Record<string, number> = {};
  for (const d of lostDeals) {
    const r = d.lostReason ?? "Não informado";
    reasonMap[r] = (reasonMap[r] ?? 0) + 1;
  }
  const lossReasons: LossReason[] = Object.entries(reasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // Usa salesRows diretamente para não perder vendas de closers externos ou sem match
  const totalVendas      = salesRows.length;
  const totalReceita     = salesRows.reduce((s, r) => s + r.value, 0);
  const totalReunioes    = agents.reduce((s, a) => s + a.totalReunioes, 0);
  const totalReunioes2   = agents.reduce((s, a) => s + a.totalReunioes2, 0);
  const totalNegociacoes = agents.reduce((s, a) => s + a.totalNegociacoes, 0);
  // Totais apenas sobre os leads dos closers cadastrados
  const closerLeads = leadsRows.filter((l) =>
    l.assignedTo != null && agentNames.some((n) => matchesCloser(l.assignedTo!, n))
  );
  const totalWon = closerLeads.filter((l) => l.status === "won").length;

  return {
    agents,
    deals,
    lossReasons,
    totals: {
      vendas: totalVendas,
      receita: parseFloat(totalReceita.toFixed(2)),
      ticketMedioGeral:
        totalVendas > 0 ? parseFloat((totalReceita / totalVendas).toFixed(2)) : 0,
      // Win rate = vendas / reuniões realizadas no período (mesma fórmula por agente)
      taxaWinGeral:
        totalReunioes > 0 ? parseFloat(((totalVendas / totalReunioes) * 100).toFixed(1)) : 0,
      totalWon,
      totalReunioes,
      totalReunioes2: typeof totalReunioes2 !== "undefined" ? totalReunioes2 : 0,
      totalNegociacoes: typeof totalNegociacoes !== "undefined" ? totalNegociacoes : 0,
      noShowGeral: parseFloat(
        (agents.reduce((s, a) => s + a.taxaNoShow, 0) / Math.max(agents.length, 1)).toFixed(1)
      ),
      leadTimeMedioGeral: parseFloat(
        (agents.filter((a) => a.leadTimeTotalDias > 0).reduce((s, a) => s + a.leadTimeTotalDias, 0) /
          Math.max(agents.filter((a) => a.leadTimeTotalDias > 0).length, 1)).toFixed(1)
      ),
    },
  };
}
