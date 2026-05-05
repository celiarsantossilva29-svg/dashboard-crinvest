const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const sale = await p.sale.findMany({ where: { value: 740000 } });
  console.log('--- 740k ---');
  for (const s of sale) console.log(`${s.id} | ${s.clientName} | ${s.value} | ${s.closedAt} | ${s.produto} | ${s.assignedTo}`);
}
main().finally(() => p.$disconnect());
