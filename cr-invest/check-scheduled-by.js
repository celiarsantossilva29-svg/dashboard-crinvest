const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const results = await prisma.$queryRaw`
    SELECT "scheduledBy", COUNT(*) as count
    FROM "Lead"
    WHERE "scheduledAt" IS NOT NULL
    GROUP BY "scheduledBy"
    ORDER BY count DESC
  `;
  console.log("scheduledBy distribution:", results);

  const nullCount = await prisma.lead.count({
    where: { scheduledAt: { not: null }, scheduledBy: null }
  });
  console.log("Leads com scheduledAt mas scheduledBy NULL:", nullCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
