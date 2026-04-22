process.env.DATABASE_URL = 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
process.env.DIRECT_URL   = 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres';

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const result = await p.vendedor.updateMany({
    where: { nome: { contains: 'Eunice', mode: 'insensitive' } },
    data: { status: 'INATIVO' },
  });
  console.log(`Vendedores atualizados: ${result.count}`);

  // Confirma o estado final
  const eunice = await p.vendedor.findMany({
    where: { nome: { contains: 'Eunice', mode: 'insensitive' } },
    select: { nome: true, role: true, status: true },
  });
  console.log('Estado atual:', eunice);
}

main().catch(console.error).finally(() => p.$disconnect());
