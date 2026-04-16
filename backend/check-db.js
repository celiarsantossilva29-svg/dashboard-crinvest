const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('✅ Conectado ao Supabase!\n');

  // List all tables
  const tables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);

  console.log('📋 Tabelas encontradas:');
  console.log('─'.repeat(50));

  for (const row of tables.rows) {
    const count = await client.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
    console.log(`  ${row.table_name.padEnd(35)} → ${count.rows[0].count} registros`);
  }

  // Show sample data from key tables
  const keyTables = ['vendas', 'Venda', 'sales', 'Sale', 'vendedores', 'Vendedor', 'users', 'User'];
  
  console.log('\n\n📊 Amostra de dados das tabelas principais:');
  console.log('═'.repeat(50));

  for (const t of keyTables) {
    try {
      const sample = await client.query(`SELECT * FROM "${t}" LIMIT 3`);
      if (sample.rows.length > 0) {
        console.log(`\n🔹 ${t} (${sample.rows.length} amostras):`);
        console.log(JSON.stringify(sample.rows, null, 2));
      }
    } catch (e) {
      // table doesn't exist, skip
    }
  }

  await client.end();
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
