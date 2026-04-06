const { useState, useEffect } = React;

const API_URL = 'http://localhost:3001/api';

function App() {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [currentView, setCurrentView] = useState('dashboard');

    useEffect(() => {
        if (token) {
            const storedUser = localStorage.getItem('user');
            if (storedUser) setUser(JSON.parse(storedUser));
            else handleLogout();
        }
    }, [token]);

    const handleLogin = (t, u) => {
        localStorage.setItem('token', t);
        localStorage.setItem('user', JSON.stringify(u));
        setToken(t);
        setUser(u);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    };

    if (!token || !user) return <Login onLogin={handleLogin} />;

    return (
        <div className="app-container">
            <Sidebar user={user} onLogout={handleLogout} currentView={currentView} setView={setCurrentView} />
            <div className="main-area">
                <Header user={user} />
                <div className="content-wrapper">
                    {currentView === 'dashboard' && <Dashboard user={user} token={token} />}
                    {currentView === 'vendas' && <Vendas user={user} token={token} />}
                    {currentView === 'comissoes' && <Comissoes user={user} token={token} />}
                </div>
            </div>
        </div>
    );
}

// -------------------------------------------------------------------------------- //

function Logo({ darkText }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
            <img src="img/logo.jpg" alt="CR Invest Logo" style={{ width: '120px', height: 'auto', borderRadius: '4px' }} />
        </div>
    );
}

