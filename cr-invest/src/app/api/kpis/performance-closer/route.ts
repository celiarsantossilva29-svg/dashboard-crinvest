export const dynamic = 'force-dynamic';

// GET /api/kpis/performance-closer?start=YYYY-MM-DD&end=YYYY-MM-DD

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { USE_MOCK, getMockLeads, getMockSales } from "@/lib/mock-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CloserStats {
  agentName: string;
  vendas: number;
  cancelamentos: number;
  taxaCancelamento: number;
  totalReunioes: number;
  totalReunioes2: number;
  totalReunioes2Realizadas: number;
  totalNegociacoes: number;
  receita: number;
  ticketMedio: number;
  taxaWin: number;
  reunioesPorVenda: number;
  taxaNoShow: number;
  /** Absolutos para agregar noShowGeral sem média de médias */
  noShowCount: number;
  totalSlots: number;
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
  contracts?: number; // número de cotas agrupadas
}

export interface LossReason {
  reason: string;
  count: number;
}

export interface CloserApiResponse {
  agents: CloserStats[];
  deals: DealCard[];
  lossReasons: LossReason[];
  funilSnapshot: {
    reuniao1Realizada: number;
    reuniao2Agendada: number;
    reuniao2Realizada: number;
    negociacao: number;
    wonCount: number;
  };
  totals: {
    vendas: number;
    receita: number;
    ticketMedioGeral: number;
    taxaWinGeral: number;
    totalWon: number;
    totalReunioes: number;
    totalReunioes2: number;
    totalReunioes2Realizadas: number;
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
      const totalSlots = scheduledLeads.length;
      const taxaNoShow =
        totalSlots > 0
          ? parseFloat(((noShowCount / totalSlots) * 100).toFixed(1))
          : 0;

      const leadTimeTotalDias = parseFloat((seeded(idx * 61, 14, 60) + Math.random() * 5).toFixed(1));
      return {
        agentName: name,
        vendas,
        cancelamentos: 0,
        taxaCancelamento: 0,
        totalReunioes,
        totalReunioes2: 0,
        totalReunioes2Realizadas: 0,
        totalNegociacoes: 0,
        receita: parseFloat(receita.toFixed(2)),
        ticketMedio: parseFloat(ticketMedio.toFixed(2)),
        taxaWin: parseFloat(taxaWin.toFixed(1)),
        reunioesPorVenda,
        taxaNoShow,
        noShowCount,
        totalSlots,
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
    funilSnapshot: { reuniao1Realizada: 0, reuniao2Agendada: 0, reuniao2Realizada: 0, negociacao: 0, wonCount: 0 },
    totals: {
      vendas: totalVendas,
      receita: parseFloat(totalReceita.toFixed(2)),
      ticketMedioGeral: totalVendas > 0 ? parseFloat((totalReceita / totalVendas).toFixed(2)) : 0,
      taxaWinGeral:
        totalReunioes > 0 ? parseFloat(((totalVendas / totalReunioes) * 100).toFixed(1)) : 0,
      totalWon,
      totalReunioes,
      totalReunioes2: mockTotalReunioes2,
      totalReunioes2Realizadas: 0,
      totalNegociacoes: mockTotalNegociacoes,
      noShowGeral: (() => {
        const totalNS = agents.reduce((s, a) => s + a.noShowCount, 0);
        const totalSl = agents.reduce((s, a) => s + a.totalSlots, 0);
        return totalSl > 0 ? parseFloat(((totalNS / totalSl) * 100).toFixed(1)) : 0;
      })(),
      leadTimeMedioGeral: parseFloat(
        (agents.filter((a) => a.leadTimeTotalDias > 0).reduce((s, a) => s + a.leadTimeTotalDias, 0) /
          Math.max(agents.filter((a) => a.leadTimeTotalDias > 0).length, 1)).toFixed(1)
      ),
    },
  };
}

// ─── normDoc: CPF/CNPJ normalizado (remove não-dígitos; trunca p/ 14 CNPJ ou 11 CPF) ──────
function normDoc(raw: string | null | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length >= 14) return d.slice(-14);
  if (d.length >= 11) return d.slice(-11);
  return d;
}

// ─── Real DB ──────────────────────────────────────────────────────────────────

