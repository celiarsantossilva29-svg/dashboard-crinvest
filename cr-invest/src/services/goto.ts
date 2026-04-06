/**
 * GoTo Connect integration — READ-ONLY
 *
 * Auth: OAuth2 Client Credentials
 *   Token URL : https://authentication.logmeininc.com/oauth/token
 *   Credentials: GOTO_CLIENT_ID + GOTO_CLIENT_SECRET (Basic Auth)
 *
 * Reports API: https://api.goto.com/reporting/v1/accounts/{accountKey}/calls
 *   accountKey = GOTO_ACCOUNT_ID
 *
 * Este serviço NUNCA escreve no GoTo. Todas as chamadas são GET.
 */

import { assertReadOnly } from "@/lib/readonly-guard";
import { prisma } from "@/lib/prisma";
import { getMockDialerMetrics, USE_MOCK } from "@/lib/mock-data";

const GOTO_BASE = "https://api.goto.com";
const TOKEN_URL = "https://authentication.logmeininc.com/oauth/token";

// ─── Token cache (in-memory, válido por processo) ─────────────────────────────

let _cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 30_000) {
    return _cachedToken.value;
  }

  const clientId = process.env.GOTO_CLIENT_ID;
  const clientSecret = process.env.GOTO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOTO_CLIENT_ID e GOTO_CLIENT_SECRET não configurados no .env");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GoTo OAuth2 falhou: ${res.status} — ${text}`);
  }

  const data = await res.json();
  _cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return _cachedToken.value;
}

function toISO(d: Date): string {
  return d.toISOString();
}

export async function syncGoToData(
  startDate: Date,
  endDate: Date
): Promise<{ synced: number }> {
  assertReadOnly("GET");

  if (USE_MOCK) {
    const metrics = getMockDialerMetrics().filter(
      (m) => m.source === "goto" && m.date >= startDate && m.date <= endDate
    );

    for (const m of metrics) {
      await prisma.dialerMetrics.upsert({
        where: { date_source_agentId: { date: m.date, source: m.source, agentId: m.agentId } },
        update: { agentName: m.agentName, totalCalls: m.totalCalls, talkTimeSecs: m.talkTimeSecs, syncedAt: new Date() },
        create: { date: m.date, source: m.source, agentId: m.agentId, agentName: m.agentName, totalCalls: m.totalCalls, talkTimeSecs: m.talkTimeSecs, syncedAt: new Date() },
      });
    }

    await prisma.syncLog.create({
      data: { source: "goto", status: "success", message: `Mock: ${metrics.length} GoTo dialer rows upserted` },
    });

    return { synced: metrics.length };
  }

  const accountKey = process.env.GOTO_ACCOUNT_ID;
  if (!accountKey) throw new Error("GOTO_ACCOUNT_ID não configurado no .env");

  const token = await getAccessToken();

  const agg: Record<string, { agentId: string; agentName: string; date: Date; totalCalls: number; talkTimeSecs: number }> = {};

  let pageToken: string | null = null;
  let pageCount = 0;

  do {
    const params = new URLSearchParams({
      startTime: toISO(startDate),
      endTime: toISO(endDate),
      pageSize: "200",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `${GOTO_BASE}/reporting/v1/accounts/${accountKey}/calls?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      await prisma.syncLog.create({
        data: { source: "goto", status: "error", message: `Página ${pageCount + 1}: ${res.status} ${text.slice(0, 400)}` },
      });
      throw new Error(`GoTo API: ${res.status} ${text}`);
    }

    const json = await res.json();
    const items: any[] = json.items ?? json.calls ?? [];

    for (const item of items) {
      const agentId   = String(item.agentId   ?? item.agent_id   ?? "unknown");
      const agentName = String(item.agentName ?? item.agent_name ?? agentId);
      const callDate  = new Date(item.callDate ?? item.call_date ?? item.startTime ?? item.start_time);
      const dateOnly  = new Date(callDate.toISOString().split("T")[0] + "T00:00:00.000Z");
      const durSecs   = Number(item.callDurationSeconds ?? item.duration_seconds ?? item.talkTime ?? 0);

      const key = `${dateOnly.toISOString()}_${agentId}`;
      if (!agg[key]) agg[key] = { agentId, agentName, date: dateOnly, totalCalls: 0, talkTimeSecs: 0 };
      agg[key].totalCalls  += 1;
      agg[key].talkTimeSecs += durSecs;
    }

    pageToken = json.nextPageToken ?? null;
    pageCount++;
  } while (pageToken);

  let synced = 0;
  for (const entry of Object.values(agg)) {
    await prisma.dialerMetrics.upsert({
      where: { date_source_agentId: { date: entry.date, source: "goto", agentId: entry.agentId } },
      update: { agentName: entry.agentName, totalCalls: entry.totalCalls, talkTimeSecs: entry.talkTimeSecs, syncedAt: new Date() },
      create: { date: entry.date, source: "goto", agentId: entry.agentId, agentName: entry.agentName, totalCalls: entry.totalCalls, talkTimeSecs: entry.talkTimeSecs, syncedAt: new Date() },
    });
    synced++;
  }

  await prisma.syncLog.create({
    data: { source: "goto", status: "success", message: `${synced} registros sincronizados em ${pageCount} páginas` },
  });

  return { synced };
}
