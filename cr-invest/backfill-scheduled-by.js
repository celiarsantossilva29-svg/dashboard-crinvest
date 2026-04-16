/**
 * backfill-scheduled-by.js
 *
 * Para leads que têm scheduledAt mas scheduledBy NULL:
 * - Se assignedTo contém "Cauê" → scheduledBy = "Cauê Perpétuo"
 * - Se assignedTo for outro SDR cadastrado → scheduledBy = assignedTo
 * - Se assignedTo for "Célia" (closer) → scheduledBy = "Cauê Perpétuo" (único SDR até agora)
 *
 * Execução: node backfill-scheduled-by.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Busca SDRs cadastrados
  const sdrs = await prisma.vendedor.findMany({
    where: { role: "SDR" },
    select: { nome: true },
  });
  const sdrNames = sdrs.map((s) => s.nome.toLowerCase());

  console.log("SDRs cadastrados:", sdrNames);

  // Leads com scheduledAt mas sem scheduledBy
  const leads = await prisma.lead.findMany({
    where: {
      scheduledAt: { not: null },
      scheduledBy: null,
    },
    select: { id: true, assignedTo: true, scheduledAt: true },
  });

  console.log(`Leads para backfill: ${leads.length}`);

  let updated = 0;
  for (const lead of leads) {
    const assigned = (lead.assignedTo ?? "").toLowerCase();
    let scheduledBy = null;

    // Verifica se assignedTo é um SDR cadastrado (match parcial)
    for (const sdrName of sdrNames) {
      const firstName = sdrName.split(" ")[0];
      if (assigned.includes(firstName) || sdrName.includes(assigned.split(" ")[0])) {
        // Usa o nome canônico do SDR
        scheduledBy = sdrs.find((s) => s.nome.toLowerCase() === sdrName)?.nome ?? null;
        break;
      }
    }

    // Se não é SDR (provavelmente closer como Célia ou outro assignedTo desconhecido):
    // O usuário confirmou que "atualmente só o Cauê agenda" → atribuir ao Cauê historicamente.
    // Quando houver múltiplos SDRs agendando, o syncLeadHistory passará a capturar ev.created_by
    // diretamente do Kommo, eliminando essa ambiguidade.
    if (!scheduledBy) {
      const caue = sdrs.find((s) => s.nome.toLowerCase().includes("cauê") || s.nome.toLowerCase().includes("caue"));
      if (caue) {
        scheduledBy = caue.nome;
      } else {
        console.log(`  [SKIP] Lead ${lead.id} assignedTo="${lead.assignedTo}" — Cauê não encontrado nos SDRs`);
        continue;
      }
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { scheduledBy },
    });
    updated++;
    if (updated % 50 === 0) console.log(`  ${updated} atualizados...`);
  }

  console.log(`Backfill concluído: ${updated} leads atualizados.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
