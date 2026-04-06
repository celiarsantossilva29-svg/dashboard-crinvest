/**
 * Kommo CRM integration — READ-ONLY
 *
 * Escopos necessários na sua integração Kommo:
 *   CRM (leads, contatos, tarefas) — somente leitura
 *
 * Este serviço NUNCA escreve no Kommo. Todas as chamadas são GET.
 * assertReadOnly() garante isso em tempo de execução.
 *
 * Fluxo:
 *   1. Usuário acessa /api/kommo/auth → redireciona ao consent screen do Kommo
 *   2. Kommo redireciona para KOMMO_REDIRECT_URI com ?code=
 *   3. /api/auth/kommo/callback troca o code pelo token e salva no BD
 *   4. /api/sync/kommo chama syncKommoData() que lê o CRM e popula Lead[]
 *
 * Docs: https://developers.kommo.com/docs/oauth
 */

import { assertReadOnly } from "@/lib/readonly-guard";
import { prisma } from "@/lib/prisma";
import { getMockLeads, USE_MOCK } from "@/lib/mock-data";

// ─── Env vars ─────────────────────────────────────────────────────────────────

const SUBDOMAIN = () => {
  const v = process.env.KOMMO_SUBDOMAIN;
  if (!v) throw new Error("KOMMO_SUBDOMAIN não configurado no .env");
  return v;
};
const CLIENT_ID = () => {
  const v = process.env.KOMMO_CLIENT_ID;
  if (!v) throw new Error("KOMMO_CLIENT_ID não configurado no .env");
  return v;
};
const CLIENT_SECRET = () => {
  const v = process.env.KOMMO_CLIENT_SECRET;
  if (!v) throw new Error("KOMMO_CLIENT_SECRET não configurado no .env");
  return v;
};
const REDIRECT_URI = () => {
  const v = process.env.KOMMO_REDIRECT_URI;
  if (!v) throw new Error("KOMMO_REDIRECT_URI não configurado no .env");
  return v;
};

const BASE = () => `https://${SUBDOMAIN()}.kommo.com/api/v4`;

// ─── Pipeline status → internal status ────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  // Nomes padrão do Kommo (ajuste conforme seu pipeline)
  "Novo":               "new",
  "Contatado":          "contacted",
  "Qualificado":        "qualified",
  "Reunião agendada":   "scheduled",
  "Reunião realizada":  "meeting",
  // Variantes comuns
  "Primeiro contato":   "contacted",
  "Em qualificação":    "qualified",
  "Agendado":           "scheduled",
  "Realizado":          "meeting",
};

function mapStatus(stageName: string, statusId: number): string {
  if (statusId === 142) return "won";
  if (statusId === 143) return "lost";
  return STATUS_MAP[stageName] ?? "new";
}

// ─── Custom field parser ───────────────────────────────────────────────────────

