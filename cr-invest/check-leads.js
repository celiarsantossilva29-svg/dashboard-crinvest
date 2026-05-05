const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startDate = new Date("2026-04-22T00:00:00-03:00");
  const endDate = new Date("2026-04-22T23:59:59-03:00");
  
  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { createdAt: { gte: startDate, lte: endDate } },
        { scheduledAt: { gte: startDate, lte: endDate } }
      ]
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      scheduledAt: true,
      syncedAt: true,
      assignedTo: true,
      scheduledBy: true
    }
  });

  console.log(`Found ${leads.length} leads created or scheduled on April 22`);
  const missingDates = leads.filter(l => ["scheduled", "meeting", "won"].includes(l.status) && l.scheduledAt === null);
  console.log(`Leads in scheduled/meeting/won status but scheduledAt is null: ${missingDates.length}`);
  console.dir(missingDates, { depth: null });
  
  const scheduledOn22 = leads.filter(l => l.scheduledAt && l.scheduledAt >= startDate && l.scheduledAt <= endDate);
  console.log(`Leads with scheduledAt actually on the 22nd: ${scheduledOn22.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
