const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const isabella = await p.sale.findMany({ where: { clientName: { contains: 'ISABELLA' } } });
  console.log('--- ISABELLA ---');
  for (const s of isabella) console.log(`${s.id} | ${s.clientName} | ${s.value} | ${s.closedAt} | ${s.produto} | ${s.assignedTo}`);
}
main().finally(() => p.$disconnect());
