const fs = require('fs');
const https = require('https');
const path = require('path');

// Re-using the logic from goto.js but with manual parameter testing
const CLIENT_ID = '4702716e-b4c3-408c-81dd-69e27a12773a';
const dbPath = path.resolve(__dirname, 'database.json');
const ACCOUNT_KEY = '5629857328715948344';

function loadTokens() {
    try {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const configItem = db.Configuracoes?.find(c => c.chave === 'GOTO_TOKENS');
        return configItem ? JSON.parse(configItem.valor) : null;
    } catch { return null; }
}

async function apiGet(apiPath) {
    const tokens = loadTokens();
    const token = tokens.access_token;

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.getgo.com',
            path: apiPath,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
                } else reject(new Error(`GoTo API Error: ${res.statusCode} - ${data}`));
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function runTest() {
    const start = '2026-03-01T00:00:00Z';
    const end = '2026-03-24T23:59:59Z';
    
    console.log('Testing Paging...');
    
    // 1. Get first page
    const p1 = await apiGet(`/call-history/v1/calls?accountKey=${ACCOUNT_KEY}&startTime=${start}&endTime=${end}&pageSize=10`);
    console.log('P1 (pageSize=10) First legId:', p1.items[0].legId);
    const marker = p1.nextPageMarker;
    console.log('nextPageMarker:', marker);

    // 2. Try &nextPageMarker=...
    const p2_marker = await apiGet(`/call-history/v1/calls?accountKey=${ACCOUNT_KEY}&startTime=${start}&endTime=${end}&pageSize=10&nextPageMarker=${marker}`);
    console.log('P2 (+nextPageMarker) First legId:', p2_marker.items[0].legId);

    // 3. Try &pageToken=...
    const p2_token = await apiGet(`/call-history/v1/calls?accountKey=${ACCOUNT_KEY}&startTime=${start}&endTime=${end}&pageSize=10&pageToken=${marker}`);
    console.log('P2 (+pageToken) First legId:', p2_token.items[0].legId);
    
    // 4. Try &offset=10
    const p2_offset = await apiGet(`/call-history/v1/calls?accountKey=${ACCOUNT_KEY}&startTime=${start}&endTime=${end}&pageSize=10&offset=10`);
    console.log('P2 (+offset=10) First legId:', p2_offset.items[0]?.legId);
}

runTest().catch(console.error);
