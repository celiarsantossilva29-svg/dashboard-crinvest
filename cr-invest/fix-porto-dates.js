/**
 * Regra Porto Seguro: compra após dia 14 → não paga no mês seguinte.
 * Ex: comprou em 15/03 → P1=Mar(pago), P2=Mai, P3=Jun, ...
 *
 * Este script encontra vendas Porto com compra > dia 14 cujas parcelas PENDENTE/INADIMPLENTE
 * estão adiantadas em 1 mês e as corrige adicionando 1 mês.
 */

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function addOneMonth(date) {
  const d = new Date(date);
  const m = d.getUTCMonth() + 1;
  return new Date(Date.UTC(
    d.getUTCFullYear() + Math.floor(m / 12),
    ((m % 12) + 12) % 12,
    1
  ));
}

function fmt(date) {
  return new Date(date).toISOString().split('T')[0];
}

async function main() {
  // Busca todas as vendas Porto com parcelas abertas
  const sales = await p.sale.findMany({
    where: {
      installments: { some: { status: { in: ['PENDENTE', 'INADIMPLENTE'] } } }
    },
    include: {
      installments: { orderBy: { parcelaNumero: 'asc' } }
    }
  });

  // Filtra: Porto (não Embracon) + compra após dia 14
  const toFix = sales.filter(s => {
    const isPorto = !String(s.administradora || '').toLowerCase().includes('embracon');
    const day = new Date(s.closedAt).getUTCDate();
    return isPorto && day > 14;
  });

  console.log(`\nVendas Porto com compra após dia 14: ${toFix.length}\n`);

  let totalFixed = 0;

  for (const sale of toFix) {
    const pendentes = sale.installments.filter(i =>
      i.status === 'PENDENTE' || i.status === 'INADIMPLENTE'
    );

    // Verifica se P2 já está correto (se já foi ajustado antes, pula)
    const pagas = sale.installments.filter(i => i.pago || i.status === 'PAGO');
    const firstPendente = pendentes[0];
    if (!firstPendente) continue;

    // Calcula a data esperada para este parcelaNumero
    const closedAt = new Date(sale.closedAt);
    const expectedDate = new Date(Date.UTC(
      closedAt.getUTCFullYear() + Math.floor((closedAt.getUTCMonth() + firstPendente.parcelaNumero + 1) / 12),
      ((closedAt.getUTCMonth() + firstPendente.parcelaNumero + 1) % 12),
      1
    ));
    const currentDate = new Date(firstPendente.dataVencimento);

    // Se a data atual já bate com o esperado, está correto — pula
    if (currentDate.getUTCFullYear() === expectedDate.getUTCFullYear() &&
        currentDate.getUTCMonth() === expectedDate.getUTCMonth()) {
      console.log(`  ✓ ${sale.clientName} (${fmt(sale.closedAt)}) — já está correto`);
      continue;
    }

    console.log(`  ✗ ${sale.clientName} (compra: ${fmt(sale.closedAt)}, dia ${new Date(sale.closedAt).getUTCDate()})`);
    console.log(`    Parcelas pagas: ${pagas.length} | Pendentes/inadimplentes: ${pendentes.length}`);

    for (const inst of pendentes) {
      const novaData = addOneMonth(inst.dataVencimento);
      await p.installment.update({
        where: { id: inst.id },
        data: { dataVencimento: novaData }
      });
      console.log(`    P${inst.parcelaNumero}: ${fmt(inst.dataVencimento)} → ${fmt(novaData)} [${inst.status}]`);
      totalFixed++;
    }
  }

  console.log(`\n✅ Total de parcelas corrigidas: ${totalFixed}`);
}

main().catch(console.error).finally(() => p.$disconnect());
