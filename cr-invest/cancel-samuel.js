const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const s = await p.sale.findMany({ where: { clientName: { contains: 'SAMUEL AUGUSTO' } } });
  let count = 0;
  for (const sale of s) {
    const res = await p.installment.updateMany({
      where: { saleId: sale.id, status: 'PENDENTE' },
      data: { status: 'CANCELADO' }
    });
    count += res.count;
  }
  console.log(`Cancelled ${count} installments for Samuel Augusto`);
}
main().catch(console.error).finally(() => p.$disconnect());
