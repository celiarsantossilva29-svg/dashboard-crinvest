/**
 * confirm-historico.js
 * Marca como PAGO todas as parcelas PENDENTE com vencimento até 31/03/2026.
 * Garante que o gráfico de projeção reflita os recebimentos reais confirmados pelos PDFs.
 * Não toca em INADIMPLENTE nem CANCELADO.
 */

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

// Última competência recebida = 03/2026 → parcelas até 31/03/2026
const CUTOFF = new Date("2026-03-31T23:59:59.000Z");

async function main() {
  // Preview antes de alterar
  const pendentes = await p.installment.count({
    where: {
      dataVencimento: { lte: CUTOFF },
      pago: false,
      status: "PENDENTE",
    },
  });

  const inadimplentes = await p.installment.count({
    where: {
      dataVencimento: { lte: CUTOFF },
      status: "INADIMPLENTE",
    },
  });

  const cancelados = await p.installment.count({
    where: {
      dataVencimento: { lte: CUTOFF },
      status: "CANCELADO",
    },
  });

  const japagas = await p.installment.count({
    where: {
      dataVencimento: { lte: CUTOFF },
      status: "PAGO",
    },
  });

  console.log("=== Preview ===");
  console.log(`Já pagas (PAGO):        ${japagas}`);
  console.log(`A confirmar (PENDENTE): ${pendentes}  ← serão marcadas como PAGO`);
  console.log(`Mantidas (INADIMPLENTE): ${inadimplentes}  ← não alteradas`);
  console.log(`Mantidas (CANCELADO):    ${cancelados}  ← não alteradas`);

  if (pendentes === 0) {
    console.log("\nNenhuma parcela pendente para confirmar. Tudo certo!");
    return;
  }

  console.log(`\nConfirmando ${pendentes} parcelas como PAGO...`);

  const result = await p.installment.updateMany({
    where: {
      dataVencimento: { lte: CUTOFF },
      pago: false,
      status: "PENDENTE",
    },
    data: {
      pago: true,
      status: "PAGO",
      // dataPagamento = dataVencimento (aproximação — Porto Seguro paga no mês seguinte)
      dataPagamento: null, // mantém null para não falsificar data exata
    },
  });

  console.log(`\n✅ ${result.count} parcelas confirmadas como PAGO.`);

  // Resumo por mês para verificar
  const porMes = await p.$queryRaw`
    SELECT
      DATE_TRUNC('month', "dataVencimento") AS mes,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'PAGO') AS pagas,
      COUNT(*) FILTER (WHERE status = 'INADIMPLENTE') AS inadimplentes
    FROM "Installment"
    WHERE "dataVencimento" <= ${CUTOFF}
    GROUP BY 1
    ORDER BY 1
  `;

  console.log("\n=== Resumo por mês após confirmação ===");
  porMes.forEach(row => {
    const mes = new Date(row.mes).toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
    console.log(`${mes}: ${row.pagas}/${row.total} pagas | ${row.inadimplentes} inadimplentes`);
  });
}

main()
  .catch(e => { console.error("ERRO:", e.message); process.exit(1); })
  .finally(() => p.$disconnect());
