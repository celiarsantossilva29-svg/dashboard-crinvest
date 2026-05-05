require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { syncLeadHistory } = require('./src/services/kommo.ts');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  console.log("Syncing lead 19884047...");
  await syncLeadHistory("19884047");
  console.log("Syncing lead 19876547...");
  await syncLeadHistory("19876547");
  
  const leads = await p.lead.findMany({
    where: { id: { in: ["19884047", "19876547"] } },
    select: { id: true, noShow: true, noShowAt: true }
  });
  console.log(leads);
}

main().catch(console.error).finally(() => p.$disconnect());
