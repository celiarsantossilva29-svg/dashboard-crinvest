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
      pageSize:  "500",
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

  // Agrega por agente + dia (para DialerMetrics global)
  // E também mapeia por número de destino para atualizar os Leads locais
  const agg: Record<string, {
    agentId: string;
    agentName: string;
    date: Date;
    totalCalls: number;
    talkTimeSecs: number;
  }> = {};

  const callCountsByNumber: Record<string, number> = {};
  const firstCallByNumber: Record<string, Date> = {};
  // Para LeadCallLog: phone → lista de {date BRT, agentId, agentName}
  const callsByNumDate: Record<string, Array<{ date: Date; agentId: string; agentName: string }>> = {};

  for (const call of calls) {
    const agentId   = String(call.caller?.number ?? call.caller?.name ?? "unknown");
    let agentName = String(call.caller?.name ?? agentId);

    // Mapeamento explícito de ramais do GoTo para o nome do SDR do Kommo
    if (agentId === "1000" || agentId === "1002") {
      agentName = "Cauê Perpétuo"; // Nome exato usado no Kommo
    }

    // Para identificar qual Lead foi ligado, pegamos o número discado
    // Em ligações OUTBOUND, o destino fica em callee.number
    if (call.callee?.number && call.startTime) {
      const cleanNum = call.callee.number.replace(/\D/g, "");
      if (cleanNum.length >= 8) {
        callCountsByNumber[cleanNum] = (callCountsByNumber[cleanNum] ?? 0) + 1;
        const callTime = new Date(call.startTime);
        if (!firstCallByNumber[cleanNum] || callTime < firstCallByNumber[cleanNum]) {
          firstCallByNumber[cleanNum] = callTime;
        }
        // LeadCallLog: data no fuso BRT para alinhar com o filtro do dashboard
        const brtDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(callTime);
        if (!callsByNumDate[cleanNum]) callsByNumDate[cleanNum] = [];
        callsByNumDate[cleanNum].push({ date: new Date(brtDateStr + "T03:00:00Z"), agentId, agentName });
      }
    }

    if (!call.startTime) continue;
    const dateOnly = new Date(call.startTime.split("T")[0] + "T00:00:00.000Z");

    // Conta TODAS as ligações (atendidas + não atendidas) para totalCalls
    const key = `${dateOnly.toISOString()}_${agentId}`;
    if (!agg[key]) {
      agg[key] = { agentId, agentName, date: dateOnly, totalCalls: 0, talkTimeSecs: 0 };
    }
    agg[key].totalCalls += 1;

    // Talk time só para ligações atendidas
    if (call.answerTime) {
      const talkSecs = Math.round(Number(call.duration ?? 0) / 1000);
      agg[key].talkTimeSecs += talkSecs;
    }
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

  // Atualiza as chamadas diretas por Lead e Data da 1ª Ligação
  let updatedLeads = 0;
  const numbersFound = Object.keys(callCountsByNumber);
  if (numbersFound.length > 0) {
    // Generate variations to guarantee matches across +55 and local formats
    const searchVariations = new Set<string>();
    for (const num of numbersFound) {
      searchVariations.add(num);
      if (num.startsWith("55") && num.length > 11) searchVariations.add(num.slice(2));
      else if (num.length >= 10 && num.length <= 11) searchVariations.add("55" + num);
      if (num.startsWith("0")) searchVariations.add(num.slice(1));
    }

    const leadsToUpdate = await prisma.lead.findMany({
      where: { leadPhones: { hasSome: Array.from(searchVariations) } }
    });

    // Acumula dados para LeadCallLog: key = "leadId||agentId||dateISO"
    const leadCallAgg = new Map<string, { leadId: string; agentId: string; agentName: string; date: Date; callCount: number }>();

    for (const lead of leadsToUpdate) {
      let extraCalls = 0;
      let earliestCall: Date | null = null;

      for (const p of lead.leadPhones) {
        // Evaluate all variations of the lead's phone against our GoTo map
        const pVars = [p, p.startsWith("55") ? p.slice(2) : "55" + p, p.startsWith("0") ? p.slice(1) : p];
        for (const pv of pVars) {
          if (callCountsByNumber[pv]) {
            extraCalls += callCountsByNumber[pv];
            if (firstCallByNumber[pv]) {
              if (!earliestCall || firstCallByNumber[pv] < earliestCall) earliestCall = firstCallByNumber[pv];
            }
            // Mapeou por uma variação, não conta duplicado das outras variações!
            delete callCountsByNumber[pv];

            // Coleta chamadas por data/agente para LeadCallLog
            const numCalls = callsByNumDate[pv];
            if (numCalls) {
              for (const c of numCalls) {
                const aggKey = `${lead.id}||${c.agentId}||${c.date.toISOString()}`;
                const entry = leadCallAgg.get(aggKey);
                if (entry) entry.callCount++;
                else leadCallAgg.set(aggKey, { leadId: lead.id, agentId: c.agentId, agentName: c.agentName, date: c.date, callCount: 1 });
              }
              delete callsByNumDate[pv];
            }
          }
        }
      }

      const updateData: any = {};
      if (extraCalls > 0) updateData.goToCalls = { increment: extraCalls };
      if (earliestCall) {
        if (!lead.firstCallAt || earliestCall < lead.firstCallAt) updateData.firstCallAt = earliestCall;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: updateData
        });
        updatedLeads++;
      }
    }

    // Upsert LeadCallLog em lotes de 50 (paralelo dentro do lote, sem bloquear)
    const logEntries = Array.from(leadCallAgg.values());
    for (let i = 0; i < logEntries.length; i += 50) {
      const chunk = logEntries.slice(i, i + 50);
      await Promise.all(chunk.map(e =>
        prisma.leadCallLog.upsert({
          where: { leadId_agentId_source_date: { leadId: e.leadId, agentId: e.agentId, source: "goto", date: e.date } },
          update: { callCount: e.callCount, agentName: e.agentName, syncedAt: new Date() },
          create: { leadId: e.leadId, agentId: e.agentId, agentName: e.agentName, source: "goto", date: e.date, callCount: e.callCount },
        })
      ));
    }
  }

  await prisma.syncLog.create({
    data: {
      source: "goto",
      status: "success",
      message: `${calls.length} chamadas → ${synced} métricas (${updatedLeads} leads mapeados)`,
    },
  });

  return { synced };
}
