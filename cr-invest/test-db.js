const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.sthgbknylraiegbblppu:fO9z9pQzg7BgmxRO@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

c.connect()
  .then(() => {
    console.log('✅ Conexão OK');
    return c.query('SELECT count(*) FROM "Lead"');
  })
  .then(r => {
    console.log('Leads:', r.rows[0].count);
    c.end();
  })
  .catch(e => {
    console.log('❌ Erro:', e.message);
    process.exit(1);
  });
