const { Client } = require('pg');

const DB_URL = 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

// Pipeline PRÉ-VENDAS (ID: 11587111)
const PIPELINE_ID = 11587111;
const AGENDADOS_STATUS_ID = 88986727;    // "1° Reunião Confirmada"
const REAGENDAMENTO_STATUS_ID = 88993003; // "Reagendamento - R1"

async function fetchLeadsByStatus(accessToken, pipelineId, statusId) {
  const ids = [];
  let page = 1;
  while (true) {
    const url = `https://celiarsantossilva.kommo.com/api/v4/leads?limit=250&page=${page}&filter[statuses][0][status_id]=${statusId}&filter[statuses][0][pipeline_id]=${pipelineId}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 204 || res.status === 404) break;
    if (!res.ok) break;
    const json = await res.json();
    const leads = json._embedded?.leads ?? [];
    if (leads.length === 0) break;
    for (const lead of leads) ids.push(String(lead.id));
    if (leads.length < 250) break;
    page++;
    await new Promise(r => setTimeout(r, 200));
  }
  return ids;
}

async function main() {
  const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const tokenRow = (await db.query('SELECT "accessToken" FROM "KommoToken" ORDER BY "updatedAt" DESC LIMIT 1')).rows[0];
  const accessToken = tokenRow.accessToken;

  console.log('📋 Pipeline: PRÉ-VENDAS (ID: 11587111)');
  console.log('   Agendados = "1° Reunião Confirmada" (88986727)');
  console.log('   No-show   = "Reagendamento - R1" (88993003)\n');

  // Buscar leads em cada estágio
  console.log('⏳ Buscando leads agendados...');
  const agendadosIds = await fetchLeadsByStatus(accessToken, PIPELINE_ID, AGENDADOS_STATUS_ID);
  console.log(`   ✅ ${agendadosIds.length} leads em "1° Reunião Confirmada"`);

  console.log('⏳ Buscando leads em reagendamento...');
  const reagendamentoIds = await fetchLeadsByStatus(accessToken, PIPELINE_ID, REAGENDAMENTO_STATUS_ID);
  console.log(`   ✅ ${reagendamentoIds.length} leads em "Reagendamento - R1"`);

  // Reset flags
  await db.query(`UPDATE "Lead" SET "noShow" = false, "isReagendado" = false`);

  // Marcar leads de reagendamento no banco
  if (reagendamentoIds.length > 0) {
    let updated = 0;
    for (let i = 0; i < reagendamentoIds.length; i += 500) {
      const chunk = reagendamentoIds.slice(i, i + 500);
      const ph = chunk.map((_, j) => `$${j + 1}`).join(', ');
      const r = await db.query(`UPDATE "Lead" SET "noShow" = true, "isReagendado" = true WHERE id IN (${ph})`, chunk);
      updated += r.rowCount;
    }
    console.log(`\n✅ ${updated} leads marcados como no-show no banco`);
  }

  // Cálculo final
  const totalAgendados = agendadosIds.length + reagendamentoIds.length;
  const noShowCount = reagendamentoIds.length;
  const noShowPct = totalAgendados > 0 ? (noShowCount / totalAgendados * 100).toFixed(2) : 'N/A';

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 NO-SHOW — Pipeline PRÉ-VENDAS`);
  console.log(`   Agendados (1° Reunião Confirmada): ${agendadosIds.length}`);
  console.log(`   Reagendamentos (Reagendamento-R1): ${reagendamentoIds.length}`);
  console.log(`   Total passaram por agendamento:    ${totalAgendados}`);
  console.log(`   ─────────────────────────────────`);
  console.log(`   No-Show %: ${noShowCount} / ${totalAgendados} = ${noShowPct}%`);
  console.log(`${'═'.repeat(50)}`);

  await db.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
