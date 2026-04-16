const { Client } = require('pg');
const fs = require('fs');
const c = new Client({
  connectionString: 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();
  const result = {};
  
  result.statusDist = (await c.query(`SELECT status, COUNT(*) as cnt FROM "Lead" GROUP BY status ORDER BY cnt DESC`)).rows;
  result.isReagendado = (await c.query(`SELECT "isReagendado", COUNT(*) as cnt FROM "Lead" GROUP BY "isReagendado"`)).rows;
  result.noShow = (await c.query(`SELECT "noShow", COUNT(*) as cnt FROM "Lead" GROUP BY "noShow"`)).rows;
  
  // Key: find all leads that went through "Reagendamento" stages
  // Check what stage names exist (we need the raw pipeline stage from Kommo)
  // Let's check campaignId (pipeline) distribution
  result.campaignDist = (await c.query(`SELECT "campaignId", COUNT(*) as cnt FROM "Lead" GROUP BY "campaignId" ORDER BY cnt DESC LIMIT 20`)).rows;
  
  // Check scheduled leads
  result.scheduledCount = (await c.query(`SELECT COUNT(*) as cnt FROM "Lead" WHERE status = 'scheduled'`)).rows;
  result.meetingCount = (await c.query(`SELECT COUNT(*) as cnt FROM "Lead" WHERE status = 'meeting'`)).rows;
  result.wonCount = (await c.query(`SELECT COUNT(*) as cnt FROM "Lead" WHERE status = 'won'`)).rows;
  result.lostCount = (await c.query(`SELECT COUNT(*) as cnt FROM "Lead" WHERE status = 'lost'`)).rows;
  result.newCount = (await c.query(`SELECT COUNT(*) as cnt FROM "Lead" WHERE status = 'new'`)).rows;
  result.contactedCount = (await c.query(`SELECT COUNT(*) as cnt FROM "Lead" WHERE status = 'contacted'`)).rows;
  result.qualifiedCount = (await c.query(`SELECT COUNT(*) as cnt FROM "Lead" WHERE status = 'qualified'`)).rows;

  fs.writeFileSync('status-dist.json', JSON.stringify(result, null, 2), 'utf8');
  console.log('Done');
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
