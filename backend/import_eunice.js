const http = require('http');

const callApi = (path, method, body, token) => new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/api' + path,
        method: method,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': 'Bearer ' + token })
        }
    };
    const req = http.request(options, res => {
        let resData = '';
        res.on('data', chunk => resData += chunk);
        res.on('end', () => {
            if(res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(resData));
            else reject(resData);
        });
    });
    req.on('error', reject);
    if(body) req.write(data);
    req.end();
});

async function run() {
    try {
        console.log("1. Fazendo login como ADMIN...");
        const adminLogin = await callApi('/auth/login', 'POST', { email: 'admin@admin.com', senha: 'password' });
        
        console.log("2. Criando conta da Closer Eunice Dias...");
        try {
            await callApi('/usuarios', 'POST', {
                nome: 'Eunice Dias',
                email: 'eunice.dias@crconsorcios.com',
                senha: 'password', // Senha padrão
                role: 'CLOSER'
            }, adminLogin.token);
        } catch (e) {
            console.log(" (Usuário já existia ou erro menor ignorado)");
        }

        console.log("3. Fazendo login como Eunice para lançar as vendas em seu nome...");
        const euniceLogin = await callApi('/auth/login', 'POST', { email: 'eunice.dias@crconsorcios.com', senha: 'password' });
        const euniceToken = euniceLogin.token;

        console.log("4. Lançando Venda Fechada 1: Daniela Fonseca (R$ 1.000.000,00)");
        await callApi('/vendas', 'POST', {
            cliente_nome: 'Daniela Fonseca',
            valor_venda: 1000000,
            data_fechamento: '2026-03-21',
            administradora: 'EMBRACON'
        }, euniceToken);

        console.log("5. Lançando Venda Fechada 2: Gislayde Ribas (R$ 450.000,00)");
        await callApi('/vendas', 'POST', {
            cliente_nome: 'Gislayde Ribas',
            valor_venda: 450000,
            data_fechamento: '2026-03-02',
            administradora: 'PORTO'
        }, euniceToken);

        console.log("6. Lançando Venda Fechada 3: Isabella Muniz (R$ 740.000,00)");
        await callApi('/vendas', 'POST', {
            cliente_nome: 'Isabella Muniz',
            valor_venda: 740000,
            data_fechamento: '2026-03-20',
            administradora: 'PORTO'
        }, euniceToken);

        console.log("-> SUCESSO! Comissões, parcelas e atingimento de Tier calculados automaticamente pelo servidor.");
    } catch(err) {
        console.error("Erro na importação:", err);
    }
}

run();
