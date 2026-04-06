/**
 * 3C Plus integration — READ-ONLY
 * Base URL: https://app.3cplus.com.br/api
 * Auth: API Key from THREEC_API_KEY as Bearer token
 *
 * Assumptions:
 *   - Endpoint: GET /v1/reports/calls
 *   - Query params: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), page, per_page
 *   - Response: { data: [...], meta: { current_page, last_page, total } }
 *   - Each call has: agent_id, agent_name, date (YYYY-MM-DD), duration (seconds),
 *     call_type, status
 *   - We aggregate by (date, agentId): totalCalls, sum(talkTimeSecs)
 *
 * If the actual 3C Plus API structure differs, update endpoint and field mappings here.
 */

import { assertReadOnly } from "@/lib/readonly-guard";
import { prisma } from "@/lib/prisma";
import { getMockDialerMetrics, USE_MOCK } from "@/lib/mock-data";

const THREEC_BASE = "https://app.3cplus.com.br/api";
const THREEC_API_KEY = process.env.THREEC_API_KEY!;

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function syncThreeCData(
  startDate: Date,
  endDate: Date
): Promise<{ synced: number }> {
  assertReadOnly("GET");

  if (USE_MOCK) {
    const metrics = getMockDialerMetrics().filter(
      (m) => m.source === "threec" && m.date >= startDate && m.date <= endDate
    );

    for (const m of metrics) {
      await prisma.dialerMetrics.upsert({
        where: {
          date_source_agentId: {
            date: m.date,
            source: m.source,
            agentId: m.agentId,
          },
        },
        update: {
          agentName: m.agentName,
          totalCalls: m.totalCalls,
          talkTimeSecs: m.talkTimeSecs,
          syncedAt: new Date(),
        },
        create: {
          date: m.date,
          source: m.source,
          agentId: m.agentId,
          agentName: m.agentName,
          totalCalls: m.totalCalls,
          talkTimeSecs: m.talkTimeSecs,
          syncedAt: new Date(),
        },
      });
    }

    await prisma.syncLog.create({
      data: {
        source: "threec",
        status: "success",
        message: `Mock: ${metrics.length} 3C Plus dialer rows upserted`,
      },
    });

    return { synced: metrics.length };
  }

  // Real 3C Plus API
  const agg: Record<
    string,
    {
      agentId: string;
      agentName: string;
      date: Date;
      totalCalls: number;
      talkTimeSecs: number;
    }
  > = {};

  let page = 1;
  let lastPage = 1;

  do {
    const params = new URLSearchParams({
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      page: String(page),
      per_page: "200",
    });

    const url = `${THREEC_BASE}/v1/reports/calls?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${THREEC_API_KEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      await prisma.syncLog.create({
        data: {
          source: "threec",
          status: "error",
          message: `Page ${page}: ${res.status} ${text}`,
        },
      });
      throw new Error(`3C Plus API error: ${res.status} ${text}`);
    }

    const json = await res.json();
    const items: any[] = json.data ?? [];
    const meta = json.meta ?? {};
    lastPage = meta.last_page ?? page;

    for (const item of items) {
      const agentId = String(item.agent_id ?? item.agentId ?? "unknown");
      const agentName = String(item.agent_name ?? item.agentName ?? agentId);
      const rawDate = item.date ?? item.call_date ?? item.created_at ?? "";
      const dateOnly = new Date(rawDate.split("T")[0] + "T00:00:00.000Z");
      const durationSecs = Number(item.duration ?? item.duration_seconds ?? item.talk_time ?? 0);

      const key = `${dateOnly.toISOString()}_${agentId}`;
      if (!agg[key]) {
        agg[key] = { agentId, agentName, date: dateOnly, totalCalls: 0, talkTimeSecs: 0 };
      }
      agg[key].totalCalls += 1;
      agg[key].talkTimeSecs += durationSecs;
    }

    page++;
  } while (page <= lastPage);

  let synced = 0;
  for (const entry of Object.values(agg)) {
    await prisma.dialerMetrics.upsert({
      where: {
        date_source_agentId: {
          date: entry.date,
          source: "threec",
          agentId: entry.agentId,
        },
      },
      update: {
        agentName: entry.agentName,
        totalCalls: entry.totalCalls,
        talkTimeSecs: entry.talkTimeSecs,
        syncedAt: new Date(),
      },
      create: {
        date: entry.date,
        source: "threec",
        agentId: entry.agentId,
        agentName: entry.agentName,
        totalCalls: entry.totalCalls,
        talkTimeSecs: entry.talkTimeSecs,
        syncedAt: new Date(),
      },
    });
    synced++;
  }

  await prisma.syncLog.create({
    data: {
      source: "threec",
      status: "success",
      message: `${synced} agent-day rows synced from ${page - 1} pages`,
    },
  });

  return { synced };
}
