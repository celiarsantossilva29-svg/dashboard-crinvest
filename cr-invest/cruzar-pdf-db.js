/**
 * cruzar-pdf-db.js
 * Cruza os clientes que aparecem nos PDFs da Porto Seguro (abr/2025 → abr/2026)
 * com as Sales cadastradas no banco de dados.
 *
 * Saída:
 *   - Clientes PDF → status no DB (cadastrado | CPF diferente | ausente)
 *   - Sales no DB sem nenhum CPF que bata nos PDFs
 *
 * Execute: node cruzar-pdf-db.js
 */

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

// ── Clientes únicos extraídos dos PDFs (CPF → nome canônico) ─────────────────
const PDF_CLIENTS = [
  { cpf: "021.396.197-06", nome: "ANDRE LUIS DE OLIVEIRA VALLADAS" },
  { cpf: "093.191.227-09", nome: "ANDRE MACENA DE MORAES" },
  { cpf: "280.784.465-00", nome: "ANGELA MARIA ROSA DA SILVA SANTOS" },
  { cpf: "098.266.667-50", nome: "ARTHUR BRUNO FISCHER" },
  { cpf: "250.453.138-94", nome: "CARLA CRISTINA FERREIRA QUIRINO DA SILVA" },
  { cpf: "951.881.932-72", nome: "CLAUDIO ALECSON SANTOS ROCA" },
  { cpf: "355.535.508-23", nome: "DIEGO FREIRE SANTOS" },
  { cpf: "345.084.518-70", nome: "EDSON FERREIRA DE SOUZA JUNIOR" },
  { cpf: "410.473.828-06", nome: "EDUARDO LOPES TROMBINI" },
  { cpf: "097.748.778-45", nome: "FABIO AUGUSTO DE OLIVEIRA CASTRO" },
  { cpf: "265.567.234-87", nome: "FABIO CORREIA DE VASCONCELOS" },
  { cpf: "119.734.114-58", nome: "GABRIEL LOPES VANDERLEI" },
  { cpf: "640.484.974-72", nome: "HUMBERTO DE AQUINO ANGELIM FILHO" },
  { cpf: "430.105.748-00", nome: "JOAO VITOR GASPAR" },
  { cpf: "357.812.138-05", nome: "LUCIANO FERREIRA DE OLIVEIRA" },
  { cpf: "635.711.451-00", nome: "MARLENE DE FATIMA DA SILVA" },
  { cpf: "013.670.931-12", nome: "MOACIR THIAGO RODRIGUES CHAVEIRO" },
  { cpf: "822.810.507-00", nome: "NEUSA DOS PRAZERES CARRILHO" },
  { cpf: "062.323.479-35", nome: "PEDRO AUGUSTO RIBEIRO BARBOSA" },
  { cpf: "121.429.848-60", nome: "ROBERTO NAVARRO RODRIGUEZ" },
  { cpf: "838.058.006-06", nome: "SALIANE RIBEIRO" },
  { cpf: "121.113.398-22", nome: "SANDRA NICE DE BARROS RAMOS" },
  { cpf: "711.392.911-73", nome: "SERGIO OLIVEIRA SILVA" },
  { cpf: "368.433.608-40", nome: "VALERIA RENATA DA ROCHA" },
  { cpf: "087.364.957-51", nome: "CHERIL SILVESTRE GOMES" },
  { cpf: "013.242.400-24", nome: "TIAGO TECCHIO" },
  { cpf: "008.534.670-56", nome: "CASSIO BARBISAN" },
  { cpf: "066.326.196-14", nome: "MARCELO DE AGUIAR PEREIRA" },
  { cpf: "380.525.578-01", nome: "MICHEL DA SILVA BARNABE" },
  { cpf: "382.875.238-18", nome: "LAURA ENZ DOS SANTOS" },
  { cpf: "857.494.001-15", nome: "LEILIANE SEVERO DA SILVA" },
  { cpf: "058.207.575-05", nome: "NAIARA EVELIN SOUZA DA SILVA" },
  { cpf: "512.295.788-62", nome: "DHRUV BHATIA" },
  { cpf: "150.706.188-90", nome: "CLAUDIO ROGERIO FERREIRA" },
  { cpf: "393.057.418-78", nome: "MARCELINO DA SILVA LEITE FILHO" },
  { cpf: "007.382.184-56", nome: "MARIANA DE LIMA TOSCANO UCHOA" },
  { cpf: "463.257.068-03", nome: "MARIANA VIANA DA SILVA" },
  { cpf: "352.736.038-70", nome: "MURILO OREGGIA GALVAO" },
  { cpf: "999.964.211-04", nome: "BRUNO RODRIGUES MAGALHAES" },
  { cpf: "703.031.444-16", nome: "JUNIO VINICIUS CASSIANO DA SILVA" },
  { cpf: "080.912.119-02", nome: "WILLIAN APARECIDO PEREIRA" },
  { cpf: "055.737.448-01", nome: "SONG SIN YEUNG" },
  { cpf: "951.095.015-72", nome: "ANDRE LUIZ DE QUEIROZ PEREIRA" },
  { cpf: "138.628.417-31", nome: "ANTONIO FILLIPE ANTUNES PINTO" },
  { cpf: "703.277.811-90", nome: "DIEGO SOUSA SILVA" },
  { cpf: "553.480.171-91", nome: "EDBRES DAVI ALVES RAMOS" },
  { cpf: "371.127.208-85", nome: "MARCIA MARIA DE LIRA" },
  { cpf: "817.787.400-49", nome: "MARCOS EDSON SOCOL" },
  { cpf: "418.400.678-70", nome: "RAPHAEL CARDOSO DA SILVA" },
  { cpf: "175.572.717-85", nome: "RICHARD CLAYDERMAN FARIA DE OLIVEIRA" },
  { cpf: "429.823.138-04", nome: "THAIS PEREIRA DOS SANTOS SILVA" },
  { cpf: "023.935.191-65", nome: "VICENTINA DE PAULA LOPES" },
  { cpf: "271.156.402-97", nome: "WHARPEM MENDES RODRIGUES" },
  { cpf: "011.749.623-56", nome: "DARIO GOMES DE ABREU" },
  { cpf: "076.227.129-90", nome: "EDERSON PEREIRA DE DIAS" },
  { cpf: "031.773.394/0001-44", nome: "SOROBAN CONTABILIDADE LTDA" },
  { cpf: "057.390.704-81", nome: "TATIANA GOMES DA SILVA" },
  { cpf: "166.697.382-34", nome: "JOSE BENEDITO DA COSTA MAGALHAES" },
  { cpf: "365.140.198-70", nome: "LUCAS FELIPE DA SILVA LEMES MEGDA" },
  { cpf: "627.500.036-87", nome: "ANESIO JOSE DE OLIVEIRA" },
  { cpf: "118.481.427-90", nome: "CARLOS PAULO DA SILVA PINTO JUNIOR" },
  { cpf: "817.041.191-20", nome: "DANIEL DE CASTRO RODRIGUES" },
  { cpf: "398.844.338-79", nome: "WELLINGTON NUNES CARDOSO" },
  { cpf: "142.593.888-43", nome: "MARTA LIMA DA SILVA" },
  { cpf: "377.648.148-06", nome: "BRUCE MARION DE OLIVEIRA SILVA" },
  { cpf: "393.622.238-05", nome: "HENRIQUE APARECIDO SOARES" },
  { cpf: "443.463.408-90", nome: "EVERTON GONCALVES DE ARAUJO" },
  { cpf: "313.918.788-25", nome: "CLEITON MARQUES BATISTA" },
  { cpf: "704.057.071-85", nome: "THALIA RODRIGUES DA SILVA" },
  { cpf: "071.461.806-38", nome: "CIRLENE AUGUSTA DE OLIVINO COSTA" },
  { cpf: "277.818.858-48", nome: "LUCIANO SALVINO DA SILVA CESAR" },
  { cpf: "169.783.146-09", nome: "SAMUEL AUGUSTO DE OLIVINO GONCALVES" },
  { cpf: "320.401.838-50", nome: "RUDNEI DIAS TAVARES" },
  { cpf: "085.303.795-78", nome: "VICTOR HUGO DOS SANTOS NASCIMENTO" },
  { cpf: "427.847.828-32", nome: "NEEMIAS SAMUEL MACHADO MACENA" },
  { cpf: "055.163.836-25", nome: "DIEGO HENRIQUE RIBEIRO" },
  { cpf: "008.642.030/0001-03", nome: "AL&DD INDUSTRIA E COMERCIO DE PRODUTOS METALURGICOS LTDA" },
  { cpf: "399.348.508-42", nome: "ANANDA DOMENICI DIAS RAFFI" },
  { cpf: "528.193.701-44", nome: "ALESSANDRA BACON DE OLIVEIRA MOREIRA" },
  { cpf: "441.350.628-65", nome: "LEONARDO DOMENICI DIAS" },
  { cpf: "106.831.426-58", nome: "ISABELLA CECILIA MOREIRA MUNIZ" },
  { cpf: "009.667.589-60", nome: "RAFAELA CRISTHINA TONELLO PEDRO DELORO" },
  { cpf: "078.667.899-24", nome: "SILVIA KRAUS" },
  { cpf: "175.180.057-19", nome: "MARCIO HENRIQUE DA SILVA DINIZ" },
  { cpf: "142.579.736-92", nome: "FABIANA AMARO RIBEIRO TEIXEIRA" },
];

