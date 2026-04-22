// Run RLS enable directly with individual statements
const { Client } = require('pg');

const TABLES = [
  'Vendedor', 'Lead', 'Sale', 'Installment', 'AdsMetrics',
  'DialerMetrics', 'Goal', 'SyncLog', 'KommoToken', 'TeamGoal',
  'CloserGoal', 'CloserMonthlySummary', 'LeadCallLog', 'GoToToken',
  'CommissionConfig', 'AppSetting', '_prisma_migrations'
];

async function main() {
  const connectionString = 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    await client.connect();
    console.log('✅ Connected to Supabase\n');
    
    for (const table of TABLES) {
      try {
        await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
        await client.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
        console.log(`  ✅ ${table} — RLS enabled + forced`);
      } catch (err) {
        if (err.message.includes('does not exist')) {
          console.log(`  ⏭️  ${table} — table does not exist, skipping`);
        } else {
          console.error(`  ❌ ${table} — ${err.message}`);
        }
      }
    }
    
    // Verify
    console.log('\n── Verificação final ──');
    const result = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    
    let allSecure = true;
    for (const row of result.rows) {
      const icon = row.rowsecurity ? '🔒' : '⚠️';
      if (!row.rowsecurity) allSecure = false;
      console.log(`  ${icon} ${row.tablename}: RLS ${row.rowsecurity ? 'ENABLED' : 'DISABLED'}`);
    }
    
    console.log(allSecure 
      ? '\n🎉 Todas as tabelas estão protegidas com RLS!'
      : '\n⚠️  Algumas tabelas ainda estão sem RLS.');
    
  } catch (err) {
    console.error('❌ Connection error:', err.message);
  } finally {
    await client.end();
  }
}

main();
