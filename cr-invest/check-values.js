const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check a few installments to see what valorParcela contains
  const samples = await p.installment.findMany({
    take: 10,
    include: { sale: { select: { clientName: true, value: true, comissaoBruta: true, comissaoPorParcela: true, quantidadeParcelas: true } } },
    orderBy: { createdAt: 'desc' }
  });

  for (const inst of samples) {
    const creditoTotal = inst.sale.value;
    const expectedComissao4pct = creditoTotal * 0.04;
    const expectedParcela = expectedComissao4pct / (inst.sale.quantidadeParcelas || 12);
    console.log(`${inst.sale.clientName}:`);
    console.log(`  Crédito: R$ ${creditoTotal}`);
    console.log(`  comissaoBruta no sale: R$ ${inst.sale.comissaoBruta}`);
    console.log(`  comissaoPorParcela no sale: R$ ${inst.sale.comissaoPorParcela}`);
    console.log(`  valorParcela no installment: R$ ${inst.valorParcela}`);
    console.log(`  Expected 4%/12: R$ ${expectedParcela.toFixed(2)}`);
    console.log(`  valorParcela * 0.04 (API calc): R$ ${(inst.valorParcela * 0.04).toFixed(2)}`);
    console.log('---');
  }
}

main().catch(console.error).finally(() => p.$disconnect());
