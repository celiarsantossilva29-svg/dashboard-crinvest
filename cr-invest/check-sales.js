const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  fs.writeFileSync('sales-out.json', JSON.stringify(sales, null, 2));
}
main().finally(() => prisma.$disconnect());
