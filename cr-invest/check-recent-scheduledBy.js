const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const start = new Date("2026-04-18T00:00:00-03:00");
  const leads = await prisma.lead.findMany({
    where: { scheduledAt: { gte: start } },
    select: { id: true, scheduledBy: true }
  });
  
  const counts = {};
  for (const l of leads) {
    const key = l.scheduledBy === null ? "NULL" : l.scheduledBy;
    counts[key] = (counts[key] || 0) + 1;
  }
  
  console.log("Leads scheduled since 2026-04-18:");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
