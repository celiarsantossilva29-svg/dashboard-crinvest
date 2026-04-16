const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
async function main() {
  await c.connect();
  
  const noShow = (await c.query(`SELECT "noShow", COUNT(*) as cnt FROM "Lead" GROUP BY "noShow" ORDER BY "noShow"`)).rows;
  const reagendado = (await c.query(`SELECT "isReagendado", COUNT(*) as cnt FROM "Lead" GROUP BY "isReagendado" ORDER BY "isReagendado"`)).rows;
  const scheduled = (await c.query(`SELECT COUNT(*) as cnt FROM "Lead" WHERE status = 'scheduled'`)).rows;
  
  console.log('noShow distribution:', JSON.stringify(noShow));
  console.log('isReagendado distribution:', JSON.stringify(reagendado));
  console.log('Total scheduled:', scheduled[0].cnt);
  
  // Calculate no-show %
  const totalNoShow = noShow.find(r => r.noShow === true)?.cnt || 0;
  const totalScheduled = parseInt(scheduled[0].cnt);
  const pct = totalScheduled > 0 ? (parseInt(totalNoShow) / (totalScheduled) * 100).toFixed(2) : 'N/A';
  console.log(`\nNo-Show %: ${totalNoShow} reagendamentos / ${totalScheduled} agendados = ${pct}%`);
  
  // Check last sync log
  const log = (await c.query(`SELECT * FROM "SyncLog" ORDER BY "syncedAt" DESC LIMIT 3`)).rows;
  console.log('\nLast sync logs:', JSON.stringify(log.map(l => ({source:l.source, status:l.status, message:l.message, at:l.syncedAt})), null, 2));
  
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
