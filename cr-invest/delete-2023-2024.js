const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const start = new Date('2023-01-01T00:00:00.000Z');
  const end   = new Date('2024-12-31T23:59:59.999Z');

  const sales = await p.sale.findMany({
    where: { closedAt: { gte: start, lte: end } },
    include: { installments: true },
    orderBy: { closedAt: 'asc' },
  });

  if (sales.length === 0) {
    console.log('Nenhuma venda encontrada em 2023-2024.');
    return;
  }

  const totalParcelas = sales.reduce((acc, s) => acc + s.installments.length, 0);
  const totalValor    = sales.reduce((acc, s) => acc + s.value, 0);

  console.log(`\nVendas em 2023-2024: ${sales.length}`);
  console.log(`Parcelas vinculadas: ${totalParcelas}`);
  console.log(`Volume total:        R$ ${totalValor.toLocaleString('pt-BR')}\n`);

  // Agrupa por ano para visão geral
  const por2023 = sales.filter(s => new Date(s.closedAt).getFullYear() === 2023);
  const por2024 = sales.filter(s => new Date(s.closedAt).getFullYear() === 2024);
  console.log(`  2023: ${por2023.length} vendas`);
  console.log(`  2024: ${por2024.length} vendas\n`);

  const saleIds = sales.map(s => s.id);

  const delInst  = await p.installment.deleteMany({ where: { saleId: { in: saleIds } } });
  console.log(`Parcelas removidas: ${delInst.count}`);

  const delSales = await p.sale.deleteMany({ where: { id: { in: saleIds } } });
  console.log(`Vendas removidas:   ${delSales.count}`);

  console.log('\n✅ Pronto!');
}

main().catch(console.error).finally(() => p.$disconnect());