function Login({ onLogin }) {
    const [email, setEmail] = useState('admin@admin.com');
    const [senha, setSenha] = useState('password');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_URL}/auth/login`, { email, senha });
            onLogin(res.data.token, res.data.user);
        } catch (err) {
            setError('Credenciais inválidas. Tente novamente.');
        }
    };

    return (
        <div className="login-bg">
            <div className="login-box">
                <Logo darkText={true} />
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">E-mail</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="form-input" required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Senha</label>
                        <input type="password" value={senha} onChange={e => setSenha(e.target.value)} className="form-input" required />
                    </div>
                    {error && <p style={{color: '#EF4444', marginBottom: '15px'}}>{error}</p>}
                    <button type="submit" className="btn-primary" style={{width: '100%', padding: '12px', fontSize: '1rem'}}>ACESSAR PLATAFORMA</button>
                </form>
            </div>
        </div>
    );
}

function Sidebar({ user, onLogout, currentView, setView }) {
    return (
        <aside className="sidebar">
            <div className="logo-container" style={{ padding: '20px 10px' }}>
                <Logo darkText={false} />
            </div>

            <nav className="nav-menu">
                <a className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
                    <i className="fa-regular fa-compass"></i>
                    Visão Geral
                </a>
                <a className={`nav-item ${currentView === 'vendas' ? 'active' : ''}`} onClick={() => setView('vendas')}>
                    <i className="fa-solid fa-chart-pie"></i>
                    Registro de Vendas
                </a>
                <a className={`nav-item ${currentView === 'comissoes' ? 'active' : ''}`} onClick={() => setView('comissoes')}>
                    <i className="fa-solid fa-money-check-dollar"></i>
                    Comissões e Baixas
                </a>
            </nav>

            <div style={{padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)'}}>
                <a className="nav-item" onClick={onLogout} style={{color: '#EF4444', padding: '10px 0'}}>
                    <i className="fa-solid fa-arrow-right-from-bracket"></i> Sair do Sistema
                </a>
            </div>
        </aside>
    );
}

function Header({ user }) {
    return (
        <header className="top-header">
            <div className="header-title">
                Bem-vindo ao Sistema de Acompanhamento
            </div>
            <div className="header-actions">
                <button className="icon-btn">
                    <i className="fa-regular fa-bell"></i>
                    <span className="icon-badge">1</span>
                </button>
                <div className="user-profile">
                    <span style={{fontWeight: '500', color: '#1F2937'}}>{user.nome}</span>
                    <div className="user-avatar">{user.nome.charAt(0)}</div>
                </div>
            </div>
        </header>
    );
}

function Dashboard({ user, token }) {
    const [vendas, setVendas] = useState([]);
    const [comissoes, setComissoes] = useState([]);

    useEffect(() => {
        axios.get(`${API_URL}/vendas`, { headers: { Authorization: `Bearer ${token}` }})
            .then(res => setVendas(res.data)).catch(console.error);

        const endpoint = user.role === 'SDR' ? '/comissoes/sdr' : '/comissoes/closer';
        axios.get(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${token}` }})
            .then(res => setComissoes(res.data)).catch(console.error);
    }, [token, user]);

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const totalVendido = vendas.reduce((acc, val) => acc + val.valor_venda, 0);
    const comissoesPendentes = comissoes.filter(c => c.status === 'PENDENTE').reduce((acc, val) => acc + (val.valor_parcela_comissao || val.valor_comissao), 0);
    const myTier = vendas.length > 0 ? vendas[0].tier_closer : 'Bronze';

    return (
        <div>
            <div className="dash-cards">
                <div className="kpi-card bronze">
                    <div className="kpi-content">
                        <i className="fa-solid fa-award kpi-icon" style={{color: '#653D16'}}></i>
                        <div>
                            <div className="kpi-title">Meu Total Vendido</div>
                            <div className="kpi-value">{formatBRL(totalVendido)}</div>
                        </div>
                    </div>
                </div>
                
                <div className="kpi-card dark">
                    <div className="kpi-content">
                        <i className="fa-solid fa-award kpi-icon" style={{color: '#9CA3AF'}}></i>
                        <div>
                            <div className="kpi-title">Comissões a Receber</div>
                            <div className="kpi-value">{formatBRL(comissoesPendentes)}</div>
                        </div>
                    </div>
                </div>

                <div className="kpi-card gold">
                    <div className="kpi-content">
                        <i className="fa-solid fa-award kpi-icon" style={{color: '#B5841D'}}></i>
                        <div>
                            <div className="kpi-title">Meu Tier Atual</div>
                            <div className="kpi-value" style={{fontSize: '1.8rem'}}>{myTier}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="chart-section">
                <h3 className="section-title" style={{color: '#B5841D'}}>Minhas Vendas Mensais</h3>
                {/* Gráfico SVG Simples e direto copiando a imagem sem dependências pesadas externas */}
                <div style={{width: '100%', height: 200, position: 'relative', marginTop: 20}}>
                    <svg viewBox="0 0 1000 200" style={{width: '100%', height: '100%'}}>
                        {/* Linha Fundo */}
                        <path d="M0,150 Q125,120 250,150 T500,130 T750,70 T1000,100" fill="none" stroke="#E5E7EB" strokeWidth="2" strokeDasharray="5,5"/>
                        {/* Linha Original do Print */}
                        <path d="M50,160 L150,130 L250,140 L350,130 L450,140 L550,120 L650,80 L750,110 L850,70 L950,90" fill="none" stroke="#E2B236" strokeWidth="3" />
                        
                        {/* Pontos */}
                        {[ 
                            {cx:50, cy:160}, {cx:150, cy:130}, {cx:250, cy:140}, {cx:350, cy:130},
                            {cx:450, cy:140}, {cx:550, cy:120}, {cx:650, cy:80}, {cx:750, cy:110},
                            {cx:850, cy:70}, {cx:950, cy:90}
                        ].map((pt, index) => (
                            <circle key={index} cx={pt.cx} cy={pt.cy} r="6" fill="#FFF" stroke="#E2B236" strokeWidth="3" />
                        ))}

                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#E2B236" stopOpacity="0.2"/>
                            <stop offset="100%" stopColor="#E2B236" stopOpacity="0"/>
                        </linearGradient>
                        <path d="M50,160 L150,130 L250,140 L350,130 L450,140 L550,120 L650,80 L750,110 L850,70 L950,90 L950,200 L50,200 Z" fill="url(#chartGrad)" />
                    </svg>
                    <div style={{position: 'absolute', bottom: 10, left: 50, color: '#9CA3AF', fontSize: 12}}>Jan</div>
                    <div style={{position: 'absolute', bottom: 10, left: 150, color: '#9CA3AF', fontSize: 12}}>Fev</div>
                    <div style={{position: 'absolute', bottom: 10, left: 250, color: '#9CA3AF', fontSize: 12}}>Mar</div>
                    <div style={{position: 'absolute', bottom: 10, left: 350, color: '#9CA3AF', fontSize: 12}}>Abr</div>
                    <div style={{position: 'absolute', bottom: 10, left: 450, color: '#9CA3AF', fontSize: 12}}>Mai</div>
                    <div style={{position: 'absolute', bottom: 10, left: 550, color: '#9CA3AF', fontSize: 12}}>Jun</div>
                    <div style={{position: 'absolute', bottom: 10, left: 650, color: '#9CA3AF', fontSize: 12}}>Jul</div>
                    <div style={{position: 'absolute', bottom: 10, left: 750, color: '#9CA3AF', fontSize: 12}}>Ago</div>
                    <div style={{position: 'absolute', bottom: 10, left: 850, color: '#9CA3AF', fontSize: 12}}>Set</div>
                    <div style={{position: 'absolute', bottom: 10, left: 950, color: '#9CA3AF', fontSize: 12}}>Out</div>
                </div>
            </div>

            <div className="data-table-container mt-4">
                 <table className="data-table">
                    <thead>
                        <tr>
                            <th><i className="fa-regular fa-square" style={{marginRight: 10}}></i> Cliente</th>
                            <th>Valor Venda</th>
                            <th>Comissão Total</th>
                            <th>Comissão Total</th>
                            <th>Parcelas Pagas/Total</th>
                            <th>Próximo Pagamento</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vendas.slice(0, 5).map((v, i) => {
                            const comissaoTotal = formatBRL(v.valor_comissao_total_closer || 0);
                            return (
                                <tr key={v.id}>
                                    <td><i className="fa-regular fa-square" style={{marginRight: 10, color: '#D1D5DB'}}></i> {v.cliente_nome}</td>
                                    <td style={{fontWeight: 600}}>{formatBRL(v.valor_venda)}</td>
                                    <td>{comissaoTotal}</td>
                                    <td>{comissaoTotal}</td>
                                    <td>
                                        <span className="pill pill-success">Pago</span>
                                    </td>
                                    <td>
                                        <span className="pill pill-warning">Pendente</span>
                                    </td>
                                </tr>
                            )
                        })}
                        {vendas.length === 0 && (
                            <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px'}}>Nenhuma venda registrada até o momento.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Vendas({ user, token }) {
    const [vendas, setVendas] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [clienteNome, setClienteNome] = useState('');
    const [valorVenda, setValorVenda] = useState('');
    const [dataFechamento, setDataFechamento] = useState(new Date().toISOString().split('T')[0]);
    const [administradora, setAdministradora] = useState('Porto Seguro');

    const fetchVendas = () => {
        axios.get(`${API_URL}/vendas`, { headers: { Authorization: `Bearer ${token}` }})
            .then(res => setVendas(res.data)).catch(console.error);
    };

    useEffect(() => { fetchVendas(); }, [token]);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/vendas`, {
                cliente_nome: clienteNome,
                valor_venda: parseFloat(valorVenda),
                data_fechamento: dataFechamento,
                administradora,
                sdr_id: null
            }, { headers: { Authorization: `Bearer ${token}` }});
            setShowForm(false);
            fetchVendas();
        } catch (err) { alert('Erro ao criar venda'); }
    };

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h2 className="section-title" style={{margin: 0}}>Registro de Vendas</h2>
                {(user.role === 'ADMIN' || user.role === 'CLOSER') && (
                    <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                        {showForm ? 'Cancelar' : '+ Registrar Venda'}
                    </button>
                )}
            </div>

            {showForm && (
                <div className="chart-section" style={{marginBottom: '30px'}}>
                    <h3 className="section-title">Dados da Venda</h3>
                    <form onSubmit={handleCreate} style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                        <div className="form-group">
                            <label className="form-label">Nome do Cliente</label>
                            <input className="form-input" required value={clienteNome} onChange={e=>setClienteNome(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Valor (R$)</label>
                            <input type="number" step="0.01" className="form-input" required value={valorVenda} onChange={e=>setValorVenda(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Data de Fechamento</label>
                            <input type="date" className="form-input" required value={dataFechamento} onChange={e=>setDataFechamento(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Administradora</label>
                            <input className="form-input" required value={administradora} onChange={e=>setAdministradora(e.target.value)} />
                        </div>
                        <button type="submit" className="btn-primary" style={{gridColumn: 'span 2'}}>Salvar Venda e Calcular Comissões</button>
                    </form>
                </div>
            )}

            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Cliente</th>
                            <th>Valor</th>
                            <th>Closer</th>
                            <th>Tier Atingido</th>
                            <th>Administradora</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vendas.length === 0 ? <tr><td colSpan="6" style={{textAlign: 'center', padding: 20}}>Nenhuma venda</td></tr> : 
                        vendas.map(v => (
                            <tr key={v.id}>
                                <td>{v.data_fechamento}</td>
                                <td>{v.cliente_nome}</td>
                                <td style={{fontWeight: 600}}>{formatBRL(v.valor_venda)}</td>
                                <td>{v.closer_nome || 'Você'}</td>
                                <td><span className="pill pill-success">{v.tier_closer}</span></td>
                                <td>{v.administradora}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Comissoes({ user, token }) {
    const [comissoes, setComissoes] = useState([]);
    const [pagamentos, setPagamentos] = useState([]);

    const fetchData = async () => {
        if (user.role === 'ADMIN') {
            const pRes = await axios.get(`${API_URL}/pagamentos-clientes`, { headers: { Authorization: `Bearer ${token}` }});
            setPagamentos(pRes.data);
        }
        
        const endpoint = user.role === 'SDR' ? '/comissoes/sdr' : '/comissoes/closer';
        const cRes = await axios.get(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${token}` }});
        setComissoes(cRes.data);
    };

    useEffect(() => { fetchData(); }, [token]);

    const handleMarcarPago = async (pid) => {
        try {
            await axios.put(`${API_URL}/pagamentos-clientes/${pid}`, {
                pago: true,
                data_pagamento: new Date().toISOString().split('T')[0]
            }, { headers: { Authorization: `Bearer ${token}` }});
            fetchData();
        } catch(e) { alert('Erro ao registrar'); }
    };

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div>
            {user.role === 'ADMIN' && (
                <div style={{marginBottom: '40px'}}>
                    <h2 className="section-title">Baixa de Parcelas de Clientes</h2>
                    <div className="data-table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nº Parcela</th>
                                    <th>Vencimento</th>
                                    <th>Valor Cliente</th>
                                    <th>Status</th>
                                    <th>Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagamentos.length === 0 && <tr><td colSpan="5" style={{textAlign: "center", padding: 20}}>Nenhum registro</td></tr>}
                                {pagamentos.map(p => (
                                    <tr key={p.id}>
                                        <td>{p.parcela_numero}/12</td>
                                        <td>{p.data_vencimento}</td>
                                        <td>{formatBRL(p.valor_parcela)}</td>
                                        <td>
                                            {p.pago 
                                                ? <span className="pill pill-success">PAGO ({p.data_pagamento})</span>
                                                : <span className="pill pill-warning">AGUARDANDO</span>}
                                        </td>
                                        <td>
                                            {!p.pago && (
                                                <button className="btn-primary" style={{padding: '5px 10px', fontSize: '0.8rem'}} onClick={() => handleMarcarPago(p.id)}>Dar Baixa</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div>
                <h2 className="section-title">{user.role === 'ADMIN' ? 'Histórico de Comissões da Equipe' : 'Minhas Comissões'}</h2>
                <div className="data-table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Cliente / Venda</th>
                                <th>Mês Ref.</th>
                                <th>Valor Comissão</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comissoes.length === 0 && <tr><td colSpan="5" style={{textAlign: "center", padding: 20}}>Nenhum registro</td></tr>}
                            {comissoes.map(c => (
                                <tr key={c.id}>
                                    <td>{c.cliente_nome}</td>
                                    <td><span className="pill" style={{background: '#E5E7EB', color: '#374151'}}>{c.mes_referencia || 'Única'}</span></td>
                                    <td style={{fontWeight: 600}}>{formatBRL(c.valor_parcela_comissao || c.valor_comissao)}</td>
                                    <td>
                                        {c.status === 'PAGO' 
                                            ? <span className="pill pill-success">LIBERADO ({c.data_pagamento_closer})</span>
                                            : <span className="pill pill-danger">BLOQUEADO</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
