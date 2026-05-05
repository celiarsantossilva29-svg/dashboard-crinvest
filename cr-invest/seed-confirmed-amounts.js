/**
 * seed-confirmed-amounts.js
 * Grava os valores reais confirmados pelos PDFs da Porto Seguro no AppSetting.
 * Chave: confirmed_YYYY_MM  (mês em que o repasse foi depositado)
 * Valor: valor líquido recebido conforme PDF (Repasse Final)
 *
 * Execute: node seed-confirmed-amounts.js
 */

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const CONFIRMED = [
  { key: "confirmed_2025_04", value: "19147.38",  label: "Abril 2025     (Comp. 03/2025)" },
  { key: "confirmed_2025_05", value: "23567.44",  label: "Maio 2025      (Comp. 04/2025)" },
  { key: "confirmed_2025_06", value: "20212.80",  label: "Junho 2025     (Comp. 05/2025)" },
  { key: "confirmed_2025_07", value: "30944.87",  label: "Julho 2025     (Comp. 06/2025)" },
  { key: "confirmed_2025_08", value: "30038.60",  label: "Agosto 2025    (Comp. 07/2025)" },
  { key: "confirmed_2025_09", value: "34081.09",  label: "Setembro 2025  (Comp. 08/2025)" },
  { key: "confirmed_2025_10", value: "52823.64",  label: "Outubro 2025   (Comp. 09/2025)" },
  { key: "confirmed_2025_11", value: "41618.68",  label: "Novembro 2025  (Comp. 10/2025)" },
  { key: "confirmed_2025_12", value: "45610.21",  label: "Dezembro 2025  (Comp. 11/2025)" },
  { key: "confirmed_2026_01", value: "45559.62",  label: "Janeiro 2026   (Comp. 12/2025)" },
  { key: "confirmed_2026_02", value: "45559.62",  label: "Fevereiro 2026 (Comp. 01/2026)" },
  { key: "confirmed_2026_03", value: "43847.81",  label: "Março 2026     (Comp. 02/2026)" },
  { key: "confirmed_2026_04", value: "50714.15",  label: "Abril 2026     (Comp. 03/2026)" },
];

async function main() {
  console.log("Gravando valores confirmados por PDF no AppSetting...\n");

  for (const entry of CONFIRMED) {
    await p.appSetting.upsert({
      where:  { key: entry.key },
      update: { value: entry.value },
      create: { key: entry.key, value: entry.value },
    });
    console.log(`  ✓  ${entry.label}  →  R$ ${Number(entry.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  }

  console.log(`\n${CONFIRMED.length} registros salvos com sucesso.`);
}

main()
  .catch(e => { console.error("ERRO:", e.message); process.exit(1); })
  .finally(() => p.$disconnect());
