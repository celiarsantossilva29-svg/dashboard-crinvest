// Re-processa eventos do Kommo para leads sem scheduledAt e popula corretamente
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

export async function POST() {
  const token = await prisma.kommoToken.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!token) return NextResponse.json({ error: "No token" });

  const subdomain = process.env.KOMMO_SUBDOMAIN;
  const base = `https://${subdomain}.kommo.com/api/v4`;

  // Resolve users
  const usersRes = await fetch(`${base}/users?limit=250`, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  const usersMap: Record<number, string> = {};
  if (usersRes.ok) {
    const usersJson = await usersRes.json();
    for (const u of usersJson._embedded?.users ?? []) {
      usersMap[u.id] = u.name ?? `user-${u.id}`;
    }
  }

  // Busca pipelines
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

  // Leads sem scheduledAt
  const leads = await prisma.lead.findMany({
    where: {
      status: { in: ["scheduled", "meeting", "won"] },
      scheduledAt: null,
    },
    select: { id: true, name: true },
  });

  const results: any[] = [];

  for (const lead of leads) {
    const evRes = await fetch(
      `${base}/events?filter[entity]=lead&filter[entity_id][]=${lead.id}&limit=250`,
      { headers: { Authorization: `Bearer ${token.accessToken}` } }
    );

    if (!evRes.ok || evRes.status === 204) {
      results.push({ id: lead.id, name: lead.name, status: "no_events" });
      continue;
    }

    const evJson = await evRes.json();
    const events = (evJson._embedded?.events ?? [])
      .filter((ev: any) => ev.value_after?.[0]?.lead_status)
      .sort((a: any, b: any) => a.created_at - b.created_at);

    // Process events — same logic as processLeadEvents but with fixes
    const timestamps: any = {};

    for (const ev of events) {
      const afterStatusId = ev.value_after[0].lead_status.id;
      const stageName = statusNames[afterStatusId] || "";
      const status = STATUS_MAP[stageName] || "";
      const ts = new Date(ev.created_at * 1000);
      const sn = stageName.toLowerCase();
      const createdBy = ev.created_by;

      if (status === "contacted" && !timestamps.contactedAt) timestamps.contactedAt = ts;
      if (status === "qualified" && !timestamps.qualifiedAt) timestamps.qualifiedAt = ts;

      const isReuniaoRealizada = sn.includes("reunião realizada") && !sn.includes("2");
      if (isReuniaoRealizada && !timestamps.meetingAt) {
        timestamps.meetingAt = ts;
        if (!timestamps.scheduledAt) {
          timestamps.scheduledAt = ts;
          timestamps.scheduledBy = createdBy === 0 ? "IA" : (usersMap[createdBy] ?? `user-${createdBy}`);
        }
      }

      const isConfirmada = sn.includes("confirmada") || (sn.includes("agendado") && !sn.includes("2°"));
      if (isConfirmada) {
        if (!timestamps.scheduledAt) {
          timestamps.scheduledAt = ts;
          timestamps.scheduledBy = createdBy === 0 ? "IA" : (usersMap[createdBy] ?? `user-${createdBy}`);
        } else {
          timestamps.reagendadoAt = ts;
          timestamps.reagendadoCount = (timestamps.reagendadoCount ?? 0) + 1;
        }
      }

      if (sn.includes("reagendamento")) {
        // Reagendamento also counts as a scheduling event if we don't have one yet
        if (!timestamps.scheduledAt) {
          timestamps.scheduledAt = ts;
          timestamps.scheduledBy = createdBy === 0 ? "IA" : (usersMap[createdBy] ?? `user-${createdBy}`);
        }
        timestamps.noShow = true;
        timestamps.noShowAt = ts;
      }

      if (sn.includes("no show") || sn.includes("noshow")) {
        timestamps.noShow = true;
        if (!timestamps.noShowAt) timestamps.noShowAt = ts;
      }

      if ((timestamps.qualifiedAt || timestamps.scheduledAt) && !timestamps.contactedAt) {
        timestamps.contactedAt = timestamps.qualifiedAt || timestamps.scheduledAt;
      }
    }

    if (Object.keys(timestamps).length > 0) {
      await prisma.lead.updateMany({
        where: { id: lead.id },
        data: timestamps,
      });
      results.push({ id: lead.id, name: lead.name, status: "updated", ...timestamps });
    } else {
      results.push({ id: lead.id, name: lead.name, status: "no_schedule_event" });
    }

    await new Promise(r => setTimeout(r, 200));
  }

  return NextResponse.json({ 
    total: leads.length,
    updated: results.filter(r => r.status === "updated").length,
    results 
  });
}
