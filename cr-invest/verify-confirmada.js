const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const matchEnv = envFile.match(/KOMMO_SUBDOMAIN=(.*)/);
const subdomain = matchEnv ? matchEnv[1].trim() : '';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Status IDs que significam "agendamento" = "1° Reunião Confirmada"
const CONFIRMADA_ID = 88986727;

async function main() {
  const token = await prisma.kommoToken.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!token) return;

  // Checar os leads com scheduledAt em 22-24/04
  const start = new Date("2026-04-22T00:00:00-03:00");
  const end = new Date("2026-04-24T23:59:59-03:00");
  
  const leads = await prisma.lead.findMany({
    where: { scheduledAt: { gte: start, lte: end } },
    select: { id: true, scheduledAt: true, status: true }
  });

  console.log(`Leads com scheduledAt entre 22-24/04: ${leads.length}\n`);

  // Para cada lead, checar se realmente passou por "1° Reunião Confirmada"
  for (const lead of leads) {
    const evRes = await fetch(`https://${subdomain}.kommo.com/api/v4/events?filter[entity]=lead&filter[entity_id][]=${lead.id}&limit=250`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    
    let confirmadaEvents = [];
    if (evRes.ok && evRes.status !== 204) {
      const json = await evRes.json();
      const events = json._embedded?.events ?? [];
      confirmadaEvents = events
        .filter(e => e.type === 'lead_status_changed' && e.value_after?.[0]?.lead_status?.id === CONFIRMADA_ID)
        .map(e => new Date(e.created_at * 1000));
    }

    const scheduledDay = new Date(lead.scheduledAt.getTime() - 3*3600*1000).toISOString().split('T')[0];
    const isLegit = confirmadaEvents.length > 0;
    const marker = isLegit ? '✅' : '❌ NOT A REAL AGENDAMENTO';
    
    console.log(`Lead ${lead.id} scheduledAt=${scheduledDay} status=${lead.status} confirmada_events=${confirmadaEvents.length} ${marker}`);
    if (confirmadaEvents.length > 0) {
      for (const d of confirmadaEvents) {
        console.log(`  → Confirmada at ${d.toISOString()}`);
      }
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
