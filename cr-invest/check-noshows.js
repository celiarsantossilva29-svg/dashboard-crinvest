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

  const since = Math.floor(new Date("2026-04-23T00:00:00-03:00").getTime() / 1000);
  const until = Math.floor(new Date("2026-04-23T23:59:59-03:00").getTime() / 1000);

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

  const reagendamentos = allEvents.filter(ev => {
    const afterId = ev.value_after?.[0]?.lead_status?.id;
    return afterId === REAGENDAMENTO_R1 || afterId === REAGENDAMENTO_R2;
  });

  console.log(`Found ${reagendamentos.length} reagendamentos on April 23:`);
  const leadIds = reagendamentos.map(ev => String(ev.entity_id));
  
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, createdAt: true, noShow: true, noShowAt: true }
  });
  
  const leadMap = new Map(leads.map(l => [l.id, l]));

  for (const ev of reagendamentos) {
    const date = new Date(ev.created_at * 1000);
    const id = String(ev.entity_id);
    const l = leadMap.get(id);
    const isR1 = ev.value_after[0].lead_status.id === REAGENDAMENTO_R1;
    console.log(`  Lead ${id} -> ${isR1 ? 'R1' : 'R2'} at ${date.toISOString()} | createdAt: ${l?.createdAt?.toISOString()} | noShow: ${l?.noShow} | noShowAt: ${l?.noShowAt?.toISOString()}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
