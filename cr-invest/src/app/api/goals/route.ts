export const dynamic = 'force-dynamic';

// POST /api/goals — creates a Goal in local DB
// PATCH /api/goals?id=ID — updates target of an existing Goal

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

export async function PATCH(req: NextRequest) {
  const updatedAt = new Date().toISOString();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const body = await req.json();
    const { target } = body;

    if (!id) {
      return NextResponse.json({ data: null, updatedAt, error: "Parâmetro id obrigatório" }, { status: 400 });
    }
    if (target === undefined || isNaN(Number(target))) {
      return NextResponse.json({ data: null, updatedAt, error: "Campo target obrigatório" }, { status: 400 });
    }

    const goal = await prisma.goal.update({
      where: { id },
      data: { target: Number(target) },
    });

    return NextResponse.json({ data: goal, updatedAt, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
