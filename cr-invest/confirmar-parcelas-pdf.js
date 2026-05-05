/**
 * confirmar-parcelas-pdf.js
 * Marca como PAGO as parcelas cujos clientes aparecem nos PDFs da Porto Seguro.
 *
 * Lógica:
 *  - Para cada Sale com CPF confirmado nos PDFs (abr/2025 → abr/2026)
 *  - Busca parcelas com dataVencimento dentro desse intervalo que ainda estão PENDENTE
 *  - Marca: status=PAGO, pago=true, dataPagamento=último dia do mês de vencimento
 *
 * Uso:
 *   node confirmar-parcelas-pdf.js           ← dry-run (mostra o que seria feito)
 *   node confirmar-parcelas-pdf.js --confirm  ← executa de verdade
 */

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const DRY_RUN = !process.argv.includes("--confirm");

// ── CPFs confirmados nos PDFs Porto Seguro (abr/2025 → abr/2026) ─────────────
const PDF_CPFS = new Set([
  "02139619706",  // ANDRE LUIS DE OLIVEIRA VALLADAS
  "09319122709",  // ANDRE MACENA DE MORAES
  "28078446500",  // ANGELA MARIA ROSA DA SILVA SANTOS
  "09826666750",  // ARTHUR BRUNO FISCHER
  "25045313894",  // CARLA CRISTINA FERREIRA QUIRINO DA SILVA
  "95188193272",  // CLAUDIO ALECSON SANTOS ROCA
  "35553550823",  // DIEGO FREIRE SANTOS
  "34508451870",  // EDSON FERREIRA DE SOUZA JUNIOR
  "41047382806",  // EDUARDO LOPES TROMBINI
  "09774877845",  // FABIO AUGUSTO DE OLIVEIRA CASTRO
  "26556723487",  // FABIO CORREIA DE VASCONCELOS
  "11973411458",  // GABRIEL LOPES VANDERLEI
  "64048497472",  // HUMBERTO DE AQUINO ANGELIM FILHO
  "43010574800",  // JOAO VITOR GASPAR
  "35781213805",  // LUCIANO FERREIRA DE OLIVEIRA
  "63571145100",  // MARLENE DE FATIMA DA SILVA
  "01367093112",  // MOACIR THIAGO RODRIGUES CHAVEIRO
  "82281050700",  // NEUSA DOS PRAZERES CARRILHO
  "06232347935",  // PEDRO AUGUSTO RIBEIRO BARBOSA
  "12142984860",  // ROBERTO NAVARRO RODRIGUEZ
  "83805800606",  // SALIANE RIBEIRO
  "12111339822",  // SANDRA NICE DE BARROS RAMOS
  "71139291173",  // SERGIO OLIVEIRA SILVA
  "36843360840",  // VALERIA RENATA DA ROCHA
  "08736495751",  // CHERIL SILVESTRE GOMES
  "01324240024",  // TIAGO TECCHIO
  "00853467056",  // CASSIO BARBISAN
  "06632619614",  // MARCELO DE AGUIAR PEREIRA
  "38052557801",  // MICHEL DA SILVA BARNABE
  "38287523818",  // LAURA ENZ DOS SANTOS
  "85749400115",  // LEILIANE SEVERO DA SILVA
  "05820757505",  // NAIARA EVELIN SOUZA DA SILVA
  "51229578862",  // DHRUV BHATIA
  "15070618890",  // CLAUDIO ROGERIO FERREIRA
  "39305741878",  // MARCELINO DA SILVA LEITE FILHO
  "00738218456",  // MARIANA DE LIMA TOSCANO UCHOA
  "46325706803",  // MARIANA VIANA DA SILVA
  "35273603870",  // MURILO OREGGIA GALVAO
  "99996421104",  // BRUNO RODRIGUES MAGALHAES
  "70303144416",  // JUNIO VINICIUS CASSIANO DA SILVA
  "08091211902",  // WILLIAN APARECIDO PEREIRA
  "05573744801",  // SONG SIN YEUNG
  "95109501572",  // ANDRE LUIZ DE QUEIROZ PEREIRA
  "13862841731",  // ANTONIO FILLIPE ANTUNES PINTO
  "70327781190",  // DIEGO SOUSA SILVA
  "55348017191",  // EDBRES DAVI ALVES RAMOS
  "37112720885",  // MARCIA MARIA DE LIRA
  "81778740049",  // MARCOS EDSON SOCOL
  "41840067870",  // RAPHAEL CARDOSO DA SILVA
  "17557271785",  // RICHARD CLAYDERMAN FARIA DE OLIVEIRA
  "42982313804",  // THAIS PEREIRA DOS SANTOS SILVA
  "02393519165",  // VICENTINA DE PAULA LOPES
  "27115640297",  // WHARPEM MENDES RODRIGUES
  "01174962356",  // DARIO GOMES DE ABREU
  "07622712990",  // EDERSON PEREIRA DE DIAS
  "03177339400010", // SOROBAN CONTABILIDADE LTDA (CNPJ)
  "05739070481",  // TATIANA GOMES DA SILVA
  "16669738234",  // JOSE BENEDITO DA COSTA MAGALHAES
  "36514019870",  // LUCAS FELIPE DA SILVA LEMES MEGDA
  "62750003687",  // ANESIO JOSE DE OLIVEIRA
  "11848142790",  // CARLOS PAULO DA SILVA PINTO JUNIOR
  "81704119120",  // DANIEL DE CASTRO RODRIGUES
  "39884433879",  // WELLINGTON NUNES CARDOSO
  "14259388843",  // MARTA LIMA DA SILVA
  "37764814806",  // BRUCE MARION DE OLIVEIRA SILVA
  "39362223805",  // HENRIQUE APARECIDO SOARES
  "44346340890",  // EVERTON GONCALVES DE ARAUJO
  "31391878825",  // CLEITON MARQUES BATISTA
  "70405707185",  // THALIA RODRIGUES DA SILVA
  "07146180638",  // CIRLENE AUGUSTA DE OLIVINO COSTA
  "27781885848",  // LUCIANO SALVINO DA SILVA CESAR
  "16978314609",  // SAMUEL AUGUSTO DE OLIVINO GONCALVES
  "32040183850",  // RUDNEI DIAS TAVARES
  "08530379578",  // VICTOR HUGO DOS SANTOS NASCIMENTO
  "42784782832",  // NEEMIAS SAMUEL MACHADO MACENA
  "05516383625",  // DIEGO HENRIQUE RIBEIRO
  "00864203000103", // AL&DD INDUSTRIA E COMERCIO (CNPJ)
  "39934850842",  // ANANDA DOMENICI DIAS RAFFI
  "52819370144",  // ALESSANDRA BACON DE OLIVEIRA MOREIRA
  "44135062865",  // LEONARDO DOMENICI DIAS
  "10683142658",  // ISABELLA CECILIA MOREIRA MUNIZ
  "00966758960",  // RAFAELA CRISTHINA TONELLO PEDRO DELORO
  "07866789924",  // SILVIA KRAUS
  "17518005719",  // MARCIO HENRIQUE DA SILVA DINIZ
  "14257973692",  // FABIANA AMARO RIBEIRO TEIXEIRA
]);

