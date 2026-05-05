const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const match = envFile.match(/KOMMO_SUBDOMAIN=(.*)/);
const subdomain = match ? match[1].trim() : '';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Pipeline status IDs (from check-pipelines.js output)
const STATUS_NAMES = {
  88986711: "Incoming leads (PRÉ-VENDAS)",
  88986715: "dia 1",
  91997863: "dia 2",
  91997867: "dia 3",
  102337968: "dia 5",
  102337972: "dia 7",
  102737448: "dia 10",
  88986727: "1° Reunião Confirmada",
  88993003: "Reagendamento - R1",
  88992831: "Incoming leads (VENDAS)",
  88992835: "1° Reunião Realizada",
  88993103: "2° Reunião AGENDADA",
  88992843: "Reagendamento - R2",
  88993107: "Negociação",
  88992839: "Contato Futuro",
  142: "Closed - won",
  143: "Closed - lost"
};

async function main() {
  const token = await prisma.kommoToken.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!token) { console.error("No token"); return; }

  // Buscar eventos de status_changed entre 22-24 de abril
  const since = Math.floor(new Date("2026-04-22T00:00:00-03:00").getTime() / 1000);
  const until = Math.floor(new Date("2026-04-24T23:59:59-03:00").getTime() / 1000);

  let page = 1;
  const allEvents = [];

  while (true) {
    const url = `https://${subdomain}.kommo.com/api/v4/events?filter[type]=lead_status_changed&filter[created_at][from]=${since}&filter[created_at][to]=${until}&limit=100&page=${page}`;
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

  console.log(`Total status_changed events from Apr 22-24: ${allEvents.length}\n`);

  // Filtrar apenas movimentos para "1° Reunião Confirmada" (88986727)
  const confirmadaEvents = allEvents.filter(ev => {
    const afterId = ev.value_after?.[0]?.lead_status?.id;
    return afterId === 88986727;
  });

  console.log(`Events moving to "1° Reunião Confirmada": ${confirmadaEvents.length}`);
  for (const ev of confirmadaEvents) {
    const date = new Date(ev.created_at * 1000);
    console.log(`  Lead ${ev.entity_id} → Confirmada at ${date.toISOString()} (${date.toLocaleDateString('pt-BR')})`);
  }

  // Agrupar por dia
  const byDay = {};
  for (const ev of confirmadaEvents) {
    const d = new Date(ev.created_at * 1000);
    const day = d.toLocaleDateString('pt-BR');
    byDay[day] = (byDay[day] || 0) + 1;
  }
  console.log('\nAgendamentos por dia:');
  for (const [day, count] of Object.entries(byDay)) {
    console.log(`  ${day}: ${count}`);
  }

  // Checar scheduledAt desses leads no banco
  const leadIds = confirmadaEvents.map(ev => String(ev.entity_id));
  const dbLeads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, scheduledAt: true, status: true }
  });
  const dbMap = new Map(dbLeads.map(l => [l.id, l]));

  console.log('\nEstado no banco:');
  for (const ev of confirmadaEvents) {
    const id = String(ev.entity_id);
    const db = dbMap.get(id);
    const evDate = new Date(ev.created_at * 1000).toISOString();
    console.log(`  Lead ${id}: scheduledAt=${db?.scheduledAt?.toISOString() ?? 'NULL'} status=${db?.status} (evento: ${evDate})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
