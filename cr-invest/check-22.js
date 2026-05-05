const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startDate = new Date("2026-04-22T00:00:00-03:00");
  const endDate = new Date("2026-04-22T23:59:59-03:00");
  
  // Leads criados no dia 22 que estao scheduled/meeting/won mas sem scheduledAt
  const leads = await prisma.lead.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      status: { in: ['scheduled', 'meeting', 'won'] },
      scheduledAt: null
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      scheduledAt: true,
      syncedAt: true,
      assignedTo: true,
      scheduledBy: true,
    }
  });

  console.log(`Leads created on April 22 with scheduled/meeting/won status but no scheduledAt: ${leads.length}`);
  console.dir(leads, { depth: null });
  
  // Que tal checar qualquer lead que teve `updated_at` dia 22? Nós não salvamos `updated_at` no banco, só usamos durante o sync.
}

main().catch(console.error).finally(() => prisma.$disconnect());
