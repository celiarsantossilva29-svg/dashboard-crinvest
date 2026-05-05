const XLSX = require('xlsx');

async function main() {
  const wb1 = XLSX.readFile('C:/Users/giova/OneDrive/Documents/RptClienteLista.xlsx');
  const clientes = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);
  
  const samueis = clientes.filter(c => (c['NOME'] || c['CLIENTE'] || '').toString().toUpperCase().includes('SAMUEL'));
  samueis.forEach(s => {
    console.log(`NOME: ${s['NOME'] || s['CLIENTE']}`);
    console.log(`SITUAÇÃO: ${s['SITUAÇÃO']}`);
    console.log(`Cancelou?: ${s['Cancelou?']}`);
    console.log(`Cancelou?_1: ${s['Cancelou?_1']}`);
    console.log('---');
  });
}

main().catch(console.error);
