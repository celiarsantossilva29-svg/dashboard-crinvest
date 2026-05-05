const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const s = await p.sale.findMany({ where: { clientName: { contains: 'SAMUEL' } }, include: { installments: true } });
  console.dir(s, { depth: null });
}
main().catch(console.error).finally(() => p.$disconnect());
