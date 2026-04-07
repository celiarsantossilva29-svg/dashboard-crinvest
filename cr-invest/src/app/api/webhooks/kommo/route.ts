/**
 * POST /api/webhooks/kommo
 *
 * Recebe eventos do Kommo em tempo real e atualiza o lead no Supabase.
 * Delay típico: 2-5 segundos após a mudança no CRM.
 *
 * Eventos suportados:
 *   leads[add][]      → lead criado
 *   leads[update][]   → lead atualizado (qualquer campo)
 *   leads[status][]   → status/etapa mudou
 *   leads[delete][]   → lead deletado (marcamos como lost)
 *
 * Segurança: verificamos o header X-Kommo-Subdomain e um secret na query string.
 *
 * Como configurar no Kommo:
 *   Configurações → Integrações → Webhooks
 *   URL: https://seu-dominio.com/api/webhooks/kommo?secret=SEU_WEBHOOK_SECRET
 *   Eventos: Leads (add, edit, status change, delete)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ── Status map (mesmo do serviço principal) ───────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  "Etapa de leads de entrada":  "new",
  "dia 1":                      "contacted",
  "dia 2":                      "contacted",
  "dia 3":                      "contacted",
  "dia 5":                      "contacted",
  "dia 7":                      "contacted",
  "dia 10":                     "contacted",
  "1° Reunião Confirmada":      "scheduled",
  "Reagendamento - R1":         "scheduled",
  "1° Reunião Realizada":       "meeting",
  "2° Reunião AGENDADA":        "scheduled",
  "Reagendamento - R2":         "scheduled",
  "Negociação":                 "meeting",
  "Contato Futuro":             "new",
  "NOVO":                       "new",
  "ABERTURA":                   "contacted",
  "CONEXÃO":                    "contacted",
  "QUALIFICADOS":               "qualified",
  "AGENDADOS":                  "scheduled",
  "rEUNIÃO REALIZADATEMOS":     "meeting",
  "NO SHOW":                    "new",
  "Contato inicial":            "contacted",
  "1ª Tentativa":               "contacted",
  "2ª Tentativa":               "contacted",
  "3ª Tentativa":               "contacted",
  "Oferta feita":               "meeting",
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
  return STATUS_MAP[stageName] ?? "new";
}

// ── Buscar lead completo no Kommo ─────────────────────────────────────────────

async function fetchLeadFromKommo(leadId: string, accessToken: string) {
  const subdomain = process.env.KOMMO_SUBDOMAIN;
  const url = `https://${subdomain}.kommo.com/api/v4/leads/${leadId}?with=contacts,loss_reason`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;
  return res.json();
}

async function fetchPipelines(accessToken: string): Promise<Record<number, { name: string; statuses: Record<number, string> }>> {
  const subdomain = process.env.KOMMO_SUBDOMAIN;
  const res = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/pipelines?limit=250`, {
    headers: { Authorization: `Bearer ${accessToken}` },
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

// ── Parsear payload form-encoded do Kommo ─────────────────────────────────────

function parseKommoPayload(body: string): {
  addedIds: string[];
  updatedIds: string[];
  deletedIds: string[];
} {
  const params = new URLSearchParams(body);
  const addedIds: string[] = [];
  const updatedIds: string[] = [];
  const deletedIds: string[] = [];

  // O Kommo envia arrays como: leads[add][0][id]=123&leads[update][0][id]=456
  for (const [key, value] of params.entries()) {
    if (key.match(/^leads\[(add|status)\]\[\d+\]\[id\]$/)) addedIds.push(value);
    if (key.match(/^leads\[update\]\[\d+\]\[id\]$/)) updatedIds.push(value);
    if (key.match(/^leads\[delete\]\[\d+\]\[id\]$/)) deletedIds.push(value);
  }

  // Deduplica: add e update podem vir juntos
  const allUpdates = [...new Set([...addedIds, ...updatedIds])];
  return { addedIds: allUpdates, updatedIds: allUpdates, deletedIds };
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Verificação básica de secret (opcional mas recomendado)
    const secret = new URL(req.url).searchParams.get("secret");
    const expectedSecret = process.env.KOMMO_WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.text();
    const { addedIds, updatedIds, deletedIds } = parseKommoPayload(body);

    const allChanged = [...new Set([...addedIds, ...updatedIds])];

    if (allChanged.length === 0 && deletedIds.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    // Buscar token válido
    const tokenRecord = await prisma.kommoToken.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (!tokenRecord) {
      return NextResponse.json({ error: "Kommo não conectado" }, { status: 503 });
    }

    const accessToken = tokenRecord.accessToken;

    // Marcar leads deletados como lost
    for (const leadId of deletedIds) {
      await prisma.lead.updateMany({
        where: { id: leadId },
        data: { status: "lost", syncedAt: new Date() },
      });
    }

    if (allChanged.length === 0) {
      return NextResponse.json({ ok: true, processed: deletedIds.length });
    }

    // Buscar pipelines uma vez para resolver status_id → nome
    const pipelines = await fetchPipelines(accessToken);

    // Atualizar cada lead modificado
    let processed = 0;
    for (const leadId of allChanged) {
      const item = await fetchLeadFromKommo(leadId, accessToken);
      if (!item) continue;

      const pipelineId = item.pipeline_id ?? null;
      const pipeline = pipelineId != null ? pipelines[pipelineId] : null;
      const stageName = pipeline?.statuses[item.status_id] ?? "";
      const status = mapStatus(stageName, item.status_id ?? 0);

      const subdomain = process.env.KOMMO_SUBDOMAIN;
      // Resolver usuário responsável
      let assignedTo: string | null = null;
      if (item.responsible_user_id) {
        const userRes = await fetch(
          `https://${subdomain}.kommo.com/api/v4/users/${item.responsible_user_id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (userRes.ok) {
          const userData = await userRes.json();
          assignedTo = userData.name ?? null;
        }
      }

      const lostReason =
        item._embedded?.loss_reason?.[0]?.name ??
        item._embedded?.loss_reason?.name ??
        null;

      const utmCampaign = item.custom_fields_values?.find(
        (f: any) => f.field_code === "utm_campaign"
      )?.values?.[0]?.value ?? null;

      const campaignName = utmCampaign ?? pipeline?.name ?? null;
      const campaignId = utmCampaign
        ? `utm:${utmCampaign}`
        : pipelineId
        ? String(pipelineId)
        : null;

      await prisma.lead.upsert({
        where: { id: String(item.id) },
        update: {
          status,
          assignedTo,
          dealValue: item.price ?? null,
          lostReason,
          closedAt: item.closed_at ? new Date(item.closed_at * 1000) : null,
          syncedAt: new Date(),
        },
        create: {
          id: String(item.id),
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
          syncedAt: new Date(),
        },
      });

      processed++;
    }

    console.log(`[Webhook Kommo] Processados: ${processed} leads, deletados: ${deletedIds.length}`);

    return NextResponse.json({ ok: true, processed, deleted: deletedIds.length });
  } catch (err: any) {
    console.error("[Webhook Kommo] Erro:", err);
    return NextResponse.json({ error: err?.message ?? "Erro interno" }, { status: 500 });
  }
}

// O Kommo pode enviar GET para verificar se o endpoint está ativo
export async function GET() {
  return NextResponse.json({ ok: true, service: "CR Invest Kommo Webhook" });
}