interface CustomFieldValues {
  sdrScore?: number | null;
  noShow?: boolean;
  isReagendado?: boolean;
  contactAttempts?: number;
  cpf?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

/**
 * Kommo retorna custom_fields_values como array:
 * [{ field_id, field_name, field_type, values: [{ value, enum_id? }] }]
 *
 * Ajuste os field_name abaixo conforme os campos personalizados do seu CRM.
 */
function parseCustomFields(fields: any[]): CustomFieldValues {
  if (!Array.isArray(fields)) return {};

  const get = (name: string) =>
    fields.find(
      (f) =>
        f.field_name?.toLowerCase() === name.toLowerCase() ||
        f.field_code?.toLowerCase() === name.toLowerCase()
    )?.values?.[0]?.value;

  const sdrScoreRaw = get("sdr_score") ?? get("SDR Score") ?? get("Nota SDR");
  const noShowRaw = get("no_show") ?? get("No-Show") ?? get("noshow");
  const reagendadoRaw = get("reagendado") ?? get("is_reagendado");
  const tentativasRaw = get("tentativas") ?? get("contact_attempts") ?? get("Tentativas de Contato");
  const cpfRaw = get("cpf") ?? get("CPF") ?? get("documento");
  const utmSourceRaw = get("utm_source");
  const utmMediumRaw = get("utm_medium");
  const utmCampaignRaw = get("utm_campaign");

  return {
    sdrScore: sdrScoreRaw != null ? Number(sdrScoreRaw) : null,
    noShow: noShowRaw === "true" || noShowRaw === "1" || noShowRaw === true,
    isReagendado: reagendadoRaw === "true" || reagendadoRaw === "1" || reagendadoRaw === true,
    contactAttempts: tentativasRaw != null ? Number(tentativasRaw) : undefined,
    cpf: typeof cpfRaw === "string" ? cpfRaw : undefined,
    utmSource: typeof utmSourceRaw === "string" ? utmSourceRaw : undefined,
    utmMedium: typeof utmMediumRaw === "string" ? utmMediumRaw : undefined,
    utmCampaign: typeof utmCampaignRaw === "string" ? utmCampaignRaw : undefined,
  };
}

// ─── Token management ─────────────────────────────────────────────────────────

async function getValidToken(): Promise<string> {
  const token = await prisma.kommoToken.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (!token) {
    throw new Error(
      "Token Kommo não encontrado. Conecte o CRM em Configurações → Conectar Kommo."
    );
  }

  // Renova se expira em menos de 5 minutos
  if (token.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    return refreshToken(token.refreshToken, token.id);
  }

  return token.accessToken;
}

async function refreshToken(refresh: string, tokenId: string): Promise<string> {
  const res = await fetch(`https://${SUBDOMAIN()}.kommo.com/oauth2/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      grant_type: "refresh_token",
      refresh_token: refresh,
      redirect_uri: REDIRECT_URI(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kommo token refresh falhou: ${res.status} — ${text}`);
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await prisma.kommoToken.update({
    where: { id: tokenId },
    data: { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt },
  });

  return data.access_token;
}

// ─── Kommo helpers ────────────────────────────────────────────────────────────

/** GET /users — resolve responsible_user_id → { name, email } */
async function fetchKommoUsers(
  token: string
): Promise<Record<number, { name: string; email: string }>> {
  assertReadOnly("GET");

  const res = await fetch(`${BASE()}/users?limit=250`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return {};

  const json = await res.json();
  const users: Record<number, { name: string; email: string }> = {};

  for (const u of json._embedded?.users ?? []) {
    users[u.id] = { name: u.name ?? `user-${u.id}`, email: u.email ?? "" };
  }

  return users;
}

/** GET /pipelines — resolve pipeline_id + status_id → { pipelineName, stageName } */
async function fetchKommoPipelines(
  token: string
): Promise<
  Record<number, { name: string; statuses: Record<number, string> }>
> {
  assertReadOnly("GET");

  const res = await fetch(`${BASE()}/pipelines?limit=250`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return {};

  const json = await res.json();
  const pipelines: Record<number, { name: string; statuses: Record<number, string> }> = {};

  for (const p of json._embedded?.pipelines ?? []) {
    const statuses: Record<number, string> = {};
    for (const s of p._embedded?.statuses ?? []) {
      statuses[s.id] = s.name;
    }
    pipelines[p.id] = { name: p.name, statuses };
  }

  return pipelines;
}

/**
 * GET /tasks — busca todas as tarefas abertas vinculadas a leads.
 * Retorna mapa: lead_id → próximo deadline (Unix timestamp ms).
 */
async function fetchOpenTasks(token: string): Promise<Record<string, Date>> {
  assertReadOnly("GET");

  const map: Record<string, Date> = {};
  let page = 1;

  while (true) {
    const url =
      `${BASE()}/tasks?limit=250&page=${page}` +
      `&filter[entity_type]=leads&filter[is_completed]=0`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok || res.status === 204) break;

    const json = await res.json();
    const tasks: any[] = json._embedded?.tasks ?? [];

    if (tasks.length === 0) break;

    for (const t of tasks) {
      if (!t.entity_id || !t.complete_till) continue;
      const key = String(t.entity_id);
      const deadline = new Date(t.complete_till * 1000);
      // Mantém o deadline mais próximo por lead
      if (!map[key] || deadline < map[key]) {
        map[key] = deadline;
      }
    }

    if (tasks.length < 250) break;
    page++;
  }

  return map;
}

// ─── Public exports ───────────────────────────────────────────────────────────

/** URL do consent screen Kommo para iniciar o fluxo OAuth */
export function getKommoAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID(),
    redirect_uri: REDIRECT_URI(),
    response_type: "code",
    // mode: "post_message" é para widgets dentro do Kommo.
    // Para app standalone, usar redirect padrão (sem mode).
  });
  return `https://www.kommo.com/oauth?${params.toString()}`;
}

/** Troca o authorization code pelo access + refresh token */
export async function exchangeKommoCode(code: string): Promise<void> {
  const res = await fetch(`https://${SUBDOMAIN()}.kommo.com/oauth2/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kommo: falha ao trocar código OAuth — ${res.status} ${text}`);
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await prisma.kommoToken.deleteMany();
  await prisma.kommoToken.create({
    data: { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt },
  });
}

export interface SyncOptions {
  /**
   * Se fornecido, busca apenas leads atualizados após esta data.
   * Se omitido, faz sync completo (todos os leads do CRM).
   */
  since?: Date;
}