async function buildRealResult(startDate: Date, endDate: Date): Promise<CloserApiResponse> {
  const [salesRows, leadsRows, closerVendedores, cohortLeads] = await Promise.all([
    prisma.sale.findMany({
      where: { closedAt: { gte: startDate, lte: endDate } },
      orderBy: { closedAt: "desc" },
    }),
    prisma.lead.findMany({
      where: {
        OR: [
          { meetingAt:    { gte: startDate, lte: endDate } },
          { scheduledAt:  { gte: startDate, lte: endDate } },
          { closedAt:     { gte: startDate, lte: endDate } },
          { noShowAt:     { gte: startDate, lte: endDate } },
          { meeting2At:           { gte: startDate, lte: endDate } },
          { meeting2RealizadaAt:  { gte: startDate, lte: endDate } },
          { negociacaoAt:         { gte: startDate, lte: endDate } },
        ],
      },
      select: {
        id: true,
        name: true,
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
        meeting2RealizadaAt: true,
        negociacaoAt: true,
        reagendadoAt: true,
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
    // Funil snapshot: estado atual dos leads CRIADOS no período (igual à visão Kommo filtrada por criação)
    // Exclui PÓS-VENDAS 2.0 (base histórica importada em bloco)
    prisma.lead.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        OR: [{ campaignName: null }, { campaignName: { not: "PÓS-VENDAS 2.0" } }],
      },
      select: {
        status: true,
        meetingAt: true,
        meeting2At: true,
        meeting2RealizadaAt: true,
        negociacaoAt: true,
      },
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

      // Reuniões realizadas NO PERÍODO — âncora primária: meetingAt; fallback: scheduledAt.
      // Mesmo critério do performance-sdr: leads com meetingAt preenchido usam meetingAt;
      // leads com meetingAt=null (sync pendente) usam scheduledAt como proxy.
      const meetingLeads = agentLeads.filter((l) => {
        if (!["meeting", "won", "lost"].includes(l.status ?? "")) return false;
        const anchor = l.meetingAt ?? l.scheduledAt;
        return anchor != null && anchor >= startDate && anchor <= endDate;
      });

      // 2ª Reunião Agendada, 2ª Reunião Realizada e Negociação no período
      const meeting2Leads = agentLeads.filter((l) =>
        (l as any).meeting2At != null && (l as any).meeting2At >= startDate && (l as any).meeting2At <= endDate
      );
      const meeting2RealizadaLeads = agentLeads.filter((l) =>
        (l as any).meeting2RealizadaAt != null && (l as any).meeting2RealizadaAt >= startDate && (l as any).meeting2RealizadaAt <= endDate
      );
      const negociacaoLeads = agentLeads.filter((l) =>
        (l as any).negociacaoAt != null && (l as any).negociacaoAt >= startDate && (l as any).negociacaoAt <= endDate
      );

      // Agendamentos no período (novos) + reagendamentos (tentativas de recuperação)
      const scheduledLeads = agentLeads.filter((l) =>
        l.scheduledAt != null && l.scheduledAt >= startDate && l.scheduledAt <= endDate
      );
      const reagendadosCount = agentLeads.filter((l) =>
        (l as any).reagendadoAt != null &&
        (l as any).reagendadoAt >= startDate &&
        (l as any).reagendadoAt <= endDate
      ).length;
      // Denominador unificado: cada slot (agendamento novo + reagendamento) pode virar
      // reunião ou no-show → comparecimento% + no-show% usa este mesmo denominador.
      const totalSlots = scheduledLeads.length + reagendadosCount;

      // Fonte de verdade para vendas = tabela Sale (mesmo CPF/CNPJ no mesmo dia BRT = 1 venda)
      const cancelamentos    = agentSales.filter((s) => s.statusValidacao === "reprovado").length;
      const validAgentSales  = agentSales.filter((s) => s.statusValidacao !== "reprovado");
      const vendas = (() => {
        const seen = new Set<string>();
        for (const s of validAgentSales) {
          const norm = normDoc(s.clienteCpf);
          const cpfKey = norm.length >= 11 ? norm : `name:${(s.clientName ?? "").toLowerCase().trim()}`;
          const brtDay = new Date(s.closedAt.getTime() - 3 * 3600 * 1000).toISOString().split("T")[0];
          seen.add(`${cpfKey}::${brtDay}`);
        }
        return seen.size;
      })();
      const taxaCancelamento = agentSales.length > 0 ? parseFloat(((cancelamentos / agentSales.length) * 100).toFixed(1)) : 0;
      const totalReunioes           = meetingLeads.length;
      const totalReunioes2          = meeting2Leads.length;
      const totalReunioes2Realizadas = meeting2RealizadaLeads.length;
      const totalNegociacoes        = negociacaoLeads.length;
      const receita          = agentSales.reduce((s, sale) => s + sale.value, 0);
      const ticketMedio      = vendas > 0 ? receita / vendas : 0;
      // Win rate = vendas fechadas no período / reuniões realizadas no período
      const taxaWin          = totalReunioes > 0 ? (vendas / totalReunioes) * 100 : 0;
      const reunioesPorVenda = vendas > 0 ? parseFloat((totalReunioes / vendas).toFixed(1)) : 0;

      // No-show: noShowAt no período COM perdão — exclui leads que no-showaram mas
      // eventualmente compareceram (meetingAt preenchido ou status=meeting/won).
      // Denominador = totalSlots (agendamentos + reagendamentos) — mesmo denominador
      // usado para comparecimento% → comparecimento% + no-show% ≈ 100% para período fechado.
      const noShowCount = agentLeads.filter((l) => {
        if (l.noShowAt == null || l.noShowAt < startDate || l.noShowAt > endDate) return false;
        if (l.meetingAt != null || l.status === "won" || l.status === "meeting") return false;
        return true;
      }).length;
      const taxaNoShow = totalSlots > 0
        ? parseFloat(((noShowCount / totalSlots) * 100).toFixed(1))
        : 0;

      // Lead Time: Sale.closedAt − Lead.createdAt (fonte de verdade = tabela Sale).
      // Kommo retorna closed_at=0 para muitos leads won → Lead.closedAt é null nesses casos.
      // Usa Sale.closedAt (sempre preenchido) e tenta casar com o lead pelo nome.
      // Exclui leads importados em lote onde closedAt===createdAt (ruído de PÓS-VENDAS 2.0).
      const wonLeadsForLT = agentLeads.filter((l) =>
        l.status === "won" &&
        !(l.closedAt != null && l.closedAt.getTime() === l.createdAt.getTime())
      );
      const leadTimeSamples: number[] = [];
      for (const sale of validAgentSales) {
        let leadCreatedAt: Date | undefined;
        // 1. Match via leadId (mais preciso)
        if (sale.leadId) {
          const byId = wonLeadsForLT.find((l) => l.id === sale.leadId);
          if (byId) leadCreatedAt = byId.createdAt;
        }
        // 2. Match via primeiro token do clientName (fuzzy, > 2 chars)
        if (!leadCreatedAt) {
          const firstToken = sale.clientName.toLowerCase().split(/\s+/).find((t) => t.length > 2);
          if (firstToken) {
            const byName = wonLeadsForLT.find((l) =>
              (l.name ?? "").toLowerCase().includes(firstToken)
            );
            if (byName) leadCreatedAt = byName.createdAt;
          }
        }
        if (leadCreatedAt) {
          const days = (sale.closedAt.getTime() - leadCreatedAt.getTime()) / 86400000;
          if (days >= 0) leadTimeSamples.push(days);
        }
      }

      const leadTimeTotalDias =
        leadTimeSamples.length > 0
          ? parseFloat((leadTimeSamples.reduce((s, v) => s + v, 0) / leadTimeSamples.length).toFixed(1))
          : 0;

      return {
        agentName: name,
        vendas,
        cancelamentos,
        taxaCancelamento,
        totalReunioes,
        totalReunioes2: (typeof totalReunioes2 !== 'undefined' ? totalReunioes2 : 0),
        totalReunioes2Realizadas: (typeof totalReunioes2Realizadas !== 'undefined' ? totalReunioes2Realizadas : 0),
        totalNegociacoes: (typeof totalNegociacoes !== 'undefined' ? totalNegociacoes : 0),
        receita: parseFloat(receita.toFixed(2)),
        ticketMedio: parseFloat(ticketMedio.toFixed(2)),
        taxaWin: parseFloat(taxaWin.toFixed(1)),
        reunioesPorVenda,
        taxaNoShow,
        noShowCount,   // absoluto — para agregar noShowGeral sem média de médias
        totalSlots,    // denominador — idem
        leadTimeTotalDias,
      };
    })
    .sort((a, b) => b.receita - a.receita);

  // Vendas válidas (sem reprovadas) — base para deal cards e totais
  const validSalesRows = salesRows.filter((s) => s.statusValidacao !== "reprovado");

  // Deal cards — won: agrupados por cliente único (soma cotas do mesmo cliente)
  const wonByClient = new Map<string, { value: number; assignedTo: string; closedAt: Date; campaignId: string | null; contracts: number }>();
  for (const s of validSalesRows) {
    const existing = wonByClient.get(s.clientName);
    if (existing) {
      existing.value += s.value;
      existing.contracts += 1;
      if (s.closedAt > existing.closedAt) existing.closedAt = s.closedAt;
    } else {
      wonByClient.set(s.clientName, { value: s.value, assignedTo: s.assignedTo, closedAt: s.closedAt, campaignId: s.campaignId ?? null, contracts: 1 });
    }
  }
  const wonDeals: DealCard[] = Array.from(wonByClient.entries()).map(([clientName, d]) => ({
    id: clientName,
    clientName,
    assignedTo: d.assignedTo,
    value: d.value,
    closedAt: d.closedAt.toISOString(),
    status: "won" as const,
    lostReason: null,
    campaignName: d.campaignId,
    contracts: d.contracts,
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

  // Funil snapshot — estado atual dos leads criados no período (mesma visão do Kommo filtrado por criação)
  // Usa status + presença de campos para identificar etapa atual sem depender 100% de timestamps de evento:
  //   "1° Reunião Realizada" → status="meeting" (meetingAt setado, ainda não agendou 2ª)
  //   "2° Reunião AGENDADA"  → status="scheduled" E meetingAt!=null OU meeting2At setado
  //   "Negociação"           → negociacaoAt setado  (status="meeting" tb, mas negociacaoAt distingue)
  const notClosed = (l: { status: string }) => l.status !== "won" && l.status !== "lost";
  const isIn2aAgendada = (l: any) =>
    (l.meeting2At != null || (l.status === "scheduled" && l.meetingAt != null)) &&
    l.meeting2RealizadaAt == null && l.negociacaoAt == null && notClosed(l);
  const funilSnapshot = {
    reuniao1Realizada:  cohortLeads.filter(l => l.status === "meeting" && l.meetingAt != null && l.negociacaoAt == null && notClosed(l)).length,
    reuniao2Agendada:   cohortLeads.filter(l => isIn2aAgendada(l)).length,
    reuniao2Realizada:  cohortLeads.filter(l => l.meeting2RealizadaAt != null && l.negociacaoAt == null && notClosed(l)).length,
    negociacao:         cohortLeads.filter(l => l.negociacaoAt != null && notClosed(l)).length,
    wonCount:           cohortLeads.filter(l => l.status === "won").length,
  };

  // Usa salesRows: mesmo CPF/CNPJ no mesmo dia BRT = 1 venda (independente do nº de cotas)
  const totalVendas = (() => {
    const seen = new Set<string>();
    for (const s of validSalesRows) {
      const norm = normDoc(s.clienteCpf);
      const cpfKey = norm.length >= 11 ? norm : `name:${(s.clientName ?? "").toLowerCase().trim()}`;
      const brtDay = new Date(s.closedAt.getTime() - 3 * 3600 * 1000).toISOString().split("T")[0];
      seen.add(`${cpfKey}::${brtDay}`);
    }
    return seen.size;
  })();
  const totalReceita     = salesRows.reduce((s, r) => s + r.value, 0);
  const totalReunioes            = agents.reduce((s, a) => s + a.totalReunioes, 0);
  const totalReunioes2           = agents.reduce((s, a) => s + a.totalReunioes2, 0);
  const totalReunioes2Realizadas = agents.reduce((s, a) => s + (a.totalReunioes2Realizadas ?? 0), 0);
  const totalNegociacoes         = agents.reduce((s, a) => s + a.totalNegociacoes, 0);
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
      totalReunioes2Realizadas: typeof totalReunioes2Realizadas !== "undefined" ? totalReunioes2Realizadas : 0,
      totalNegociacoes: typeof totalNegociacoes !== "undefined" ? totalNegociacoes : 0,
      // noShowGeral: agregado correto = total de no-shows / total de slots (todos os closers)
      // Não usa média de taxas individuais (que daria peso igual a closers com volumes diferentes).
      noShowGeral: (() => {
        const totalNS = agents.reduce((s, a) => s + a.noShowCount, 0);
        const totalSl = agents.reduce((s, a) => s + a.totalSlots, 0);
        return totalSl > 0 ? parseFloat(((totalNS / totalSl) * 100).toFixed(1)) : 0;
      })(),
      leadTimeMedioGeral: parseFloat(
        (agents.filter((a) => a.leadTimeTotalDias > 0).reduce((s, a) => s + a.leadTimeTotalDias, 0) /
          Math.max(agents.filter((a) => a.leadTimeTotalDias > 0).length, 1)).toFixed(1)
      ),
    },
    funilSnapshot,
  };
}
