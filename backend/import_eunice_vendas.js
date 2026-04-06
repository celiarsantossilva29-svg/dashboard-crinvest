const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { calcularParcelas, gerarPeriodoComissao } = require('./src/functions/comissoes');

const dbPath = path.resolve(__dirname, 'src/database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Read config directly from DB
const config = {};
db.Configuracoes.forEach(r => { config[r.chave] = parseFloat(r.valor); });

function calcularTierSync(totalVendido) {
    if (totalVendido > config.TIER_PRATA_MAX) {
        return { tier: "Ouro", percentualCloser: config.PERCENTUAL_CLOSER_OURO, percentualSDR: config.PERCENTUAL_SDR_OURO };
    } else if (totalVendido > config.TIER_BRONZE_MAX) {
        return { tier: "Prata", percentualCloser: config.PERCENTUAL_CLOSER_PRATA, percentualSDR: config.PERCENTUAL_SDR_PRATA };
    } else {
        return { tier: "Bronze", percentualCloser: config.PERCENTUAL_CLOSER_BRONZE, percentualSDR: config.PERCENTUAL_SDR_BRONZE };
    }
}

// 1. Create Cauê (SDR) if not exists
let caue = db.Usuarios.find(u => u.role === 'SDR' && u.nome && u.nome.toLowerCase().includes('cau'));
if (!caue) {
    caue = { id: uuidv4(), nome: 'Cauê', email: 'caue@crinvest.com', senha_hash: bcrypt.hashSync('password', 10), role: 'SDR', fixo_mensal: 0, created_at: new Date().toISOString() };
    db.Usuarios.push(caue);
    console.log('Cauê (SDR) criado:', caue.id);
}

// 2. Create Célia (CLOSER) if not exists
let celia = db.Usuarios.find(u => u.role === 'CLOSER' && u.nome && u.nome.toLowerCase().includes('lia'));
if (!celia) {
    celia = { id: uuidv4(), nome: 'Célia', email: 'celia@crinvest.com', senha_hash: bcrypt.hashSync('password', 10), role: 'CLOSER', fixo_mensal: 0, created_at: new Date().toISOString() };
    db.Usuarios.push(celia);
    console.log('Célia (CLOSER) criada:', celia.id);
}

const eunice = db.Usuarios.find(u => u.role === 'CLOSER' && u.nome && u.nome.toLowerCase().includes('unice'));
console.log('Eunice:', eunice.id);
console.log('Cauê:', caue.id);

const vendas = [
    { cliente_nome: 'Daniela Fonseca', cliente_cpf: '', data_fechamento: '2026-02-27', valor_venda: 1000000, administradora: 'Embracon', promocao: 1, closer_id: eunice.id, sdr_id: caue.id },
    { cliente_nome: 'Gislayde Ribas', cliente_cpf: '', data_fechamento: '2026-02-27', valor_venda: 450000, administradora: 'Porto Seguro', promocao: 1, closer_id: eunice.id, sdr_id: caue.id },
    { cliente_nome: 'Isabella Muniz', cliente_cpf: '', data_fechamento: '2026-02-27', valor_venda: 740000, administradora: 'Porto Seguro', promocao: 1, closer_id: eunice.id, sdr_id: caue.id },
];

for (const v of vendas) {
    const vendaId = uuidv4();
    const tierInfo = calcularTierSync(v.valor_venda);
    const valor_comissao_total_closer = v.valor_venda * tierInfo.percentualCloser;
    const valor_comissao_total_sdr = v.sdr_id ? (v.valor_venda * tierInfo.percentualSDR) : 0;

    db.Vendas.push({
        id: vendaId, lead_id: null, data_fechamento: v.data_fechamento, cliente_nome: v.cliente_nome,
        cliente_cpf: v.cliente_cpf, promocao: v.promocao, closer_id: v.closer_id, sdr_id: v.sdr_id,
        valor_venda: v.valor_venda, administradora: v.administradora, tier_closer: tierInfo.tier,
        percentual_closer: tierInfo.percentualCloser, valor_comissao_total_closer,
        percentual_sdr: tierInfo.percentualSDR, valor_comissao_total_sdr, created_at: new Date().toISOString()
    });

    const parcelasCloser = calcularParcelas(valor_comissao_total_closer);
    const valorParcelaCliente = v.valor_venda / 12;
    let d = new Date(v.data_fechamento);

    for (let i = 0; i < 12; i++) {
        d.setMonth(d.getMonth() + 1);
        const dataVencimento = d.toISOString().split('T')[0];
        const pagamentoClienteId = uuidv4();

        db.PagamentosClientes.push({ id: pagamentoClienteId, venda_id: vendaId, parcela_numero: i + 1, data_vencimento: dataVencimento, valor_parcela: valorParcelaCliente, pago: 0, created_at: new Date().toISOString() });

        const pInfo = gerarPeriodoComissao(dataVencimento);
        db.ComissoesClosers.push({ id: uuidv4(), closer_id: v.closer_id, venda_id: vendaId, pagamento_cliente_id: pagamentoClienteId, mes_referencia: pInfo.mesReferencia, valor_parcela_comissao: parcelasCloser[i], status: 'PENDENTE', created_at: new Date().toISOString() });
    }

    if (v.sdr_id) {
        db.ComissoesSDRs.push({ id: uuidv4(), sdr_id: v.sdr_id, venda_id: vendaId, valor_comissao: valor_comissao_total_sdr, status: 'PENDENTE', created_at: new Date().toISOString() });
    }

    console.log(`✅ ${v.cliente_nome} | ${v.administradora} | R$ ${v.valor_venda.toLocaleString('pt-BR')} | Tier: ${tierInfo.tier}`);
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('\n🎉 3 vendas da Eunice + usuários Cauê e Célia inseridos com sucesso!');
