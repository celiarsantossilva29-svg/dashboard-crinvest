const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // Vendas fechadas no período 1-15 abril
  const sales = await p.sale.findMany({
    where: {
      closedAt: { gte: new Date('2026-04-01'), lte: new Date('2026-04-15T23:59:59Z') }
    },
    select: { id: true, leadId: true, clientName: true, closedAt: true }
  });
  console.log('Vendas no período:', sales.length);
  sales.forEach(s => console.log('  leadId:', s.leadId, '| cliente:', s.clientName, '| fechou:', s.closedAt));

  // Verifica quais desses leadIds existem na tabela Lead
  const leadIds = sales.map(s => s.leadId).filter(Boolean);
  if (leadIds.length > 0) {
    const leads = await p.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, name: true, createdAt: true, status: true }
    });
    console.log('\nLeads encontrados no banco:', leads.length);
    leads.forEach(l => console.log('  id:', l.id, '| nome:', l.name, '| criado:', l.createdAt, '| status:', l.status));
  } else {
    console.log('\nNenhuma venda tem leadId vinculado!');
  }

  await p.$disconnect();
}
run();
