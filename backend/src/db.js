const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.json');

// Initialize DB schema
let dbData = {
    Usuarios: [],
    Leads: [],
    Vendas: [],
    PagamentosClientes: [],
    ComissoesClosers: [],
    ComissoesSDRs: [],
    Configuracoes: []
};

// Load or create DB File
function loadDb() {
    if (!fs.existsSync(dbPath)) {
        saveDb();
        console.log('Banco de dados JSON criado e inicializado.');
    } else {
        const raw = fs.readFileSync(dbPath, 'utf8');
        dbData = JSON.parse(raw);
        console.log('Banco de dados JSON carregado.');
    }
}

function saveDb() {
    fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));
}

loadDb();

// Seed initial data
if (dbData.Usuarios.length === 0) {
    dbData.Usuarios.push({
        id: uuidv4(),
        nome: 'Administrador',
        email: 'admin@admin.com',
        senha_hash: bcrypt.hashSync('password', 10),
        role: 'ADMIN',
        fixo_mensal: 0,
        meta_vendas: 0,
        created_at: new Date().toISOString()
    });
    saveDb();
}

if (dbData.Configuracoes.length === 0) {
    const configs = [
        ['TIER_BRONZE_MAX', '999999', 'Valor máximo para tier Bronze'],
        ['TIER_PRATA_MAX', '2999999', 'Valor máximo para tier Prata'],
        ['PERCENTUAL_CLOSER_BRONZE', '0.005', '0.5%'],
        ['PERCENTUAL_CLOSER_PRATA', '0.006', '0.6%'],
        ['PERCENTUAL_CLOSER_OURO', '0.007', '0.7%'],
        ['PERCENTUAL_SDR_BRONZE', '0.0007', '0.07%'],
        ['PERCENTUAL_SDR_PRATA', '0.0008', '0.08%'],
        ['PERCENTUAL_SDR_OURO', '0.0009', '0.09%'],
        ['META_EQUIPE_MENSAL', '500000', 'Meta global de faturamento do mês']
    ];
    configs.forEach(c => {
        dbData.Configuracoes.push({
            id: uuidv4(),
            chave: c[0],
            valor: c[1],
            descricao: c[2],
            created_at: new Date().toISOString()
        });
    });
    saveDb();
}

