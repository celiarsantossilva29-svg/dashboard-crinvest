/**
 * Backfill: corrige datas de parcelas PENDENTE/INADIMPLENTE conforme regra Porto:
 *   baseOffset = dia > 22 ? 2 : 1
 *   skipOffset = dia > 14 ? 1 : 0
 *   P1  → closedAt + baseOffset
 *   P2+ → closedAt + baseOffset + i + skipOffset  (i = parcelaNumero - 1)
 *
 * Embracon não segue essa regra → ignorado.
 */

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function addMonths(date, n) {
  const m = date.getUTCMonth() + n;
  return new Date(Date.UTC(
    date.getUTCFullYear() + Math.floor(m / 12),
    ((m % 12) + 12) % 12,
    1
  ));
}

function fmt(date) {
  return new Date(date).toISOString().slice(0, 7); // YYYY-MM
}

async function main() {
  const sales = await p.sale.findMany({
    where: {
      installments: { some: { status: { in: ['PENDENTE', 'INADIMPLENTE'] } } },
    },
    include: {
      installments: { orderBy: { parcelaNumero: 'asc' } },
    },
  });

  // Apenas Porto (não Embracon)
  const portoSales = sales.filter(s =>
    !String(s.administradora || '').toLowerCase().includes('embracon')
  );

  console.log(`\nVendas Porto com parcelas abertas: ${portoSales.length}\n`);

  let totalFixed = 0;
  let totalSkipped = 0;

  for (const sale of portoSales) {
    const closedAt = new Date(sale.closedAt);
    const day = closedAt.getUTCDate();
    const baseOffset = day > 22 ? 2 : 1;
    const skipOffset = day > 14 ? 1 : 0;

    const openInsts = sale.installments.filter(i =>
      i.status === 'PENDENTE' || i.status === 'INADIMPLENTE'
    );

    let changed = false;

    for (const inst of openInsts) {
      const i = inst.parcelaNumero - 1; // 0-based
      const expected = addMonths(closedAt, i === 0 ? baseOffset : baseOffset + i + skipOffset);
      const current = new Date(inst.dataVencimento);

      const sameMonth =
        current.getUTCFullYear() === expected.getUTCFullYear() &&
        current.getUTCMonth() === expected.getUTCMonth();

      if (!sameMonth) {
        await p.installment.update({
          where: { id: inst.id },
          data: { dataVencimento: expected },
        });
        console.log(
          `  ${sale.clientName} | dia ${day} | P${inst.parcelaNumero}: ${fmt(current)} → ${fmt(expected)}`
        );
        totalFixed++;
        changed = true;
      }
    }

    if (!changed) totalSkipped++;
  }

  console.log(`\n✅ Parcelas corrigidas: ${totalFixed}`);
  console.log(`   Vendas já corretas:  ${totalSkipped}`);
}

main().catch(console.error).finally(() => p.$disconnect());
