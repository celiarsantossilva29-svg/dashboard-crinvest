export const dynamic = 'force-dynamic';

// GET /api/kpis/meta?cycleId=ID&originSdr=true
// Returns active goal + achievement + projection
// originSdr=true → filtra apenas vendas onde sdrName IS NOT NULL (originadas via SDR)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockGoals, getMockSales, USE_MOCK } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const updatedAt = new Date().toISOString();

  try {
    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get("cycleId");
    const originSdr = searchParams.get("originSdr") === "true";

    let goal: {
      id: string;
      cycleName: string;
      startDate: Date;
      endDate: Date;
      target: number;
    } | null = null;

    if (USE_MOCK) {
      const goals = getMockGoals();
      if (cycleId) {
        goal = goals.find((g) => g.id === cycleId) ?? null;
      } else {
        const now = new Date();
        goal = goals.find((g) => g.startDate <= now && g.endDate >= now) ?? goals[0] ?? null;
      }
    } else {
      if (cycleId) {
        goal = await prisma.goal.findUnique({ where: { id: cycleId } });
      } else {
        const now = new Date();
        goal = await prisma.goal.findFirst({
          where: { startDate: { lte: now }, endDate: { gte: now } },
          orderBy: { startDate: "desc" },
        });
      }
    }

    if (!goal) {
      return NextResponse.json(
        { data: null, updatedAt, error: "Nenhuma meta encontrada" },
        { status: 404 }
      );
    }

    // Calculate achievement (sales in the goal period)
    let achieved = 0;

    if (USE_MOCK) {
      let sales = getMockSales().filter(
        (s) => s.closedAt >= goal!.startDate && s.closedAt <= goal!.endDate
      );
      if (originSdr) sales = sales.filter((s) => !!(s as any).sdrName);
      achieved = sales.reduce((sum, s) => sum + s.value, 0);
    } else {
      const sdrFilter = originSdr ? { NOT: { sdrName: null } } : {};
      const baseWhere = { closedAt: { gte: goal.startDate, lte: goal.endDate }, ...sdrFilter };
      const [agg, wonCount] = await Promise.all([
        prisma.sale.aggregate({
          where: baseWhere,
          _sum: { value: true },
        }),
        prisma.sale.count({
          where: baseWhere,
        }),
      ]);
      achieved = agg._sum.value ?? 0;
      (goal as any)._wonCount = wonCount;
    }

    const now = new Date();
    const totalMs = goal.endDate.getTime() - goal.startDate.getTime();
    const elapsedMs = Math.max(0, now.getTime() - goal.startDate.getTime());
    const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(1, Math.ceil(elapsedMs / (1000 * 60 * 60 * 24)));
    const daysLeft = Math.max(0, totalDays - elapsedDays);

    const percentage = goal.target > 0 ? (achieved / goal.target) * 100 : 0;
    const ritmoAtual = elapsedDays > 0 ? achieved / elapsedDays : 0;
    const ritmoNecessario = daysLeft > 0 ? (goal.target - achieved) / daysLeft : 0;
    const projection = ritmoAtual * totalDays;

    return NextResponse.json({
      data: {
        goal,
        achieved,
        wonCount: (goal as any)._wonCount ?? 0,
        percentage: parseFloat(percentage.toFixed(1)),
        projection: parseFloat(projection.toFixed(2)),
        daysLeft,
        totalDays,
        ritmoAtual: parseFloat(ritmoAtual.toFixed(2)),
        ritmoNecessario: parseFloat(ritmoNecessario.toFixed(2)),
      },
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
