const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const sales = await p.sale.findMany({
    where: {
      closedAt: { gte: new Date('2026-04-01'), lte: new Date('2026-04-15T23:59:59Z') }
    },
    select: { id: true, leadId: true, clientName: true, closedAt: true, value: true, administradora: true }
  });

  console.log(`Vendas de 01/04 a 15/04: ${sales.length}\n`);

  for (const s of sales) {
    let admTag = 'Sem info';
    // Check lead tags if leadId exists
    if (s.leadId) {
      const lead = await p.lead.findUnique({ where: { id: s.leadId }, select: { tags: true } });
      if (lead && lead.tags.length > 0) {
        const knownAdms = ["embracon", "porto", "bancorbras", "rodobens"];
        const found = lead.tags.find(t => knownAdms.some(k => t.toLowerCase().includes(k)));
        if (found) admTag = found;
        else admTag = lead.tags.join(', ');
      }
    }
    // Also check Sale.administradora
    if (admTag === 'Sem info' && s.administradora) admTag = s.administradora;

    console.log(`  ${s.clientName} | R$${s.value} | Fechou: ${s.closedAt?.toISOString().slice(0,10)} | Adm: ${admTag}`);
  }

  // Count by adm
  const byAdm = {};
  for (const s of sales) {
    let adm = s.administradora || 'Sem info';
    if (s.leadId) {
      const lead = await p.lead.findUnique({ where: { id: s.leadId }, select: { tags: true } });
      if (lead) {
        const found = lead.tags.find(t => t.toLowerCase().includes('porto') || t.toLowerCase().includes('embracon'));
        if (found) adm = found;
      }
    }
    byAdm[adm] = (byAdm[adm] || 0) + 1;
  }
  console.log('\nResumo por administradora:');
  Object.entries(byAdm).forEach(([k, v]) => console.log(`  ${k}: ${v} vendas`));

  await p.$disconnect();
}
run();
