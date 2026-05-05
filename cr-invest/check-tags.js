const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: new Date('2026-04-18T00:00:00-03:00') } },
    select: { tags: true }
  });
  console.log(Array.from(new Set(leads.map(l => l.tags.join(', ')))));
}

main().catch(console.error).finally(() => prisma.$disconnect());
