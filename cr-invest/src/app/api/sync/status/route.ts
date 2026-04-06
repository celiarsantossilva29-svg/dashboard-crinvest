// GET /api/sync/status — returns last SyncLog entry per source

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SOURCES = ["kommo", "facebook", "goto", "threec"] as const;

export async function GET() {
  const updatedAt = new Date().toISOString();

  try {
    const results = await Promise.all(
      SOURCES.map((source) =>
        prisma.syncLog.findFirst({
          where: { source },
          orderBy: { syncedAt: "desc" },
        })
      )
    );

    const data = SOURCES.reduce(
      (acc, source, i) => {
        acc[source] = results[i] ?? null;
        return acc;
      },
      {} as Record<string, any>
    );

    return NextResponse.json({ data, updatedAt, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
