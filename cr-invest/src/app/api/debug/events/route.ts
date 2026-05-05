// API route para diagnóstico dos eventos Kommo de leads agendados em maio
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

const STATUS_MAP: Record<string, string> = {
  "Etapa de leads de entrada": "new",
  "dia 1": "contacted", "dia 2": "contacted", "dia 3": "contacted",
  "dia 5": "contacted", "dia 7": "contacted", "dia 10": "contacted",
  "1° Reunião Confirmada": "scheduled",
  "Reagendamento - R1": "scheduled",
  "1° Reunião Realizada": "meeting",
  "2° Reunião AGENDADA": "scheduled",
  "Reagendamento - R2": "scheduled",
  "Negociação": "meeting",
  "NOVO": "new", "ABERTURA": "contacted", "CONEXÃO": "contacted",
  "QUALIFICADOS": "qualified", "AGENDADOS": "scheduled",
  "NO SHOW": "new",
};

export async function GET() {
  const token = await prisma.kommoToken.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!token) return NextResponse.json({ error: "No token" });

  const subdomain = process.env.KOMMO_SUBDOMAIN;
  const base = `https://${subdomain}.kommo.com/api/v4`;

  // Busca pipelines para resolver nomes de etapas
  const pipRes = await fetch(`${base}/leads/pipelines?limit=250`, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });

  const statusNames: Record<number, string> = {};
  if (pipRes.ok) {
    const pipJson = await pipRes.json();
    for (const p of pipJson._embedded?.pipelines ?? []) {
      for (const s of p._embedded?.statuses ?? []) {
        statusNames[s.id] = s.name;
      }
    }
  }

  // Busca leads scheduled/meeting criados recentemente
  const leads = await prisma.lead.findMany({
    where: {
      status: { in: ["scheduled", "meeting", "won"] },
      createdAt: { gte: new Date("2026-04-25T00:00:00Z"), lte: new Date("2026-05-05T23:59:59Z") }
    },
    select: { id: true, name: true, status: true, scheduledAt: true, scheduledBy: true, assignedTo: true, createdAt: true },
    orderBy: { createdAt: "asc" }
  });

  const results: any[] = [];

  for (const lead of leads.slice(0, 20)) {
    const evRes = await fetch(
      `${base}/events?filter[entity]=lead&filter[entity_id][]=${lead.id}&limit=100`,
      { headers: { Authorization: `Bearer ${token.accessToken}` } }
    );

    let events: any[] = [];
    if (evRes.ok && evRes.status !== 204) {
      const evJson = await evRes.json();
      events = (evJson._embedded?.events ?? [])
        .filter((ev: any) => ev.value_after?.[0]?.lead_status)
        .sort((a: any, b: any) => a.created_at - b.created_at)
        .map((ev: any) => {
          const statusId = ev.value_after[0].lead_status.id;
          return {
            ts: new Date(ev.created_at * 1000).toISOString(),
            created_by: ev.created_by,
            status_id: statusId,
            stage_name: statusNames[statusId] || `unknown(${statusId})`,
            mapped: STATUS_MAP[statusNames[statusId] || ""] || "?",
          };
        });
    }

    results.push({
      id: lead.id,
      name: lead.name,
      status: lead.status,
      assignedTo: lead.assignedTo,
      scheduledAt: lead.scheduledAt?.toISOString() || null,
      scheduledBy: lead.scheduledBy,
      createdAt: lead.createdAt.toISOString(),
      events_count: events.length,
      status_changes: events,
    });

    await new Promise(r => setTimeout(r, 200));
  }

  return NextResponse.json({ leads: results, statusNames });
}
