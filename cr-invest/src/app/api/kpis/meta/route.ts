// GET /api/kpis/meta?cycleId=ID
// Returns active goal + achievement + projection

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockGoals, getMockSales, USE_MOCK } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const updatedAt = new Date().toISOString();

  try {
    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get("cycleId");

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
      const sales = getMockSales().filter(
        (s) => s.closedAt >= goal!.startDate && s.closedAt <= goal!.endDate
      );
      achieved = sales.reduce((sum, s) => sum + s.value, 0);
    } else {
      const agg = await prisma.sale.aggregate({
        where: { closedAt: { gte: goal.startDate, lte: goal.endDate } },
        _sum: { value: true },
      });
      achieved = agg._sum.value ?? 0;
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
        percentage: parseFloat(percentage.toFixed(1)),
        projection: parseFloat(projection.toFixed(2)),
        daysLeft,
        totalDays,
        ritmoAtual: parseFloat(ritmoAtual.toFixed(2)),
        ritmoNecessario: parseFloat(ritmoNecessario.toFixed(2)),
      },
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
