const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.gasto.findMany().then(g => {
  console.log("Gastos found:", g.length);
  const celia = g.find(x => x.descricao.includes('Célia'));
  console.log("Celia:", celia);
}).finally(() => p.$disconnect());
