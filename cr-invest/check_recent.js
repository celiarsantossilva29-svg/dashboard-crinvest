const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const all = await p.sale.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log('--- RECENT SALES ---');
  for (const s of all) console.log(`${s.id} | ${s.clientName} | ${s.value} | ${s.closedAt} | ${s.produto} | ${s.assignedTo}`);
}
main().finally(() => p.$disconnect());
