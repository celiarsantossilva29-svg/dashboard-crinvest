const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const missing = await p.lead.count({
    where: { scheduledAt: null, status: { in: ['scheduled', 'meeting', 'won'] } }
  });
  console.log('Leads missing scheduledAt:', missing);

  const today = new Date("2026-04-24T00:00:00-03:00");
  const todayEnd = new Date("2026-04-24T23:59:59-03:00");
  const onToday = await p.lead.count({
    where: { scheduledAt: { gte: today, lte: todayEnd } }
  });
  console.log('Leads with scheduledAt on Apr 24:', onToday);

  // Check last sync log
  const lastSync = await p.syncLog.findFirst({
    where: { source: 'kommo' },
    orderBy: { syncedAt: 'desc' }
  });
  console.log('Last sync:', lastSync?.status, lastSync?.message, lastSync?.syncedAt);
}

main().catch(console.error).finally(() => p.$disconnect());
