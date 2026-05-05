const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function addCelia() {
  await p.gasto.create({
    data: {
      descricao: "Pró-labore Célia",
      valor: 20000,
      categoria: "pessoas",
      fornecedor: "Célia (Sócia)",
      tipo: "fixo",
      recorrente: true,
      status: "pago",
      dataGasto: new Date('2026-04-05T12:00:00Z'),
    }
  });
  console.log("Celia added");
}

addCelia().catch(console.error).finally(() => p.$disconnect());
