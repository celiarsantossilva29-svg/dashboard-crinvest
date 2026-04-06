const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'src', 'database.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

data.PagamentosClientes.forEach(p => {
    // Force day 14
    const parts = p.data_vencimento.split('-');
    if (parts.length === 3) {
        parts[2] = '14';
        p.data_vencimento = parts.join('-');
    }
});

fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
console.log('Todas as datas de vencimento foram migradas para o dia 14.');
