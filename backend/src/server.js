const express = require('express');
const cors = require('cors');
const dbHelper = require('./db');
const { v4: uuidv4 } = require('uuid');
const { calcularTier, calcularParcelas, gerarPeriodoComissao } = require('./functions/comissoes');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const kommo = require('./kommo');
const goto = require('./goto');
const tcPlus = require('./threecplus'); // Corrected from tcplus to tcPlus and fixed typo
const gotoApi = require('./goto');
const kommoApi = require('./kommo');
const consolidator = require('./consolidator'); // Moved consolidator import

const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());

// --- GOTO OAUTH ROUTES ---
app.get('/api/goto/auth', (req, res) => {
    res.redirect(gotoApi.getAuthorizationUrl());
});
app.get('/api/goto/login', (req, res) => {
    res.redirect(gotoApi.getAuthorizationUrl());
});

app.get('/api/goto/callback', async (req, res) => {
    try {
        await gotoApi.exchangeCodeForToken(req.query.code);
        res.send('✅ GoTo Connect Autorizado! O token com escopo PBX foi salvo com sucesso. Pode fechar esta aba.');
    } catch(err) {
        res.status(500).send('Erro na autorizacao GoTo: ' + err.message);
    }
});

// Servindo a nova plataforma React compilada diretamente na porta da API
app.use(express.static(path.join(__dirname, '../../frontend-v2/dist')));

const JWT_SECRET = 'antigravity-secret-key-1234';

// Middlewares Auth
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  });
};

const adminMiddleware = (req, res, next) => {
    if (req.userRole !== 'ADMIN') return res.status(403).json({ error: 'Requires admin role' });
    next();
};

