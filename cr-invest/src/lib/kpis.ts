/**
 * KPI calculation functions for CR Invest dashboard.
 * All period-based functions accept { startDate, endDate }.
 * When USE_MOCK_DATA=true, returns data computed from mock arrays directly.
 */

import { prisma } from "@/lib/prisma";
import {
  USE_MOCK,
  getMockLeads,
  getMockSales,
  getMockAdsMetrics,
  getMockDialerMetrics,
} from "@/lib/mock-data";

export interface Period {
  startDate: Date;
  endDate: Date;
}

// ═══════════════════════════════════════════════════════════════════
// BLOCK 1 — Sales KPIs
// ═══════════════════════════════════════════════════════════════════

export async function calcCAC(
  period: Period
): Promise<{ value: number; adSpend: number; customers: number }> {
  if (USE_MOCK) {
    const leads = getMockLeads().filter(
      (l) =>
        l.status === "won" &&
        l.closedAt &&
        l.closedAt >= period.startDate &&
        l.closedAt <= period.endDate
    );
    const ads = getMockAdsMetrics().filter(
      (a) => a.date >= period.startDate && a.date <= period.endDate
    );
    const adSpend = ads.reduce((s, a) => s + a.spend, 0);
    const customers = leads.length;
    const value = customers > 0 ? adSpend / customers : 0;
    return { value, adSpend, customers };
  }

  const [adsAgg, customers] = await Promise.all([
    prisma.adsMetrics.aggregate({
      where: { date: { gte: period.startDate, lte: period.endDate } },
      _sum: { spend: true },
    }),
    prisma.lead.count({
      where: {
        status: "won",
        closedAt: { gte: period.startDate, lte: period.endDate },
      },
    }),
  ]);

  const adSpend = adsAgg._sum.spend ?? 0;
  const value = customers > 0 ? adSpend / customers : 0;
  return { value, adSpend, customers };
}

export async function calcTicketMedio(
  period: Period
): Promise<{ value: number; total: number; count: number }> {
  if (USE_MOCK) {
    const sales = getMockSales().filter(
      (s) => s.closedAt >= period.startDate && s.closedAt <= period.endDate
    );
    const total = sales.reduce((s, sale) => s + sale.value, 0);
    const count = sales.length;
    const value = count > 0 ? total / count : 0;
    return { value, total, count };
  }

  const agg = await prisma.sale.aggregate({
    where: { closedAt: { gte: period.startDate, lte: period.endDate } },
    _sum: { value: true },
    _count: { value: true },
    _avg: { value: true },
  });

  const total = agg._sum.value ?? 0;
  const count = agg._count.value ?? 0;
  const value = agg._avg.value ?? 0;
  return { value, total, count };
}

export async function calcTaxaConversao(
  period: Period
): Promise<{ value: number; won: number; total: number }> {
  if (USE_MOCK) {
    const leads = getMockLeads().filter(
      (l) => l.createdAt >= period.startDate && l.createdAt <= period.endDate
    );
    const won = leads.filter((l) => l.status === "won").length;
    const total = leads.length;
    const value = total > 0 ? (won / total) * 100 : 0;
    return { value, won, total };
  }

  const [won, total] = await Promise.all([
    prisma.lead.count({
      where: {
        status: "won",
        createdAt: { gte: period.startDate, lte: period.endDate },
      },
    }),
    prisma.lead.count({
      where: { createdAt: { gte: period.startDate, lte: period.endDate } },
    }),
  ]);

  const value = total > 0 ? (won / total) * 100 : 0;
  return { value, won, total };
}

export async function calcCicloVendas(
  period: Period
): Promise<{ value: number; unit: "days" }> {
  if (USE_MOCK) {
    const won = getMockLeads().filter(
      (l) =>
        l.status === "won" &&
        l.closedAt &&
        l.closedAt >= period.startDate &&
        l.closedAt <= period.endDate
    );

    if (won.length === 0) return { value: 0, unit: "days" };

    const totalDays = won.reduce((sum, lead) => {
      const ms = lead.closedAt!.getTime() - lead.createdAt.getTime();
      return sum + ms / (1000 * 60 * 60 * 24);
    }, 0);

    return { value: parseFloat((totalDays / won.length).toFixed(1)), unit: "days" };
  }

  const wonLeads = await prisma.lead.findMany({
    where: {
      status: "won",
      closedAt: { gte: period.startDate, lte: period.endDate },
      NOT: { closedAt: null },
    },
    select: { createdAt: true, closedAt: true },
  });

  if (wonLeads.length === 0) return { value: 0, unit: "days" };

  const totalDays = wonLeads.reduce((sum: number, lead: { createdAt: Date; closedAt: Date | null }) => {
    const ms = lead.closedAt!.getTime() - lead.createdAt.getTime();
    return sum + ms / (1000 * 60 * 60 * 24);
  }, 0);

  return {
    value: parseFloat((totalDays / wonLeads.length).toFixed(1)),
    unit: "days",
  };
}

