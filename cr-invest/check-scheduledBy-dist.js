const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    where: { scheduledAt: { not: null } },
    select: { id: true, scheduledBy: true, assignedTo: true, status: true }
  });
  
  const counts = {};
  for (const l of leads) {
    const key = l.scheduledBy || "NULL";
    counts[key] = (counts[key] || 0) + 1;
  }
  
  console.log("Distribution of scheduledBy for leads with scheduledAt != null:");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
