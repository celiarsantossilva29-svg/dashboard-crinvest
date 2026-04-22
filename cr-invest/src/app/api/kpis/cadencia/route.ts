// GET /api/kpis/cadencia?start=YYYY-MM-DD&end=YYYY-MM-DD&agent=NomeSDR

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export interface CadenciaRow {
  diaLabel: string;
  diaCad: number;
  total: number;
  noShow: number;
  taxaNoShow: number;
  ganhos: number;
  taxaConversao: number;
}

export interface ComparativoItem {
  total: number;
  noShow: number;
  taxa: number;
  ia?: number; // agendamentos via IA (só presente em novos)
}

export interface ReagendadoDistRow {
  vezes: number;       // 1, 2, 3, 4+
  label: string;       // "1x", "2x", "3x", "4x+"
  total: number;
  noShow: number;
  taxa: number;
}

export interface CadenciaResult {
  rows: CadenciaRow[];
  totalLeads: number;
  totalNoShow: number;
  taxaGeral: number;
  comparativo: {
    novos: ComparativoItem;
    reagendados: ComparativoItem;
  };
  reagendadoDist: ReagendadoDistRow[];
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const agent = searchParams.get("agent");

  const startDate = start ? new Date(start) : new Date("2025-01-01");
  const endDate = end ? new Date(end + "T23:59:59") : new Date();

  const agentFilter = agent
    ? { scheduledBy: { contains: agent, mode: "insensitive" as const } }
    : {};

  // ── Query principal: leads com primeiro agendamento no período ────────────
  type LeadRow = {
    arrivalAt: Date | null;
    scheduledAt: Date | null;
    noShowAt: Date | null;
    status: string;
    assignedTo: string | null;
    scheduledBy: string | null;
  };

  const leads: LeadRow[] = await prisma.lead.findMany({
    where: {
      scheduledAt: { gte: startDate, lte: endDate },
      ...agentFilter,
    },
    select: {
      arrivalAt: true,
      scheduledAt: true,
      noShowAt: true,
      status: true,
      assignedTo: true,
      scheduledBy: true,
    },
  });

  // ── Comparativo novos vs reagendados + distribuição por nº de vezes ───────
  const IA_NAMES = ["IA", "Sellmap"];

  const [novosLeads, reagendadosLeads] = await Promise.all([
    // Novos: TODOS os leads com scheduledAt no período (SDR + IA)
    // Não filtra reagendadoAt: um lead pode ter sido agendado e depois reagendado no mesmo mês
    prisma.lead.findMany({
      where: {
        scheduledAt: { gte: startDate, lte: endDate },
        ...agentFilter,
      },
      select: { noShowAt: true, scheduledBy: true },
    }),
    // Reagendados: leads cujo reagendadoAt cai no período
    prisma.lead.findMany({
      where: {
        reagendadoAt: { gte: startDate, lte: endDate },
        ...agentFilter,
      },
      select: { noShowAt: true, reagendadoAt: true, reagendadoCount: true },
    }),
  ]);

  const toItem = (subset: { noShowAt: Date | null; reagendadoAt?: Date | null }[]): ComparativoItem => {
    const total = subset.length;
    const noShow = subset.filter((l) => {
      if (!l.noShowAt) return false;
      if (l.reagendadoAt) return l.noShowAt >= l.reagendadoAt;
      return true;
    }).length;
    return { total, noShow, taxa: total > 0 ? Math.round((noShow / total) * 100) : 0 };
  };

  // Conta IA dentro dos novos (para exibir no card)
  const novosIaCount = (novosLeads as { scheduledBy: string | null }[])
    .filter((l) => IA_NAMES.includes(l.scheduledBy ?? "")).length;

  const comparativo = {
    novos: { ...toItem(novosLeads), ia: novosIaCount },
    reagendados: toItem(reagendadosLeads),
  };

  // ── Distribuição por número de reagendamentos ─────────────────────────────
  // Agrupa: 1x, 2x, 3x, 4x+
  const distGroups: Record<number, { total: number; noShow: number }> = {};
  for (const l of reagendadosLeads) {
    const count = l.reagendadoCount ?? 1;
    const bucket = count >= 4 ? 4 : count; // 4 = "4x+"
    if (!distGroups[bucket]) distGroups[bucket] = { total: 0, noShow: 0 };
    distGroups[bucket].total++;
    if (l.noShowAt && l.reagendadoAt && l.noShowAt >= l.reagendadoAt) {
      distGroups[bucket].noShow++;
    }
  }

  const distLabels: Record<number, string> = { 1: "1x", 2: "2x", 3: "3x", 4: "4x+" };
  const reagendadoDist: ReagendadoDistRow[] = [1, 2, 3, 4]
    .filter((v) => distGroups[v])
    .map((v) => {
      const g = distGroups[v];
      return {
        vezes: v,
        label: distLabels[v],
        total: g.total,
        noShow: g.noShow,
        taxa: g.total > 0 ? Math.round((g.noShow / g.total) * 100) : 0,
      };
    });

  // ── Agrupamento por dia de cadência ──────────────────────────────────────
  const groups: Record<number, { total: number; noShow: number; ganhos: number }> = {};

  for (const l of leads) {
    let diaCad: number;
    if (!l.arrivalAt || !l.scheduledAt) {
      diaCad = 99;
    } else {
      const diffMs = new Date(l.scheduledAt).getTime() - new Date(l.arrivalAt).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const raw = Math.max(0, diffDays) + 1;
      diaCad = raw <= 10 ? raw : 100;
    }
    if (!groups[diaCad]) groups[diaCad] = { total: 0, noShow: 0, ganhos: 0 };
    groups[diaCad].total++;
    if (l.noShowAt) groups[diaCad].noShow++;
    if (l.status === "won") groups[diaCad].ganhos++;
  }

  const dayOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100, 99];
  const dayLabels: Record<number, string> = { 99: "Sem data", 100: "Dia 10+" };
  for (let i = 1; i <= 10; i++) dayLabels[i] = `Dia ${i}`;

  const rows: CadenciaRow[] = dayOrder
    .filter((d) => groups[d])
    .map((d) => {
      const g = groups[d];
      return {
        diaLabel: dayLabels[d],
        diaCad: d,
        total: g.total,
        noShow: g.noShow,
        taxaNoShow: g.total > 0 ? Math.round((g.noShow / g.total) * 100) : 0,
        ganhos: g.ganhos,
        taxaConversao: g.total > 0 ? Math.round((g.ganhos / g.total) * 100) : 0,
      };
    });

  const totalLeads = leads.length;
  const totalNoShow = leads.filter((l) => l.noShowAt).length;
  const taxaGeral = totalLeads > 0 ? Math.round((totalNoShow / totalLeads) * 100) : 0;

  return NextResponse.json({
    data: { rows, totalLeads, totalNoShow, taxaGeral, comparativo, reagendadoDist } as CadenciaResult,
    error: null,
  }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