export function calcLTV(ticketMedio: number, retencaoMeses: number): number {
  return ticketMedio * retencaoMeses;
}

// ═══════════════════════════════════════════════════════════════════
// BLOCK 2 — Prospecting KPIs
// ═══════════════════════════════════════════════════════════════════

export async function calcLeadsGerados(period: Period): Promise<number> {
  if (USE_MOCK) {
    return getMockLeads().filter(
      (l) => l.createdAt >= period.startDate && l.createdAt <= period.endDate
    ).length;
  }

  return prisma.lead.count({
    where: { createdAt: { gte: period.startDate, lte: period.endDate } },
  });
}

export async function calcTaxaAgendamento(
  period: Period
): Promise<{ value: number; scheduled: number; contacted: number }> {
  if (USE_MOCK) {
    const leads = getMockLeads().filter(
      (l) => l.createdAt >= period.startDate && l.createdAt <= period.endDate
    );
    const contacted = leads.filter(
      (l) =>
        ["contacted", "qualified", "scheduled", "meeting", "won", "lost"].includes(l.status)
    ).length;
    const scheduled = leads.filter((l) =>
      ["scheduled", "meeting", "won", "lost"].includes(l.status)
    ).length;
    const value = contacted > 0 ? (scheduled / contacted) * 100 : 0;
    return { value, scheduled, contacted };
  }

  const [contacted, scheduled] = await Promise.all([
    prisma.lead.count({
      where: {
        createdAt: { gte: period.startDate, lte: period.endDate },
        status: { in: ["contacted", "qualified", "scheduled", "meeting", "won", "lost"] },
      },
    }),
    prisma.lead.count({
      where: {
        createdAt: { gte: period.startDate, lte: period.endDate },
        status: { in: ["scheduled", "meeting", "won", "lost"] },
      },
    }),
  ]);

  const value = contacted > 0 ? (scheduled / contacted) * 100 : 0;
  return { value, scheduled, contacted };
}

export async function calcNoShow(
  period: Period
): Promise<{ value: number; missed: number; scheduled: number }> {
  if (USE_MOCK) {
    const leads = getMockLeads().filter(
      (l) => l.createdAt >= period.startDate && l.createdAt <= period.endDate
    );
    const scheduled = leads.filter((l) =>
      ["scheduled", "meeting", "won", "lost"].includes(l.status)
    ).length;
    const meetings = leads.filter((l) =>
      ["meeting", "won", "lost"].includes(l.status)
    ).length;
    const missed = scheduled - meetings;
    const value = scheduled > 0 ? (missed / scheduled) * 100 : 0;
    return { value, missed, scheduled };
  }

  const [scheduled, meetings] = await Promise.all([
    prisma.lead.count({
      where: {
        createdAt: { gte: period.startDate, lte: period.endDate },
        status: { in: ["scheduled", "meeting", "won", "lost"] },
      },
    }),
    prisma.lead.count({
      where: {
        createdAt: { gte: period.startDate, lte: period.endDate },
        status: { in: ["meeting", "won", "lost"] },
      },
    }),
  ]);

  const missed = scheduled - meetings;
  const value = scheduled > 0 ? (missed / scheduled) * 100 : 0;
  return { value, missed, scheduled };
}

