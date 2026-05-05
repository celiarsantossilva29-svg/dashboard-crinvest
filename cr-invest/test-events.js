const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const l = await p.lead.findFirst({ where: { name: 'Ketne muniz' } });
  console.log(l);
  const events = await p.kommoEvent.findMany({ where: { leadId: l.id }, orderBy: { occurredAt: 'asc' } });
  console.table(events.map(e => ({ type: e.type, oldStatus: e.oldStatusId, newStatus: e.newStatusId, date: e.occurredAt })));
}
check().finally(() => p.$disconnect());
