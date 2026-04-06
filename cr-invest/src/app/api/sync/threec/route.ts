// GET /api/sync/threec — syncs last 30 days

import { NextResponse } from "next/server";
import { syncThreeCData } from "@/services/threec";

export async function GET() {
  const updatedAt = new Date().toISOString();

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const result = await syncThreeCData(startDate, endDate);
    return NextResponse.json({ data: { success: true, ...result }, updatedAt, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Sync failed" },
      { status: 500 }
    );
  }
}
