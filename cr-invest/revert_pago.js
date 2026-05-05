const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const result = await p.installment.updateMany({
    where: {
      pago: true,
      dataVencimento: { gte: new Date('2026-03-01T00:00:00Z') },
      status: 'PAGO'
    },
    data: { pago: false, status: 'PENDENTE' }
  });
  console.log(`Reverted ${result.count} installments back to PENDENTE for March onwards.`);
}
main().finally(() => p.$disconnect());
