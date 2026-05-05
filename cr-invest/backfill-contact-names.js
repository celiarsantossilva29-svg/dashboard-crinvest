const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const t = env.match(/KOMMO_SUBDOMAIN=(.*)/)[1].trim();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const token = await prisma.kommoToken.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!token) {
    console.error("Token não encontrado");
    return;
  }

  const start = new Date("2026-04-18T00:00:00-03:00");
  const leads = await prisma.lead.findMany({
    where: { 
      createdAt: { gte: start },
      OR: [
        { name: { contains: "Facebook" } },
        { name: { contains: "WhatsApp" } },
        { name: { contains: "Lead" } },
        { name: { contains: "Instagram" } },
      ]
    },
    select: { id: true, name: true }
  });
  
  console.log(`Buscando NOME DO CONTATO para ${leads.length} leads no Kommo...`);
  
  if (leads.length === 0) return;

  for (let i = 0; i < leads.length; i += 50) {
    const chunk = leads.slice(i, i + 50);
    const filterQuery = chunk.map((l, idx) => `filter[id][${idx}]=${l.id}`).join("&");
    
    const url = `https://${t}.kommo.com/api/v4/leads?${filterQuery}&limit=50&with=contacts`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token.accessToken}` } });
    if (!res.ok) continue;
    
    const json = await res.json();
    const items = json._embedded?.leads ?? [];
    
    let count = 0;
    for (const item of items) {
      if (item._embedded?.contacts && item._embedded.contacts.length > 0) {
        const cid = item._embedded.contacts[0].id;
        const cRes = await fetch(`https://${t}.kommo.com/api/v4/contacts/${cid}`, {
          headers: { Authorization: `Bearer ${token.accessToken}` }
        });
        if (cRes.ok) {
          const cJson = await cRes.json();
          if (cJson.name && cJson.name.trim() !== "") {
            await prisma.lead.update({
              where: { id: String(item.id) },
              data: { name: cJson.name }
            });
            count++;
          }
        }
      }
    }
    console.log(`Lote ${i/50 + 1}: corrigidos ${count} nomes.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
