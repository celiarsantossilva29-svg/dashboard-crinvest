const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Mostra estado atual
  const all = await prisma.vendedor.findMany({ orderBy: { nome: "asc" } });
  console.log("\n=== RATES ATUAIS ===");
  for (const v of all) {
    console.log(`${v.nome.padEnd(30)} (${v.role.padEnd(6)}) bronze=${v.bronzeRate} silver=${v.silverRate} gold=${v.goldRate} | silverMin=${v.silverMin} goldMin=${v.goldMin}`);
  }

  // Encontra Cauê
  const caue = all.find(v => v.nome.toLowerCase().includes("cau"));
  if (!caue) { console.log("\nCauê não encontrado!"); return; }

  console.log(`\n>>> Encontrado: ${caue.nome} (id=${caue.id})`);
  console.log(`    bronze=${caue.bronzeRate} | silver=${caue.silverRate} | gold=${caue.goldRate}`);
  console.log(`    silverMin=${caue.silverMin} | goldMin=${caue.goldMin}`);

  // Corrige para: bronze=0.07, silver=0.08, gold=0.09 | silverMin=1M, goldMin=3M
  const updated = await prisma.vendedor.update({
    where: { id: caue.id },
    data: {
      bronzeRate: 0.07,
      silverRate: 0.08,
      goldRate:   0.09,
      silverMin:  1000000,
      goldMin:    3000000,
    },
  });

  console.log(`\n=== APÓS UPDATE ===`);
  console.log(`${updated.nome}: bronze=${updated.bronzeRate} silver=${updated.silverRate} gold=${updated.goldRate} | silverMin=${updated.silverMin} goldMin=${updated.goldMin}`);
  console.log("\nOK — recarregue a aba de gestão de vendas.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
