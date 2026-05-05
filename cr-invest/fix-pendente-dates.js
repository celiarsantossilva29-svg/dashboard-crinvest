/**
 * fix-pendente-dates.js
 * Corrige datas de vencimento das parcelas PENDENTE que ficaram erradas
 * por causa do bug setMonth() overflow (ex: Jan31+1mês = Mar3 em vez de Fev1).
 *
 * Lógica correta: parcela N vence no dia 1 do mês (closedAt.month + N-1).
 * Execute: node fix-pendente-dates.js
 * Use --dry-run para simular sem alterar o banco.
 */

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

// UTC-safe: 1º do mês (closedAt.month + n)
function addMonthsSafe(date, n) {
  const m = date.getUTCMonth() + n;
  return new Date(Date.UTC(
    date.getUTCFullYear() + Math.floor(m / 12),
    ((m % 12) + 12) % 12,
    1
  ));
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN (nenhuma alteração será gravada) ===" : "=== CORRIGINDO DATAS PENDENTES ===\n");

  // Buscar todas as parcelas PENDENTE com info da venda
  const pendentes = await p.installment.findMany({
    where: { status: "PENDENTE" },
    include: { sale: { select: { closedAt: true, clientName: true } } },
    orderBy: [{ sale: { clientName: "asc" } }, { parcelaNumero: "asc" }],
  });

  console.log(`Parcelas PENDENTE encontradas: ${pendentes.length}\n`);

  let fixed = 0, skipped = 0, errors = 0;
  const updates = [];

  for (const inst of pendentes) {
    const closedAt = new Date(inst.sale.closedAt);
    const correctDate = addMonthsSafe(closedAt, inst.parcelaNumero - 1);
    const currentDate = new Date(inst.dataVencimento);

    const currentYYYYMM = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth()+1).padStart(2,"0")}`;
    const correctYYYYMM = `${correctDate.getUTCFullYear()}-${String(correctDate.getUTCMonth()+1).padStart(2,"0")}`;

    if (currentYYYYMM === correctYYYYMM) {
      skipped++;
      continue; // mês correto, não precisa corrigir
    }

    const clientShort = inst.sale.clientName.substring(0, 25).padEnd(25);
    console.log(`  ${clientShort} | P${inst.parcelaNumero} | ${currentDate.toISOString().split("T")[0]} → ${correctDate.toISOString().split("T")[0]}`);
    updates.push({ id: inst.id, dataVencimento: correctDate });
    fixed++;
  }

  console.log(`\nParcelas a corrigir: ${fixed}`);
  console.log(`Parcelas já corretas: ${skipped}`);

  if (fixed === 0) {
    console.log("\nNenhuma data precisa de correção.");
    return;
  }

  if (DRY_RUN) {
    console.log("\n(Dry run — nenhuma alteração gravada)");
    return;
  }

  console.log("\nAplicando correções...");
  for (const u of updates) {
    try {
      await p.installment.update({
        where: { id: u.id },
        data:  { dataVencimento: u.dataVencimento },
      });
    } catch (e) {
      errors++;
      console.error(`  Erro ao atualizar ${u.id}: ${e.message}`);
    }
  }

  console.log(`\n✓ ${fixed - errors} datas corrigidas. ${errors} erros.`);
}

main()
  .catch(e => { console.error("ERRO:", e.message); process.exit(1); })
  .finally(() => p.$disconnect());
