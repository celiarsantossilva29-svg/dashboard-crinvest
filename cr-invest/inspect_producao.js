const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function parseDateBR(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(dateStr);
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const str = String(dateStr).trim();
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(Date.UTC(y, m - 1, d));
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
  // Read spreadsheet
  const wb = XLSX.readFile('C:\\Users\\giova\\OneDrive\\Documents\\RptAnaliseProducao (3).xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  console.log('=== COLUNAS DA PLANILHA ===');
  if (rows.length > 0) console.log(Object.keys(rows[0]));
  console.log(`Total linhas: ${rows.length}\n`);

  // Show first 2 rows
  for (let i = 0; i < Math.min(2, rows.length); i++) {
    console.log(`--- Linha ${i+1} ---`);
    const r = rows[i];
    for (const [k, v] of Object.entries(r)) {
      if (v !== '' && v !== 0) console.log(`  ${k}: ${v}`);
    }
  }
}

main().catch(console.error).finally(() => p.$disconnect());
