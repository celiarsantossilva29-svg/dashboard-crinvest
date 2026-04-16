// GET /api/sync/status — returns last SyncLog per source + in-progress state + history

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncProgress } from "@/lib/sync-progress";

const SOURCES = ["kommo", "facebook", "goto"] as const;

export async function GET() {
  const updatedAt = new Date().toISOString();

  try {
    const [lastPerSource, history] = await Promise.all([
      Promise.all(
        SOURCES.map((source) =>
          prisma.syncLog.findFirst({
            where: { source },
            orderBy: { syncedAt: "desc" },
          })
        )
      ),
      prisma.syncLog.findMany({
        orderBy: { syncedAt: "desc" },
        take: 15,
      }),
    ]);

    const data = SOURCES.reduce(
      (acc, source, i) => {
        acc[source] = lastPerSource[i] ?? null;
        return acc;
      },
      {} as Record<string, any>
    );

    return NextResponse.json({
      data,
      progress: syncProgress,
      history,
      updatedAt,
      error: null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, progress: syncProgress, history: [], updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
