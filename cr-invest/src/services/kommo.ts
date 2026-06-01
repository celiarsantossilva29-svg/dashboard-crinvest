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
import { startSync, updateSync, finishSync } from "@/lib/sync-progress";

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
  // ── PRÉ-VENDAS (pipeline principal — SDR) ─────────────────────────────────
  "Etapa de leads de entrada":  "new",
  "dia 1":                      "contacted",
  "dia 2":                      "contacted",
  "dia 3":                      "contacted",
  "dia 5":                      "contacted",
  "dia 7":                      "contacted",
  "dia 10":                     "contacted",
  "1° Reunião Confirmada":      "scheduled",
  "Reagendamento - R1":         "scheduled",

  // ── VENDAS (pipeline closer) ───────────────────────────────────────────────
  "1° Reunião Realizada":       "meeting",
  "2° Reunião AGENDADA":        "scheduled",
  "2° Reunião Realizada":       "meeting",
  "Reagendamento - R2":         "scheduled",
  "Negociação":                 "meeting",
  "Contato Futuro":             "new",

  // ── PRÉ-VENDAS 2.0 ────────────────────────────────────────────────────────
  "NOVO":                       "new",
  "ABERTURA":                   "contacted",
  "CONEXÃO":                    "contacted",
  "QUALIFICADOS":               "qualified",
  "AGENDADOS":                  "scheduled",
  "rEUNIÃO REALIZADATEMOS":     "meeting",
  "NO SHOW":                    "new",

  // ── RECUPERAÇÃO ───────────────────────────────────────────────────────────
  "Contato inicial":            "contacted",
  "1ª Tentativa":               "contacted",
  "2ª Tentativa":               "contacted",
  "3ª Tentativa":               "contacted",
  "Oferta feita":               "meeting",

  // ── Campanha | Nutrição ───────────────────────────────────────────────────
  "BASE Antiga":                "new",
  "Leads":                      "new",
  "Cancelados":                 "lost",
  "Cliente Detrator":           "new",
  "Cliente Promotor":           "won",
  "Campanha 1":                 "contacted",
  "Campanha 2":                 "contacted",
  "Não quer receber Mensagem":  "lost",
};

