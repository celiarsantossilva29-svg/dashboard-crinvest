const goto = require('./goto');
const https = require('https');
const fs = require('fs');

async function testGoTo() {
    console.log('Testing New GoTo Token with PBX Scopes...');
    try {
        const token = await goto.isAuthenticated() ? JSON.parse(fs.readFileSync('database.json')).Configuracoes.find(c => c.chave==='GOTO_TOKENS').valor : null;
        if (!token) return console.log('no token');
        const realToken = JSON.parse(token).access_token;

        const options = {
            hostname: 'api.getgo.com',
            path: '/users/v1/lines',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${realToken}`,
                'Accept': 'application/json'
            }
        };

        const tryReq = (hostname, path) => new Promise((resolve) => {
            const req = https.request({ ...options, hostname, path }, res => {
                let data = '';
                res.on('data', d => data += d);
                res.on('end', () => resolve({ code: res.statusCode, data }));
            });
            req.on('error', err => resolve({ error: err.message }));
            req.end();
        });

        // Tenta Jive ME
        console.log('1. User Lines:', await tryReq('api.jive.com', '/users/v1/lines'));
        console.log('2. Call History:', await tryReq('api.jive.com', '/call-history/v1/calls'));
        console.log('3. PBXs:', await tryReq('api.jive.com', '/pbxs/v1/pbxs'));
        
    } catch(err) {
        console.error('Error:', err.message);
    }
}

testGoTo();
