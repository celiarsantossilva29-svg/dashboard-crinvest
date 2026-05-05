process.env.DATABASE_URL = 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
process.env.DIRECT_URL   = 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const TABLES = [
  'AdsMetrics', 'AppSetting', 'CloserGoal', 'CloserMonthlySummary',
  'CommissionConfig', 'DialerMetrics', 'GoToToken', 'Goal',
  'Installment', 'KommoToken', 'Lead', 'LeadCallLog',
  'Sale', 'SyncLog', 'TeamGoal', 'Vendedor',
];

async function main() {
  for (const table of TABLES) {
    await p.$executeRawUnsafe(`ALTER TABLE public."${table}" DISABLE ROW LEVEL SECURITY`);
    console.log(`✓ RLS desativado: ${table}`);
  }
  console.log('\nConcluído. Rode o linter do Supabase novamente para confirmar.');
}

main().catch(console.error).finally(() => p.$disconnect());
