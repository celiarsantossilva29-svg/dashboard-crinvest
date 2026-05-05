/**
 * check-march-detail.js
 * Investiga por que o sistema tem 113 parcelas em março vs ~55 no PDF
 * Foco: clientes com múltiplas parcelas consecutivas no mesmo mês
 */

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const MARCH_START = new Date("2026-03-01T00:00:00.000Z");
const MARCH_END   = new Date("2026-03-31T23:59:59.999Z");

async function main() {
  // Buscar todas as parcelas de março com detalhe da venda
  const marchInsts = await p.installment.findMany({
    where: {
      dataVencimento: { gte: MARCH_START, lte: MARCH_END },
      status: { not: "CANCELADO" },
    },
    include: {
      sale: {
        select: {
          id: true, clientName: true, value: true,
          closedAt: true, administradora: true, clienteCpf: true,
        },
      },
    },
    orderBy: [{ sale: { clientName: "asc" } }, { parcelaNumero: "asc" }],
  });

  console.log(`\n=== Parcelas não-canceladas em Março 2026: ${marchInsts.length} ===\n`);

  // Agrupar por saleId para ver quantas parcelas por contrato caem em março
  const porVenda = new Map();
  for (const inst of marchInsts) {
    const sid = inst.saleId;
    if (!porVenda.has(sid)) {
      porVenda.set(sid, {
        client: inst.sale.clientName,
        cpf: inst.sale.clienteCpf,
        value: inst.sale.value,
        closedAt: inst.sale.closedAt,
        parcelas: [],
      });
    }
    porVenda.get(sid).parcelas.push(inst.parcelaNumero);
  }

  // Contratos com MAIS DE 1 parcela em março (o problema)
  const duplicados = [];
  const normais = [];
  for (const [sid, info] of porVenda.entries()) {
    if (info.parcelas.length > 1) duplicados.push({ sid, ...info });
    else normais.push({ sid, ...info });
  }

  console.log(`Contratos com 1 parcela em março (normal): ${normais.length}`);
  console.log(`Contratos com 2+ parcelas em março (PROBLEMA): ${duplicados.length}`);

  if (duplicados.length > 0) {
    console.log("\n=== Contratos com múltiplas parcelas em Março (causando inflação) ===");
    let overcount = 0;
    for (const d of duplicados.sort((a,b) => a.client.localeCompare(b.client))) {
      const bruto = (d.value * 0.04) / 12;
      const extraParcelas = d.parcelas.length - 1;
      overcount += extraParcelas * bruto * 0.847;
      console.log(`${d.client.padEnd(40)} | R$${String(Math.round(d.value)).padStart(7)} | closedAt: ${new Date(d.closedAt).toISOString().split('T')[0]} | parcelas: [${d.parcelas.join(',')}]`);
    }
    console.log(`\nInflação total gerada pelas parcelas extras: R$ ${overcount.toFixed(2)}`);
  }

  // Verificar as datas exatas das parcelas problemáticas
  console.log("\n=== Datas exatas das parcelas em março para BRUCE MARION ===");
  const bruceInsts = marchInsts.filter(i => i.sale.clientName.includes("BRUCE"));
  for (const inst of bruceInsts) {
    console.log(`  SaleId: ${inst.saleId.substring(0,8)}... | Parcela ${inst.parcelaNumero}/12 | Vencimento: ${new Date(inst.dataVencimento).toISOString().split('T')[0]} | closedAt: ${new Date(inst.sale.closedAt).toISOString().split('T')[0]}`);
  }

  console.log("\n=== Datas exatas das parcelas em março para DANIEL DE CASTRO ===");
  const danielInsts = marchInsts.filter(i => i.sale.clientName.includes("DANIEL"));
  for (const inst of danielInsts) {
    console.log(`  SaleId: ${inst.saleId.substring(0,8)}... | Parcela ${inst.parcelaNumero}/12 | Vencimento: ${new Date(inst.dataVencimento).toISOString().split('T')[0]} | closedAt: ${new Date(inst.sale.closedAt).toISOString().split('T')[0]}`);
  }

  // Listar todos os saleIds do DANIEL para ver se existem mesmo contratos diferentes
  console.log("\n=== Todas as vendas de DANIEL DE CASTRO no DB ===");
  const danielSales = await p.sale.findMany({
    where: { clientName: { contains: "DANIEL DE CASTRO" } },
    include: { installments: { orderBy: { parcelaNumero: "asc" }, take: 3 } },
    orderBy: { closedAt: "asc" },
  });
  for (const s of danielSales) {
    const primeiraInst = s.installments[0];
    console.log(`  ID: ${s.id.substring(0,8)}... | R$${Math.round(s.value)} | closedAt: ${new Date(s.closedAt).toISOString().split('T')[0]} | ${s.installments.length} parcelas | 1ª parc: ${primeiraInst ? new Date(primeiraInst.dataVencimento).toISOString().split('T')[0] : 'n/a'}`);
  }

  // Resumo da raiz do problema
  console.log("\n=== RESUMO ===");
  console.log(`Total instâncias em março (sistema):   ${marchInsts.length}`);
  console.log(`Contratos únicos com parcela em março: ${porVenda.size}`);
  console.log(`Média de parcelas/contrato em março:   ${(marchInsts.length / porVenda.size).toFixed(2)}`);
  console.log(`\nSe cada contrato tivesse 1 parcela: ${porVenda.size} × avg_comm ≈ R$${(43847.81 * (porVenda.size / marchInsts.length * 2)).toFixed(0)} (estimativa)`);
  console.log(`\nPDF real: R$ 43.847,81`);
  console.log(`Sistema:  R$ 93.701,20`);
  console.log(`Ratio:    ${(93701.20 / 43847.81).toFixed(2)}x`);
}

main()
  .catch(e => { console.error("ERRO:", e.message); process.exit(1); })
  .finally(() => p.$disconnect());
