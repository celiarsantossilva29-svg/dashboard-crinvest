const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startDate = new Date("2026-04-24T00:00:00-03:00");
  const endDate = new Date("2026-04-24T23:59:59-03:00");
  
  const leads = await prisma.lead.findMany({
    where: {
      scheduledAt: { gte: startDate, lte: endDate }
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      scheduledAt: true,
      syncedAt: true,
      assignedTo: true,
      scheduledBy: true,
      historyLog: true
    }
  });

  console.log(`Found ${leads.length} leads with scheduledAt on April 24`);
  
  // Imprime um pequeno resumo de 5 leads para entendermos o que tem neles
  for (let i = 0; i < Math.min(5, leads.length); i++) {
    console.log(`Lead ${leads[i].id} - status: ${leads[i].status}, created: ${leads[i].createdAt}, scheduledAt: ${leads[i].scheduledAt}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