// Emulate simple query interface to match what server.js expects
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        // Simple manual SQL parsing for the specific queries we wrote in server.js
        try {
            if (sql.includes("SELECT * FROM Usuarios WHERE email = ?")) {
                const results = dbData.Usuarios.filter(u => u.email === params[0]);
                return resolve(results);
            }
            if (sql.includes("SELECT id, nome, email, role, fixo_mensal, meta_vendas, created_at FROM Usuarios")) {
                return resolve(dbData.Usuarios.map(u => ({...u, senha_hash: undefined})));
            }
            if (sql.includes("SELECT * FROM Vendas ORDER BY") || sql === "SELECT * FROM Vendas") {
                let res = [...dbData.Vendas];
                res.sort((a,b) => new Date(b.data_fechamento) - new Date(a.data_fechamento));
                return resolve(res);
            }
            if (sql.includes("SELECT v.*, c.nome as closer_nome, s.nome as sdr_nome FROM Vendas v")) {
                let res = dbData.Vendas.map(v => {
                    const closer = dbData.Usuarios.find(u => u.id === v.closer_id);
                    const sdr = dbData.Usuarios.find(u => u.id === v.sdr_id);
                    return { ...v, closer_nome: closer?.nome, sdr_nome: sdr?.nome };
                });
                if (sql.includes("WHERE v.closer_id = ?")) {
                    res = res.filter(v => v.closer_id === params[0]);
                } else if (sql.includes("WHERE v.sdr_id = ?")) {
                    res = res.filter(v => v.sdr_id === params[0]);
                }
                res.sort((a,b) => new Date(b.data_fechamento) - new Date(a.data_fechamento));
                return resolve(res);
            }
            if (sql.includes("PagamentosClientes") && sql.includes("JOIN Vendas v")) {
                let res = dbData.PagamentosClientes.map(p => {
                    const venda = dbData.Vendas.find(v => v.id === p.venda_id);
                    const closer = dbData.Usuarios.find(u => u.id === venda?.closer_id);
                    const comissao = dbData.ComissoesClosers.find(c => c.pagamento_cliente_id === p.id);
                    return { 
                        ...p, 
                        cliente_nome: venda?.cliente_nome, 
                        administradora: venda?.administradora,
                        closer_id: venda?.closer_id,
                        valor_venda: venda?.valor_venda,
                        valor_comissao_total_closer: venda?.valor_comissao_total_closer,
                        data_fechamento: venda?.data_fechamento,
                        valor_parcela_comissao: comissao?.valor_parcela_comissao || 0,
                        closer_nome: closer?.nome || '—'
                    };
                });
                res.sort((a,b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
                return resolve(res);
            }
            if (sql.includes("SELECT c.*, v.cliente_nome FROM ComissoesClosers c JOIN Vendas v ON c.venda_id = v.id")) {
                let res = dbData.ComissoesClosers.map(c => {
                    const venda = dbData.Vendas.find(v => v.id === c.venda_id);
                    return { ...c, cliente_nome: venda?.cliente_nome };
                });
                if (sql.includes("WHERE c.closer_id = ?")) {
                    res = res.filter(c => c.closer_id === params[0]);
                }
                return resolve(res);
            }
            if (sql.includes("SELECT c.*, v.cliente_nome FROM ComissoesSDRs c JOIN Vendas v ON c.venda_id = v.id")) {
                let res = dbData.ComissoesSDRs.map(c => {
                    const venda = dbData.Vendas.find(v => v.id === c.venda_id);
                    return { ...c, cliente_nome: venda?.cliente_nome };
                });
                if (sql.includes("WHERE c.sdr_id = ?")) {
                    res = res.filter(c => c.sdr_id === params[0]);
                }
                return resolve(res);
            }
            if (sql.includes("SELECT sum(valor_venda) as total FROM Vendas")) {
                const total = dbData.Vendas.reduce((acc, val) => acc + val.valor_venda, 0);
                return resolve([{ total }]);
            }
            if (sql.includes("SELECT sum(valor_parcela_comissao) as total FROM ComissoesClosers WHERE status = 'PENDENTE'")) {
                const total = dbData.ComissoesClosers.filter(c => c.status === 'PENDENTE').reduce((acc, val) => acc + val.valor_parcela_comissao, 0);
                return resolve([{ total }]);
            }
            if (sql.includes("SELECT sum(valor_comissao) as total FROM ComissoesSDRs WHERE status = 'PENDENTE'")) {
                const total = dbData.ComissoesSDRs.filter(c => c.status === 'PENDENTE').reduce((acc, val) => acc + val.valor_comissao, 0);
                return resolve([{ total }]);
            }
            if (sql.includes("SELECT tier_closer, count(id) as count FROM Vendas GROUP BY tier_closer")) {
                const counts = {};
                dbData.Vendas.forEach(v => {
                    counts[v.tier_closer] = (counts[v.tier_closer] || 0) + 1;
                });
                const arr = Object.keys(counts).map(tier => ({ tier_closer: tier, count: counts[tier] }));
                return resolve(arr);
            }
            if (sql.includes("SELECT chave, valor FROM Configuracoes")) {
                return resolve(dbData.Configuracoes);
            }
            console.log("Desconhecido SELECT:", sql);
            resolve([]);
        } catch (e) {
            reject(e);
        }
    });
};

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        try {
            if (sql.includes("INSERT INTO Usuarios")) {
                dbData.Usuarios.push({ 
                    id: params[0], 
                    nome: params[1], 
                    email: params[2], 
                    senha_hash: params[3], 
                    role: params[4], 
                    fixo_mensal: params[5], 
                    meta_vendas: params[6] || 0,
                    created_at: new Date().toISOString() 
                });
            } else if (sql.includes("INSERT INTO Vendas")) {
                dbData.Vendas.push({
                    id: params[0], lead_id: params[1], data_fechamento: params[2], cliente_nome: params[3],
                    cliente_cpf: params[4], promocao: params[5],
                    closer_id: params[6], sdr_id: params[7], valor_venda: params[8], administradora: params[9],
                    tier_closer: params[10], percentual_closer: params[11], valor_comissao_total_closer: params[12],
                    percentual_sdr: params[13], valor_comissao_total_sdr: params[14],
                    cliente_telefone: params[15], cliente_cnpj: params[16], cliente_localizacao: params[17],
                    created_at: new Date().toISOString()
                });
            } else if (sql.includes("INSERT INTO PagamentosClientes")) {
                dbData.PagamentosClientes.push({
                    id: params[0], venda_id: params[1], parcela_numero: params[2], data_vencimento: params[3],
                    valor_parcela: params[4], pago: 0, created_at: new Date().toISOString()
                });
            } else if (sql.includes("INSERT INTO ComissoesClosers")) {
                dbData.ComissoesClosers.push({
                    id: params[0], closer_id: params[1], venda_id: params[2], pagamento_cliente_id: params[3],
                    mes_referencia: params[4], valor_parcela_comissao: params[5], status: 'PENDENTE', created_at: new Date().toISOString()
                });
            } else if (sql.includes("INSERT INTO ComissoesSDRs")) {
                dbData.ComissoesSDRs.push({
                    id: params[0], sdr_id: params[1], venda_id: params[2], valor_comissao: params[3],
                    status: 'PENDENTE', created_at: new Date().toISOString()
                });
            } else if (sql.includes("UPDATE PagamentosClientes SET pago = ?, data_pagamento = ? WHERE id = ?")) {
                const p = dbData.PagamentosClientes.find(x => x.id === params[2]);
                if (p) {
                    p.pago = params[0];
                    p.data_pagamento = params[1];
                }
            } else if (sql.includes("UPDATE ComissoesClosers SET status = 'PAGO', data_pagamento_closer = ? WHERE pagamento_cliente_id = ?")) {
                const c = dbData.ComissoesClosers.find(x => x.pagamento_cliente_id === params[1]);
                if (c) {
                    c.status = 'PAGO';
                    c.data_pagamento_closer = params[0];
                }
            } else if (sql.includes("UPDATE Usuarios SET nome = ?, email = ?, role = ?, fixo_mensal = ?, meta_vendas = ? WHERE id = ?")) {
                const u = dbData.Usuarios.find(x => x.id === params[5]);
                if (u) {
                    u.nome = params[0];
                    u.email = params[1];
                    u.role = params[2];
                    u.fixo_mensal = params[3];
                    u.meta_vendas = params[4];
                }
            }
            saveDb();
            resolve();
        } catch (e) {
            reject(e);
        }
    });
};

module.exports = { query, run, saveDb, get dbData() { return dbData; } };
