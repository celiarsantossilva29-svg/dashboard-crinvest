const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const matchEnv = envFile.match(/KOMMO_SUBDOMAIN=(.*)/);
const subdomain = matchEnv ? matchEnv[1].trim() : '';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const REUNIAO_REALIZADA_1 = 88992835;

async function main() {
  const token = await prisma.kommoToken.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!token) return;

  const start = new Date("2026-04-18T00:00:00-03:00");
  const leads = await prisma.lead.findMany({
    where: { 
      scheduledAt: { gte: start },
      status: { in: ["meeting", "won", "lost"] },
      meetingAt: null
    },
    select: { id: true, scheduledAt: true }
  });
  
  console.log(`Buscando eventos para ${leads.length} leads sem meetingAt...`);
  
  for (const lead of leads) {
    const url = `https://${subdomain}.kommo.com/api/v4/events?filter[entity]=lead&filter[entity_id][]=${lead.id}&filter[type]=lead_status_changed&limit=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token.accessToken}` } });
    if (!res.ok || res.status === 204) continue;
    
    const json = await res.json();
    const events = json._embedded?.events ?? [];
    
    // Procura o evento de entrada em Reunião Realizada
    const meetingEvents = events.filter(ev => {
      const id = ev.value_after?.[0]?.lead_status?.id;
      // Pipeline "1° Reunião Realizada" ou similares que representam a reunião
      const statusName = ev.value_after?.[0]?.lead_status?.name?.toLowerCase() || "";
      return id === REUNIAO_REALIZADA_1 || (statusName.includes("reunião realizada") && !statusName.includes("2"));
    }).sort((a, b) => a.created_at - b.created_at);
    
    if (meetingEvents.length > 0) {
      const meetingAt = new Date(meetingEvents[0].created_at * 1000);
      await prisma.lead.updateMany({
        where: { id: lead.id },
        data: { meetingAt }
      });
      console.log(`Lead ${lead.id}: meetingAt atualizado para ${meetingAt.toISOString()}`);
    } else {
      // Se não tem evento explícito, usa um fallback (scheduledAt + 12 horas ou updatedAt)
      // para não perder a métrica de conversão
      const fallback = new Date(lead.scheduledAt.getTime() + 12 * 3600 * 1000);
      await prisma.lead.updateMany({
        where: { id: lead.id },
        data: { meetingAt: fallback }
      });
      console.log(`Lead ${lead.id}: meetingAt fallback -> ${fallback.toISOString()}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
