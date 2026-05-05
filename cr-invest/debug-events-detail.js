const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const match = envFile.match(/KOMMO_SUBDOMAIN=(.*)/);
const subdomain = match ? match[1].trim() : '';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const token = await prisma.kommoToken.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!token) { console.error("No token"); return; }

  // Get leads that now have scheduledAt = null but are in scheduled/meeting/won status
  const leads = await prisma.lead.findMany({
    where: {
      scheduledAt: null,
      status: { in: ['scheduled', 'meeting', 'won'] }
    },
    select: { id: true, status: true, createdAt: true },
    take: 200
  });

  console.log(`Found ${leads.length} leads with no scheduledAt but active status`);

  // Check events for a few to understand the pattern
  const sample = leads.slice(0, 5);
  for (const lead of sample) {
    console.log(`\n--- Lead ${lead.id} (status: ${lead.status}, created: ${lead.createdAt.toISOString().split('T')[0]}) ---`);
    
    const evRes = await fetch(`https://${subdomain}.kommo.com/api/v4/events?filter[entity]=lead&filter[entity_id][]=${lead.id}&limit=250`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    
    if (!evRes.ok || evRes.status === 204) {
      console.log("  No events or error");
      continue;
    }
    
    const json = await evRes.json();
    const events = json._embedded?.events ?? [];
    
    // Show only status changes
    const statusChanges = events.filter(e => e.type === 'lead_status_changed');
    console.log(`  ${statusChanges.length} status changes found:`);
    for (const ev of statusChanges) {
      const afterId = ev.value_after?.[0]?.lead_status?.id;
      const pipelineId = ev.value_after?.[0]?.lead_status?.pipeline_id;
      console.log(`  - [${new Date(ev.created_at * 1000).toISOString()}] → status ${afterId} (pipeline ${pipelineId})`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
