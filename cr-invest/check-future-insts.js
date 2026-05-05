const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Settings
  const settings = await p.setting.findMany({ orderBy: { key: 'asc' } });
  console.log('=== SETTINGS ===');
  settings.forEach(s => console.log(' ', s.key, '=', s.value));

  // Parcelas futuras
  const insts = await p.installment.findMany({
    where: { dataVencimento: { gte: new Date('2026-05-01') }, status: { not: 'CANCELADO' } },
    include: { sale: { select: { value: true, administradora: true, clientName: true } } }
  });

  const byMonth = {};
  for (const i of insts) {
    const k = i.dataVencimento.toISOString().slice(0,7);
    if (!byMonth[k]) byMonth[k] = { n: 0, comTotal: 0 };
    const netFactor = (i.sale.administradora||'').toLowerCase().includes('embracon') ? (1-0.07) : (1-0.084-0.069);
    const com = (i.sale.value * 0.04) / 1 * netFactor; // aproximado
    byMonth[k].n++;
    byMonth[k].comTotal += i.valorParcela * netFactor;
  }

  console.log('\n=== PARCELAS FUTURAS (mai/26+) ===');
  let fmt = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
  Object.entries(byMonth).sort().forEach(([m, d]) =>
    console.log(' ', m, d.n, 'parcelas | comissão estimada:', fmt(d.comTotal))
  );

  // Total de vendas no banco
  const totalSales = await p.sale.count();
  const totalInsts = await p.installment.count({ where: { status: { not: 'CANCELADO' } } });
  console.log('\n=== TOTAIS DB ===');
  console.log('Vendas:', totalSales);
  console.log('Parcelas ativas:', totalInsts);
}

main().catch(console.error).finally(() => p.$disconnect());
