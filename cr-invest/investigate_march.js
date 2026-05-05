const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const marchInsts = await p.installment.findMany({
    where: {
      pago: true,
      dataVencimento: {
        gte: new Date('2026-03-01T00:00:00Z'),
        lt: new Date('2026-04-01T00:00:00Z')
      }
    },
    include: {
      sale: true
    }
  });

  let totalComm = 0;
  console.log(`Found ${marchInsts.length} paid installments in March 2026:`);
  for (const inst of marchInsts) {
    if (inst.status === 'CANCELADO') continue;
    // CommPerInst calculation
    // We need to count total installments for this sale to get exact commPerInst
    const allInstsCount = await p.installment.count({ where: { saleId: inst.saleId, status: { not: 'CANCELADO' } } });
    const comm = (inst.sale.value * 0.04) / Math.max(1, allInstsCount);
    totalComm += comm;
    console.log(`- ${inst.sale.clientName} | Parcela ${inst.parcelaNumero} | Valor Venda: ${inst.sale.value} | Comissao da Parcela: ${comm.toFixed(2)} | Venc: ${inst.dataVencimento.toISOString().split('T')[0]}`);
  }
  console.log(`Total Commission Received in March: R$ ${totalComm.toFixed(2)}`);
}

main().finally(() => p.$disconnect());
