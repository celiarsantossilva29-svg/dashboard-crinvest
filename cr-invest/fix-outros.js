const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    where: { 
      scheduledAt: { not: null },
      OR: [
        { scheduledBy: null },
        { scheduledBy: { notIn: ["IA", "Bot"] } }
      ]
    },
    select: { id: true, scheduledBy: true }
  });
  
  const toUpdate = leads.filter(l => l.scheduledBy !== "Cauê Perpétuo");
  console.log(`Encontrados ${toUpdate.length} leads com scheduledBy inválido (Outros/Null). Corrigindo para Cauê Perpétuo...`);
  
  const ids = toUpdate.map(l => l.id);
  
  if (ids.length > 0) {
    const res = await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: { scheduledBy: "Cauê Perpétuo" }
    });
    console.log(`Corrigidos ${res.count} leads.`);
  } else {
    console.log("Nenhum lead precisa de correção.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
