const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const result = await p.sale.updateMany({
    where: { sdrName: { contains: 'Prospec' } },
    data: { sdrName: 'Prospecção direta (Sem SDR)' }
  });
  console.log(`✅ Fixed sdrName encoding for ${result.count} sales.`);
}

main().catch(console.error).finally(() => p.$disconnect());
