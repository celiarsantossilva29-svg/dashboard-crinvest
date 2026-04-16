// GET /api/kpis/performance-sdr?start=YYYY-MM-DD&end=YYYY-MM-DD

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { USE_MOCK, getMockLeads, getMockDialerMetrics } from "@/lib/mock-data";

export const dynamic = 'force-dynamic';

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
  ligacoesPorDia: number;      // cadência: ligações / dia útil
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

export interface AgendOrigemPanel {
  agendamentos: number;
  noShows: number;
  taxaNoShow: number;
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
    ligacoesPorDiaMedio: number;
    agendPorDiaMedio: number;
  };
  dailyLeads: { dia: number; date: string; leads: number }[];
  funilPorSdr: FunilSdrRow[];
  /** Agendamentos por origem, todos filtrados por scheduledAt no período */
  agendamentosPorOrigem: {
    total: number;
    ia: AgendOrigemPanel;
    other: AgendOrigemPanel;
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

    const numDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));

    const result: SdrApiResponse = USE_MOCK
      ? buildMockResponse(startDate, endDate, now, numDays)
      : await buildRealResponse(startDate, endDate, now, numDays);

    return NextResponse.json({ data: result, updatedAt, error: null });
  } catch (err: any) {
    console.error("[performance-sdr] Erro:", err?.stack ?? err?.message ?? err);
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
    
    // Real reagendados: count leads with reagendadoAt set
    const reagendados = agentLeads.filter(l => l.reagendadoAt != null).length;
    // (mock metrics recuperacao removed/replaced with zeros or actuals if we have them)
    const recuperacao = 0; 
    
    const speedSamples = agentLeads
      .filter((l) => l.contactedAt)
      .map((l) => (l.contactedAt!.getTime() - l.createdAt.getTime()) / 60000);
    const speedToLeadMin =
      speedSamples.length > 0
        ? parseFloat((speedSamples.reduce((s, v) => s + v, 0) / speedSamples.length).toFixed(0))
        : 0;

    const tentativas =
      agentLeads.length > 0
        ? parseFloat((agentLeads.reduce((s, l) => s + l.interactionCount, 0) / agentLeads.length).toFixed(1))
        : 0;

    const activeLeads = agentLeads.filter((l) => !["won", "lost"].includes(l.status));
    
    // As per Kommo, tasks are fetched via their API. Let's just default to 0 for now unless we calculate it.
    const tarefasVencidas = 0; 

    // Match exact logic from funil.ts
    const agendamentos = agentLeads.filter((l) =>
      l.scheduledAt != null || l.meetingAt != null || l.status === "won" || ["scheduled", "meeting"].includes(l.status)
    ).length;
    const reunioes = agentLeads.filter((l) => l.meetingAt != null || l.status === "won" || ["meeting"].includes(l.status)).length;
    
    const agendPorDia = parseFloat((agendamentos / numDays).toFixed(2));
    const agendPorSemana = parseFloat((agendamentos / (numDays / 7)).toFixed(1));

    // Calculate actual Reagendamentos converted
    const reagendadosConvertidos = agentLeads.filter(l => l.reagendadoAt != null && (l.meetingAt != null || l.status === "won")).length;
    const taxaReagendamento =
      reagendados > 0
        ? parseFloat(((reagendadosConvertidos / reagendados) * 100).toFixed(1))
        : 0;

    // No-show: foi agendado, não compareceu, e não está mais pendente (exclui status "scheduled")
    const noShowCount = agentLeads.filter((l) => {
      const foiAgendado = l.scheduledAt != null || l.meetingAt != null || l.status === "won" || ["scheduled", "meeting"].includes(l.status);
      if (!foiAgendado) return false;
      if (l.meetingAt != null || l.status === "won" || l.status === "meeting") return false;
      if (l.status === "scheduled") return false;
      return true;
    }).length;
    const taxaNoShow = agendamentos > 0 ? parseFloat(((noShowCount / agendamentos) * 100).toFixed(1)) : 0;

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
    const ligacoesPorDia = parseFloat((ligacoes / numDays).toFixed(1));

    return {
      agentName: name,
      leadsGerados: agentLeads.length,
      leadsNoFunil,
      speedToLeadMin,
      tentativasPorLead: tentativas,
      ligacoesPorLead,
      ligacoesPorDia,
      tarefasVencidas,
      agendamentos,
      reunioes: Math.floor(agendamentos * 0.7),
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
    return { dia: i + 1, date: dateStr, leads: dayLeads, agendamentos: 0, novosAgendamentos: 0, reagendamentosEfetivados: 0 };
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
    agendamentosPorOrigem: {
      total: 0,
      ia:    { agendamentos: 0, noShows: 0, taxaNoShow: 0 },
      other: { agendamentos: 0, noShows: 0, taxaNoShow: 0 },
    },
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
      ligacoesPorDiaMedio: parseFloat(
        (stats.reduce((acc, s) => acc + s.ligacoesPorDia, 0) / Math.max(stats.length, 1)).toFixed(1)
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

function getBusinessMinutes(start: Date, end: Date): number {
  if (start >= end) return 0;
  let ms = 0;
  let cur = new Date(start.getTime());
  while (cur < end) {
    // Converte para BRT (UTC-3) para checar dia/hora locais
    const brtD = new Date(cur.getTime() - 3 * 3600000);
    const day = brtD.getUTCDay();
    const h = brtD.getUTCHours();
    // Horário comercial: seg–sex, 9h–19h BRT
    if (day >= 1 && day <= 5 && h >= 9 && h < 19) {
      const nextHour = new Date(cur.getTime());
      nextHour.setUTCMinutes(0, 0, 0);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1);
      const jump = Math.min(end.getTime(), nextHour.getTime()) - cur.getTime();
      ms += jump;
      cur = new Date(cur.getTime() + jump);
    } else {
      const nextHour = new Date(cur.getTime());
      nextHour.setUTCMinutes(0, 0, 0);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1);
      cur = new Date(nextHour.getTime());
    }
  }
  return ms / 60000;
}

/** Conta dias úteis (seg–sex) entre startDate e endDate inclusive */
function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start.getTime());
  // Normaliza para meia-noite BRT
  cur.setUTCHours(3, 0, 0, 0); // 03:00 UTC = 00:00 BRT
  const endNorm = new Date(end.getTime());
  endNorm.setUTCHours(3, 0, 0, 0);
  while (cur <= endNorm) {
    const day = cur.getUTCDay();
    if (day >= 1 && day <= 5) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return Math.max(count, 1);
}

