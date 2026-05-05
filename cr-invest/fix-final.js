const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Lead 19947135: won sem evento de Confirmada — scheduledAt deve ser null
  await prisma.lead.update({
    where: { id: "19947135" },
    data: { scheduledAt: null }
  });
  console.log("Lead 19947135: scheduledAt → null (não passou por Confirmada)");

  // Lead 19781507: evento de Confirmada foi dia 20/04, não 23/04
  await prisma.lead.update({
    where: { id: "19781507" },
    data: { scheduledAt: new Date("2026-04-20T18:54:03.000Z") }
  });
  console.log("Lead 19781507: scheduledAt → 2026-04-20 (data real da Confirmada)");

  // Verificar contagem final por dia
  const start = new Date("2026-04-18T00:00:00-03:00");
  const end = new Date("2026-04-30T23:59:59-03:00");
  const leads = await prisma.lead.findMany({
    where: { scheduledAt: { gte: start, lte: end } },
    select: { scheduledAt: true }
  });

  const byDay = {};
  for (const l of leads) {
    const d = new Date(l.scheduledAt.getTime() - 3 * 3600 * 1000);
    const day = d.toISOString().split('T')[0];
    byDay[day] = (byDay[day] || 0) + 1;
  }

  console.log('\nAgendamentos corrigidos por dia:');
  for (const [day, count] of Object.entries(byDay).sort((a,b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${day}: ${count}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
