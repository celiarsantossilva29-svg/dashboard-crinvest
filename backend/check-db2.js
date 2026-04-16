const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  
  const result = {};

  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);

  for (const row of tables.rows) {
    const count = await client.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
    const sample = await client.query(`SELECT * FROM "${row.table_name}" LIMIT 2`);
    result[row.table_name] = {
      count: parseInt(count.rows[0].count),
      sample: sample.rows
    };
  }

  fs.writeFileSync('db-result.json', JSON.stringify(result, null, 2), 'utf8');
  console.log('Done - saved to db-result.json');
  await client.end();
}

main().catch(err => { console.error(err.message); process.exit(1); });
