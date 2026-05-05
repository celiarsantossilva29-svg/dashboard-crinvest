const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Encontra a venda pela proposta no campo notes
  const sale = await p.sale.findFirst({
    where: { notes: { contains: '104708' } },
    include: { installments: { orderBy: { parcelaNumero: 'asc' } } }
  });

  if (!sale) {
    console.log('Venda com Proposta 104708 não encontrada.');
    return;
  }

  console.log(`Venda: ${sale.id}`);
  console.log(`Cliente: ${sale.clientName}`);
  console.log(`\nParcelas antes da restauração:`);
  for (const i of sale.installments) {
    console.log(`  P${i.parcelaNumero}: ${i.status} (pago: ${i.pago})`);
  }

  // Restaura apenas as CANCELADO que não estavam pagas (P4 em diante)
  const result = await p.installment.updateMany({
    where: {
      saleId: sale.id,
      status: 'CANCELADO',
      pago: false,
    },
    data: { status: 'PENDENTE' }
  });

  console.log(`\nParcelas restauradas para PENDENTE: ${result.count}`);
}

main().catch(console.error).finally(() => p.$disconnect());