// Normaliza CPF: remove pontos, traços, barras, converte para lowercase
function normCpf(s) {
  return (s || "").replace(/[\.\-\/\s]/g, "").toLowerCase();
}

// Normaliza nome: uppercase, sem acento, espaços simples
function normNome(s) {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  // 1. Busca todas as Sales do banco
  const sales = await p.sale.findMany({
    select: {
      id: true,
      clientName: true,
      clienteCpf: true,
      value: true,
      closedAt: true,
      assignedTo: true,
    },
    orderBy: { closedAt: "asc" },
  });

  console.log(`\n${"=".repeat(70)}`);
  console.log(`  CRUZAMENTO PDF × BANCO DE DADOS`);
  console.log(`  ${PDF_CLIENTS.length} clientes únicos nos PDFs | ${sales.length} Sales no banco`);
  console.log(`${"=".repeat(70)}\n`);

  // Indexa sales por CPF normalizado e por nome normalizado
  const saleByCpf  = new Map(); // normCpf  → sale[]
  const saleByNome = new Map(); // normNome → sale[]

  for (const s of sales) {
    const cpfN  = normCpf(s.clienteCpf);
    const nomeN = normNome(s.clientName);
    if (cpfN) {
      if (!saleByCpf.has(cpfN)) saleByCpf.set(cpfN, []);
      saleByCpf.get(cpfN).push(s);
    }
    if (!saleByNome.has(nomeN)) saleByNome.set(nomeN, []);
    saleByNome.get(nomeN).push(s);
  }

  const pdfCpfsNorm = new Set(PDF_CLIENTS.map(c => normCpf(c.cpf)));

  // ── Parte 1: PDF → DB ──────────────────────────────────────────────────────
  const achados    = [];
  const soNome     = [];
  const ausentes   = [];

  for (const c of PDF_CLIENTS) {
    const cpfN  = normCpf(c.cpf);
    const nomeN = normNome(c.nome);

    if (saleByCpf.has(cpfN)) {
      achados.push({ pdf: c, sales: saleByCpf.get(cpfN) });
    } else if (saleByNome.has(nomeN)) {
      soNome.push({ pdf: c, sales: saleByNome.get(nomeN) });
    } else {
      ausentes.push(c);
    }
  }

  // ── Parte 2: DB → PDF (sales sem CPF correspondente no PDF) ───────────────
  const dbSemPdf = sales.filter(s => {
    const cpfN = normCpf(s.clienteCpf);
    const nomeN = normNome(s.clientName);
    const cpfBate  = cpfN  && pdfCpfsNorm.has(cpfN);
    const nomeBate = [...pdfCpfsNorm].some(() => false) || // placeholder
      PDF_CLIENTS.some(c => normNome(c.nome) === nomeN);
    return !cpfBate && !nomeBate;
  });

  // ── Exibe resultados ───────────────────────────────────────────────────────

  console.log(`✅  ENCONTRADOS NO BANCO POR CPF (${achados.length}/${PDF_CLIENTS.length})\n`);
  for (const { pdf, sales: ss } of achados) {
    for (const s of ss) {
      const dt = s.closedAt.toISOString().slice(0,10);
      console.log(`  ${pdf.cpf}  ${pdf.nome.padEnd(45)} → R$ ${s.value.toLocaleString("pt-BR")}  (fechado ${dt})`);
    }
  }

  if (soNome.length) {
    console.log(`\n⚠️   ENCONTRADOS SÓ POR NOME (CPF diferente ou ausente no banco) (${soNome.length})\n`);
    for (const { pdf, sales: ss } of soNome) {
      for (const s of ss) {
        const dt = s.closedAt.toISOString().slice(0,10);
        console.log(`  PDF CPF: ${pdf.cpf}  DB CPF: ${s.clienteCpf || "(vazio)"}  ${pdf.nome.padEnd(40)} → R$ ${s.value.toLocaleString("pt-BR")}  (fechado ${dt})`);
      }
    }
  }

  if (ausentes.length) {
    console.log(`\n❌  AUSENTES NO BANCO (${ausentes.length}) — pagaram na Porto mas não estão cadastrados\n`);
    for (const c of ausentes) {
      console.log(`  ${c.cpf}  ${c.nome}`);
    }
  }

  if (dbSemPdf.length) {
    console.log(`\n🔍  SALES NO BANCO NÃO ENCONTRADAS NOS PDFs (${dbSemPdf.length})\n`);
    for (const s of dbSemPdf) {
      const dt = s.closedAt.toISOString().slice(0,10);
      console.log(`  ${(s.clienteCpf||"(sem CPF)").padEnd(20)}  ${s.clientName.padEnd(45)} R$ ${s.value.toLocaleString("pt-BR")}  (fechado ${dt})`);
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`  Resumo: ${achados.length} por CPF | ${soNome.length} só nome | ${ausentes.length} ausentes | ${dbSemPdf.length} DB extra`);
  console.log(`${"=".repeat(70)}\n`);
}

main()
  .catch(e => { console.error("ERRO:", e.message); process.exit(1); })
  .finally(() => p.$disconnect());
