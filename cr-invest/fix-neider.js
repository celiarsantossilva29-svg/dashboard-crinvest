const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const result = await p.sale.updateMany({
    where: { clientName: { contains: 'NEIDER GABRIEL' } },
    data: { sdrName: 'Cauê' }
  });
  console.log(`Updated ${result.count} sales for Neider to SDR Cauê`);
}

main().catch(console.error).finally(() => p.$disconnect());
