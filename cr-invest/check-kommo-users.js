process.env.DATABASE_URL     = 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
process.env.DIRECT_URL       = 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres';
process.env.KOMMO_SUBDOMAIN  = 'celiarsantossilva';
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.kommoToken.findFirst({ orderBy: { updatedAt: 'desc' } }).then(async t => {
  if (!t) { console.log('No token'); p.$disconnect(); return; }

  const subdomain = process.env.KOMMO_SUBDOMAIN;
  const base = `https://${subdomain}.kommo.com/api/v4`;

  const res = await fetch(base + '/users?limit=250', {
    headers: { Authorization: 'Bearer ' + t.accessToken }
  });

  if (!res.ok) {
    console.log('Error:', res.status, await res.text());
    p.$disconnect();
    return;
  }

  const j = await res.json();
  const users = (j._embedded?.users ?? []).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    group: u.group,
  }));
  console.log(JSON.stringify(users, null, 2));
  p.$disconnect();
}).catch(e => { console.error(e); p.$disconnect(); });
