const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  await p.installment.deleteMany({ where: { saleId: '735e73d6-c814-440b-9ba4-98c365f7d4c3' } });
  await p.sale.delete({ where: { id: '735e73d6-c814-440b-9ba4-98c365f7d4c3' } });
  console.log('Deleted duplicate Isabella Muniz 740k');
}
main().finally(() => p.$disconnect());
