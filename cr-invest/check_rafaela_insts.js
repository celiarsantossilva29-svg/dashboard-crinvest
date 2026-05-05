const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const rafaela = await p.sale.findFirst({
    where: { clientName: { contains: 'RAFAELA CRISTHINA' }, value: 600000 },
    include: { installments: { orderBy: { parcelaNumero: 'asc' } } }
  });
  console.log('Rafaela 600k (Sold March 19):');
  for (const i of rafaela.installments) {
    console.log(`P${i.parcelaNumero}: Vencimento ${i.dataVencimento.toISOString().split('T')[0]} | Status: ${i.status} | Pago: ${i.pago}`);
  }
}
main().finally(() => p.$disconnect());
