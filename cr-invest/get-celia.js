const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  const v = await p.vendedor.findFirst({where: {nome: {contains: 'Celia', mode: 'insensitive'}}});
  console.log('Vendedor:', v);
  const s = await p.sale.findFirst({where: {administradora: 'Porto Seguro'}});
  console.log('Sale.assignedTo:', s ? s.assignedTo : null);
}
run().finally(() => p.$disconnect());