function mapStatus(stageName: string, statusId: number): string {
  if (statusId === 142) return "won";
  if (statusId === 143) return "lost";
  
  // Tratamento para leads que foram ganhos e movidos para o funil de Pós Vendas
  const sn = stageName.toLowerCase();
  if (sn.includes("acompanhamento") || sn.includes("pós venda") || sn.includes("pos venda")) {
    return "won";
  }

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
  reuniaoPreVenda?: Date | null;
  objetivo?: string;
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
  const reuniaoRaw = get("Reunião PRÉ-VENDA") ?? get("Reuniao PRE-VENDA") ?? get("reuniao_pre_venda");
  // "Qual seu principal objetivo" — aba Investimento no Kommo
  const objetivoRaw = get("Qual seu principal objetivo") ?? get("Qual seu principal objetivo?") ?? get("principal_objetivo") ?? get("objetivo");

  // O campo de data no Kommo pode vir como timestamp Unix (number) ou string ISO
  let reuniaoPreVenda: Date | null = null;
  if (reuniaoRaw != null) {
    const ts = Number(reuniaoRaw);
    if (!isNaN(ts) && ts > 0) {
      reuniaoPreVenda = new Date(ts * 1000); // Unix timestamp em segundos
    } else if (typeof reuniaoRaw === "string" && reuniaoRaw.length > 0) {
      const d = new Date(reuniaoRaw);
      if (!isNaN(d.getTime())) reuniaoPreVenda = d;
    }
  }

  return {
    sdrScore: sdrScoreRaw != null ? Number(sdrScoreRaw) : null,
    noShow: noShowRaw === "true" || noShowRaw === "1" || noShowRaw === true,
    isReagendado: reagendadoRaw === "true" || reagendadoRaw === "1" || reagendadoRaw === true,
    contactAttempts: tentativasRaw != null ? Number(tentativasRaw) : undefined,
    cpf: typeof cpfRaw === "string" ? cpfRaw : undefined,
    utmSource: typeof utmSourceRaw === "string" ? utmSourceRaw : undefined,
    utmMedium: typeof utmMediumRaw === "string" ? utmMediumRaw : undefined,
    utmCampaign: typeof utmCampaignRaw === "string" ? utmCampaignRaw : undefined,
    reuniaoPreVenda,
    objetivo: typeof objetivoRaw === "string" && objetivoRaw.length > 0 ? objetivoRaw : undefined,
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

  const res = await fetch(`${BASE()}/leads/pipelines?limit=250`, {
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

  startSync("kommo");

  let accessToken: string;
  try {
    accessToken = await getValidToken();
  } catch (e: any) {
    finishSync(e.message);
    throw e;
  }

  // 1. Cache de usuários e pipelines (uma chamada cada, no início)
  updateSync("Buscando metadados (usuários, pipelines, tarefas)...", 0, 0);
  console.log("Fetching users/pipelines/tasks...");
  const [users, pipelines, openTasksMap] = await Promise.all([
    fetchKommoUsers(accessToken),
    fetchKommoPipelines(accessToken),
    fetchOpenTasks(accessToken),
  ]);
  console.log("Done caching.");

  // 2. Pagina pelos leads
  let page = 1;
  let total = 0;

  while (true) {
    const url = new URL(`${BASE()}/leads`);
    url.searchParams.set("limit", "250");
    url.searchParams.set("page", String(page));
    url.searchParams.set("with", "contacts,loss_reason,tags");

    // Sync incremental: só leads atualizados após `since`
    if (opts.since) {
      url.searchParams.set(
        "filter[updated_at][from]",
        String(Math.floor(opts.since.getTime() / 1000))
      );
    }

    updateSync(`Buscando página ${page} de leads...`, total, total, page);
    console.log(`Fetching Kommo Leads page ${page}...`);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 204 || res.status === 404) break;

    if (!res.ok) {
      const text = await res.text();
      const errMsg = `Página ${page}: HTTP ${res.status} — ${text.slice(0, 500)}`;
      await prisma.syncLog.create({
        data: { source: "kommo", status: "error", message: errMsg },
      });
      finishSync(errMsg);
      throw new Error(`Kommo API: ${res.status} ${text}`);
    }

    const json = await res.json();
    const items: any[] = json._embedded?.leads ?? [];

    if (items.length === 0) break;

    // ⚠️ Não quebrar em items.length < 250: o parâmetro `with=contacts,...`
    // pode fazer Kommo retornar menos de 250 itens em páginas intermediárias,
    // fazendo o sync parar antes de capturar os leads mais recentes. A saída
    // real é quando a resposta for 204/404 ou items.length === 0 (acima).

    // Ignora apenas leads de funis de nutrição (não são prospecção ativa).
    // PÓS-VENDAS é incluído para capturar o campo "objetivo" dos clientes ganhos.
    const SKIP_PIPELINES = ["CAMPANHA | NUTRIÇÃO"];
    const filteredItems = items.filter((item: any) => {
      const pName = (pipelines[item.pipeline_id]?.name ?? "").toUpperCase();
      return !pName.includes("CAMPANHA") && !pName.includes("NUTRIÇÃO");
    });
    const skipped = items.length - filteredItems.length;
    if (skipped > 0) console.log(`Pulando ${skipped} leads de funis ignorados: ${SKIP_PIPELINES.join(", ")}`);
    const activeItems = filteredItems;

    updateSync(`Pág. ${page}: ${activeItems.length} leads recebidos, buscando contatos...`, 0, 0, page);

    // -- BUSCA TELEFONES DOS CONTATOS VINCULADOS --
    const contactIds = new Set<number>();
    for (const item of activeItems) {
      for (const c of item._embedded?.contacts ?? []) {
        if (c.id) contactIds.add(c.id);
      }
    }

    const contactDetailsMap: Record<number, { name: string, phones: string[] }> = {};
    const cIdsArray = Array.from(contactIds);
    if (cIdsArray.length > 0) {
      try {
        const chunkSize = 50;
        const totalChunks = Math.ceil(cIdsArray.length / chunkSize);
        for (let i = 0; i < cIdsArray.length; i += chunkSize) {
          const chunkIdx = Math.floor(i / chunkSize) + 1;
          updateSync(`Pág. ${page}: buscando contatos (${chunkIdx}/${totalChunks})...`, 0, 0, page);
          const chunk = cIdsArray.slice(i, i + chunkSize);
          const idQuery = chunk.map((id) => `filter[id][]=${id}`).join("&");
          const cRes = await fetch(`${BASE()}/contacts?${idQuery}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (cRes.ok) {
            const cJson = await cRes.json();
            const contacts = cJson._embedded?.contacts ?? [];
            for (const contact of contacts) {
              const phones: string[] = [];
              for (const cf of contact.custom_fields_values ?? []) {
                const fname = (cf.field_name || cf.name || "").toLowerCase();
                const fcode = (cf.field_code || "").toUpperCase();

                if (fname.includes("telefone") || fname.includes("tel") || fcode === "PHONE") {
                  for (const val of cf.values ?? []) {
                    if (val.value) phones.push(val.value.replace(/\D/g, ""));
                  }
                }
              }
              contactDetailsMap[contact.id] = {
                name: contact.name || "",
                phones: phones.filter((p) => p.length >= 8)
              };
            }
          }
        }
      } catch (e) {
        console.error("Error fetching contacts", e);
      }
    }

    // ── Captura syncedAt e scheduledAt ANTES do upsert ──
    const pageIds = activeItems.map((item: any) => String(item.id));
    const existingSynced = await prisma.lead.findMany({
      where: { id: { in: pageIds } },
      select: { id: true, syncedAt: true, scheduledAt: true, meetingAt: true, meeting2At: true, meeting2RealizadaAt: true, negociacaoAt: true },
    });
    const syncedAtMap = new Map(existingSynced.map(l => [l.id, { syncedAt: l.syncedAt, scheduledAt: l.scheduledAt, meetingAt: l.meetingAt, meeting2At: l.meeting2At, meeting2RealizadaAt: l.meeting2RealizadaAt, negociacaoAt: l.negociacaoAt }]));

    updateSync(`Pág. ${page}: salvando ${activeItems.length} leads no banco...`, 0, 0, page);

    // Prepara os dados de todos os leads da página antes de abrir a transação.
    const upsertOps = activeItems.map((item: any) => {
      const pipelineId = item.pipeline_id ?? null;
      const pipeline = pipelineId != null ? pipelines[pipelineId] : null;
      const stageName = pipeline?.statuses[item.status_id] ?? "";
      const status = mapStatus(stageName, item.status_id ?? 0);
      const sn_stage = stageName.toLowerCase();
      const existingUpsert = syncedAtMap.get(String(item.id));
      const isCurrentlyMeeting2          = (sn_stage.includes("2°") || sn_stage.includes("2ª")) && sn_stage.includes("agendada");
      const isCurrentlyMeeting2Realizada = (sn_stage.includes("2°") || sn_stage.includes("2ª")) && sn_stage.includes("realizada");
      const isCurrentlyNegociacao        = sn_stage.includes("negociação") || sn_stage.includes("negociacao");
      // "1ª Reunião Realizada": status=meeting mas NÃO é 2ª reunião realizada
      const isCurrentlyMeeting1          = status === "meeting" && !isCurrentlyMeeting2Realizada;

      const assignedTo =
        item.responsible_user_id != null
          ? (users[item.responsible_user_id]?.name ?? String(item.responsible_user_id))
          : null;

      const lostReason =
        item._embedded?.loss_reason?.[0]?.name ??
        item._embedded?.loss_reason?.name ??
        null;

      const tags: string[] = (item._embedded?.tags ?? [])
        .map((t: any) => t.name ?? "")
        .filter(Boolean);

      const custom = parseCustomFields(item.custom_fields_values ?? []);

      const campaignName = custom.utmCampaign ?? pipeline?.name ?? null;
      const campaignId = custom.utmCampaign
        ? `utm:${custom.utmCampaign}`
        : pipelineId
        ? String(pipelineId)
        : null;

      const closedAt = item.closed_at ? new Date(item.closed_at * 1000) : null;

      const nextTaskAt = openTasksMap[String(item.id)] ?? null;

      const phonesSet = new Set<string>();
      let contactName: string | null = null;
      for (const c of item._embedded?.contacts ?? []) {
        if (contactDetailsMap[c.id]) {
          if (!contactName && contactDetailsMap[c.id].name) {
            contactName = contactDetailsMap[c.id].name;
          }
          for (const p of contactDetailsMap[c.id].phones) phonesSet.add(p);
        }
      }
      const leadPhones = Array.from(phonesSet);

      const finalName = contactName || item.name || `Lead ${item.id}`;

      return prisma.lead.upsert({
        where: { id: String(item.id) },
        update: {
          name: finalName,
          status,
          assignedTo,
          dealValue: item.price ?? null,
          lostReason,
          closedAt,
          nextTaskAt,
          sdrScore: custom.sdrScore ?? null,
          noShow: custom.noShow ?? false,
          isReagendado: custom.isReagendado ?? false,
          contactAttempts: custom.contactAttempts ?? 0,
          leadPhones,
          tags,
          ...(custom.objetivo != null ? { objetivo: custom.objetivo } : {}),
          // Campo "Reunião PRÉ-VENDA" tem prioridade sobre a data inferida por etapa
          ...(custom.reuniaoPreVenda != null ? { meetingAt: custom.reuniaoPreVenda } : {}),
          // Fallback: se o lead está em "1ª Reunião Realizada" mas meetingAt ainda é null,
          // usa item.updated_at como proxy (mesmo padrão de meeting2At / negociacaoAt)
          ...(isCurrentlyMeeting1          && !existingUpsert?.meetingAt           ? { meetingAt:           new Date(item.updated_at * 1000) } : {}),
          // Fallback: se o lead está atualmente em "2ª Reunião AGENDADA"/"Negociação" mas o
          // timestamp ainda é null (eventos não capturaram), usa item.updated_at como proxy
          ...(isCurrentlyMeeting2          && !existingUpsert?.meeting2At          ? { meeting2At:          new Date(item.updated_at * 1000) } : {}),
          ...(isCurrentlyMeeting2Realizada && !existingUpsert?.meeting2RealizadaAt ? { meeting2RealizadaAt: new Date(item.updated_at * 1000) } : {}),
          ...(isCurrentlyNegociacao        && !existingUpsert?.negociacaoAt        ? { negociacaoAt:        new Date(item.updated_at * 1000) } : {}),
          syncedAt: new Date(),
        },
        create: {
          id: String(item.id),
          name: finalName,
          source: "kommo",
          campaignId,
          campaignName,
          createdAt: new Date(item.created_at * 1000),
          arrivalAt: new Date(item.created_at * 1000),
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
          leadPhones,
          tags,
          ...(custom.objetivo != null ? { objetivo: custom.objetivo } : {}),
          syncedAt: new Date(),
        },
      });
    });

    // Executa todos os upserts da página em uma única transação
    await prisma.$transaction(upsertOps);
    total += activeItems.length;

    // ── Enriquecer leads com timestamps de etapa (events API) ──
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 3600 * 1000);
    const leadsToEnrich = activeItems.filter((item: any) => {
      // Pula leads fechados (won/lost) há mais de 6 meses — nunca mudam
      const closedAt = (item.closed_at && item.closed_at > 0) ? new Date(item.closed_at * 1000) : null;
      const isClosed = item.status_id === 142 || item.status_id === 143; // won/lost IDs padrão Kommo
      if (isClosed && closedAt && closedAt < sixMonthsAgo) return false;

      const existing = syncedAtMap.get(String(item.id));

      // Força enriquecimento se o lead está em scheduled/meeting mas scheduledAt ainda é null —
      // garante que movimentações recentes no Kommo sejam capturadas mesmo que o sync
      // já tenha rodado desde a última atualização do lead.
      if (!existing?.scheduledAt) {
        const pipelineForCheck = item.pipeline_id != null ? pipelines[item.pipeline_id] : null;
        const stageForCheck = pipelineForCheck?.statuses[item.status_id] ?? "";
        const statusForCheck = mapStatus(stageForCheck, item.status_id ?? 0);
        if (statusForCheck === "scheduled" || statusForCheck === "meeting") return true;
      }

      // Força enriquecimento se o lead está em "1ª Reunião Realizada" mas meetingAt ainda é null —
      // cobre leads que já tinham scheduledAt (scheduled antes do período) e passaram para
      // meeting sem que o sync recapturasse o evento de mudança de etapa.
      if (!existing?.meetingAt) {
        const pipelineForCheck = item.pipeline_id != null ? pipelines[item.pipeline_id] : null;
        const stageForCheck = pipelineForCheck?.statuses[item.status_id] ?? "";
        const statusForCheck = mapStatus(stageForCheck, item.status_id ?? 0);
        if (statusForCheck === "meeting") return true;
      }

      // Força enriquecimento se está em etapas de 2ª reunião ou Negociação mas timestamps são null
      {
        const pipelineForCheck = item.pipeline_id != null ? pipelines[item.pipeline_id] : null;
        const snCheck = (pipelineForCheck?.statuses[item.status_id] ?? "").toLowerCase();
        const isIn2aAgendada   = (snCheck.includes("2°") || snCheck.includes("2ª")) && snCheck.includes("agendada");
        const isIn2aRealizada  = (snCheck.includes("2°") || snCheck.includes("2ª")) && snCheck.includes("realizada");
        const isInNegociacao   = snCheck.includes("negociação") || snCheck.includes("negociacao");
        if (isIn2aAgendada  && !existing?.meeting2At)          return true;
        if (isIn2aRealizada && !existing?.meeting2RealizadaAt) return true;
        if (isInNegociacao  && !existing?.negociacaoAt)        return true;
      }

      const lastSynced = existing?.syncedAt ?? null;
      const kommoUpdated = new Date(item.updated_at * 1000);
      return !(lastSynced && kommoUpdated <= lastSynced);
    });

    // Busca eventos em batches de 20 leads por chamada (Kommo aceita múltiplos
    // filter[entity_id][]). Reduz ~7700 chamadas individuais para ~385 batches.
    const BATCH_SIZE = 20;
    for (let bi = 0; bi < leadsToEnrich.length; bi += BATCH_SIZE) {
      const batch = leadsToEnrich.slice(bi, bi + BATCH_SIZE);
      const batchNum = Math.floor(bi / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(leadsToEnrich.length / BATCH_SIZE);
      updateSync(
        `Pág. ${page}: histórico ${batchNum}/${totalBatches} (${total} leads)`,
        bi + batch.length,
        leadsToEnrich.length,
        page
      );

      try {
        const idParams = batch.map((item: any) => `filter[entity_id][]=${item.id}`).join("&");
        // Filtra apenas mudanças de etapa: reduz volume de eventos de ~15-25/lead para ~2-5/lead,
        // garantindo que o limite de 250 não corte eventos relevantes em batches de 20 leads.
        const res = await fetch(
          `${BASE()}/events?filter[entity]=lead&${idParams}&filter[type][]=lead_status_changed&limit=250`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok && res.status !== 204) {
          const json = await res.json();
          const events: any[] = json._embedded?.events ?? [];

          // Agrupa eventos por lead e processa cada um
          const byLead = new Map<string, any[]>();
          for (const ev of events) {
            const lid = String(ev.entity_id);
            if (!byLead.has(lid)) byLead.set(lid, []);
            byLead.get(lid)!.push(ev);
          }
          for (const item of batch) {
            const leadEvents = byLead.get(String(item.id)) ?? [];
            await processLeadEvents(String(item.id), leadEvents, pipelines, users);
          }
        }
      } catch (e: any) {
        console.error(`processLeadEvents batch failed (batch ${batchNum}):`, e.message);
      }
      // 250ms entre batches → bem abaixo do limite de 7 req/s do Kommo
      await new Promise(r => setTimeout(r, 250));
    }

    page++;

    // Pausa leve para não estourar o rate limit do Kommo (7 req/s por token)
    await new Promise((r) => setTimeout(r, 150));
  }

  const successMsg = `${total} leads sincronizados em ${page} página(s)${opts.since ? " (incremental)" : " (completo)"}`;
  await prisma.syncLog.create({
    data: { source: "kommo", status: "success", message: successMsg },
  });
  finishSync();

  return { synced: total, pages: page };
}

/**
 * processLeadEvents — processa a lista de eventos já carregados para um lead
 * e persiste os timestamps derivados no banco.
 */
async function processLeadEvents(
  leadId: string,
  events: any[],
  pipelines: Record<string, { name: string; statuses: Record<number, string> }>,
  users: Record<number, { name: string }>
): Promise<void> {
  if (events.length === 0) return;

  const timestamps: {
    contactedAt?: Date;
    firstContactAt?: Date;
    qualifiedAt?: Date;
    scheduledAt?: Date;
    scheduledBy?: string | null;
    meetingAt?: Date;
    meeting2At?: Date;
    meeting2RealizadaAt?: Date;
    negociacaoAt?: Date;
    reagendadoAt?: Date;
    reagendadoCount?: number;
  } = {};

  const sorted = [...events].sort((a, b) => a.created_at - b.created_at);

  for (const ev of sorted) {
    const afterStatusId = ev.value_after?.[0]?.lead_status?.id ?? null;
    if (!afterStatusId) continue;

    let stageName = "";
    for (const p of Object.values(pipelines)) {
      if (p.statuses[afterStatusId]) { stageName = p.statuses[afterStatusId]; break; }
    }

    const status = mapStatus(stageName, afterStatusId);
    const ts = new Date(ev.created_at * 1000);
    const sn = stageName.toLowerCase();

    if (status === "contacted" && !timestamps.contactedAt) {
      timestamps.contactedAt = ts;
      timestamps.firstContactAt = ts; // Speed to Lead: primeiro contato humano real
    }
    if (status === "qualified"  && !timestamps.qualifiedAt)  timestamps.qualifiedAt = ts;

    const isReuniao2Realizada = (sn.includes("2°") || sn.includes("2ª")) && sn.includes("reunião realizada");
    if (isReuniao2Realizada && !timestamps.meeting2RealizadaAt) timestamps.meeting2RealizadaAt = ts;

    const isReuniaoRealizada = (afterStatusId === 88992835 || sn.includes("reunião realizada")) && !isReuniao2Realizada;
    if (isReuniaoRealizada && !timestamps.meetingAt) {
      timestamps.meetingAt = ts;
      // BACKFILL: Se teve reunião, necessariamente foi agendado.
      if (!timestamps.scheduledAt) {
        timestamps.scheduledAt = ts;
        timestamps.scheduledBy = "Cauê Perpétuo";
      }
    }

    const isReuniao2Agendada = (sn.includes("2°") || sn.includes("2ª") || sn.includes("segunda reunião") || sn.includes("2a reunião")) && !sn.includes("realizada");
    if (isReuniao2Agendada && !timestamps.meeting2At) timestamps.meeting2At = ts;

    const isNegociacao = sn.includes("negociação") || sn.includes("negociacao");
    if (isNegociacao && !timestamps.negociacaoAt) {
      timestamps.negociacaoAt = ts;
      // BACKFILL: Se entrou em negociação, necessariamente foi agendado antes.
      if (!timestamps.scheduledAt) {
        timestamps.scheduledAt = ts;
        timestamps.scheduledBy = "Cauê Perpétuo";
      }
    }

    const isConfirmada = sn.includes("confirmada") || (sn.includes("agendado") && !sn.includes("2°"));
    if (isConfirmada) {
      if (!timestamps.scheduledAt) {
        timestamps.scheduledAt = ts;
        const createdBy = ev.created_by ?? null;
        timestamps.scheduledBy = createdBy === 0
          ? "IA"
          : createdBy != null ? (users[createdBy]?.name ?? `user-${createdBy}`) : null;
      } else {
        timestamps.reagendadoAt = ts;
        timestamps.reagendadoCount = (timestamps.reagendadoCount ?? 0) + 1;
      }
    }

    if ((timestamps.qualifiedAt || timestamps.scheduledAt) && !timestamps.contactedAt) {
      timestamps.contactedAt = timestamps.qualifiedAt || timestamps.scheduledAt;
    }

    if (sn.includes("reagendamento")) {
      (timestamps as any).noShow = true;
      (timestamps as any).noShowAt = ts;
    }
    if (sn.includes("no show") || sn.includes("noshow")) {
      (timestamps as any).noShow = true;
      if (!(timestamps as any).noShowAt) (timestamps as any).noShowAt = ts;
    }

    let pipelineName = "";
    for (const p of Object.values(pipelines)) {
      if (p.statuses[afterStatusId]) { pipelineName = p.name; break; }
    }
    if (pipelineName.toUpperCase() === "RECUPERAÇÃO" && sn.includes("contato inicial")) {
      if (!(timestamps as any).recuperacaoAt) (timestamps as any).recuperacaoAt = ts;
    }
  }

  if (Object.keys(timestamps).length > 0) {
    await prisma.lead.updateMany({
      where: { id: leadId },
      data: { ...timestamps, syncedAt: new Date() },
    });
  }
}

/**
 * syncLeadHistory — enriquece um lead específico buscando seus eventos do Kommo.
 * Usado pontualmente (ex: webhook). Para sync em lote use syncKommoData que
 * agrupa múltiplos leads por chamada.
 */
export async function syncLeadHistory(leadId: string): Promise<void> {
  assertReadOnly("GET");
  if (USE_MOCK) return;

  const accessToken = await getValidToken();
  const [pipelines, users, res] = await Promise.all([
    fetchKommoPipelines(accessToken),
    fetchKommoUsers(accessToken),
    fetch(`${BASE()}/events?filter[entity]=lead&filter[entity_id][]=${leadId}&filter[type][]=lead_status_changed&limit=250`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  if (!res.ok || res.status === 204) return;
  const json = await res.json();
  await processLeadEvents(leadId, json._embedded?.events ?? [], pipelines, users);
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
