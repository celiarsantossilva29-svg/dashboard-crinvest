const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const start = new Date("2026-04-18T00:00:00-03:00");
  const end = new Date("2026-04-30T23:59:59-03:00");
  
  const leads = await p.lead.findMany({
    where: { scheduledAt: { gte: start, lte: end } },
    select: { id: true, scheduledAt: true }
  });

  // Agrupar por dia BRT
  const byDay = {};
  for (const l of leads) {
    const d = new Date(l.scheduledAt.getTime() - 3 * 3600 * 1000);
    const day = d.toISOString().split('T')[0];
    byDay[day] = (byDay[day] || 0) + 1;
  }

  console.log('Agendamentos por dia (scheduledAt):');
  const sortedDays = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [day, count] of sortedDays) {
    console.log(`  ${day}: ${count}`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
