const XLSX = require('xlsx');

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

async function main() {
  const wb = XLSX.readFile('C:\\Users\\giova\\OneDrive\\Documents\\RptAnaliseProducao (3).xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const aldd = rows.filter(r => String(r['CLIENTE']).includes('AL&DD'));
  for (const r of aldd) {
    const vig = excelDateToJS(r['INÍCIO DE VIGÊNCIA']);
    console.log(`AL&DD na Planilha: Vigência ${fmtDate(vig)} | Valor: ${r['PRÊMIO']} | Proposta: ${r['PROPOSTA']}`);
  }
}

main();
