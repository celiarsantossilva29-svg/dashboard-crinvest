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

  // Check what the spreadsheet says for these 3 clients
  const targets = ['NEIDER', 'JEFERSON', 'NIVALDO'];
  
  for (const name of targets) {
    console.log(`\n=== ${name} na PLANILHA ===`);
    const xlsRows = rows.filter(r => String(r['CLIENTE']).toUpperCase().includes(name));
    for (const r of xlsRows) {
      const vig = excelDateToJS(r['INÍCIO DE VIGÊNCIA']);
      console.log(`  ${r['CLIENTE']} | CPF: ${r['CPF/CNPJ']} | Produto: ${r['NOME ABREVIADO DO PRODUTO']} | Valor: ${r['PRÊMIO']} | Vigência: ${fmtDate(vig)} | Proposta: ${r['PROPOSTA']}`);
    }
  }

  // Check what's in DB
  for (const name of targets) {
    console.log(`\n=== ${name} no BANCO ===`);
    const dbSales = await p.sale.findMany({
      where: { clientName: { contains: name } },
      select: { id: true, clientName: true, closedAt: true, value: true, clienteCpf: true, produto: true, administradora: true },
    });
    for (const s of dbSales) {
      console.log(`  ${s.clientName} | CPF: ${s.clienteCpf} | Produto: ${s.produto} | Valor: ${s.value} | Data: ${fmtDate(s.closedAt)} | ID: ${s.id}`);
    }
  }
}

main().catch(console.error).finally(() => p.$disconnect());
