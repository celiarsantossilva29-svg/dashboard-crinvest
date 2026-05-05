const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const match = envFile.match(/KOMMO_SUBDOMAIN=(.*)/);
const subdomain = match ? match[1].trim() : process.env.KOMMO_SUBDOMAIN;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  if (!subdomain) throw new Error("No KOMMO_SUBDOMAIN");

  const startDate = new Date("2026-04-24T00:00:00-03:00");
  const endDate = new Date("2026-04-24T23:59:59-03:00");
  
  const leads = await prisma.lead.findMany({
    where: {
      scheduledAt: { gte: startDate, lte: endDate },
      status: { in: ['scheduled', 'meeting', 'won'] }
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      scheduledAt: true,
    }
  });

  console.log(`Found ${leads.length} leads with scheduledAt on April 24`);
  
  // Let's force fetch events from Kommo for the first 2 leads to see what events they have
  const token = await prisma.kommoToken.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!token) return;

  for (let i = 0; i < 2; i++) {
    const lead = leads[i];
    console.log(`\nFetching events for lead ${lead.id}...`);
    const res = await fetch(`https://${subdomain}.kommo.com/api/v4/leads/${lead.id}?with=loss_reason,contacts,tags`, {
       headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (!res.ok) continue;
    const leadData = await res.json();
    console.log(`Lead status_id: ${leadData.status_id}, updated_at: ${new Date(leadData.updated_at * 1000)}`);
    
    const evRes = await fetch(`https://${subdomain}.kommo.com/api/v4/events?filter[entity]=lead&filter[entity_id][]=${lead.id}&limit=100`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (evRes.ok) {
      const evJson = await evRes.json();
      const events = evJson._embedded?.events ?? [];
      console.log(`Found ${events.length} events:`);
      for (const ev of events) {
        if (ev.type === 'lead_status_changed') {
           console.log(`- [${new Date(ev.created_at * 1000).toISOString()}] status changed to ${ev.value_after?.[0]?.lead_status?.id}`);
        } else {
           console.log(`- [${new Date(ev.created_at * 1000).toISOString()}] event type: ${ev.type}`);
        }
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
