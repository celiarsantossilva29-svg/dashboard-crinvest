const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sales = await prisma.sale.findMany({
    where: { clientName: { contains: 'Isabela', mode: 'insensitive' } },
    include: { installments: { orderBy: { parcelaNumero: 'asc' } } }
  });

  if (!sales.length) {
    console.log('Nenhuma venda com Isabela no nome');
    return;
  }

  for (const s of sales) {
    console.log('---');
    console.log('clientName:', s.clientName);
    console.log('assignedTo:', s.assignedTo);
    console.log('sdrName:', s.sdrName);
    console.log('value:', s.value);
    console.log('statusValidacao:', s.statusValidacao);
    console.log('valorComissaoCloser:', s.valorComissaoCloser);
    console.log('valorComissaoSdr:', s.valorComissaoSdr);
    console.log('comissaoPorParcela:', s.comissaoPorParcela);
    console.log('quantidadeParcelas:', s.quantidadeParcelas);
    console.log('closedAt:', s.closedAt ? s.closedAt.toISOString().substring(0,10) : null);
    for (const inst of s.installments.slice(0, 3)) {
      console.log(`  P${inst.parcelaNumero}: ${inst.dataVencimento ? inst.dataVencimento.toISOString().substring(0,10) : 'null'} status=${inst.status} pago=${inst.pago}`);
    }
    if (s.installments.length > 3) console.log(`  ...+${s.installments.length - 3} more`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
