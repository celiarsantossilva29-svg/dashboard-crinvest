const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function excelDateToJS(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d) return null;
  return new Date(Date.UTC(d.y, d.m - 1, d.d));
}

function fmtDate(d) {
  if (!d) return '—';
  return d.toISOString().split('T')[0];
}

function normalizeCpf(cpf) {
  if (!cpf) return '';
  return String(cpf).replace(/\D/g, '');
}

async function main() {
  const wb = XLSX.readFile('C:\\Users\\giova\\OneDrive\\Documents\\RptAnaliseProducao (3).xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const sales = await p.sale.findMany({
    select: { id: true, clientName: true, closedAt: true, value: true, clienteCpf: true }
  });

  // Build lookup: CPF+value -> sale(s)
  const salesByCpfValue = {};
  const salesByCpf = {};
  for (const s of sales) {
    const cpf = normalizeCpf(s.clienteCpf);
    if (!cpf) continue;
    if (!salesByCpf[cpf]) salesByCpf[cpf] = [];
    salesByCpf[cpf].push(s);
    const key = `${cpf}|${s.value}`;
    if (!salesByCpfValue[key]) salesByCpfValue[key] = [];
    salesByCpfValue[key].push(s);
  }

  let fixed = 0;
  let alreadyCorrect = 0;
  let notFound = 0;
  const processedIds = new Set();

  for (const row of rows) {
    const cpf = normalizeCpf(row['CPF/CNPJ']);
    const vigencia = excelDateToJS(row['INÍCIO DE VIGÊNCIA']);
    const premio = row['PRÊMIO'];

    if (!cpf || !vigencia) continue;

    const vigDateStr = fmtDate(vigencia);

    // Try exact match: CPF + value
    const key = `${cpf}|${premio}`;
    let matches = salesByCpfValue[key];

    if (!matches || matches.length === 0) {
      // Try just by CPF
      matches = salesByCpf[cpf];
    }

    if (!matches || matches.length === 0) {
      notFound++;
      continue;
    }

    // Find the first unprocessed sale that needs fixing
    for (const sale of matches) {
      if (processedIds.has(sale.id)) continue;
      processedIds.add(sale.id);

      const dbDateStr = fmtDate(sale.closedAt);
      if (dbDateStr === vigDateStr) {
        alreadyCorrect++;
      } else {
        await p.sale.update({
          where: { id: sale.id },
          data: { closedAt: vigencia }
        });
        console.log(`✓ ${row['CLIENTE']} | CPF: ${row['CPF/CNPJ']} | R$ ${premio} | ${dbDateStr} → ${vigDateStr}`);
        fixed++;
      }
      break;
    }
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`Já corretos:  ${alreadyCorrect}`);
  console.log(`Corrigidos:   ${fixed}`);
  console.log(`Não no banco: ${notFound}`);
}

main().catch(console.error).finally(() => p.$disconnect());