export async function calcTaxaQualificacao(
  period: Period
): Promise<{ value: number; qualified: number; total: number }> {
  if (USE_MOCK) {
    const leads = getMockLeads().filter(
      (l) => l.createdAt >= period.startDate && l.createdAt <= period.endDate
    );
    const total = leads.length;
    const qualified = leads.filter((l) =>
      ["qualified", "scheduled", "meeting", "won", "lost"].includes(l.status)
    ).length;
    const value = total > 0 ? (qualified / total) * 100 : 0;
    return { value, qualified, total };
  }

  const [total, qualified] = await Promise.all([
    prisma.lead.count({
      where: { createdAt: { gte: period.startDate, lte: period.endDate } },
    }),
    prisma.lead.count({
      where: {
        createdAt: { gte: period.startDate, lte: period.endDate },
        status: { in: ["qualified", "scheduled", "meeting", "won", "lost"] },
      },
    }),
  ]);

  const value = total > 0 ? (qualified / total) * 100 : 0;
  return { value, qualified, total };
}

export async function calcContatosPorLead(period: Period): Promise<number> {
  if (USE_MOCK) {
    const leads = getMockLeads().filter(
      (l) => l.createdAt >= period.startDate && l.createdAt <= period.endDate
    );
    if (leads.length === 0) return 0;
    const total = leads.reduce((s, l) => s + l.interactionCount, 0);
    return parseFloat((total / leads.length).toFixed(1));
  }

  const agg = await prisma.lead.aggregate({
    where: { createdAt: { gte: period.startDate, lte: period.endDate } },
    _avg: { interactionCount: true },
  });

  return parseFloat((agg._avg.interactionCount ?? 0).toFixed(1));
}

// ═══════════════════════════════════════════════════════════════════
// BLOCK 3 — Meta Ads KPIs
// ═══════════════════════════════════════════════════════════════════

export interface AdsResult {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalLeads: number;
  cpm: number;
  ctr: number;
  cpc: number;
  cpl: number;
  roas: number;
}

export async function calcAdsMetrics(period: Period): Promise<AdsResult> {
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalLeads = 0;

  if (USE_MOCK) {
    const ads = getMockAdsMetrics().filter(
      (a) => a.date >= period.startDate && a.date <= period.endDate
    );
    totalSpend = ads.reduce((s, a) => s + a.spend, 0);
    totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
    totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
    totalLeads = ads.reduce((s, a) => s + a.leads, 0);

    // Revenue from mock won leads
    const wonLeads = getMockLeads().filter(
      (l) =>
        l.status === "won" &&
        l.closedAt &&
        l.closedAt >= period.startDate &&
        l.closedAt <= period.endDate
    );
    const revenue = wonLeads.reduce((s, l) => s + (l.dealValue ?? 0), 0);

    const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const roas = totalSpend > 0 ? revenue / totalSpend : 0;

    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalLeads,
      cpm: parseFloat(cpm.toFixed(2)),
      ctr: parseFloat(ctr.toFixed(2)),
      cpc: parseFloat(cpc.toFixed(2)),
      cpl: parseFloat(cpl.toFixed(2)),
      roas: parseFloat(roas.toFixed(2)),
    };
  }

  const [adsAgg, revenueAgg] = await Promise.all([
    prisma.adsMetrics.aggregate({
      where: { date: { gte: period.startDate, lte: period.endDate } },
      _sum: {
        spend: true,
        impressions: true,
        clicks: true,
        leads: true,
      },
    }),
    prisma.lead.aggregate({
      where: {
        status: "won",
        closedAt: { gte: period.startDate, lte: period.endDate },
      },
      _sum: { dealValue: true },
    }),
  ]);

  totalSpend = adsAgg._sum.spend ?? 0;
  totalImpressions = adsAgg._sum.impressions ?? 0;
  totalClicks = adsAgg._sum.clicks ?? 0;
  totalLeads = adsAgg._sum.leads ?? 0;
  const revenue = revenueAgg._sum.dealValue ?? 0;

  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const roas = totalSpend > 0 ? revenue / totalSpend : 0;

  return {
    totalSpend,
    totalImpressions,
    totalClicks,
    totalLeads,
    cpm: parseFloat(cpm.toFixed(2)),
    ctr: parseFloat(ctr.toFixed(2)),
    cpc: parseFloat(cpc.toFixed(2)),
    cpl: parseFloat(cpl.toFixed(2)),
    roas: parseFloat(roas.toFixed(2)),
  };
}

// ═══════════════════════════════════════════════════════════════════
// BLOCK 4 — Dialer KPIs
// ═══════════════════════════════════════════════════════════════════

export interface AgentDialerStats {
  agentName: string;
  totalCalls: number;
  talkTimeSecs: number;
  avgPerCall: number;
  source: string;
}

