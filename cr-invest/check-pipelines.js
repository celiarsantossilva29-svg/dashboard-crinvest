const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const t = env.match(/KOMMO_SUBDOMAIN=(.*)/)[1].trim();
const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

async function run(){
  const token = await prisma.kommoToken.findFirst({orderBy:{updatedAt:'desc'}});
  const res = await fetch('https://'+t+'.kommo.com/api/v4/leads/pipelines', {headers:{Authorization:'Bearer '+token.accessToken}});
  const j = await res.json();
  j._embedded.pipelines.forEach(p => console.log(p.id, p.name, p._embedded.statuses.map(s => s.name)));
  await prisma.$disconnect();
}
run();
