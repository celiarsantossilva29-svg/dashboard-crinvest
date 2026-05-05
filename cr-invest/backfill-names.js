const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const matchEnv = envFile.match(/KOMMO_SUBDOMAIN=(.*)/);
const subdomain = matchEnv ? matchEnv[1].trim() : '';

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
      name: null
    },
    select: { id: true }
  });
  
  console.log(`Buscando nomes para ${leads.length} leads no Kommo...`);
  
  if (leads.length === 0) return;

  // Busca em lotes de 50
  for (let i = 0; i < leads.length; i += 50) {
    const chunk = leads.slice(i, i + 50);
    const filterQuery = chunk.map((l, idx) => `filter[id][${idx}]=${l.id}`).join("&");
    
    const url = `https://${subdomain}.kommo.com/api/v4/leads?${filterQuery}&limit=50`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token.accessToken}` } });
    if (!res.ok) {
      console.log("Erro na API", res.status, await res.text());
      continue;
    }
    
    const json = await res.json();
    const items = json._embedded?.leads ?? [];
    
    let count = 0;
    for (const item of items) {
      if (item.name) {
        await prisma.lead.updateMany({
          where: { id: String(item.id) },
          data: { name: item.name }
        });
        count++;
      }
    }
    console.log(`Lote ${i/50 + 1}: atualizados ${count} nomes.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