// 5.1 Autenticação
app.post('/api/auth/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const rows = await dbHelper.query("SELECT * FROM Usuarios WHERE email = ?", [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'Credenciais inválidas' });
        
        const user = { ...rows[0] }; // Evita apagar a senha_hash do BD em memória
        const validPwd = user.senha_hash 
            ? await bcrypt.compare(senha, user.senha_hash) 
            : senha === user.senha;
        if (!validPwd) return res.status(401).json({ error: 'Credenciais inválidas' });
        
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        
        delete user.senha_hash;
        res.json({ token, user });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.get('/api/usuarios', authMiddleware, adminMiddleware, async (req, res) => {
  const rows = await dbHelper.query("SELECT id, nome, email, role, fixo_mensal, meta_vendas, created_at FROM Usuarios");
  res.json(rows);
});

// Endpoint to create a new Closer or SDR
app.post('/api/usuarios', authMiddleware, adminMiddleware, async (req, res) => {
    const { nome, email, senha, role, fixo_mensal, meta_vendas } = req.body;
    const bcrypt = require('bcryptjs');
    const newId = uuidv4();
    const hash = bcrypt.hashSync(senha, 10);
    try {
        await dbHelper.run('INSERT INTO Usuarios (id, nome, email, senha_hash, role, fixo_mensal, meta_vendas) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [newId, nome, email, hash, role, fixo_mensal || 0, meta_vendas || 0]);
        res.json({ id: newId, nome, email, role });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// Update user (Used by Admin to set Meta/Salary)
app.put('/api/usuarios/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { nome, email, role, fixo_mensal, meta_vendas } = req.body;
    try {
        await dbHelper.run('UPDATE Usuarios SET nome = ?, email = ?, role = ?, fixo_mensal = ?, meta_vendas = ? WHERE id = ?', 
            [nome, email, role, fixo_mensal, meta_vendas, req.params.id]);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// 5.2 Vendas
app.get('/api/vendas', authMiddleware, async (req, res) => {
    let sql = "SELECT v.*, c.nome as closer_nome, s.nome as sdr_nome FROM Vendas v LEFT JOIN Usuarios c ON v.closer_id = c.id LEFT JOIN Usuarios s ON v.sdr_id = s.id";
    let params = [];
    
    // Closer ou SDR so podem ver as próprias
    if (req.userRole === 'CLOSER') {
        sql += " WHERE v.closer_id = ?";
        params.push(req.userId);
    } else if (req.userRole === 'SDR') {
        sql += " WHERE v.sdr_id = ?";
        params.push(req.userId);
    }
    sql += " ORDER BY v.data_fechamento DESC";
    
    try {
        const rows = await dbHelper.query(sql, params);
        res.json(rows);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// WORKFLOW 4.1 "Venda Criada" built-in here
app.post('/api/vendas', authMiddleware, async (req, res) => {
    const { 
        lead_id, data_fechamento, cliente_nome, cliente_cpf, promocao, 
        closer_id, sdr_id, valor_venda, administradora,
        cliente_telefone, cliente_cnpj, cliente_localizacao 
    } = req.body;
    
    // Closer constraints
    const c_id = req.userRole === 'CLOSER' ? req.userId : closer_id;
    
    try {
        // Calculate Tier & Percentages
        // Calculate Tier based on TOTAL monthly volume for this closer
        const mesVenda = data_fechamento.substring(0, 7);
        const totalVendidoMes = dbHelper.dbData.Vendas
            .filter(v => v.closer_id === c_id && v.data_fechamento?.startsWith(mesVenda))
            .reduce((sum, v) => sum + v.valor_venda, 0);
            
        const tierInfo = await calcularTier(dbHelper, totalVendidoMes + valor_venda);
        const valor_comissao_total_closer = valor_venda * tierInfo.percentualCloser;
        const valor_comissao_total_sdr = sdr_id ? (valor_venda * tierInfo.percentualSDR) : 0;
        
        const vendaId = uuidv4();
        
        // Insert Venda
        await dbHelper.run(
            `INSERT INTO Vendas (
                id, lead_id, data_fechamento, cliente_nome, cliente_cpf, promocao, 
                closer_id, sdr_id, valor_venda, administradora, 
                tier_closer, percentual_closer, valor_comissao_total_closer, 
                percentual_sdr, valor_comissao_total_sdr,
                cliente_telefone, cliente_cnpj, cliente_localizacao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                vendaId, lead_id || null, data_fechamento, cliente_nome, cliente_cpf, promocao ? 1 : 0, 
                c_id, sdr_id || null, valor_venda, administradora, 
                tierInfo.tier, tierInfo.percentualCloser, valor_comissao_total_closer, 
                tierInfo.percentualSDR, valor_comissao_total_sdr,
                cliente_telefone || null, cliente_cnpj || null, cliente_localizacao || null
            ]
        );

        // CREATE Parcela cliente & Comissoes Closer (12 times)
        const parcelasCloser = calcularParcelas(valor_comissao_total_closer);
        const valorParcelaCliente = valor_venda / 12; // Supondo q paguem em 12
        let d = new Date(data_fechamento);
        // Regra de negócio: Parcelas vencem sempre no dia 14
        d.setDate(14); 
        
        for (let i = 0; i < 12; i++) {
            d.setMonth(d.getMonth() + 1); // próxima parcela a cada mês
            const dataVencimento = d.toISOString().split('T')[0];
            const pagamentoClienteId = uuidv4();
            
            await dbHelper.run(
                `INSERT INTO PagamentosClientes (id, venda_id, parcela_numero, data_vencimento, valor_parcela) VALUES (?, ?, ?, ?, ?)`,
                [pagamentoClienteId, vendaId, i+1, dataVencimento, valorParcelaCliente]
            );

            // Gerar mes_referencia na data q prevemos a parcela sendo paga
            const pInfo = gerarPeriodoComissao(dataVencimento);
            
            await dbHelper.run(
                `INSERT INTO ComissoesClosers (id, closer_id, venda_id, pagamento_cliente_id, mes_referencia, valor_parcela_comissao) VALUES (?, ?, ?, ?, ?, ?)`,
                [uuidv4(), c_id, vendaId, pagamentoClienteId, pInfo.mesReferencia, parcelasCloser[i]]
            );
        }

        // CREATE Comissao SDR (unica)
        if (sdr_id) {
            await dbHelper.run(
                `INSERT INTO ComissoesSDRs (id, sdr_id, venda_id, valor_comissao, mes_referencia) VALUES (?, ?, ?, ?, ?)`,
                [uuidv4(), sdr_id, vendaId, valor_comissao_total_sdr, data_fechamento.substring(0, 7)]
            );
        }

        res.json({ id: vendaId, message: 'Venda criada e comissões/parcelas geradas com sucesso!' });
        
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// EDIÇÃO DE VENDA (PROTEÇÃO DE PARCELAS PAGAS)
app.put('/api/vendas/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { 
        valor_venda, sdr_id, closer_id, data_fechamento, cliente_nome, administradora,
        cliente_telefone, cliente_cnpj, cliente_localizacao 
    } = req.body;
    const vendaId = req.params.id;

    try {
        console.log("Editando venda:", vendaId, req.body);
        // 1. Recalcular Novo Total de Ganho
        const tierInfo = await calcularTier(dbHelper, valor_venda);
        console.log("Tier Info:", tierInfo);
        const novoTotalCloser = valor_venda * tierInfo.percentualCloser;
        const novoTotalSdr = sdr_id ? (valor_venda * tierInfo.percentualSDR) : 0;

        // 2. Buscar parcelas existentes
        const pgts = dbHelper.dbData.PagamentosClientes.filter(p => p.venda_id === vendaId);
        const coms = dbHelper.dbData.ComissoesClosers.filter(c => c.venda_id === vendaId);

        // 3. Somar o que já foi pago
        const totalJaPago = coms.filter(c => c.status === 'PAGO').reduce((s, c) => s + c.valor_parcela_comissao, 0);
        const saldoRemanescente = Math.max(0, novoTotalCloser - totalJaPago);

        const parcelasPendentes = coms.filter(c => c.status === 'PENDENTE');
        if (parcelasPendentes.length > 0) {
            const novoValorPorParcela = saldoRemanescente / parcelasPendentes.length;
            parcelasPendentes.forEach(p => {
                p.valor_parcela_comissao = novoValorPorParcela;
            });
        }

        // 4. Atualizar valores do cliente (parcelas pendentes)
        const pgtsPendentes = pgts.filter(p => !p.pago);
        if (pgtsPendentes.length > 0) {
            const novoValorPgtoCliente = valor_venda / 12; // Simplificado
            pgtsPendentes.forEach(p => p.valor_parcela = novoValorPgtoCliente);
        }

        // 5. Atualizar registro da Venda principal
        const venda = dbHelper.dbData.Vendas.find(v => v.id === vendaId);
        if (venda) {
            venda.valor_venda = valor_venda;
            venda.sdr_id = sdr_id || null;
            venda.closer_id = closer_id;
            venda.data_fechamento = data_fechamento;
            venda.cliente_nome = cliente_nome;
            venda.administradora = administradora;
            venda.tier_closer = tierInfo.tier;
            venda.percentual_closer = tierInfo.percentualCloser;
            venda.valor_comissao_total_closer = novoTotalCloser;
            venda.percentual_sdr = tierInfo.percentualSDR;
            venda.valor_comissao_total_sdr = novoTotalSdr;
            // Novos campos
            venda.cliente_telefone = cliente_telefone;
            venda.cliente_cnpj = cliente_cnpj;
            venda.cliente_localizacao = cliente_localizacao;
        }

        // 6. Atualizar comissão SDR se mudou valor ou foi excluído
        const comSdr = dbHelper.dbData.ComissoesSDRs.find(s => s.venda_id === vendaId);
        if (comSdr) {
            if (sdr_id) {
                comSdr.sdr_id = sdr_id;
                comSdr.valor_comissao = novoTotalSdr;
            } else {
                // Remover se não tiver mais SDR
                dbHelper.dbData.ComissoesSDRs = dbHelper.dbData.ComissoesSDRs.filter(s => s.venda_id !== vendaId);
            }
        } else if (sdr_id) {
             dbHelper.dbData.ComissoesSDRs.push({
                id: uuidv4(), sdr_id, venda_id: vendaId, valor_comissao: novoTotalSdr, status: 'PENDENTE', created_at: new Date().toISOString()
            });
        }

        dbHelper.saveDb();
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// FINANCEIRO PESSOAL (Fixo + Projeção 12 meses)
app.get('/api/meu-financeiro', authMiddleware, async (req, res) => {
    try {
        const user = dbHelper.dbData.Usuarios.find(u => u.id === req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const fixo = user.fixo_mensal || 0;
        
        let comissoes = [];
        if (req.userRole === 'CLOSER') {
            comissoes = dbHelper.dbData.ComissoesClosers.filter(c => c.closer_id === req.userId);
        } else if (req.userRole === 'SDR') {
            const sdrComs = dbHelper.dbData.ComissoesSDRs.filter(c => c.sdr_id === req.userId);
            comissoes = sdrComs.map(c => {
                const venda = dbHelper.dbData.Vendas.find(v => v.id === c.venda_id);
                return { 
                    valor_parcela_comissao: c.valor_comissao, 
                    mes_referencia: c.mes_referencia || venda?.data_fechamento?.substring(0, 7) || '2024-09' 
                };
            });
        }

        const projecao = {};
        const mesesDisplay = [];
        let d = new Date();
        d.setDate(1);

        for (let i = 0; i < 12; i++) {
            const mesRef = d.toISOString().substring(0, 7);
            projecao[mesRef] = fixo;
            mesesDisplay.push({ id: mesRef, label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) });
            d.setMonth(d.getMonth() + 1);
        }

        comissoes.forEach(c => {
            if (projecao[c.mes_referencia] !== undefined) {
                projecao[c.mes_referencia] += c.valor_parcela_comissao;
            }
        });

        const chartData = mesesDisplay.map(m => ({
            month: m.label,
            total: (projecao[m.id] || 0).toFixed(2),
            fixo: fixo,
            variavel: ((projecao[m.id] || 0) - fixo).toFixed(2)
        }));

        res.json({ chartData, fixo, meta: user.meta_vendas });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.get('/api/pagamentos-clientes', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const rows = await dbHelper.query(`
            SELECT 
                p.*, 
                v.cliente_nome, 
                v.administradora,
                v.closer_id,
                v.valor_venda,
                v.valor_comissao_total_closer,
                v.data_fechamento,
                com.valor_parcela_comissao,
                u.nome as closer_nome
            FROM PagamentosClientes p 
            JOIN Vendas v ON p.venda_id = v.id 
            LEFT JOIN ComissoesClosers com ON p.id = com.pagamento_cliente_id
            LEFT JOIN Usuarios u ON v.closer_id = u.id
            ORDER BY p.data_vencimento ASC
        `);
        res.json(rows);
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

// 5.3 Pagamentos de Clientes (Workflow 4.2 Built-in)
app.put('/api/pagamentos-clientes/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const { pago, data_pagamento } = req.body;
    
    try {
        await dbHelper.run("UPDATE PagamentosClientes SET pago = ?, data_pagamento = ? WHERE id = ?", [pago ? 1 : 0, data_pagamento, id]);
        
        if (pago) {
            // Update closer commission status
            await dbHelper.run("UPDATE ComissoesClosers SET status = 'PAGO', data_pagamento_closer = ? WHERE pagamento_cliente_id = ?", [data_pagamento, id]);
        }
        res.json({ message: 'Pagamento atualizado com sucesso' });
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

// 5.4 Comissoes
app.get('/api/comissoes/closer', authMiddleware, async (req, res) => {
    let closerId = req.query.closerId;
    if (req.userRole === 'CLOSER') closerId = req.userId;
    if (!closerId && req.userRole !== 'ADMIN') return res.status(403).json({error: 'Forbidden'});

    let sql = "SELECT c.*, v.cliente_nome FROM ComissoesClosers c JOIN Vendas v ON c.venda_id = v.id";
    let params = [];
    if (closerId) {
        sql += " WHERE c.closer_id = ?";
        params.push(closerId);
    }
    
    try {
        const rows = await dbHelper.query(sql, params);
        res.json(rows);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.get('/api/comissoes/sdr', authMiddleware, async (req, res) => {
    let sdrId = req.query.sdrId;
    if (req.userRole === 'SDR') sdrId = req.userId;
    if (!sdrId && req.userRole !== 'ADMIN') return res.status(403).json({error: 'Forbidden'});

    let sql = "SELECT c.*, v.cliente_nome FROM ComissoesSDRs c JOIN Vendas v ON c.venda_id = v.id";
    let params = [];
    if (sdrId) {
        sql += " WHERE c.sdr_id = ?";
        params.push(sdrId);
    }
    
    try {
        const rows = await dbHelper.query(sql, params);
        res.json(rows);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// 5.5 Dashboard
app.get('/api/dashboard/admin', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const totalVendasResult = await dbHelper.query("SELECT sum(valor_venda) as total FROM Vendas");
        const comissoesPendentesCloser = await dbHelper.query("SELECT sum(valor_parcela_comissao) as total FROM ComissoesClosers WHERE status = 'PENDENTE'");
        const comissoesPendentesSdr = await dbHelper.query("SELECT sum(valor_comissao) as total FROM ComissoesSDRs WHERE status = 'PENDENTE'");
        
        const closersTier = await dbHelper.query("SELECT tier_closer, count(id) as count FROM Vendas GROUP BY tier_closer");
        let tiersDict = { Bronze: 0, Prata: 0, Ouro: 0 };
        closersTier.forEach(t => tiersDict[t.tier_closer] = t.count);

        res.json({
            totalVendas: totalVendasResult[0]?.total || 0,
            totalComissoesPagar: (comissoesPendentesCloser[0]?.total || 0) + (comissoesPendentesSdr[0]?.total || 0),
            closersPorTier: tiersDict
        });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// 5.6 Métricas Consolidadas (Kommo/3CX/GoTo) - SDR
app.get('/api/metrics/sdr', authMiddleware, async (req, res) => {
    try {
        const { mode, agent, periodo } = req.query; // mode=geral ou agent=ID
        
        // Validação de Segurança
        if (req.userRole === 'SDR') {
            // SDRs só podem ver o próprio modo
            if (mode === 'geral' || (agent && agent !== req.userId)) {
                return res.status(403).json({ error: 'Acesso negado. Você só pode visualizar seu próprio dashboard.' });
            }
        }

        // TODO: Substituir pelas integrações reais:
        // 1. 3CX API para ligacoesFeitas
        // 2. Kommo API para leadsTrabalhados e agendamentos
        // 3. GoTo API para comparecimento e noShow
        
        // Mock data baseado nos parâmetros
        const isGeral = mode === 'geral' && req.userRole === 'ADMIN';
        res.json({
            leadsTrabalhados: isGeral ? 520 : 150,
            ligacoesFeitas: isGeral ? 1800 : 610,
            agendamentos: isGeral ? 84 : 24,
            taxaAgendamento: isGeral ? 16.1 : 16.0,
            comparecimento: isGeral ? 62 : 18,
            noShow: isGeral ? 26.1 : 25.0, // percent
            conversaoLigacao: isGeral ? 4.6 : 3.9,
            ligacoesDiaMeta: isGeral ? 320 : 120,
            ligacoesDiaAtual: isGeral ? 310 : 118,
            agendamentosDiaMeta: isGeral ? 10 : 4,
            agendamentosDiaAtual: isGeral ? 9.5 : 3.8,
            weeklyProduction: isGeral 
              ? [
                  { day: "Seg", ligacoes: 350, agendamentos: 18 },
                  { day: "Ter", ligacoes: 380, agendamentos: 22 },
                  { day: "Qua", ligacoes: 340, agendamentos: 15 },
                  { day: "Qui", ligacoes: 410, agendamentos: 20 },
                  { day: "Sex", ligacoes: 320, agendamentos: 9 }
                ]
              : [
                  { day: "Seg", ligacoes: 125, agendamentos: 5 },
                  { day: "Ter", ligacoes: 132, agendamentos: 6 },
                  { day: "Qua", ligacoes: 118, agendamentos: 4 },
                  { day: "Qui", ligacoes: 140, agendamentos: 7 },
                  { day: "Sex", ligacoes: 95, agendamentos: 2 }
                ]
        });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// 5.7 Métricas Consolidadas (Kommo/GoTo) - CLOSER
app.get('/api/metrics/closer', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date, mode, agent, periodo } = req.query;
        const todayStr = new Date().toISOString().split('T')[0];
        const qEnd = end_date || todayStr;
        const qStart = start_date || (todayStr.substring(0,8) + '01');
        
        if (req.userRole === 'CLOSER') {
            if (mode === 'geral' || (agent && agent !== req.userId)) {
                return res.status(403).json({ error: 'Acesso negado.' });
            }
        }

        const isGeral = mode === 'geral' && req.userRole === 'ADMIN';
        
        // Real data from DB
        let allVendas = await dbHelper.query("SELECT * FROM Vendas ORDER BY data_fechamento DESC");
        
        // Filtro de Data
        allVendas = allVendas.filter(v => {
            if (!v.data_fechamento) return false;
            const refDate = v.data_fechamento.substring(0,10);
            return refDate >= qStart && refDate <= qEnd;
        });

        if (!isGeral) {
            const closerId = agent || req.userId;
            allVendas = allVendas.filter(v => v.closer_id === closerId);
        }

        const vendasFechadas = allVendas.length;
        const faturamento = allVendas.reduce((sum, v) => sum + (v.valor_venda || 0), 0);
        const ticketMedio = vendasFechadas > 0 ? Math.round(faturamento / vendasFechadas) : 0;
        const comissaoTotal = allVendas.reduce((sum, v) => sum + (v.valor_comissao_total_closer || 0), 0);
        
        // TODO: Replace with real Kommo/GoTo integration
        const closerUser = isGeral ? null : dbHelper.dbData.Usuarios.find(u => u.id === (agent || req.userId));

        let reunioesRecebidas = Math.max(vendasFechadas * 4, 1);
        let negociacoesAbertas = Math.round(vendasFechadas * 2.5);

        // INTEGRAÇÃO GOTO: Tenta buscar as reuniões reais do Closer na GoTo
        try {
            if (gotoApi.isAuthenticated()) {
                const today = new Date().toISOString();
                const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
                // Assíncrono com timeout/catch interno
                const gotoData = await gotoApi.getMeetingsHistory(past, today).catch(() => null);
                if (gotoData && Array.isArray(gotoData) && gotoData.length > 0) {
                     // Substituiria aqui a lógica pelas reuniões reais que contém o email do closerUser
                     // let count = gotoData.filter(...).length;
                }
            }
        } catch (e) {
            console.error("GoTo Sync Error:", e.message);
        }

        // REUNIÕES RECEBIDAS (MOCK/GOTO)
        if (closerUser && closerUser.nome === 'Eunice Dias') {
            reunioesRecebidas = 26; // (26 agendamentos enviados na planilha)
        }
        
        // KOMMO: Pipeline da Kommo (Somente VENDAS)
        let kommoPipeline = [];
        try {
            const kommoLeads = await kommoApi.getLeads('limit=250');
            const leadsObj = kommoLeads._embedded?.leads || [];
            
            const now = Date.now() / 1000;
            kommoPipeline = leadsObj
                .filter(l => l.pipeline_id === 11587795 && l.status_id !== 142 && l.status_id !== 143)
                .map(l => {
                    const overdue = l.closest_task_at && l.closest_task_at < now;
                    let etapaLabel = 'Em Negociação';
                    if(l.status_id === 88992835) etapaLabel = '1° Reunião Realizada';
                    if(l.status_id === 88993103) etapaLabel = '2° Reunião AGENDADA';
                    if(l.status_id === 88992843) etapaLabel = 'Reagendamento';

                    return {
                        id: l.id,
                        lead: l.name,
                        etapa: etapaLabel,
                        valor: l.price || 0,
                        tarefaAtrasada: overdue,
                        dias: Math.floor((now - l.created_at) / 86400)
                    };
                });
        } catch (e) {
            console.error("Kommo Sync Error:", e.message);
        }
        negociacoesAbertas = kommoPipeline.length;

        const conversao = reunioesRecebidas > 0 ? (vendasFechadas / reunioesRecebidas) * 100 : 0;

        // Group by month for chart
        const monthMap = {};
        const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        allVendas.forEach(v => {
            const d = new Date(v.data_fechamento);
            const key = `${meses[d.getMonth()]}`;
            if (!monthMap[key]) monthMap[key] = { month: key, vendas: 0, faturamento: 0, comissao: 0 };
            monthMap[key].vendas++;
            monthMap[key].faturamento += v.valor_venda || 0;
            monthMap[key].comissao += v.valor_comissao_total_closer || 0;
        });
        const monthlyPerformance = Object.values(monthMap);

        // Individual vendas list for the table
        const vendasList = allVendas.map(v => ({
            id: v.id,
            cliente_nome: v.cliente_nome,
            cliente_cpf: v.cliente_cpf || '',
            data_fechamento: v.data_fechamento,
            valor_venda: v.valor_venda,
            administradora: v.administradora,
            promocao: v.promocao,
            comissao_closer: v.valor_comissao_total_closer || 0,
            tier: v.tier_closer || 'Bronze'
        }));

        // SALARY PROJECTION: fixo + variável pago + variável pendente
        const vendaIds = new Set(allVendas.map(v => v.id));
        const allComissoes = dbHelper.dbData.ComissoesClosers || [];
        const allPagClientes = dbHelper.dbData.PagamentosClientes || [];
        const relevantComissoes = allComissoes.filter(c => vendaIds.has(c.venda_id));
        
        // Get closer fixo_mensal
        const fixoMensal = closerUser?.fixo_mensal || 0;

        // Build lookup: pagamento_cliente_id -> pago (0 or 1)
        const pagStatusMap = {};
        allPagClientes.forEach(p => { pagStatusMap[p.id] = p.pago; });

        const projMap = {};
        relevantComissoes.forEach(c => {
            const mes = c.mes_referencia || 'Indefinido';
            if (!projMap[mes]) projMap[mes] = { mes, fixo: fixoMensal, variavel_pago: 0, variavel_pendente: 0 };
            const clientePagou = pagStatusMap[c.pagamento_cliente_id];
            if (clientePagou === 1 || c.status === 'PAGO') {
                projMap[mes].variavel_pago += c.valor_parcela_comissao || 0;
            } else {
                projMap[mes].variavel_pendente += c.valor_parcela_comissao || 0;
            }
        });
        
        // Sort projection
        const mesesOrder = {'Janeiro':1,'Fevereiro':2,'Março':3,'Abril':4,'Maio':5,'Junho':6,'Julho':7,'Agosto':8,'Setembro':9,'Outubro':10,'Novembro':11,'Dezembro':12};
        const salaryProjection = Object.values(projMap).sort((a, b) => {
            const [mA, yA] = a.mes.split('/');
            const [mB, yB] = b.mes.split('/');
            return (parseInt(yA)*100 + (mesesOrder[mA]||0)) - (parseInt(yB)*100 + (mesesOrder[mB]||0));
        });

        // Fetch 3C Plus stats if closer has a mapped 3C Plus account
        let stats3c = null;
        if (closerUser) {
            let tcId = null;
            for (const [name3c, nameLocal] of Object.entries(tcPlus.AGENT_MAP_3C_TO_LOCAL)) {
                if (nameLocal === closerUser.nome) {
                    tcId = tcPlus.ACTIVE_AGENTS[name3c];
                    break;
                }
            }
            if (tcId) {
                try {
                    const today = new Date().toISOString().split('T')[0];
                    const monthStart = today.substring(0,8) + '01';
                    const res3c = await tcPlus.getCallStatistics(monthStart, today, tcId);
                    const daily = res3c.data || [];
                    stats3c = {
                        monthCalls: daily.reduce((s,d) => s + (d.answered||0), 0),
                        monthConverted: daily.reduce((s,d) => s + (d.converted||0), 0),
                        monthDMC: daily.reduce((s,d) => s + (d.dmc||0), 0),
                        dailyChart: daily
                    };
                } catch(err) { console.error("3C Plus error for closer:", err.message); }
            }
        }

        res.json({
            vendasFechadas,
            faturamento,
            ticketMedio,
            comissaoTotal,
            negociacoesAbertas,
            reunioesRecebidas,
            conversao,
            monthlyPerformance,
            vendasList,
            salaryProjection,
            stats3c,
            kommoPipeline
        });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// ═══════════════════════════════════════════════
// METRICS - ADMIN UNIFICADO (KOMMO + 3C PLUS + DB)
// ═══════════════════════════════════════════════
app.get('/api/metrics/admin', authMiddleware, async (req, res) => {
    try {
        if (req.userRole !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });

        const { start_date, end_date } = req.query;
        const todayStr = new Date().toISOString().split('T')[0];
        const qEnd = end_date || todayStr;
        const qStart = start_date || (todayStr.substring(0,8) + '01');

        // 1. Obter dados consolidados (3C Plus + GoTo + DB)
        const consolidated = await consolidator.getConsolidatedData(qStart, qEnd);
        const { summary, leads, vendas, dailyStats } = consolidated;

        // 2. Mapeamento de SDR e Closer baseado nos dados reais
        const sdrData = [];
        const closerMap = {};

        // Iniciar Closers conhecidos do mapa de agentes
        Object.values(tcPlus.AGENT_MAP_3C_TO_LOCAL).forEach(name => {
             closerMap[name] = { name, reunioes: 0, vendas: 0, conversao: 0 };
        });

        // Contar vendas reais por Closer vindas do banco de dados (já processadas pelo consolidator)
        vendas.forEach(v => {
            if (!closerMap[v.closer]) {
                closerMap[v.closer] = { name: v.closer, reunioes: 0, vendas: 0, conversao: 0 };
            }
            closerMap[v.closer].vendas++;
        });

        // Ajuste de reuniões baseado em tabulações reais ou histórico conhecido
        // Eunice: Média de 26 agendamentos conforme histórico
        if (closerMap['Eunice Dias']) {
            closerMap['Eunice Dias'].reunioes = 26;
            closerMap['Eunice Dias'].conversao = (closerMap['Eunice Dias'].vendas / 26) * 100;
        } else if (closerMap['Eunice']) {
            closerMap['Eunice'].reunioes = 26;
            closerMap['Eunice'].conversao = (closerMap['Eunice'].vendas / 26) * 100;
        }

        const closerData = Object.values(closerMap);

        // 3. Montar objeto Current
        const current = {
            leads: leads.length || summary.effectiveContacts, // Ajuste para mostrar volume de leads processados
            agendados: summary.scheduled,
            atendidos: summary.meetingHeld,
            vendas: summary.won,
            noShow: summary.noShow,
            faturamento: summary.faturamento,
            ticketMedio: summary.won > 0 ? summary.faturamento / summary.won : 0,
            ligacoesDia: summary.totalCalls,
            agendamentosDia: summary.scheduled > 0 ? Math.ceil(summary.scheduled / 10) : 0, // Estimativa diária
            negociacoesDia: summary.meetingHeld > 0 ? Math.ceil(summary.meetingHeld / 10) : 0
        };

        const goals = { 
            leads: 100, 
            agendados: 50, 
            atendidos: 30, 
            vendas: 10, 
            ligacoesDia: 120, 
            agendamentosDia: 4, 
            negociacoesDia: 4 
        };

        // 4. Pipeline Table (Leads quentes do consolidator que estão em negociação ou agendados)
        const pipelineTable = leads
            .filter(l => l.metrics.scheduled || l.metrics.negociacao)
            .slice(0, 15)
            .map(l => ({
                lead: l.lead_name,
                responsavel: "Equipe Comercial",
                status: l.metrics.won ? 'Ganho' : 'Ativo',
                etapa: l.metrics.negociacao ? 'Em Negociação' : 'Agendado',
                valor: l.price || (summary.won > 0 ? summary.faturamento / summary.won : 500000), // Fallback para ticket médio
                ultimaAcao: 'Tabulação 3C Plus',
                dias: l.timeline.first_contact_at ? Math.floor((Date.now() - new Date(l.timeline.first_contact_at)) / 86400000) : 1
            }));

        res.json({ 
            current, 
            goals, 
            pipelineTable, 
            sdrData: [], // Dashboard SDR usa endpoint próprio, mantido vazio para evitar conflito
            closerData,
            vendasHistoricas: vendas,
            dailyStats
        });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// 5.8 Dashboard de Ciclo Comercial (Novo)
const cycleCache = new Map();

app.get('/api/metrics/cycle', authMiddleware, async (req, res) => {
    try {
        if (req.userRole !== 'ADMIN') return res.status(403).json({ error: 'Acesso negado' });

        const { start_date, end_date } = req.query;
        const goalValue = parseFloat(req.query.goal) || 5000000;
        
        const qStart = start_date;
        const qEnd = end_date;
        const cacheKey = `${goalValue}_${qStart}_${qEnd}`;
        
        // Check local cache
        const cachedResults = cycleCache.get(cacheKey);
        if (cachedResults && (Date.now() - cachedResults.timestamp < 5 * 60 * 1000)) {
            return res.json(cachedResults.data);
        }

        // 1. VENDAS — Direto do DB local (INSTANTÂNEO, sem depender de APIs externas)
        console.log(`[Metrics Cycle] Start fetch: ${qStart} to ${qEnd}`);
        const usuarios = dbHelper.dbData.Usuarios || [];
        const getUserName = (id) => {
            if (!id) return '—';
            const user = usuarios.find(u => u.id === id);
            return user ? user.nome : String(id).substring(0, 8);
        };

        const vendasLocais = (dbHelper.dbData.Vendas || []).filter(v => {
            if (!v.data_fechamento) return false;
            return v.data_fechamento >= qStart && v.data_fechamento <= qEnd;
        });
        const totalFaturamento = vendasLocais.reduce((s, v) => s + (v.valor_venda || 0), 0);
        const totalVendasCount = vendasLocais.length;

        const vendas = vendasLocais.map(v => ({
            cliente: v.cliente_nome,
            valor: v.valor_venda,
            data: v.data_fechamento,
            administradora: v.administradora,
            closer: getUserName(v.closer_id),
            sdr: getUserName(v.sdr_id),
        }));

        console.log(`[Metrics Cycle] Vendas locais: ${totalVendasCount} = ${totalFaturamento}`);
        
        // 2. 3C Plus — Do cache local (INSTANTÂNEO)
        const allCached = tcPlus.getCacheData();
        const daysToGet = [];
        let d = new Date(qStart + 'T00:00:00');
        const dEnd = new Date(qEnd + 'T23:59:59');
        while (d <= dEnd) {
            daysToGet.push(d.toISOString().split('T')[0]);
            d.setDate(d.getDate() + 1);
        }
        const cachedCalls = daysToGet.map(day => allCached[day] || []).flat();
        console.log(`[Metrics Cycle] 3C Plus cache: ${cachedCalls.length} calls`);

        // 3. GoTo — Com timeout rígido de 15s (pode falhar, dashboard continua funcionando)
        let gotoCalls = [];
        try {
            const gotoTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('GoTo Timeout 15s')), 15000));
            const statsGoto = await Promise.race([
                gotoApi.getCallsHistory(qStart, qEnd),
                gotoTimeout
            ]);
            gotoCalls = statsGoto.items || [];
        } catch(e) {
            console.warn('[Metrics Cycle] GoTo indisponível:', e.message);
        }
        console.log(`[Metrics Cycle] GoTo: ${gotoCalls.length} calls`);

        // 4. Processar métricas de chamadas
        const activityCalls = {
            totalCalls: 0,
            sdr: { calls: 0, talkTime: 0, source: 'GoTo' },
            closer: { calls: 0, talkTime: 0, source: '3C Plus', qualifications: {} }
        };

        // SDR — Cauê (GoTo ext 1000/1002)
        gotoCalls.forEach(c => {
            const isCaue = c.caller?.number === '1000' || c.caller?.number === '1002' || 
                           c.callee?.number === '1000' || c.callee?.number === '1002';
            if (isCaue) {
                activityCalls.sdr.calls++;
                activityCalls.sdr.talkTime += (c.duration || 0) / 1000;
            }
        });

        // Closer — Eunice (3C Plus)
        const euniceId = tcPlus.ACTIVE_AGENTS['Eunice Dias'];
        (cachedCalls || []).forEach(c => {
            if (c.agent_id == euniceId) {
                activityCalls.closer.calls++;
                if (c.speaking_time && typeof c.speaking_time === 'string') {
                    const parts = c.speaking_time.split(':');
                    if (parts.length === 3) {
                        activityCalls.closer.talkTime += (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
                    }
                }
                if (c.qualification) {
                    activityCalls.closer.qualifications[c.qualification] = (activityCalls.closer.qualifications[c.qualification] || 0) + 1;
                }
            }
        });

        activityCalls.totalCalls = activityCalls.sdr.calls + activityCalls.closer.calls;

        // Funil: usar tabulações do 3C Plus para agendados/reuniões
        let agendados = 0, reunioes = 0;
        (cachedCalls || []).forEach(c => {
            const q = (c.qualification || '').toLowerCase();
            if (q.includes('retornar') || q.includes('agend') || q.includes('showroom')) agendados++;
            if (q.includes('negocia')) reunioes++;
        });

        // 2. Cálculos de Tempo e Ritmo
        const start = new Date(qStart);
        const end = new Date(qEnd);
        const now = new Date();
        
        const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
        const elapsedDays = Math.max(1, Math.ceil((Math.min(now, end) - start) / (1000 * 60 * 60 * 24)) + 1);
        const remainingDays = Math.max(0, totalDays - elapsedDays);
        
        const currentFaturamento = totalFaturamento;
        const totalVendas = totalVendasCount;
        const remainingGoal = Math.max(0, goalValue - currentFaturamento);
        
        const currentRhythm = currentFaturamento / elapsedDays;
        const requiredRhythm = remainingDays > 0 ? (remainingGoal / remainingDays) : 0;
        const projection = currentRhythm * totalDays;

        // Ticket Médio REAL
        const ticketMedio = totalVendas > 0 ? currentFaturamento / totalVendas : 0;

        // Previsibilidade
        const vendasParaMeta = ticketMedio > 0 ? Math.ceil(remainingGoal / ticketMedio) : 0;
        const vendasPorDia = remainingDays > 0 ? (vendasParaMeta / remainingDays) : 0;
        const vendasRealizadasPorDia = totalVendas / elapsedDays;

        // 3. Performance por Closer no Ciclo
        const closerMap = {};
        vendas.forEach(v => {
            if (!closerMap[v.closer]) closerMap[v.closer] = { name: v.closer, reunioes: 0, vendas: 0, faturamento: 0 };
            closerMap[v.closer].vendas++;
            closerMap[v.closer].faturamento += v.valor || 0;
        });

        Object.values(closerMap).forEach(c => {
            c.reunioes = Math.round(c.vendas * 4); 
            c.conversao = c.reunioes > 0 ? (c.vendas / c.reunioes) * 100 : 0;
        });

        const closerPerformance = Object.values(closerMap).sort((a,b) => b.faturamento - a.faturamento);

        // 4. Pipeline
        const pipelineTotalValue = currentFaturamento * 0.8;
        const potentialVsRemaining = remainingGoal > 0 ? (pipelineTotalValue / remainingGoal) * 100 : 100;

        const finalResult = {
            cycleInfo: { start_date: qStart, end_date: qEnd, totalDays, elapsedDays, remainingDays },
            thermometer: { goal: goalValue, current: currentFaturamento, percent: (currentFaturamento/goalValue)*100, remaining: remainingGoal },
            rhythm: { required: requiredRhythm, current: currentRhythm, projection, status: currentRhythm >= requiredRhythm ? 'OK' : 'ABAIXO' },
            activityCalls,
            funnel: {
                leads: 0,
                agendados,
                reunioes,
                vendas: totalVendasCount,
                taxas: {
                    leadToAgendamento: 0,
                    agendamentoToReuniao: agendados > 0 ? (reunioes / agendados) * 100 : 0,
                    reuniaoToVenda: reunioes > 0 ? (totalVendasCount / reunioes) * 100 : 0
                }
            },
            predictability: {
                ticketMedio,
                vendasParaMeta,
                vendasPorDia,
                vendasRealizadasPorDia,
                totalVendas,
                projectionPercent: goalValue > 0 ? (projection / goalValue) * 100 : 0
            },
            pipeline: {
                totalValue: pipelineTotalValue,
                count: Math.round(pipelineTotalValue / (ticketMedio || 500000)),
                ticketMedio: ticketMedio || 0,
                potentialIndicator: potentialVsRemaining
            },
            closerPerformance,
            alerts: [
                currentRhythm < requiredRhythm ? "Ritmo atual abaixo do necessário para bater a meta." : null,
                pipelineTotalValue < remainingGoal ? "Pipeline insuficiente para cobrir o restante." : null,
            ].filter(Boolean)
        };

        // Save to cache before sending
        cycleCache.set(cacheKey, { timestamp: Date.now(), data: finalResult });
        res.json(finalResult);

    } catch(e) {
        res.status(500).json({error: e.message});
    }
});


// GET all vendas (Admin only)
app.get('/api/vendas', authMiddleware, async (req, res) => {
    try {
        const allVendas = await dbHelper.query("SELECT * FROM Vendas ORDER BY data_fechamento DESC");
        
        if (req.userRole === 'ADMIN') {
            return res.json(allVendas);
        }
        // SDR/Closer only sees their own
        const filtered = allVendas.filter(v => v.closer_id === req.userId || v.sdr_id === req.userId);
        res.json(filtered);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});
// ═══════════════════════════════════════════════
// 3C PLUS INTEGRATION — READ-ONLY ENDPOINTS
// ═══════════════════════════════════════════════
// const tcPlus = require('./threecplus');

// List all agents from 3C Plus
app.get('/api/3cplus/agents', authMiddleware, async (req, res) => {
    try {
        const result = await tcPlus.getAgents();
        res.json(result.data || []);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// Current agent status (online/offline/idle)
app.get('/api/3cplus/agents/status', authMiddleware, async (req, res) => {
    try {
        const result = await tcPlus.getAgentsStatus();
        res.json(result.data || []);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// Active calls right now
app.get('/api/3cplus/calls/active', authMiddleware, async (req, res) => {
    try {
        const result = await tcPlus.getActiveCalls();
        res.json(result.data || []);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// Call statistics per day
app.get('/api/3cplus/statistics', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date, agent_id } = req.query;
        const sd = start_date || new Date().toISOString().split('T')[0].substring(0,8) + '01';
        const ed = end_date || new Date().toISOString().split('T')[0];
        const result = await tcPlus.getCallStatistics(sd, ed, agent_id);
        res.json(result.data || []);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// Call history (paginated)
app.get('/api/3cplus/calls', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date, per_page } = req.query;
        const sd = start_date || new Date().toISOString().split('T')[0].substring(0,8) + '01';
        const ed = end_date || new Date().toISOString().split('T')[0];
        const result = await tcPlus.getCallHistory(sd, ed, per_page || 50);
        res.json(result.data || []);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// Call totals
app.get('/api/3cplus/calls/total', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const sd = start_date || new Date().toISOString().split('T')[0].substring(0,8) + '01';
        const ed = end_date || new Date().toISOString().split('T')[0];
        const result = await tcPlus.getCallsTotal(sd, ed);
        res.json(result.data || {});
    } catch(e) { res.status(500).json({error: e.message}); }
});

// Qualification statistics
app.get('/api/3cplus/qualifications', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const sd = start_date || new Date().toISOString().split('T')[0].substring(0,8) + '01';
        const ed = end_date || new Date().toISOString().split('T')[0];
        const result = await tcPlus.getQualificationStats(sd, ed);
        res.json(result.data || []);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// Campaigns list
app.get('/api/3cplus/campaigns', authMiddleware, async (req, res) => {
    try {
        const result = await tcPlus.getCampaigns();
        res.json(result.data || []);
    } catch(e) { res.status(500).json({error: e.message}); }
});

// Agent mapping info
app.get('/api/3cplus/agent-map', authMiddleware, (req, res) => {
    res.json({
        mapping: tcPlus.AGENT_MAP_3C_TO_LOCAL,
        activeAgents: tcPlus.ACTIVE_AGENTS,
    });
});

// SDR consolidated dashboard data from 3C Plus
app.get('/api/3cplus/sdr-dashboard', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        const todayStr = new Date().toISOString().split('T')[0];
        const today = end_date || todayStr;
        const monthStart = start_date || (todayStr.substring(0,8) + '01');

        // Fetch overall + per-agent stats in parallel
        const agentEntries = Object.entries(tcPlus.ACTIVE_AGENTS); // [['Cauê Perpétuo', 207455], ...]
        const [statsMonth, statsToday, agentsStatus, callsTotal, gotoCallsRes, ...perAgentResults] = await Promise.all([
            tcPlus.getCallStatistics(monthStart, today),
            tcPlus.getCallStatistics(today, today),
            tcPlus.getAgentsStatus(),
            tcPlus.getCallsTotal(monthStart, today),
            gotoApi.getCallsHistory(monthStart, today).catch(e => { console.error('GoTo SDR Error:', e.message); return { items: [] }; }),
            ...agentEntries.map(([_, id]) => tcPlus.getCallStatistics(monthStart, today, id)),
        ]);

        const dailyStats = statsMonth.data || [];
        const todayStats = statsToday.data || [];
        const gotoCalls = gotoCallsRes?.items || [];

        // Monthly totals
        const totalAnswered = dailyStats.reduce((s,d) => s + (d.answered||0), 0);
        const totalConverted = dailyStats.reduce((s,d) => s + (d.converted||0), 0);
        const totalDMC = dailyStats.reduce((s,d) => s + (d.dmc||0), 0);

        // Today totals
        const todayAnswered = todayStats.reduce((s,d) => s + (d.answered||0), 0);
        const todayConverted = todayStats.reduce((s,d) => s + (d.converted||0), 0);

        // Kommo CRM leads (Somente PRÉ-VENDAS)
        let kommoPipeline = [];
        try {
            const kommoReq = await kommoApi.getLeads('limit=250');
            const leadsObj = kommoReq._embedded?.leads || [];
            const now = Date.now() / 1000;
            kommoPipeline = leadsObj
                .filter(l => l.status_id !== 142 && l.status_id !== 143) // Puxa todos ativos independente de pipeline config
                .map(l => {
                    let etapaLabel = 'Em Tentativa';
                    if(l.status_id === 88986711) etapaLabel = 'Lead Novo';
                    if(l.status_id === 88986727) etapaLabel = '1° Reunião Confirmada';
                    if(l.status_id === 88993003) etapaLabel = 'Reagendamento';

                    return {
                        id: l.id,
                        lead: l.name,
                        responsavel: l.responsible_user_id,
                        etapa: etapaLabel,
                        valor: l.price || 0,
                        tarefaAtrasada: l.closest_task_at && l.closest_task_at < now,
                        dias: Math.floor((now - l.created_at) / 86400)
                    };
                });
        } catch(err) {}

        // Per-agent breakdown + GOTO INTEGRATION
        // O Dashboard SDR exibe apenas o Cauê. 
        // Como ele usa Célia, Giovanna e o próprio nome, a conta é: TOTAL 3C - EUNICE 3C + GOTO
        
        // 1. Stats da Eunice
        const euniceIndex = agentEntries.findIndex(([name]) => name === 'Eunice Dias');
        const euniceData = euniceIndex >= 0 ? perAgentResults[euniceIndex]?.data || [] : [];
        const euniceCalls = euniceData.reduce((s,d) => s + (d.answered||0), 0);
        const euniceDmc = euniceData.reduce((s,d) => s + (d.dmc||0), 0);
        const euniceConverted = euniceData.reduce((s,d) => s + (d.converted||0), 0);

        // 2. GoTo Connect do Cauê (Ramais 1000 e 1002)
        const caueGotoRaw = gotoCalls.filter(c => 
            c.caller?.number === '1000' || c.caller?.number === '1002' ||
            c.callee?.number === '1000' || c.callee?.number === '1002' ||
            c.caller?.extension === '1000' || c.caller?.extension === '1002' ||
            c.callee?.extension === '1000' || c.callee?.extension === '1002'
        );
        const uniqueCallsMap = new Map();
        caueGotoRaw.forEach(c => {
            if (!uniqueCallsMap.has(c.originatorId)) {
                uniqueCallsMap.set(c.originatorId, c);
            } else if ((c.duration||0) > (uniqueCallsMap.get(c.originatorId).duration||0)) {
                uniqueCallsMap.set(c.originatorId, c);
            }
        });
        const uniqueCalls = Array.from(uniqueCallsMap.values());
        const caueGotoCallsCount = uniqueCalls.length;
        const caueGotoDmcCount = uniqueCalls.filter(c => (c.duration || 0) > 45000).length;

        // 3. Montar métricas consolidadas do Cauê (Total 3C - Eunice 3C + GoTo Cauê)
        const caueTotalCalls = Math.max(0, totalAnswered - euniceCalls) + caueGotoCallsCount;
        const caueTotalDmc = Math.max(0, totalDMC - euniceDmc) + caueGotoDmcCount;
        const caueTotalConverted = Math.max(0, totalConverted - euniceConverted);

        const agentsBreakdown = [
            {
                id: 'caue_consolidado',
                nameLocal: 'Cauê',
                name3c: 'GoTo + 3C Plus (várias contas)',
                monthCalls: caueTotalCalls,
                monthConverted: caueTotalConverted,
                monthDMC: caueTotalDmc,
                dailyChart: dailyStats
            }
        ];

        // Summing GoTo to Totals
        const caueGotoTotalRaw = gotoCalls.filter(c => c.caller?.number === '1000' || c.caller?.number === '1002');
        const uniqueTotalMap = new Map();
        caueGotoTotalRaw.forEach(c => {
            if (!uniqueTotalMap.has(c.originatorId)) uniqueTotalMap.set(c.originatorId, c);
        });
        const uniqueTotalCalls = Array.from(uniqueTotalMap.values());

        const gotoCallsCount = uniqueTotalCalls.length;
        const gotoDMCCount = uniqueTotalCalls.filter(c => (c.duration || 0) > 45000).length;

        res.json({
            monthly: {
                totalCalls: totalAnswered + gotoCallsCount,
                converted: totalConverted,
                dmc: totalDMC + gotoDMCCount,
                conversionRate: (totalAnswered + gotoCallsCount) > 0 ? ((totalConverted / (totalAnswered + gotoCallsCount)) * 100).toFixed(1) : '0.0',
            },
            today: {
                calls: todayAnswered + uniqueTotalCalls.filter(c => c.startTime && c.startTime.startsWith(todayStr)).length,
                converted: todayConverted,
            },
            dailyChart: dailyStats,
            agentsOnline: (agentsStatus.data || []).filter(a => a.status !== 'offline'),
            callsTotal: callsTotal.data || {},
            agentsBreakdown,
            kommoPipeline
        });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// ──────── GOTO OAUTH ROUTES ────────
app.get('/api/goto/auth', (req, res) => {
    res.redirect(gotoApi.getAuthorizationUrl());
});

app.get('/api/goto/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Erro: Código não recebido da GoTo.');
    try {
        await gotoApi.exchangeCodeForToken(code);
        res.send('<h2 style="font-family:sans-serif;text-align:center;margin-top:50px;">Integração GoTo concluída com sucesso! 🎉<br>Pode fechar esta janela e voltar ao painel.</h2>');
    } catch (e) {
        res.status(500).send('Erro na integração GoTo: ' + e.message);
    }
});

// ──────── KOMMO: MIDDLEWARE DE SEGURANÇA OBRIGATÓRIO ────────
// REGRA: Bloqueia QUALQUER método que não seja GET nas rotas /api/kommo/*
// Isso garante que o sistema NUNCA possa criar, editar ou apagar dados no CRM.
app.use('/api/kommo', (req, res, next) => {
    // Permitir apenas GET (leitura)
    if (req.method !== 'GET') {
        console.warn(`[SEGURANÇA KOMMO] Tentativa BLOQUEADA: ${req.method} ${req.originalUrl}`);
        return res.status(403).json({
            error: 'BLOQUEADO',
            message: 'Operações de escrita no Kommo são estritamente proibidas. Apenas leitura (GET) é permitida.'
        });
    }
    next();
});

// ──────── KOMMO OAUTH ROUTES (GET only) ────────
app.get('/api/kommo/auth', (req, res) => {
    res.redirect(kommoApi.getAuthorizationUrl());
});

app.get('/api/kommo/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Erro: Código não recebido da Kommo.');
    try {
        await kommoApi.exchangeCodeForToken(code);
        res.send('<h2 style="font-family:sans-serif;text-align:center;margin-top:50px;">Integração Kommo concluída com sucesso! 🎉<br>Pode fechar esta janela e voltar ao painel.</h2>');
    } catch (e) {
        res.status(500).send('Erro na integração Kommo: ' + e.message);
    }
});

// ──────── KOMMO: ENDPOINTS DE LEITURA (PROXY READ-ONLY) ────────
app.get('/api/kommo/leads', authMiddleware, async (req, res) => {
    try {
        const data = await kommoApi.getLeads(req.query.query || '');
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/kommo/pipelines', authMiddleware, async (req, res) => {
    try {
        const data = await kommoApi.getPipelines();
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/kommo/contacts', authMiddleware, async (req, res) => {
    try {
        const data = await kommoApi.getContacts(req.query.query || '');
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/kommo/users', authMiddleware, async (req, res) => {
    try {
        const data = await kommoApi.getUsers();
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/kommo/account', authMiddleware, async (req, res) => {
    try {
        const data = await kommoApi.getAccount();
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/kommo/status', (req, res) => {
    res.json({ authenticated: kommoApi.isAuthenticated(), readOnly: true });
});

// ──────── ENDPOINT CONSOLIDADO (V4) ────────
app.get('/api/metrics/consolidated', authMiddleware, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate e endDate são obrigatórios (YYYY-MM-DD)' });
        }
        const data = await consolidator.getConsolidatedData(startDate, endDate);
        res.json(data);
    } catch (error) {
        console.error('Consolidation Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fallback React Router SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend-v2/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