/**
 * syncKommoData — busca leads do CRM e popula a tabela Lead no Supabase.
 *
 * READ-ONLY: usa apenas GET. Nunca escreve no Kommo.
 *
 * Mapeamento principal:
 *   lead.id              → Lead.id
 *   lead.created_at      → Lead.createdAt + Lead.arrivalAt
 *   lead.responsible_user_id → (resolve via /users) → Lead.assignedTo
 *   lead.status_id       → (resolve via /pipelines) → Lead.status
 *   lead.pipeline_id     → Lead.campaignId + Lead.campaignName
 *   lead.price           → Lead.dealValue
 *   lead.closed_at       → Lead.closedAt
 *   lead.custom_fields_values → Lead.sdrScore, noShow, isReagendado, contactAttempts
 *   tasks (open)         → Lead.nextTaskAt
 */
export async function syncKommoData(opts: SyncOptions = {}): Promise<{ synced: number; pages: number }> {
  assertReadOnly("GET");

  // ── Mock mode ──────────────────────────────────────────────────────────────
  if (USE_MOCK) {
    const leads = getMockLeads();
    let count = 0;

    for (const lead of leads) {
      await prisma.lead.upsert({
        where: { id: lead.id },
        update: {
          status: lead.status,
          assignedTo: lead.assignedTo,
          interactionCount: lead.interactionCount,
          dealValue: lead.dealValue,
          closedAt: lead.closedAt,
          syncedAt: new Date(),
        },
        create: {
          id: lead.id,
          source: lead.source,
          campaignId: lead.campaignId,
          campaignName: lead.campaignName,
          createdAt: lead.createdAt,
          arrivalAt: lead.createdAt,
          contactedAt: lead.contactedAt,
          qualifiedAt: lead.qualifiedAt,
          scheduledAt: lead.scheduledAt,
          meetingAt: lead.meetingAt,
          closedAt: lead.closedAt,
          status: lead.status,
          lostReason: lead.lostReason,
          dealValue: lead.dealValue,
          assignedTo: lead.assignedTo,
          interactionCount: lead.interactionCount,
          syncedAt: new Date(),
        },
      });
      count++;
    }

    await prisma.syncLog.create({
      data: { source: "kommo", status: "success", message: `Mock: ${count} leads` },
    });

    return { synced: count, pages: 1 };
  }

  // ── Real API ───────────────────────────────────────────────────────────────

  const accessToken = await getValidToken();

  // 1. Cache de usuários e pipelines (uma chamada cada, no início)
  const [users, pipelines, openTasksMap] = await Promise.all([
    fetchKommoUsers(accessToken),
    fetchKommoPipelines(accessToken),
    fetchOpenTasks(accessToken),
  ]);

  // 2. Pagina pelos leads
  let page = 1;
  let total = 0;

  while (true) {
    const url = new URL(`${BASE()}/leads`);
    url.searchParams.set("limit", "250");
    url.searchParams.set("page", String(page));
    url.searchParams.set("with", "contacts,loss_reason");

    // Sync incremental: só leads atualizados após `since`
    if (opts.since) {
      url.searchParams.set(
        "filter[updated_at][from]",
        String(Math.floor(opts.since.getTime() / 1000))
      );
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 204 || res.status === 404) break;

    if (!res.ok) {
      const text = await res.text();
      await prisma.syncLog.create({
        data: {
          source: "kommo",
          status: "error",
          message: `Página ${page}: HTTP ${res.status} — ${text.slice(0, 500)}`,
        },
      });
      throw new Error(`Kommo API: ${res.status} ${text}`);
    }

    const json = await res.json();
    const items: any[] = json._embedded?.leads ?? [];

    if (items.length === 0) break;

    for (const item of items) {
      const pipelineId = item.pipeline_id ?? null;
      const pipeline = pipelineId != null ? pipelines[pipelineId] : null;
      const stageName = pipeline?.statuses[item.status_id] ?? "";
      const status = mapStatus(stageName, item.status_id ?? 0);

      const assignedTo =
        item.responsible_user_id != null
          ? (users[item.responsible_user_id]?.name ?? String(item.responsible_user_id))
          : null;

      const lostReason =
        item._embedded?.loss_reason?.[0]?.name ??
        item._embedded?.loss_reason?.name ??
        null;

      const custom = parseCustomFields(item.custom_fields_values ?? []);

      // Deriva campaignName de utm_campaign custom field ou pipeline name
      const campaignName = custom.utmCampaign ?? pipeline?.name ?? null;
      const campaignId = custom.utmCampaign
        ? `utm:${custom.utmCampaign}`
        : pipelineId
        ? String(pipelineId)
        : null;

      const nextTaskAt = openTasksMap[String(item.id)] ?? null;

      await prisma.lead.upsert({
        where: { id: String(item.id) },
        update: {
          status,
          assignedTo,
          dealValue: item.price ?? null,
          lostReason,
          closedAt: item.closed_at ? new Date(item.closed_at * 1000) : null,
          nextTaskAt,
          sdrScore: custom.sdrScore ?? null,
          noShow: custom.noShow ?? false,
          isReagendado: custom.isReagendado ?? false,
          contactAttempts: custom.contactAttempts ?? 0,
          syncedAt: new Date(),
        },
        create: {
          id: String(item.id),
          source: "kommo",
          campaignId,
          campaignName,
          createdAt: new Date(item.created_at * 1000),
          arrivalAt: new Date(item.created_at * 1000),
          // Timestamps de etapa não são fornecidos diretamente pela API de leads.
          // Para preencher contactedAt/qualifiedAt/scheduledAt/meetingAt é necessário
          // buscar GET /leads/{id}/events, o que é feito via syncLeadHistory() abaixo.
          contactedAt: null,
          qualifiedAt: null,
          scheduledAt: null,
          meetingAt: null,
          closedAt: item.closed_at ? new Date(item.closed_at * 1000) : null,
          status,
          lostReason,
          dealValue: item.price ?? null,
          assignedTo,
          interactionCount: 0,
          nextTaskAt,
          sdrScore: custom.sdrScore ?? null,
          noShow: custom.noShow ?? false,
          isReagendado: custom.isReagendado ?? false,
          contactAttempts: custom.contactAttempts ?? 0,
          syncedAt: new Date(),
        },
      });

      total++;
    }

    if (items.length < 250) break;
    page++;

    // Pausa leve para não estourar o rate limit do Kommo (7 req/s por token)
    await new Promise((r) => setTimeout(r, 150));
  }

  await prisma.syncLog.create({
    data: {
      source: "kommo",
      status: "success",
      message: `${total} leads sincronizados em ${page} página(s)${opts.since ? " (incremental)" : " (completo)"}`,
    },
  });

  return { synced: total, pages: page };
}

