/**
 * GoTo Connect integration — READ-ONLY
 *
 * Auth: OAuth2 Authorization Code (token armazenado no banco via /api/goto/callback)
 *
 * API utilizada: Call History v1
 *   GET https://api.goto.com/call-history/v1/calls
 *   Scope: cr.v1.read (disponível no app OAuth)
 *
 * Campos relevantes por chamada:
 *   - caller.name / caller.number  → agente (ramal interno)
 *   - startTime                    → data/hora da chamada
 *   - duration                     → duração em milissegundos
 *   - direction                    → INBOUND | OUTBOUND
 *   - answerTime                   → null se não atendida
 *
 * Este serviço NUNCA escreve no GoTo. Todas as chamadas são GET.
 */

import { assertReadOnly } from "@/lib/readonly-guard";
import { prisma } from "@/lib/prisma";
import { getMockDialerMetrics, USE_MOCK } from "@/lib/mock-data";

const CALL_HISTORY_BASE = "https://api.goto.com/call-history/v1";
const TOKEN_URL         = "https://authentication.logmeininc.com/oauth/token";

// ─── Token via Authorization Code (OAuth2) ────────────────────────────────────

async function refreshAccessToken(tokenId: string, refreshToken: string): Promise<string> {
  const clientId     = process.env.GOTO_CLIENT_ID!;
  const clientSecret = process.env.GOTO_CLIENT_SECRET!;
  const credentials  = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GoTo token refresh falhou: ${res.status} — ${text}`);
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);

  await prisma.goToToken.update({
    where: { id: tokenId },
    data: { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt },
  });

  return data.access_token;
}

async function getAccessToken(): Promise<{ token: string; accountKey: string }> {
  const record = await prisma.goToToken.findFirst({ orderBy: { updatedAt: "desc" } });

  if (!record) {
    throw new Error(
      "GoTo não conectado. Acesse Configurações → Conectar GoTo para autorizar."
    );
  }

  const accountKey = record.accountKey ?? process.env.GOTO_ACCOUNT_ID ?? "";
  if (!accountKey) throw new Error("GOTO_ACCOUNT_ID não configurado");

  // Renova se expira em menos de 5 minutos
  if (record.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const token = await refreshAccessToken(record.id, record.refreshToken);
    return { token, accountKey };
  }

  return { token: record.accessToken, accountKey };
}

// ─── Busca todas as chamadas do período (com paginação) ───────────────────────

async function fetchAllCalls(
  token: string,
  accountKey: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const allItems: any[] = [];
  let pageToken: string | null = null;
  let page = 0;

  do {
    const params = new URLSearchParams({
      accountKey,
      startTime: startDate.toISOString(),
      endTime:   endDate.toISOString(),
      limit:     "500",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `${CALL_HISTORY_BASE}/calls?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GoTo Call History: ${res.status} — ${text.slice(0, 400)}`);
    }

    const json = await res.json();
    const items: any[] = json.items ?? [];
    allItems.push(...items);

    pageToken = json.nextPageToken ?? null;
    page++;

    if (page > 50) break; // safety limit
  } while (pageToken);

  return allItems;
}

// ─── Sincronização principal ──────────────────────────────────────────────────

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

  const { token, accountKey } = await getAccessToken();

  let calls: any[];
  try {
    calls = await fetchAllCalls(token, accountKey, startDate, endDate);
  } catch (err: any) {
    await prisma.syncLog.create({
      data: { source: "goto", status: "error", message: String(err.message).slice(0, 500) },
    });
    throw err;
  }

  // Agrega por agente + dia
  const agg: Record<string, {
    agentId: string;
    agentName: string;
    date: Date;
    totalCalls: number;
    talkTimeSecs: number;
  }> = {};

  for (const call of calls) {
    // Agente = ramal interno. caller.number = ramal (1000, 1001, 1002...)
    const agentId   = String(call.caller?.number ?? call.caller?.name ?? "unknown");
    const agentName = String(call.caller?.name   ?? agentId);

    if (!call.startTime) continue;
    const dateOnly = new Date(call.startTime.split("T")[0] + "T00:00:00.000Z");

    // Conta apenas chamadas atendidas (answerTime presente)
    if (!call.answerTime) continue;

    // duration em ms → converte para segundos
    const talkSecs = Math.round(Number(call.duration ?? 0) / 1000);

    const key = `${dateOnly.toISOString()}_${agentId}`;
    if (!agg[key]) {
      agg[key] = { agentId, agentName, date: dateOnly, totalCalls: 0, talkTimeSecs: 0 };
    }
    agg[key].totalCalls   += 1;
    agg[key].talkTimeSecs += talkSecs;
  }

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
    data: {
      source: "goto",
      status: "success",
      message: `${calls.length} chamadas → ${synced} entradas (${startDate.toISOString().split("T")[0]} → ${endDate.toISOString().split("T")[0]})`,
    },
  });

  return { synced };
}
