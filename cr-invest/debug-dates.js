const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/giova/Downloads/Controle Comissão - CR Invest.xlsx');
const sheet = wb.Sheets['ABR-2026'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
const hi = rows.findIndex(r => r && r.some(c => String(c||'').toLowerCase().includes('cpf')));
console.log('Header row index:', hi);
if (hi > -1) {
  const headers = rows[hi].map(c => String(c||'').trim().toLowerCase());
  console.log('Headers:', headers);
  const iIni = headers.findIndex(c => c.includes('início') || c.includes('inicio'));
  const iFim = headers.findIndex(c => c.includes('término') || c.includes('termino'));
  console.log('iIni:', iIni, 'iFim:', iFim);
  for(let i=hi+1; i<hi+5; i++) {
    const r = rows[i];
    if(!r) continue;
    console.log(r[1], 'Inicio:', r[iIni], 'Fim:', r[iFim], typeof r[iIni], typeof r[iFim]);
  }
}
