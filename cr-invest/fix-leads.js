

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startDate = new Date("2026-04-24T00:00:00-03:00");
  const endDate = new Date("2026-04-24T23:59:59-03:00");
  
  const leads = await prisma.lead.findMany({
    where: {
      scheduledAt: { gte: startDate, lte: endDate },
      status: { in: ['scheduled', 'meeting', 'won'] }
    },
    select: { id: true }
  });

  console.log(`Found ${leads.length} corrupted leads. Nullifying scheduledAt...`);
  
  for (const l of leads) {
    await prisma.lead.update({
      where: { id: l.id },
      data: { scheduledAt: null, syncedAt: new Date('2020-01-01') }
    });
  }

  console.log(`Now triggering sync for these leads to rebuild history correctly...`);
  
  // We can't easily require ts files in raw node sometimes, so let's just trigger a full sync 
  // via the existing script sync-prod.js or just let the user click the button.
}

main().catch(console.error).finally(() => prisma.$disconnect());
