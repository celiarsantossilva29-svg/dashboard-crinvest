const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const aldd = await p.sale.findMany({
    where: { clientName: { contains: 'AL&DD' } },
    include: { installments: true }
  });
  console.log(`AL&DD Sales: ${aldd.length}`);
  for (const s of aldd) {
    console.log(`- ${s.clientName} | ${s.value} | ${s.closedAt} | Product: ${s.produto} | Closer: ${s.assignedTo}`);
    const pend = s.installments.filter(i => i.status === 'PENDENTE' && !i.pago).length;
    const pago = s.installments.filter(i => i.status === 'PAGO' || i.pago).length;
    console.log(`  Installments: ${s.installments.length} total, ${pend} pendente, ${pago} pago`);
  }

  const rafaelas = await p.sale.findMany({
    where: { clientName: { contains: 'RAFAELA' } }
  });
  console.log(`\nRafaela Sales: ${rafaelas.length}`);
  for (const s of rafaelas) {
    console.log(`- ${s.clientName} | ${s.value} | CPF: ${s.clienteCpf} | Product: ${s.produto} | Closer: ${s.assignedTo} | SDR: ${s.sdrName}`);
  }
}

main().finally(() => p.$disconnect());
