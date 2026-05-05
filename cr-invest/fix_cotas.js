const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // First, check what sales exist for Nivaldo to understand the 1.5M one
  const nivaldo = await p.sale.findMany({
    where: { clientName: { contains: 'NIVALDO' } },
    include: { installments: { take: 1 } }
  });
  console.log('=== Nivaldo existing sales ===');
  for (const s of nivaldo) {
    console.log(`  ID: ${s.id} | Valor: ${s.value} | Produto: ${s.produto} | Data: ${s.closedAt.toISOString().split('T')[0]} | Installments: ${s.installments.length > 0 ? 'yes' : 'no'}`);
  }

  // ── NEIDER: need to create 3 more cotas ──
  // Has 1 cota of 453306 (imovel). Needs:
  //   295120 (imovel) - proposta 107774
  //   295120 (imovel) - proposta 107780
  //   453306 (imovel) - proposta 107782
  const neiderRef = await p.sale.findFirst({ where: { clientName: { contains: 'NEIDER' } } });
  
  const neiderCotas = [
    { value: 295120, notes: 'Proposta 107774' },
    { value: 295120, notes: 'Proposta 107780' },
    { value: 453306, notes: 'Proposta 107782' },
  ];
  
  for (const cota of neiderCotas) {
    const sale = await p.sale.create({
      data: {
        clientName: neiderRef.clientName,
        assignedTo: neiderRef.assignedTo,
        sdrName: neiderRef.sdrName,
        value: cota.value,
        closedAt: new Date('2026-04-06T00:00:00Z'),
        administradora: neiderRef.administradora,
        produto: 'imovel',
        clienteCpf: neiderRef.clienteCpf,
        notes: cota.notes,
        origem: neiderRef.origem,
      },
    });
    // Create 12 installments
    const installments = [];
    for (let i = 1; i <= 12; i++) {
      const venc = new Date('2026-04-06T00:00:00Z');
      venc.setUTCMonth(venc.getUTCMonth() + i);
      installments.push({
        saleId: sale.id,
        parcelaNumero: i,
        valorParcela: cota.value,
        dataVencimento: venc,
        pago: false,
        status: 'PENDENTE',
      });
    }
    await p.installment.createMany({ data: installments });
    console.log(`✓ NEIDER cota criada: R$ ${cota.value} | ${cota.notes}`);
  }

  // ── JEFERSON: need to create 4 more cotas ──
  // Has 1 cota of 295176 (imovel). Needs:
  //   295176 (imovel) - proposta 107210
  //   295176 (imovel) - proposta 107208
  //   295176 (imovel) - proposta 107203
  //   251232 (auto) - proposta 107200
  const jefRef = await p.sale.findFirst({ where: { clientName: { contains: 'JEFERSON' } } });

  const jefCotas = [
    { value: 295176, produto: 'imovel', notes: 'Proposta 107210' },
    { value: 295176, produto: 'imovel', notes: 'Proposta 107208' },
    { value: 295176, produto: 'imovel', notes: 'Proposta 107203' },
    { value: 251232, produto: 'auto', notes: 'Proposta 107200' },
  ];

  for (const cota of jefCotas) {
    const sale = await p.sale.create({
      data: {
        clientName: jefRef.clientName,
        assignedTo: jefRef.assignedTo,
        sdrName: jefRef.sdrName,
        value: cota.value,
        closedAt: new Date('2026-04-02T00:00:00Z'),
        administradora: jefRef.administradora,
        produto: cota.produto,
        clienteCpf: jefRef.clienteCpf,
        notes: cota.notes,
        origem: jefRef.origem,
      },
    });
    const installments = [];
    for (let i = 1; i <= 12; i++) {
      const venc = new Date('2026-04-02T00:00:00Z');
      venc.setUTCMonth(venc.getUTCMonth() + i);
      installments.push({
        saleId: sale.id,
        parcelaNumero: i,
        valorParcela: cota.value,
        dataVencimento: venc,
        pago: false,
        status: 'PENDENTE',
      });
    }
    await p.installment.createMany({ data: installments });
    console.log(`✓ JEFERSON cota criada: R$ ${cota.value} | ${cota.notes}`);
  }

  // ── NIVALDO: the 1.5M cota (id cmo2yqzhl...) has produto=null ──
  // This is the "outro" sale. Let's fix its produto and date
  // The 3 IMÓVEL cotas of 500k are already in the DB and correct
  await p.sale.update({
    where: { id: 'cmo2yqzhl00001zgyb8dr6tsg' },
    data: { produto: 'outro', closedAt: new Date('2026-04-15T00:00:00Z') }
  });
  console.log('✓ NIVALDO cota 1.5M atualizada: produto=outro, data=15/04');

  console.log('\n=== CONCLUÍDO ===');
}

main().catch(console.error).finally(() => p.$disconnect());
