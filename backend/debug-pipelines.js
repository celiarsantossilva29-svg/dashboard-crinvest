const { Client } = require('pg');
const fs = require('fs');

const DB_URL = 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

const REAGENDAMENTO_STAGES = [
  'Reagendamento - R1',
  'Reagendamento - R2',
  'NO SHOW',
];

async function main() {
  const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const tokenRow = (await db.query('SELECT "accessToken" FROM "KommoToken" ORDER BY "updatedAt" DESC LIMIT 1')).rows[0];
  const accessToken = tokenRow.accessToken;

  const pipelinesRes = await fetch('https://celiarsantossilva.kommo.com/api/v4/leads/pipelines?limit=250', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  const pipelinesJson = await pipelinesRes.json();
  
  const result = {};
  const reagendamentoIds = [];
  
  for (const p of pipelinesJson._embedded?.pipelines ?? []) {
    result[p.name] = {};
    for (const s of p._embedded?.statuses ?? []) {
      const isReag = REAGENDAMENTO_STAGES.includes(s.name);
      result[p.name][s.id] = { name: s.name, isReagendamento: isReag };
      if (isReag) reagendamentoIds.push({ id: s.id, name: s.name, pipeline: p.name });
    }
  }

  fs.writeFileSync('pipelines-map.json', JSON.stringify({ pipelines: result, reagendamentoIds }, null, 2), 'utf8');
  console.log('Done - saved to pipelines-map.json');
  console.log('Reagendamento IDs:', JSON.stringify(reagendamentoIds, null, 2));
  
  // Also reset the wrong data
  await db.query(`UPDATE "Lead" SET "noShow" = false, "isReagendado" = false`);
  console.log('Reset all noShow/isReagendado flags to false');
  
  await db.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