/**
 * syncLeadHistory — enriquece um lead específico com timestamps de mudança de etapa.
 *
 * Usa GET /leads/{id}/events (changelog) para derivar:
 *   contactedAt, qualifiedAt, scheduledAt, meetingAt
 *
 * Deve ser chamada pontualmente (não em lote) para não exceder rate limits.
 */
export async function syncLeadHistory(leadId: string): Promise<void> {
  assertReadOnly("GET");

  if (USE_MOCK) return;

  const accessToken = await getValidToken();
  const [pipelines, res] = await Promise.all([
    fetchKommoPipelines(accessToken),
    fetch(`${BASE()}/leads/${leadId}/events?type=lead_status_changed&limit=250`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  if (!res.ok) return;

  const json = await res.json();
  const events: any[] = json._embedded?.events ?? [];

  if (events.length === 0) return;

  const timestamps: {
    contactedAt?: Date;
    qualifiedAt?: Date;
    scheduledAt?: Date;
    meetingAt?: Date;
  } = {};

  // Percorre eventos em ordem cronológica (mais antigo primeiro)
  const sorted = [...events].sort((a, b) => a.created_at - b.created_at);

  for (const ev of sorted) {
    const afterStatusId = ev.value_after?.[0]?.lead_status?.id ?? null;
    if (!afterStatusId) continue;

    // Tenta resolver o nome do status através de qualquer pipeline
    let stageName = "";
    for (const p of Object.values(pipelines)) {
      if (p.statuses[afterStatusId]) {
        stageName = p.statuses[afterStatusId];
        break;
      }
    }

    const status = mapStatus(stageName, afterStatusId);
    const ts = new Date(ev.created_at * 1000);

    if (status === "contacted" && !timestamps.contactedAt) timestamps.contactedAt = ts;
    if (status === "qualified"  && !timestamps.qualifiedAt)  timestamps.qualifiedAt = ts;
    if (status === "scheduled"  && !timestamps.scheduledAt)  timestamps.scheduledAt = ts;
    if (status === "meeting"    && !timestamps.meetingAt)    timestamps.meetingAt = ts;
  }

  if (Object.keys(timestamps).length > 0) {
    await prisma.lead.updateMany({
      where: { id: leadId },
      data: { ...timestamps, syncedAt: new Date() },
    });
  }
}

/** Verifica se há um token válido salvo (para mostrar status na UI) */
export async function getKommoConnectionStatus(): Promise<{
  connected: boolean;
  expiresAt: Date | null;
  lastSync: Date | null;
}> {
  const [token, lastLog] = await Promise.all([
    prisma.kommoToken.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.syncLog.findFirst({
      where: { source: "kommo", status: "success" },
      orderBy: { syncedAt: "desc" },
    }),
  ]);

  return {
    connected: !!token,
    expiresAt: token?.expiresAt ?? null,
    lastSync: lastLog?.syncedAt ?? null,
  };
}
