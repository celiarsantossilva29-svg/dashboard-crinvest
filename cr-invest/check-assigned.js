const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const leads = await p.lead.findMany({
    where: {
      status: { in: ['scheduled', 'meeting', 'won'] },
      scheduledBy: null,
      createdAt: { gte: new Date('2026-05-01T00:00:00Z'), lte: new Date('2026-05-05T23:59:59Z') }
    },
    select: { id: true, name: true, assignedTo: true, status: true, scheduledBy: true, scheduledAt: true, createdAt: true }
  });
  console.log(`Leads com scheduledBy=null no período: ${leads.length}`);
  for (const l of leads) {
    console.log(`  ${l.name} | assignedTo=${l.assignedTo} | status=${l.status} | scheduledAt=${l.scheduledAt?.toISOString() || 'null'}`);
  }
}
check().finally(() => p.$disconnect());
