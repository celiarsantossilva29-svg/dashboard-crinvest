const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const matchEnv = envFile.match(/KOMMO_SUBDOMAIN=(.*)/);
const subdomain = matchEnv ? matchEnv[1].trim() : '';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const REAGENDAMENTO_R1 = 88993003;
const REAGENDAMENTO_R2 = 88992843;

async function main() {
  const token = await prisma.kommoToken.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!token) return;

  // Busca todos os eventos de reagendamento desde 18/04
  const since = Math.floor(new Date("2026-04-18T00:00:00-03:00").getTime() / 1000);

  let page = 1;
  const allEvents = [];

  console.log("Buscando eventos de reagendamento no Kommo...");
  while (true) {
    const url = `https://${subdomain}.kommo.com/api/v4/events?filter[type]=lead_status_changed&filter[created_at][from]=${since}&limit=100&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (!res.ok || res.status === 204) break;
    const json = await res.json();
    const events = json._embedded?.events ?? [];
    if (events.length === 0) break;
    allEvents.push(...events);
    if (events.length < 100) break;
    page++;
  }

  const reagendamentos = allEvents.filter(ev => {
    const afterId = ev.value_after?.[0]?.lead_status?.id;
    return afterId === REAGENDAMENTO_R1 || afterId === REAGENDAMENTO_R2;
  });

  console.log(`Encontrados ${reagendamentos.length} eventos de reagendamento.`);

  for (const ev of reagendamentos) {
    const date = new Date(ev.created_at * 1000);
    const id = String(ev.entity_id);
    
    // Atualiza o lead no banco
    await prisma.lead.updateMany({
      where: { id },
      data: { noShow: true, noShowAt: date }
    });
    console.log(`Updated lead ${id} -> noShow=true, noShowAt=${date.toISOString()}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
