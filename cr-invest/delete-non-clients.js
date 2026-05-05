const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const NAMES_TO_DELETE = [
  'EDMAR RODRIGUES DA SILVA',
  'I7 SERRALHERIA COBERTURA E COMERCIO LTDA',
  'PEDRO HENRIQUE DE SOUZA CEDRAN',
  'WESLLEY LUIZ DOS SANTOS',
];

async function main() {
  const sales = await p.sale.findMany({
    where: {
      clientName: { in: NAMES_TO_DELETE }
    },
    include: { installments: true }
  });

  if (sales.length === 0) {
    console.log('Nenhuma venda encontrada para os nomes informados.');
    return;
  }

  console.log(`Encontradas ${sales.length} venda(s) para remover:\n`);
  for (const s of sales) {
    console.log(`  ID: ${s.id}`);
    console.log(`  Cliente: ${s.clientName}`);
    console.log(`  Valor: R$ ${s.value}`);
    console.log(`  Data: ${s.closedAt}`);
    console.log(`  Closer: ${s.assignedTo}`);
    console.log(`  Parcelas: ${s.installments.length}`);
    console.log('');
  }

  const saleIds = sales.map(s => s.id);

  // Deleta parcelas primeiro (FK constraint)
  const delInst = await p.installment.deleteMany({
    where: { saleId: { in: saleIds } }
  });
  console.log(`Parcelas removidas: ${delInst.count}`);

  // Deleta as vendas
  const delSales = await p.sale.deleteMany({
    where: { id: { in: saleIds } }
  });
  console.log(`Vendas removidas: ${delSales.count}`);

  console.log('\nPronto!');
}

main().catch(console.error).finally(() => p.$disconnect());
