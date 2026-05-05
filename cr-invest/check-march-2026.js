/**
 * check-march-2026.js
 * Diagnostica o que o sistema está computando para março/2026
 * e compara com o PDF que mostra R$43.847,81
 */

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const MARCH_START = new Date("2026-03-01T00:00:00.000Z");
const MARCH_END   = new Date("2026-03-31T23:59:59.999Z");
const NET_FACTOR_PORTO    = 1 - 0.084 - 0.069; // 0.847
const NET_FACTOR_EMBRACON = 1 - 0 - 0.07;      // 0.93

function getNetFactor(adm) {
  if ((adm || "").toLowerCase().includes("embracon")) return NET_FACTOR_EMBRACON;
  return NET_FACTOR_PORTO;
}

async function main() {
  // 1. Todas as parcelas com dataVencimento em março/2026
  const marchInsts = await p.installment.findMany({
    where: {
      dataVencimento: { gte: MARCH_START, lte: MARCH_END },
    },
    include: { sale: { select: { value: true, administradora: true, closedAt: true, clientName: true } } },
    orderBy: { dataVencimento: "asc" },
  });

  console.log(`\n=== Parcelas com vencimento em Março 2026: ${marchInsts.length} ===`);

  // Breakdown por status
  const byStatus = {};
  for (const inst of marchInsts) {
    byStatus[inst.status] = (byStatus[inst.status] || 0) + 1;
  }
  console.log("Por status:", byStatus);

  // 2. Calcular comissão por método do sistema (como o chart faz)
  // Precisa saber quantas parcelas cada sale tem
  const saleIds = [...new Set(marchInsts.map(i => i.saleId))];
  console.log(`\nVendas únicas com parcela em março: ${saleIds.length}`);

  const salesWithInsts = await p.sale.findMany({
    where: { id: { in: saleIds } },
    include: {
      installments: { select: { id: true, status: true } },
    },
  });

  const saleInstCount = {};
  for (const s of salesWithInsts) {
    saleInstCount[s.id] = { total: s.installments.length, adm: s.administradora, value: s.value, clientName: s.clientName };
  }

  // 3. Computar como o chart faz
  let totalRecebido = 0, totalPendente = 0, totalCancelado = 0, totalInadimplente = 0;
  const breakdown = [];

  for (const inst of marchInsts) {
    const saleInfo = saleInstCount[inst.saleId];
    if (!saleInfo) continue;
    const { total, adm, value, clientName } = saleInfo;
    const brutoPerInst = (value * 0.04) / Math.max(1, total);
    const commPerInst  = brutoPerInst * getNetFactor(adm);

    breakdown.push({
      client: clientName,
      value,
      parcNum: inst.parcelaNumero,
      totalParc: total,
      status: inst.status,
      bruto: brutoPerInst,
      comm: commPerInst,
      adm: adm || "Porto Seguro",
    });

    if (inst.status === "CANCELADO") { totalCancelado += commPerInst; continue; }
    if (inst.status === "INADIMPLENTE") { totalInadimplente += commPerInst; continue; }
    if (inst.pago || inst.status === "PAGO") totalRecebido += commPerInst;
    else if (inst.status === "PENDENTE") totalPendente += commPerInst;
  }

  console.log("\n=== Cálculo do sistema para Março 2026 ===");
  console.log(`Recebido (PAGO):        R$ ${totalRecebido.toFixed(2)}`);
  console.log(`Pendente (PENDENTE):    R$ ${totalPendente.toFixed(2)}`);
  console.log(`Inadimplente:           R$ ${totalInadimplente.toFixed(2)}`);
  console.log(`Cancelado (excluído):   R$ ${totalCancelado.toFixed(2)}`);
  console.log(`TOTAL PAGO+PENDENTE:    R$ ${(totalRecebido + totalPendente).toFixed(2)}`);
  console.log(`\nPDF real (março):       R$ 43.847,81`);
  console.log(`Diferença:              R$ ${((totalRecebido + totalPendente) - 43847.81).toFixed(2)}`);

  // 4. Listar os contratos ativos que geram essas parcelas
  console.log("\n=== Detalhamento por contrato (não CANCELADO) ===");
  const active = breakdown.filter(r => r.status !== "CANCELADO");
  active.sort((a, b) => b.comm - a.comm);

  let runTotal = 0;
  for (const r of active) {
    runTotal += r.comm;
    console.log(`${r.client.padEnd(30)} | ${String(r.adm).padEnd(12)} | R$${String(Math.round(r.value)).padStart(8)} | ${r.parcNum}/${r.totalParc} | ${r.status.padEnd(12)} | comm: R$${r.comm.toFixed(2)}`);
  }
  console.log(`\nTotal acumulado: R$ ${runTotal.toFixed(2)}`);

  // 5. Vendas fechadas no ciclo de faturamento de março (23/jan - 22/fev/2026)
  const cycleStart = new Date("2026-01-23T00:00:00.000Z");
  const cycleEnd   = new Date("2026-02-22T23:59:59.999Z");
  const newSalesCycle = await p.sale.count({
    where: { closedAt: { gte: cycleStart, lte: cycleEnd } },
  });
  console.log(`\n=== Vendas fechadas no ciclo de março (23/jan-22/fev): ${newSalesCycle} ===`);
}

main()
  .catch(e => { console.error("ERRO:", e.message); process.exit(1); })
  .finally(() => p.$disconnect());
