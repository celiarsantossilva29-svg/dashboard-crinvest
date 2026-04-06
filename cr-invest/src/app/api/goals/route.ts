// POST /api/goals — creates a Goal in local DB

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const updatedAt = new Date().toISOString();

  try {
    const body = await req.json();
    const { cycleName, startDate, endDate, target } = body;

    if (!cycleName || !startDate || !endDate || !target) {
      return NextResponse.json(
        {
          data: null,
          updatedAt,
          error: "Campos obrigatórios: cycleName, startDate, endDate, target",
        },
        { status: 400 }
      );
    }

    const goal = await prisma.goal.create({
      data: {
        cycleName: String(cycleName),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        target: Number(target),
      },
    });

    return NextResponse.json({ data: goal, updatedAt, error: null }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
