const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function parseDateBR(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function normalizeCpf(cpf) {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '');
}

function fmtDate(d) {
  if (!d) return '—';
  return d.toISOString().split('T')[0];
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

  let fixed = 0;
  let skipped = 0;

  for (const row of rows) {
    const cpfXls = normalizeCpf(row['CGC/CPF']);
    const dateXls = row['DATA DE INCLUSÃO'];
    const parsedDate = parseDateBR(dateXls);

    if (!parsedDate || !cpfXls) continue;

    const dbSales = salesByCpf[cpfXls];
    if (!dbSales || dbSales.length === 0) continue;

    const xlsDateStr = fmtDate(parsedDate);

    // Update ALL sales with this CPF to the spreadsheet date
    const allMatch = dbSales.every(s => fmtDate(s.closedAt) === xlsDateStr);
    if (allMatch) {
      skipped++;
      continue;
    }

    // Update all sales with this CPF
    const result = await p.sale.updateMany({
      where: { clienteCpf: row['CGC/CPF'] },
      data: { closedAt: parsedDate }
    });

    console.log(`✓ ${row['NOME']} (${row['CGC/CPF']}): ${dbSales.map(s => fmtDate(s.closedAt)).join(', ')} → ${xlsDateStr} (${result.count} registros)`);
    fixed++;
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`Corrigidos: ${fixed}`);
  console.log(`Já corretos: ${skipped}`);
}

main().catch(console.error).finally(() => p.$disconnect());