export interface DialerResult {
  totalCalls: number;
  totalTalkTimeSecs: number;
  avgTalkTimePerCall: number;
  callsBySource: { goto: number; threec: number };
  callsByAgent: AgentDialerStats[];
}

export async function calcDialerMetrics(
  period: Period,
  agent?: string
): Promise<DialerResult> {
  if (USE_MOCK) {
    let rows = getMockDialerMetrics().filter(
      (m) => m.date >= period.startDate && m.date <= period.endDate
    );
    if (agent) {
      rows = rows.filter((m) =>
        m.agentName.toLowerCase().includes(agent.toLowerCase())
      );
    }

    const totalCalls = rows.reduce((s, r) => s + r.totalCalls, 0);
    const totalTalkTimeSecs = rows.reduce((s, r) => s + r.talkTimeSecs, 0);
    const avgTalkTimePerCall = totalCalls > 0 ? totalTalkTimeSecs / totalCalls : 0;

    const gotoRows = rows.filter((r) => r.source === "goto");
    const threecRows = rows.filter((r) => r.source === "threec");
    const callsBySource = {
      goto: gotoRows.reduce((s, r) => s + r.totalCalls, 0),
      threec: threecRows.reduce((s, r) => s + r.totalCalls, 0),
    };

    // Aggregate by agentName + source
    const agentMap: Record<string, AgentDialerStats> = {};
    for (const row of rows) {
      const key = `${row.agentName}_${row.source}`;
      if (!agentMap[key]) {
        agentMap[key] = {
          agentName: row.agentName,
          totalCalls: 0,
          talkTimeSecs: 0,
          avgPerCall: 0,
          source: row.source,
        };
      }
      agentMap[key].totalCalls += row.totalCalls;
      agentMap[key].talkTimeSecs += row.talkTimeSecs;
    }
    const callsByAgent = Object.values(agentMap).map((a) => ({
      ...a,
      avgPerCall: a.totalCalls > 0 ? a.talkTimeSecs / a.totalCalls : 0,
    }));

    return {
      totalCalls,
      totalTalkTimeSecs,
      avgTalkTimePerCall: parseFloat(avgTalkTimePerCall.toFixed(0)),
      callsBySource,
      callsByAgent,
    };
  }

  const where: any = {
    date: { gte: period.startDate, lte: period.endDate },
  };
  if (agent) {
    where.agentName = { contains: agent, mode: "insensitive" };
  }

  const rows = await prisma.dialerMetrics.findMany({ where });

  type DialerRow = { totalCalls: number; talkTimeSecs: number; source: string; agentName: string; agentId: string };
  const totalCalls = rows.reduce((s: number, r: DialerRow) => s + r.totalCalls, 0);
  const totalTalkTimeSecs = rows.reduce((s: number, r: DialerRow) => s + r.talkTimeSecs, 0);
  const avgTalkTimePerCall = totalCalls > 0 ? totalTalkTimeSecs / totalCalls : 0;

  const callsBySource = {
    goto: rows.filter((r: DialerRow) => r.source === "goto").reduce((s: number, r: DialerRow) => s + r.totalCalls, 0),
    threec: rows.filter((r: DialerRow) => r.source === "threec").reduce((s: number, r: DialerRow) => s + r.totalCalls, 0),
  };

  const agentMap: Record<string, AgentDialerStats> = {};
  for (const row of rows) {
    const key = `${row.agentName}_${row.source}`;
    if (!agentMap[key]) {
      agentMap[key] = {
        agentName: row.agentName,
        totalCalls: 0,
        talkTimeSecs: 0,
        avgPerCall: 0,
        source: row.source,
      };
    }
    agentMap[key].totalCalls += row.totalCalls;
    agentMap[key].talkTimeSecs += row.talkTimeSecs;
  }

  const callsByAgent = Object.values(agentMap).map((a) => ({
    ...a,
    avgPerCall: a.totalCalls > 0 ? parseFloat((a.talkTimeSecs / a.totalCalls).toFixed(0)) : 0,
  }));

  return {
    totalCalls,
    totalTalkTimeSecs,
    avgTalkTimePerCall: parseFloat(avgTalkTimePerCall.toFixed(0)),
    callsBySource,
    callsByAgent,
  };
}
