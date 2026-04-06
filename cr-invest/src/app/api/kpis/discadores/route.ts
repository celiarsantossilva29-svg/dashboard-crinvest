// GET /api/kpis/discadores?start=YYYY-MM-DD&end=YYYY-MM-DD&agent=optional

import { NextRequest, NextResponse } from "next/server";
import { calcDialerMetrics } from "@/lib/kpis";

export async function GET(req: NextRequest) {
  const updatedAt = new Date().toISOString();

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const agent = searchParams.get("agent") ?? undefined;

    const now = new Date();
    const startDate = start
      ? new Date(start + "T00:00:00-03:00")
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = end
      ? new Date(end + "T23:59:59-03:00")
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const data = await calcDialerMetrics({ startDate, endDate }, agent);

    return NextResponse.json({ data, updatedAt, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
