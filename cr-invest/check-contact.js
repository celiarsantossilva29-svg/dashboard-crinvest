const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const t = env.match(/KOMMO_SUBDOMAIN=(.*)/)[1].trim();
const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

async function run(){
  const token = await prisma.kommoToken.findFirst({orderBy:{updatedAt:'desc'}});
  const res = await fetch(`https://${t}.kommo.com/api/v4/leads/19953745?with=contacts`, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  const json = await res.json();
  console.log("Contacts attached to lead:", JSON.stringify(json._embedded?.contacts, null, 2));
  
  if (json._embedded?.contacts?.[0]) {
    const cid = json._embedded.contacts[0].id;
    const cRes = await fetch(`https://${t}.kommo.com/api/v4/contacts/${cid}`, {
      headers: { Authorization: `Bearer ${token.accessToken}` }
    });
    const cJson = await cRes.json();
    console.log("Contact info:", JSON.stringify(cJson, null, 2));
  }
  
  await prisma.$disconnect();
}
run();
