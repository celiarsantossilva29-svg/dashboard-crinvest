const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const vendedores = await prisma.vendedor.findMany({ orderBy: { nome: "asc" } });
  for (const v of vendedores) {
    console.log(`${v.nome} (${v.role}): bronze=${v.bronzeRate} silver=${v.silverRate} gold=${v.goldRate} | silverMin=${v.silverMin} goldMin=${v.goldMin}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
