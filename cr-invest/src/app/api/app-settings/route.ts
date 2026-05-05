export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/app-settings?prefix=confirmed_
// Returns { data: Record<string, number> } — key without prefix → numeric value
export async function GET(req: NextRequest) {
  try {
    const prefix = new URL(req.url).searchParams.get("prefix") ?? "";
    const rows = await prisma.appSetting.findMany({
      where: prefix ? { key: { startsWith: prefix } } : undefined,
    });
    const data: Record<string, number> = {};
    for (const row of rows) {
      const shortKey = prefix ? row.key.slice(prefix.length) : row.key;
      data[shortKey] = parseFloat(row.value);
    }
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ data: {}, error: err?.message }, { status: 500 });
  }
}
