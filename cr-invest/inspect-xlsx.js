const XLSX = require('xlsx');

// 1. Ler RptClienteLista (dados do cliente + status)
const wb1 = XLSX.readFile('C:/Users/giova/OneDrive/Documents/RptClienteLista.xlsx');
const ws1 = wb1.Sheets[wb1.SheetNames[0]];
const clientes = XLSX.utils.sheet_to_json(ws1, {header:1});
console.log("=== RptClienteLista ===");
console.log("Total rows:", clientes.length);
console.log("Header:", JSON.stringify(clientes[0]));
console.log("Row 1:", JSON.stringify(clientes[1]));
console.log("Row 2:", JSON.stringify(clientes[2]));
console.log("Row 3:", JSON.stringify(clientes[3]));

console.log("\n");

// 2. Ler RptAnaliseProducao (valor das cotas - PRÊMIO)
const wb2 = XLSX.readFile('C:/Users/giova/OneDrive/Documents/RptAnaliseProducao (3).xlsx');
const ws2 = wb2.Sheets[wb2.SheetNames[0]];
const producao = XLSX.utils.sheet_to_json(ws2, {header:1});
console.log("=== RptAnaliseProducao ===");
console.log("Total rows:", producao.length);
console.log("Header:", JSON.stringify(producao[0]));
console.log("Row 1:", JSON.stringify(producao[1]));
console.log("Row 2:", JSON.stringify(producao[2]));
console.log("Row 3:", JSON.stringify(producao[3]));
