// GET /api/kpis/performance-sdr?start=YYYY-MM-DD&end=YYYY-MM-DD

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { USE_MOCK, getMockLeads, getMockDialerMetrics } from "@/lib/mock-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SdrStats {
  agentName: string;
  // Funil
  leadsGerados: number;
  leadsNoFunil: number;        // leads ativos (não won/lost)
  // Esforço operacional
  speedToLeadMin: number;
  tentativasPorLead: number;
  ligacoesPorLead: number;     // intensidade: ligações / lead único
  tarefasVencidas: number;
  // Passagem de bastão
  agendamentos: number;
  agendPorDia: number;         // produtividade diária
  agendPorSemana: number;      // produtividade semanal
  taxaReagendamento: number;
  reagendados: number;         // count absoluto
  recuperacao: number;         // leads recuperados (lostReason != null + status ativo)
  recuperacaoMotivoTop: string | null;
  taxaNoShow: number;
  sdrScoreMedia: number;
  tempomaturacaoDias: number;
  // Discadores
  ligacoes: number;
  talkTimeSecs: number;
}

export interface FunilSdrRow {
  sdr: string;
  new: number;
  contacted: number;
  qualified: number;
  scheduled: number;
  meeting: number;
  won: number;
  lost: number;
  total: number;
}

export interface SdrApiResponse {
  stats: SdrStats[];
  totais: {
    leadsGerados: number;
    leadsNoFunil: number;
    tarefasVencidas: number;
    reagendados: number;
    recuperacao: number;
    recuperacaoMotivoTop: string | null;
    ligacoesPorLeadMedio: number;
    agendPorDiaMedio: number;
  };
  dailyLeads: { dia: number; date: string; leads: number }[];
  funilPorSdr: FunilSdrRow[];
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

