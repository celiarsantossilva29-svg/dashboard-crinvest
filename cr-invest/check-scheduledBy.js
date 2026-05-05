const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    where: { id: { in: ["19910153", "19884047", "19876547"] } },
    select: { id: true, scheduledBy: true }
  });
  console.log(leads);
}

main().catch(console.error).finally(() => prisma.$disconnect());
