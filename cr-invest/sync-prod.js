// Roda o sync do Kommo direto contra o banco de produção, sem limite de timeout
process.env.DATABASE_URL = 'postgresql://postgres.sthgbknylraiegbblppu:oc49DJYBC0nWoB0A@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
process.env.DIRECT_URL   = 'postgresql://postgres.sthgbknylraiegbblppu:oc49DJYBC0nWoB0A@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
process.env.KOMMO_SUBDOMAIN = 'celiarsantossilva';

// Carrega as demais vars do .env.local
require('dotenv').config({ path: '.env.local' });

async function main() {
  const { syncKommoData } = await import('./src/services/kommo.ts');
  console.log('Iniciando sync completo...');
  await syncKommoData('full');
  console.log('Sync concluído!');
}

main().catch(console.error);
