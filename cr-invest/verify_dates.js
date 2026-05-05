const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function parseDateBR(dateStr) {
  if (!dateStr) return null;
  // format: dd/mm/yyyy
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtDate(d) {
  if (!d) return '—';
  return d.toISOString().split('T')[0];
}

function normalizeCpf(cpf) {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '');
}

function normalizeName(name) {
  if (!name) return '';
  return name.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function main() {
  const wb = XLSX.readFile('C:\\Users\\giova\\OneDrive\\Documents\\RptClienteLista - abril.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const sales = await p.sale.findMany({
    select: { id: true, clientName: true, closedAt: true, value: true, clienteCpf: true }
  });

  // Build lookup by CPF
  const salesByCpf = {};
  for (const s of sales) {
    const cpf = normalizeCpf(s.clienteCpf);
    if (cpf) {
      if (!salesByCpf[cpf]) salesByCpf[cpf] = [];
      salesByCpf[cpf].push(s);
    }
  }

  // Build lookup by name
  const salesByName = {};
  for (const s of sales) {
    const name = normalizeName(s.clientName);
    if (!salesByName[name]) salesByName[name] = [];
    salesByName[name].push(s);
  }

  let matched = 0;
  let mismatched = 0;
  let notFound = 0;
  const mismatches = [];

  for (const row of rows) {
    const cpfXls = normalizeCpf(row['CGC/CPF']);
    const nameXls = normalizeName(row['NOME']);
    const dateXls = row['DATA DE INCLUSÃO'];
    const parsedDate = parseDateBR(dateXls);

    if (!parsedDate) continue; // skip rows without date

    // Try match by CPF first, then by name
    let dbSales = salesByCpf[cpfXls];
    if (!dbSales || dbSales.length === 0) {
      dbSales = salesByName[nameXls];
    }

    if (!dbSales || dbSales.length === 0) {
      // not found in DB — skip
      notFound++;
      continue;
    }

    // Compare dates — check if any sale matches the spreadsheet date
    const xlsDateStr = fmtDate(parsedDate);
    
    for (const sale of dbSales) {
      const dbDateStr = fmtDate(sale.closedAt);
      if (dbDateStr === xlsDateStr) {
        matched++;
      } else {
        mismatched++;
        mismatches.push({
          nome: row['NOME'],
          cpf: row['CGC/CPF'],
          dataDB: dbDateStr,
          dataPlanilha: xlsDateStr,
          saleId: sale.id,
          valorDB: sale.value
        });
      }
    }
  }

  console.log('=== RESULTADO DA VERIFICAÇÃO ===');
  console.log(`Matches corretos:     ${matched}`);
  console.log(`Datas divergentes:    ${mismatched}`);
  console.log(`Não encontrados no DB: ${notFound}`);
  console.log('');

  if (mismatches.length > 0) {
    console.log('=== DIVERGÊNCIAS (DB vs Planilha) ===');
    console.log('');
    for (const m of mismatches) {
      console.log(`  ${m.nome}`);
      console.log(`    CPF: ${m.cpf}`);
      console.log(`    DB:       ${m.dataDB}`);
      console.log(`    Planilha: ${m.dataPlanilha}`);
      console.log(`    Valor: ${m.valorDB}`);
      console.log(`    ID: ${m.saleId}`);
      console.log('');
    }
  }
}

main().catch(console.error).finally(() => p.$disconnect());