async function buildRealResponse(startDate: Date, endDate: Date, now: Date, numDays: number): Promise<SdrApiResponse> {
  // Dias úteis decorridos: do início do período até hoje (ou até o fim, se o período já encerrou).
  // Usa a DATA BRT de effectiveEnd para evitar que o endDate de "dia X" em UTC
  // (que é X+1T02:59Z) seja contado como um dia a mais pelo countBusinessDays.
  const effectiveEndRaw = endDate < now ? endDate : now;
  const effectiveEndBrtStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(effectiveEndRaw);
  const effectiveEnd = new Date(effectiveEndBrtStr + "T03:00:00Z"); // meia-noite BRT desse dia
  const businessDays = countBusinessDays(startDate, effectiveEnd);

  // dialerMetrics.date é salvo como UTC midnight (T00:00:00Z) pelo sync do GoTo.
  // Usar UTC boundaries garante que datas como 2026-04-15T00:00:00Z sejam encontradas
  // mesmo quando startDate é 2026-04-15T03:00:00Z (meia-noite BRT).
  const dialerStart = new Date(startDate.toISOString().split("T")[0] + "T00:00:00Z");
  const dialerEnd = new Date(endDate.toISOString().split("T")[0] + "T23:59:59Z");

  const [leadsRows, dialerRows, callLogRows, sdrVendedores, activeLeadsAll] = await Promise.all([
    prisma.lead.findMany({
      where: {
        OR: [
          { createdAt: { gte: startDate, lte: endDate } },
          { scheduledAt: { gte: startDate, lte: endDate } },
          { reagendadoAt: { gte: startDate, lte: endDate } },
          { meetingAt: { gte: startDate, lte: endDate } },
          { noShowAt: { gte: startDate, lte: endDate } }
        ]
      },
      select: {
        assignedTo: true,
        scheduledBy: true,
        status: true,
        createdAt: true,
        arrivalAt: true,
        firstContactAt: true,
        contactedAt: true,
        contactAttempts: true,
        interactionCount: true,
        scheduledAt: true,
        meetingAt: true,
        closedAt: true,
        nextTaskAt: true,
        isReagendado: true,
        reagendadoAt: true,
        goToCalls: true,
        firstCallAt: true,
        noShow: true,
        noShowAt: true,
        sdrScore: true,
        lostReason: true,
        syncedAt: true,
      },
    }),
    prisma.dialerMetrics.findMany({
      where: { date: { gte: dialerStart, lte: dialerEnd } },
      select: { agentName: true, totalCalls: true, talkTimeSecs: true },
    }),
    // LeadCallLog: ligações mapeadas a leads por data (idempotente, BRT-scoped)
    // Fallback para [] se a tabela ainda não existir (Prisma client desatualizado).
    (prisma as any).leadCallLog?.findMany({
      where: { source: "goto", date: { gte: dialerStart, lte: dialerEnd } },
      select: { leadId: true, agentId: true, agentName: true, callCount: true },
    }) ?? Promise.resolve([]),
    // Busca apenas vendedores com role SDR para filtrar os agentes
    prisma.vendedor.findMany({
      where: { role: "SDR", status: "ATIVO" },
      select: { nome: true },
    }),
    // Carteira ativa de cada SDR: todos os leads ativos (não fechados) — denominator para lig/lead
    prisma.lead.findMany({
      where: { status: { notIn: ["won", "lost"] } },
      select: { assignedTo: true },
    }),
  ]);

  // Nomes dos SDRs cadastrados (ex: "Cauê")
  const sdrNomes = sdrVendedores.map((v) => v.nome?.toLowerCase() ?? "");

  // Verifica se um nome de agente (do Kommo ou GoTo) pertence a um SDR cadastrado.
  // O nome do Kommo pode ser o nome completo ("Cauê Perpétuo") enquanto o cadastro tem "Cauê".
  const isSdr = (agentName: string | null | undefined): agentName is string => {
    if (!agentName) return false;
    const lower = agentName?.toLowerCase() ?? "";
    return sdrNomes.some(
      (sdr) => lower.startsWith(sdr) || sdr.startsWith(lower.split(" ")[0])
    );
  };

  // Usa os SDRs cadastrados como base — garante que apareçam mesmo quando seus leads
  // foram transferidos para um closer (assignedTo mudou) ou não há dados GoTo no período.
  const agentNames = sdrVendedores.map((v) => v.nome).filter(Boolean) as string[];

  // Nomes de agentes IA — definido aqui para uso tanto no loop de stats quanto no resumo final
  const IA_NAMES_SET = new Set(["IA", "Sellmap"]);

  const stats: SdrStats[] = agentNames.map((name) => {
    // Match parcial para capturar tanto "Cauê" (cadastro) quanto "Cauê Perpétuo" (Kommo/GoTo)
    const matchName = (field: string | null | undefined) => {
      if (!field || !name) return false;
      const f = field.toLowerCase();
      const n = name.toLowerCase();
      return f.startsWith(n) || n.startsWith(f.split(" ")[0]);
    };
    const agentLeadsPeriod = leadsRows.filter((l) => matchName(l.assignedTo));
    const agentLeadsCreated = agentLeadsPeriod.filter(l => l.createdAt >= startDate && l.createdAt <= endDate);
    const agentDialer = dialerRows.filter((d) => matchName(d.agentName));

    const leadsNoFunil = agentLeadsCreated.filter((l) => !["won", "lost"].includes(l.status)).length;

    const recoveryReasons = agentLeadsPeriod
      .filter((l) => l.lostReason != null && !["won", "lost"].includes(l.status))
      .map((l) => l.lostReason!);
    const reasonCount: Record<string, number> = {};
    for (const r of recoveryReasons) reasonCount[r] = (reasonCount[r] ?? 0) + 1;
    const recuperacaoMotivoTop = Object.entries(reasonCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Speed-to-Lead: usa leads criados no período (mede criação → primeiro contato/ação do SDR)
    // Filtra apenas amostras ≤ 60 min para excluir leads antigos/parados que inflariam a métrica
    const speedSamples = agentLeadsCreated
      .filter((l) => {
        const firstContact = l.firstCallAt ?? l.firstContactAt ?? l.contactedAt;
        return (l.arrivalAt || l.createdAt) && firstContact;
      })
      .map((l) => {
        const from = l.arrivalAt ?? l.createdAt;
        const to = l.firstCallAt ?? l.firstContactAt ?? l.contactedAt!;
        return getBusinessMinutes(from, to);
      })
      .filter((raw) => raw >= 0 && raw <= 60);
    const sortedSpeed = [...speedSamples].sort((a, b) => a - b);
    const speedToLeadMin =
      sortedSpeed.length > 0
        ? parseFloat(sortedSpeed[Math.floor(sortedSpeed.length / 2)].toFixed(1))
        : 0;

    const tentativas =
      agentLeadsPeriod.length > 0
        ? parseFloat(
            (agentLeadsPeriod.reduce((s, l) => s + (l.contactAttempts || l.goToCalls || l.interactionCount), 0) / agentLeadsPeriod.length).toFixed(1)
          )
        : 0;

    const tarefasVencidas = agentLeadsPeriod.filter(
      (l) => l.nextTaskAt && l.nextTaskAt < now && !["won", "lost"].includes(l.status)
    ).length;

    // ── Métricas de passagem de bastão atribuídas por scheduledBy ──────────────
    // scheduledBy captura quem moveu o lead para "1ª Reunião Confirmada" no Kommo,
    // independente de para quem o lead foi reatribuído depois (ex: Closer após a reunião).
    // Isso garante que agendamentos de Cauê apareçam em Cauê mesmo após leads irem para Célia.
    const matchesAgent = (scheduledBy: string | null) => {
      if (!scheduledBy) return false;
      const s = scheduledBy?.toLowerCase() ?? "";
      const n = name?.toLowerCase() ?? "";
      return s.startsWith(n) || n.startsWith(s.split(" ")[0]);
    };

    const agendadosPorMim = leadsRows.filter((l) =>
      matchesAgent(l.scheduledBy) && l.scheduledAt != null &&
      l.scheduledAt >= startDate && l.scheduledAt <= endDate
    );

    const agendamentos = agendadosPorMim.length;

    // Agendamentos realizados pela IA em leads que pertencem a este SDR (assignedTo)
    const agendamentosIa = leadsRows.filter((l) =>
      IA_NAMES_SET.has(l.scheduledBy ?? "") &&
      matchName(l.assignedTo) &&
      l.scheduledAt != null &&
      l.scheduledAt >= startDate && l.scheduledAt <= endDate
    ).length;

    // Reuniões realizadas dos leads que este SDR agendou
    const reunioes = agendadosPorMim.filter((l) =>
      l.meetingAt != null || ["meeting", "won", "lost"].includes(l.status)
    ).length;

    // Reagendamentos bem-sucedidos (reagendadoAt = SDR reconverteu um no-show)
    // Atribuídos ao SDR pelo scheduledBy original
    const reagendados = agendadosPorMim.filter((l) => {
      const ts = l.reagendadoAt;
      return ts != null && ts >= startDate && ts <= endDate;
    }).length;

    const agendPorDia = parseFloat((agendamentos / businessDays).toFixed(2));
    // agendPorSemana = média semanal (5 dias úteis = 1 semana)
    const agendPorSemana = parseFloat((agendamentos / (businessDays / 5)).toFixed(1));

    // Taxa de reagendamento: dos leads que este SDR agendou e tiveram no-show, quantos voltou a converter
    const reagendadosForRate = agendadosPorMim.filter((l) => l.isReagendado || l.reagendadoAt);
    const reagendadosConvertidos = reagendadosForRate.filter((l) =>
      ["scheduled", "meeting", "won"].includes(l.status)
    ).length;
    const taxaReagendamento =
      reagendadosForRate.length > 0
        ? parseFloat(((reagendadosConvertidos / reagendadosForRate.length) * 100).toFixed(1))
        : 0;

    // No-Show: eventos noShowAt no período em leads agendados por este SDR.
    // Não usa aritmética (agend - reuniões) porque meetingAt só é preenchido via GoTo Connect.
    // O campo noShowAt registra o evento concreto de no-show vindo do Kommo.
    const noShowsNoPeriodo = agendadosPorMim.filter((l) =>
      l.noShowAt != null && l.noShowAt >= startDate && l.noShowAt <= endDate
    ).length;
    const taxaNoShow = agendamentos > 0 ? parseFloat(((noShowsNoPeriodo / agendamentos) * 100).toFixed(1)) : 0;

    const recuperacao = agentLeadsPeriod.filter((l) => {
      return l.status !== "lost" && l.lostReason != null && l.syncedAt && l.syncedAt >= startDate && l.syncedAt <= endDate;
    }).length;

    const scores = agentLeadsPeriod.map((l) => l.sdrScore).filter((s): s is number => s !== null);
    const sdrScoreMedia =
      scores.length > 0
        ? parseFloat((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1))
        : 0;

    const maturacaoSamples = agentLeadsCreated
      .filter((l) => l.scheduledAt)
      .map((l) => (l.scheduledAt!.getTime() - l.createdAt.getTime()) / 86400000);
    const tempomaturacaoDias =
      maturacaoSamples.length > 0
        ? parseFloat((maturacaoSamples.reduce((s, v) => s + v, 0) / maturacaoSamples.length).toFixed(1))
        : 0;

    const ligacoes = agentDialer.reduce((s, d) => s + d.totalCalls, 0);
    const talkTimeSecs = agentDialer.reduce((s, d) => s + d.talkTimeSecs, 0);
    
    // ligacoesPorLead: ligações mapeadas a leads reais / leads únicos contatados
    // Usa LeadCallLog (idempotente, BRT-scoped) para precisão por período.
    const agentCallLogs = (callLogRows as { agentName: string | null; leadId: string; callCount: number }[]).filter(c => {
      if (!c.agentName || !name) return false;
      const lower = c.agentName?.toLowerCase() ?? "";
      const n = name?.toLowerCase() ?? "";
      return lower.startsWith(n) || n.startsWith(lower.split(" ")[0]);
    });
    const totalMappedCalls = agentCallLogs.reduce((s, c) => s + c.callCount, 0);
    const uniqueLeadsCalled = new Set(agentCallLogs.map(c => c.leadId)).size;
    // Carteira ativa: todos os leads ativos (não fechados) sob responsabilidade deste SDR
    const activeLeadsAgent = activeLeadsAll.filter((l) => matchName(l.assignedTo)).length;
    // lig/lead = ligações do período / carteira ativa (visão de cadência)
    // Fallback por prioridade: LeadCallLog → ligações totais / carteira ativa → 0
    const ligacoesPorLead = uniqueLeadsCalled > 0
      ? parseFloat((totalMappedCalls / uniqueLeadsCalled).toFixed(1))
      : activeLeadsAgent > 0
        ? parseFloat((ligacoes / activeLeadsAgent).toFixed(1))
        : 0;
    // ligacoesPorDia: total de ligações do discador / dias úteis decorridos
    const ligacoesPorDia = parseFloat((ligacoes / businessDays).toFixed(1));

    return {
      agentName: name,
      leadsGerados: agentLeadsCreated.length,
      leadsNoFunil,
      speedToLeadMin,
      tentativasPorLead: tentativas,
      ligacoesPorLead,
      ligacoesPorDia,
      tarefasVencidas,
      agendamentos,
      agendamentosIa,
      reunioes,
      agendPorDia,
      agendPorSemana,
      taxaReagendamento,
      reagendados,
      recuperacao,
      recuperacaoMotivoTop,
      taxaNoShow,
      noShowsNoPeriodo,
      sdrScoreMedia,
      tempomaturacaoDias,
      ligacoes,
      talkTimeSecs,
    };
  }).sort((a, b) => b.agendamentos - a.agendamentos);

  // ... skip intermediate until daily Leads ...
  // Daily leads breakdown
  const dailyLeads = Array.from({ length: numDays }).map((_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD in UTC (since start is UTC midnight)
    
    // Convert DB timestamp to GMT-3 to match BR local time string formats
    const dayLeads = leadsRows.filter((l) => {
      const gmt3 = new Date(l.createdAt.getTime() - 3 * 3600 * 1000);
      return gmt3.toISOString().split("T")[0] === dateStr;
    }).length;
    
    const dayScheduled = leadsRows.filter((l) => {
      if (!l.scheduledAt) return false;
      const gmt3 = new Date(l.scheduledAt.getTime() - 3 * 3600 * 1000);
      return gmt3.toISOString().split("T")[0] === dateStr;
    }).length;

    const dayReagendado = leadsRows.filter((l) => {
      if (!l.reagendadoAt) return false;
      const gmt3 = new Date(l.reagendadoAt.getTime() - 3 * 3600 * 1000);
      return gmt3.toISOString().split("T")[0] === dateStr;
    }).length;
    
    // O gráfico usará a soma (esforço total), mas a API manda separado também
    const actualDay = parseInt(dateStr.split("-")[2], 10);
    return { dia: actualDay, date: dateStr, leads: dayLeads, agendamentos: dayScheduled + dayReagendado, novosAgendamentos: dayScheduled, reagendamentosEfetivados: dayReagendado };
  });

  const totLeads = leadsRows.filter(l => l.createdAt >= startDate && l.createdAt <= endDate).length;
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

  // ── Origem dos agendamentos (scheduledAt no período — mesma âncora dos SDRs) ──

  // Total real: todos os leads com scheduledAt no período (independente de scheduledBy)
  const allAgendLeads = leadsRows.filter(l =>
    l.scheduledAt != null && l.scheduledAt >= startDate && l.scheduledAt <= endDate
  );

  const agendIaLeads = allAgendLeads.filter(l => IA_NAMES_SET.has(l.scheduledBy ?? ""));
  // Other inclui scheduledBy = null (histórico ainda não sincronizado) + ex-usuários + outros
  const agendOtherLeads = allAgendLeads.filter(l =>
    !IA_NAMES_SET.has(l.scheduledBy ?? "") &&
    !(l.scheduledBy != null && isSdr(l.scheduledBy))
  );
  const noShowIa = agendIaLeads.filter(l => l.noShowAt != null && l.noShowAt >= startDate && l.noShowAt <= endDate).length;
  const noShowOther = agendOtherLeads.filter(l => l.noShowAt != null && l.noShowAt >= startDate && l.noShowAt <= endDate).length;
  const agendamentosPorOrigem = {
    total: allAgendLeads.length,
    ia: {
      agendamentos: agendIaLeads.length,
      noShows: noShowIa,
      taxaNoShow: agendIaLeads.length > 0 ? parseFloat(((noShowIa / agendIaLeads.length) * 100).toFixed(1)) : 0,
    },
    other: {
      agendamentos: agendOtherLeads.length,
      noShows: noShowOther,
      taxaNoShow: agendOtherLeads.length > 0 ? parseFloat(((noShowOther / agendOtherLeads.length) * 100).toFixed(1)) : 0,
    },
  };

  return {
    stats,
    agendamentosPorOrigem,
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
      ligacoesPorDiaMedio: parseFloat(
        (stats.reduce((acc, s) => acc + s.ligacoes, 0) / businessDays).toFixed(1)
      ),
      agendPorDiaMedio: parseFloat(
        (allAgendLeads.length / businessDays).toFixed(2)
      ),
    },
    dailyLeads,
    funilPorSdr,
  };
}