// Período confirmado: abr/2025 → abr/2026 (inclusive)
const PERIOD_START = new Date("2025-04-01T00:00:00.000Z");
const PERIOD_END   = new Date("2026-04-30T23:59:59.999Z");

function normCpf(s) {
  return (s || "").replace(/[\.\-\/\s]/g, "");
}

async function main() {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  CONFIRMAÇÃO DE PARCELAS — PDFs Porto Seguro Abr/2025 → Abr/2026`);
  console.log(`  Modo: ${DRY_RUN ? "🔍 DRY RUN (sem alterações)" : "✅ EXECUÇÃO REAL"}`);
  console.log(`${"=".repeat(70)}\n`);

  // Busca todas as Sales com CPF
  const sales = await p.sale.findMany({
    where: { clienteCpf: { not: null } },
    select: {
      id: true,
      clientName: true,
      clienteCpf: true,
      closedAt: true,
      assignedTo: true,
      installments: {
        where: {
          status: "PENDENTE",
          dataVencimento: { gte: PERIOD_START, lte: PERIOD_END },
        },
        orderBy: { parcelaNumero: "asc" },
        select: { id: true, parcelaNumero: true, dataVencimento: true, valorParcela: true, status: true },
      },
    },
  });

  // Filtra apenas as Sales cujo CPF está nos PDFs
  const salesComPdf = sales.filter(s => {
    const cpfN = normCpf(s.clienteCpf);
    return PDF_CPFS.has(cpfN);
  });

  // Sales com CPF no PDF mas sem parcelas PENDENTE no período
  const semParcelas = salesComPdf.filter(s => s.installments.length === 0);
  const comParcelas = salesComPdf.filter(s => s.installments.length > 0);

  console.log(`📊 Sales com CPF nos PDFs: ${salesComPdf.length}`);
  console.log(`   ✓ Com parcelas PENDENTE no período: ${comParcelas.length} sales`);
  console.log(`   · Sem parcelas pendentes no período: ${semParcelas.length} sales (já pagas ou fora do range)\n`);

  if (comParcelas.length === 0) {
    console.log("Nenhuma parcela para confirmar. Tudo já foi pago ou não há pendências no período.");
    return;
  }

  let totalParcelas = 0;
  let totalValor = 0;

  for (const sale of comParcelas) {
    console.log(`\n  📋 ${sale.clientName} (CPF: ${sale.clienteCpf})`);
    console.log(`     Closer: ${sale.assignedTo} | Fechado: ${sale.closedAt.toISOString().slice(0,10)}`);

    for (const inst of sale.installments) {
      const mesVenc = inst.dataVencimento.toISOString().slice(0, 7); // YYYY-MM
      console.log(`     Parcela ${String(inst.parcelaNumero).padStart(2,'0')}  venc. ${mesVenc}  R$ ${inst.valorParcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
      totalParcelas++;
      totalValor += inst.valorParcela;
    }
  }

  console.log(`\n${"─".repeat(70)}`);
  console.log(`  Total: ${totalParcelas} parcelas | Valor total: R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  console.log(`${"─".repeat(70)}\n`);

  if (DRY_RUN) {
    console.log(`⚠️  DRY RUN — nenhuma alteração feita.`);
    console.log(`   Para confirmar, execute: node confirmar-parcelas-pdf.js --confirm\n`);
    return;
  }

  // ── EXECUÇÃO REAL ─────────────────────────────────────────────────────────
  console.log("Confirmando parcelas...\n");
  let ok = 0;
  let erros = 0;

  for (const sale of comParcelas) {
    for (const inst of sale.installments) {
      try {
        // dataPagamento = último dia do mês de vencimento
        const dt = inst.dataVencimento;
        const ultimoDia = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));

        await p.installment.update({
          where: { id: inst.id },
          data: {
            status: "PAGO",
            pago: true,
            dataPagamento: ultimoDia,
          },
        });
        ok++;
        process.stdout.write(".");
      } catch (e) {
        erros++;
        console.error(`\nERRO na parcela ${inst.id}: ${e.message}`);
      }
    }
  }

  console.log(`\n\n✅ ${ok} parcelas confirmadas com sucesso.`);
  if (erros > 0) console.log(`❌ ${erros} erros.`);
  console.log();
}

main()
  .catch(e => { console.error("ERRO:", e.message); process.exit(1); })
  .finally(() => p.$disconnect());
