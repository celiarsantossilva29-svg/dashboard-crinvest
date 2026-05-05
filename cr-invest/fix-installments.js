const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Get all sales
  const sales = await p.sale.findMany({
    select: { id: true, value: true, comissaoBruta: true, comissaoPorParcela: true, quantidadeParcelas: true, clientName: true }
  });

  console.log(`Total sales: ${sales.length}`);
  let fixed = 0;

  // Batch: for each sale, update ALL its installments at once
  for (const sale of sales) {
    const parcelas = sale.quantidadeParcelas || 12;
    const correctValue = sale.comissaoPorParcela || ((sale.comissaoBruta || (sale.value * 0.04)) / parcelas);

    const result = await p.installment.updateMany({
      where: { saleId: sale.id },
      data: { valorParcela: correctValue }
    });
    fixed += result.count;
  }

  console.log(`✅ Fixed ${fixed} installments across ${sales.length} sales`);

  // Verify
  const sample = await p.installment.findMany({
    take: 5,
    include: { sale: { select: { clientName: true, value: true } } },
    orderBy: { createdAt: 'desc' }
  });
  console.log('\n--- Sample ---');
  for (const inst of sample) {
    console.log(`${inst.sale.clientName}: valorParcela=R$ ${inst.valorParcela.toFixed(2)}, credit=R$ ${inst.sale.value}`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
