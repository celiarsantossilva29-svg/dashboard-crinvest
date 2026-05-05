// Marca todas as vendas de 2023 e 2024 como FINALIZADO
// Status "FINALIZADO" = comissão já recebida, não conta nos cálculos atuais.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Buscar vendas com closedAt antes de 2025
  const sales = await prisma.sale.findMany({
    where: {
      closedAt: {
        lt: new Date("2025-01-01T00:00:00Z"),
      },
    },
    include: {
      installments: {
        orderBy: { parcelaNumero: "asc" },
      },
    },
    orderBy: { closedAt: "asc" },
  });

  console.log(`\n📋 Vendas com closedAt antes de 2025: ${sales.length}`);

  let totalParcelas = 0;
  let parcelasPendentes = 0;

  for (const sale of sales) {
    const year = sale.closedAt.getFullYear();
    const pending = sale.installments.filter(
      (i) => i.status !== "FINALIZADO" && i.status !== "CANCELADO"
    );
    totalParcelas += sale.installments.length;
    parcelasPendentes += pending.length;

    if (pending.length > 0) {
      console.log(
        `  → ${sale.clientName} (${year}) | ${sale.installments.length} parcelas | ${pending.length} a finalizar | Admin: ${sale.administradora || "N/A"}`
      );
    }
  }

  console.log(`\n📊 Total de parcelas: ${totalParcelas}`);
  console.log(`⏳ Parcelas a finalizar: ${parcelasPendentes}`);

  if (dryRun) {
    console.log("\n🔍 Modo --dry-run: nenhuma alteração feita.");
    return;
  }

  // Atualizar todas as parcelas dessas vendas para FINALIZADO
  const result = await prisma.installment.updateMany({
    where: {
      sale: {
        closedAt: {
          lt: new Date("2025-01-01T00:00:00Z"),
        },
      },
      status: { notIn: ["FINALIZADO", "CANCELADO"] },
    },
    data: {
      pago: true,
      status: "FINALIZADO",
      observacoes: "Comissão já recebida - vendas 2023/2024 finalizadas automaticamente",
    },
  });

  console.log(`\n✅ ${result.count} parcelas marcadas como FINALIZADO.`);
  console.log(`   (Status FINALIZADO não entra nos cálculos de comissão)`);
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
