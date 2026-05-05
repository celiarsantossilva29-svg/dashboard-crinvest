const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const startDate = new Date('2026-05-01T00:00:00.000Z');
  const endDate = new Date('2026-05-05T23:59:59.999Z');
  const leads = await p.lead.findMany({
    where: {
      noShowAt: { gte: startDate, lte: endDate }
    },
    select: { name: true, scheduledBy: true, noShowAt: true, scheduledAt: true }
  });
  console.log("No-shows em MAIO:");
  console.table(leads);
}
check().finally(() => p.$disconnect());