    const numDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));

    const result: SdrApiResponse = USE_MOCK
      ? buildMockResponse(startDate, endDate, now, numDays)
      : await buildRealResponse(startDate, endDate, now, numDays);

    return NextResponse.json({ data: result, updatedAt, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

// ─── Mock ─────────────────────────────────────────────────────────────────────

function buildMockResponse(startDate: Date, endDate: Date, now: Date, numDays: number): SdrApiResponse {
  const leads = getMockLeads().filter(
    (l) => l.createdAt >= startDate && l.createdAt <= endDate
  );
  const dialerRows = getMockDialerMetrics().filter(
    (m) => m.date >= startDate && m.date <= endDate
  );

  const agentNames = Array.from(
    new Set<string>([
      ...(leads.map((l) => l.assignedTo).filter(Boolean) as string[]),
      ...dialerRows.map((d) => d.agentName),
    ])
  );

  const stats: SdrStats[] = agentNames.map((name, agentIdx) => {
    const agentLeads = leads.filter((l) => l.assignedTo === name);
    const agentDialer = dialerRows.filter((d) => d.agentName === name);

    const leadsNoFunil = agentLeads.filter((l) => !["won", "lost"].includes(l.status)).length;
    const reagendados = agentLeads.filter((_, i) => seeded(agentIdx * 37 + i, 0, 3) === 0).length;
    const recuperacao = agentLeads.filter(
      (_, i) => seeded(agentIdx * 53 + i, 0, 7) === 0
    ).length;

    const speedSamples = agentLeads
      .filter((l) => l.contactedAt)
      .map((l) => (l.contactedAt!.getTime() - l.createdAt.getTime()) / 60000);
    const speedToLeadMin =
      speedSamples.length > 0
        ? parseFloat((speedSamples.reduce((s, v) => s + v, 0) / speedSamples.length).toFixed(0))
        : seeded(agentIdx * 13 + 7, 8, 120);

    const tentativas =
      agentLeads.length > 0
        ? parseFloat((agentLeads.reduce((s, l) => s + l.interactionCount, 0) / agentLeads.length).toFixed(1))
        : 0;

    const activeLeads = agentLeads.filter((l) => !["won", "lost"].includes(l.status));
    const tarefasVencidas = activeLeads.filter((_, i) => seeded(agentIdx * 31 + i, 0, 6) === 0).length;

    const agendamentos = agentLeads.filter((l) =>
      ["scheduled", "meeting", "won", "lost"].includes(l.status)
    ).length;
    const agendPorDia = parseFloat((agendamentos / numDays).toFixed(2));
    const agendPorSemana = parseFloat((agendamentos / (numDays / 7)).toFixed(1));

    const reagendadosTotal = reagendados;
    const reagendadosConvertidos = Math.floor(reagendadosTotal * 0.55);
    const taxaReagendamento =
      reagendadosTotal > 0
        ? parseFloat(((reagendadosConvertidos / reagendadosTotal) * 100).toFixed(1))
        : 0;

    const comReuniao = agendamentos;
    const noShowCount = agentLeads.filter(
      (_, i) => ["scheduled", "meeting", "won", "lost"].includes(agentLeads[i]?.status ?? "") && seeded(agentIdx * 41 + i, 0, 4) === 0
    ).length;
    const taxaNoShow = comReuniao > 0 ? parseFloat(((noShowCount / comReuniao) * 100).toFixed(1)) : 0;

    const sdrScoreMedia = parseFloat((3.0 + seeded(agentIdx * 43, 0, 18) / 10).toFixed(1));

    const maturacaoSamples = agentLeads
      .filter((l) => l.scheduledAt)
      .map((l) => (l.scheduledAt!.getTime() - l.createdAt.getTime()) / 86400000);
    const tempomaturacaoDias =
      maturacaoSamples.length > 0
        ? parseFloat((maturacaoSamples.reduce((s, v) => s + v, 0) / maturacaoSamples.length).toFixed(1))
        : parseFloat((seeded(agentIdx * 47, 5, 21) + Math.random()).toFixed(1));

    const ligacoes = agentDialer.reduce((s, d) => s + d.totalCalls, 0);
    const talkTimeSecs = agentDialer.reduce((s, d) => s + d.talkTimeSecs, 0);
    const ligacoesPorLead = agentLeads.length > 0
      ? parseFloat((ligacoes / agentLeads.length).toFixed(1))
      : 0;

    return {
      agentName: name,
      leadsGerados: agentLeads.length,
      leadsNoFunil,
      speedToLeadMin,
      tentativasPorLead: tentativas,
      ligacoesPorLead,
      tarefasVencidas,
      agendamentos,
      agendPorDia,
      agendPorSemana,
      taxaReagendamento,
      reagendados,
      recuperacao,
      recuperacaoMotivoTop: recuperacao > 0 ? "Sem capital" : null,
      taxaNoShow,
      sdrScoreMedia,
      tempomaturacaoDias,
      ligacoes,
      talkTimeSecs,
    };
  }).sort((a, b) => b.agendamentos - a.agendamentos);

  // Daily leads
  const dailyLeads = Array.from({ length: numDays }).map((_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayLeads = leads.filter((l) => l.createdAt.toISOString().split("T")[0] === dateStr).length;
    return { dia: i + 1, date: dateStr, leads: dayLeads };
  });

  const totLeads = stats.reduce((s, r) => s + r.leadsGerados, 0);
  const totNoFunil = stats.reduce((s, r) => s + r.leadsNoFunil, 0);
  const totVencidas = stats.reduce((s, r) => s + r.tarefasVencidas, 0);
  const totReagendados = stats.reduce((s, r) => s + r.reagendados, 0);
  const totRecuperacao = stats.reduce((s, r) => s + r.recuperacao, 0);

  const funilPorSdr: FunilSdrRow[] = agentNames.map((name) => {
    const al = leads.filter((l) => l.assignedTo === name);
    const count = (s: string) => al.filter((l) => l.status === s).length;
    const total = al.length;
    return { sdr: name, new: count("new"), contacted: count("contacted"), qualified: count("qualified"), scheduled: count("scheduled"), meeting: count("meeting"), won: count("won"), lost: count("lost"), total };
  }).sort((a, b) => b.total - a.total);

  return {
    stats,
    totais: {
      leadsGerados: totLeads,
      leadsNoFunil: totNoFunil,
      tarefasVencidas: totVencidas,
      reagendados: totReagendados,
      recuperacao: totRecuperacao,
      recuperacaoMotivoTop: totRecuperacao > 0 ? "Sem capital" : null,
      ligacoesPorLeadMedio: parseFloat(
        (stats.filter((s) => s.ligacoesPorLead > 0).reduce((acc, s) => acc + s.ligacoesPorLead, 0) /
          Math.max(stats.filter((s) => s.ligacoesPorLead > 0).length, 1)).toFixed(1)
      ),
      agendPorDiaMedio: parseFloat(
        (stats.reduce((acc, s) => acc + s.agendPorDia, 0) / Math.max(stats.length, 1)).toFixed(2)
      ),
    },
    dailyLeads,
    funilPorSdr,
  };
}

// ─── Real DB ──────────────────────────────────────────────────────────────────

async function buildRealResponse(startDate: Date, endDate: Date, now: Date, numDays: number): Promise<SdrApiResponse> {
  const [leadsRows, dialerRows] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: {
        assignedTo: true,
        status: true,
        createdAt: true,
        arrivalAt: true,
        firstContactAt: true,
        contactedAt: true,
        contactAttempts: true,
        interactionCount: true,
        scheduledAt: true,
        nextTaskAt: true,
        isReagendado: true,
        noShow: true,
        sdrScore: true,
        lostReason: true,
      },
    }),
    prisma.dialerMetrics.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      select: { agentName: true, totalCalls: true, talkTimeSecs: true },
    }),
  ]);

  const agentNames = Array.from(
    new Set<string>([
      ...(leadsRows.map((l) => l.assignedTo).filter(Boolean) as string[]),
      ...dialerRows.map((d) => d.agentName),
    ])
  );

  const stats: SdrStats[] = agentNames.map((name) => {
    const agentLeads = leadsRows.filter((l) => l.assignedTo === name);
    const agentDialer = dialerRows.filter((d) => d.agentName === name);

    const leadsNoFunil = agentLeads.filter((l) => !["won", "lost"].includes(l.status)).length;
    const reagendados = agentLeads.filter((l) => l.isReagendado).length;
    const recuperacao = agentLeads.filter(
      (l) => l.lostReason != null && !["won", "lost"].includes(l.status)
    ).length;

    // Recovery top reason
    const recoveryReasons = agentLeads
      .filter((l) => l.lostReason != null && !["won", "lost"].includes(l.status))
      .map((l) => l.lostReason!);
    const reasonCount: Record<string, number> = {};
    for (const r of recoveryReasons) reasonCount[r] = (reasonCount[r] ?? 0) + 1;
    const recuperacaoMotivoTop = Object.entries(reasonCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const speedSamples = agentLeads
      .filter((l) => (l.arrivalAt || l.createdAt) && (l.firstContactAt || l.contactedAt))
      .map((l) => {
        const from = l.arrivalAt ?? l.createdAt;
        const to = l.firstContactAt ?? l.contactedAt!;
        return (to.getTime() - from.getTime()) / 60000;
      })
      .filter((v) => v >= 0);
    const speedToLeadMin =
      speedSamples.length > 0
        ? parseFloat((speedSamples.reduce((s, v) => s + v, 0) / speedSamples.length).toFixed(0))
        : 0;

    const tentativas =
      agentLeads.length > 0
        ? parseFloat(
            (agentLeads.reduce((s, l) => s + (l.contactAttempts || l.interactionCount), 0) / agentLeads.length).toFixed(1)
          )
        : 0;

    const tarefasVencidas = agentLeads.filter(
      (l) => l.nextTaskAt && l.nextTaskAt < now && !["won", "lost"].includes(l.status)
    ).length;

    const agendamentos = agentLeads.filter((l) =>
      ["scheduled", "meeting", "won", "lost"].includes(l.status)
    ).length;
    const agendPorDia = parseFloat((agendamentos / numDays).toFixed(2));
    const agendPorSemana = parseFloat((agendamentos / (numDays / 7)).toFixed(1));

    const reagendadosForRate = agentLeads.filter((l) => l.isReagendado);
    const reagendadosConvertidos = reagendadosForRate.filter((l) =>
      ["scheduled", "meeting", "won"].includes(l.status)
    ).length;
    const taxaReagendamento =
      reagendadosForRate.length > 0
        ? parseFloat(((reagendadosConvertidos / reagendadosForRate.length) * 100).toFixed(1))
        : 0;

    const comReuniao = agendamentos;
    const noShowCount = agentLeads.filter((l) => l.noShow).length;
    const taxaNoShow = comReuniao > 0 ? parseFloat(((noShowCount / comReuniao) * 100).toFixed(1)) : 0;

    const scores = agentLeads.map((l) => l.sdrScore).filter((s): s is number => s !== null);
    const sdrScoreMedia =
      scores.length > 0
        ? parseFloat((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1))
        : 0;

    const maturacaoSamples = agentLeads
      .filter((l) => l.scheduledAt)
      .map((l) => (l.scheduledAt!.getTime() - l.createdAt.getTime()) / 86400000);
    const tempomaturacaoDias =
      maturacaoSamples.length > 0
        ? parseFloat((maturacaoSamples.reduce((s, v) => s + v, 0) / maturacaoSamples.length).toFixed(1))
        : 0;

    const ligacoes = agentDialer.reduce((s, d) => s + d.totalCalls, 0);
    const talkTimeSecs = agentDialer.reduce((s, d) => s + d.talkTimeSecs, 0);
    const ligacoesPorLead = agentLeads.length > 0
      ? parseFloat((ligacoes / agentLeads.length).toFixed(1))
      : 0;

    return {
      agentName: name,
      leadsGerados: agentLeads.length,
      leadsNoFunil,
      speedToLeadMin,
      tentativasPorLead: tentativas,
      ligacoesPorLead,
      tarefasVencidas,
      agendamentos,
      agendPorDia,
      agendPorSemana,
      taxaReagendamento,
      reagendados,
      recuperacao,
      recuperacaoMotivoTop,
      taxaNoShow,
      sdrScoreMedia,
      tempomaturacaoDias,
      ligacoes,
      talkTimeSecs,
    };
  }).sort((a, b) => b.agendamentos - a.agendamentos);

  // Daily leads breakdown
  const dailyLeads = Array.from({ length: numDays }).map((_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayLeads = leadsRows.filter((l) => l.createdAt.toISOString().split("T")[0] === dateStr).length;
    return { dia: i + 1, date: dateStr, leads: dayLeads };
  });

  const totLeads = stats.reduce((s, r) => s + r.leadsGerados, 0);
  const totNoFunil = stats.reduce((s, r) => s + r.leadsNoFunil, 0);
  const totVencidas = stats.reduce((s, r) => s + r.tarefasVencidas, 0);
  const totReagendados = stats.reduce((s, r) => s + r.reagendados, 0);
  const totRecuperacao = stats.reduce((s, r) => s + r.recuperacao, 0);

  // Top recovery reason across all agents
  const allRecoveryReasons = leadsRows
    .filter((l) => l.lostReason != null && !["won", "lost"].includes(l.status))
    .map((l) => l.lostReason!);
  const globalReasonCount: Record<string, number> = {};
  for (const r of allRecoveryReasons) globalReasonCount[r] = (globalReasonCount[r] ?? 0) + 1;
  const globalMotivoTop = Object.entries(globalReasonCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const funilPorSdr: FunilSdrRow[] = agentNames.map((name) => {
    const al = leadsRows.filter((l) => l.assignedTo === name);
    const count = (s: string) => al.filter((l) => l.status === s).length;
    const total = al.length;
    return { sdr: name, new: count("new"), contacted: count("contacted"), qualified: count("qualified"), scheduled: count("scheduled"), meeting: count("meeting"), won: count("won"), lost: count("lost"), total };
  }).sort((a, b) => b.total - a.total);

  return {
    stats,
    totais: {
      leadsGerados: totLeads,
      leadsNoFunil: totNoFunil,
      tarefasVencidas: totVencidas,
      reagendados: totReagendados,
      recuperacao: totRecuperacao,
      recuperacaoMotivoTop: globalMotivoTop,
      ligacoesPorLeadMedio: parseFloat(
        (stats.filter((s) => s.ligacoesPorLead > 0).reduce((acc, s) => acc + s.ligacoesPorLead, 0) /
          Math.max(stats.filter((s) => s.ligacoesPorLead > 0).length, 1)).toFixed(1)
      ),
      agendPorDiaMedio: parseFloat(
        (stats.reduce((acc, s) => acc + s.agendPorDia, 0) / Math.max(stats.length, 1)).toFixed(2)
      ),
    },
    dailyLeads,
    funilPorSdr,
  };
}
