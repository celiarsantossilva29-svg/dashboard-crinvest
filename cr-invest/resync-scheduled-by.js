/**
 * resync-scheduled-by.js
 *
 * Para todos os leads com scheduledAt != null, busca os eventos do Kommo e
 * corrige scheduledBy com o nome real de quem moveu para "1ª Reunião Confirmada".
 * Isso distingue agendamentos do SDR (Cauê/Eunice) vs IA (Sellmap).
 */

process.env.DATABASE_URL    = 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
process.env.DIRECT_URL      = 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
process.env.KOMMO_SUBDOMAIN = 'celiarsantossilva';

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const BASE = `https://celiarsantossilva.kommo.com/api/v4`;

const STAGE_MAP = {
  confirmada: ['confirmada'],
  agendado: ['agendado'],
};

function isConfirmadaStage(stageName) {
  const sn = stageName.toLowerCase();
  return sn.includes('confirmada') || (sn.includes('agendado') && !sn.includes('2°'));
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const token = await p.kommoToken.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!token) { console.error('No Kommo token'); process.exit(1); }

  // Busca usuários Kommo para resolver ID → nome
  const usersRes = await fetch(`${BASE}/users?limit=250`, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  const usersJson = await usersRes.json();
  const users = {};
  for (const u of usersJson._embedded?.users ?? []) {
    users[u.id] = u.name;
  }
  console.log('Usuários Kommo:', users);

  // Busca pipelines para resolver status_id → nome
  const pipRes = await fetch(`${BASE}/leads/pipelines?limit=250`, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  const pipJson = await pipRes.json();
  const pipelines = {};
  for (const pip of pipJson._embedded?.pipelines ?? []) {
    pipelines[pip.id] = {};
    for (const s of pip._embedded?.statuses ?? []) {
      pipelines[pip.id][s.id] = s.name;
    }
  }

  // Busca todos os leads com scheduledAt preenchido
  const leads = await p.lead.findMany({
    where: { scheduledAt: { not: null } },
    select: { id: true, scheduledBy: true, scheduledAt: true },
    orderBy: { scheduledAt: 'asc' },
  });

  console.log(`\nProcessando ${leads.length} leads com scheduledAt...`);

  let updated = 0, unchanged = 0, failed = 0;
  const changes = { before: {}, after: {} };

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];

    try {
      const res = await fetch(
        `${BASE}/events?filter[entity]=lead&filter[entity_id][]=${lead.id}&limit=250`,
        { headers: { Authorization: `Bearer ${token.accessToken}` } }
      );

      if (!res.ok || res.status === 204) { failed++; continue; }

      const json = await res.json();
      const events = (json._embedded?.events ?? []).sort((a, b) => a.created_at - b.created_at);

      let scheduledBy = null;
      let foundFirst = false;

      for (const ev of events) {
        const afterStatusId = ev.value_after?.[0]?.lead_status?.id ?? null;
        if (!afterStatusId) continue;

        let stageName = '';
        for (const statuses of Object.values(pipelines)) {
          if (statuses[afterStatusId]) { stageName = statuses[afterStatusId]; break; }
        }

        if (isConfirmadaStage(stageName) && !foundFirst) {
          foundFirst = true;
          const createdBy = ev.created_by ?? null;
          scheduledBy = createdBy != null ? (users[createdBy] ?? `user-${createdBy}`) : null;
        }
      }

      if (scheduledBy !== null && scheduledBy !== lead.scheduledBy) {
        const before = lead.scheduledBy ?? '(null)';
        changes.before[before] = (changes.before[before] ?? 0) + 1;
        changes.after[scheduledBy] = (changes.after[scheduledBy] ?? 0) + 1;

        await p.lead.update({ where: { id: lead.id }, data: { scheduledBy } });
        updated++;
      } else {
        unchanged++;
      }

    } catch (e) {
      console.error(`Erro no lead ${lead.id}:`, e.message);
      failed++;
    }

    // Rate limit: ~5 req/s (Kommo permite 7/s por token)
    if ((i + 1) % 5 === 0) {
      await sleep(1000);
      if ((i + 1) % 50 === 0) {
        console.log(`  ${i + 1}/${leads.length} processados — updated: ${updated}, unchanged: ${unchanged}, failed: ${failed}`);
      }
    }
  }

  console.log('\n=== Resultado ===');
  console.log(`Total: ${leads.length} | Atualizados: ${updated} | Sem mudança: ${unchanged} | Erros: ${failed}`);
  console.log('\nAntes:', changes.before);
  console.log('Depois:', changes.after);

  // Distribuição final
  const dist = await p.lead.groupBy({
    by: ['scheduledBy'],
    _count: { scheduledBy: true },
    where: { scheduledAt: { not: null } },
    orderBy: { _count: { scheduledBy: 'desc' } },
  });
  console.log('\nDistribuição scheduledBy após re-sync:');
  console.table(dist.map(r => ({ scheduledBy: r.scheduledBy, count: Number(r._count.scheduledBy) })));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
