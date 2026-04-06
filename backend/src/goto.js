const https = require('https');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = '4702716e-b4c3-408c-81dd-69e27a12773a';
const CLIENT_SECRET = '2fgg4xPCqjY5m6qAEZnvnZGu';
const REDIRECT_URI = 'http://localhost:3001/api/goto/callback';

const dbPath = path.resolve(__dirname, 'database.json');

// Helper para ler/salvar tokens no DB
function loadTokens() {
    try {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const configItem = db.Configuracoes?.find(c => c.chave === 'GOTO_TOKENS');
        return configItem ? JSON.parse(configItem.valor) : null;
    } catch { return null; }
}

function saveTokens(tokenData) {
    try {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!db.Configuracoes) db.Configuracoes = [];
        let configItem = db.Configuracoes.find(c => c.chave === 'GOTO_TOKENS');
        if (configItem) {
            configItem.valor = JSON.stringify(tokenData);
        } else {
            db.Configuracoes.push({ id: 'config-goto', chave: 'GOTO_TOKENS', valor: JSON.stringify(tokenData) });
        }
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    } catch (e) { console.error('Error saving GoTo tokens', e); }
}

function getAuthorizationUrl() {
    return `https://authentication.logmeininc.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
}

function exchangeCodeForToken(code) {
    return new Promise((resolve, reject) => {
        const data = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
        const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        
        const req = https.request({
            hostname: 'authentication.logmeininc.com',
            path: '/oauth/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data),
                'Accept': 'application/json'
            }
        }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const tokenData = JSON.parse(body);
                    saveTokens(tokenData);
                    resolve(tokenData);
                } else reject(new Error(`OAuth Error: ${body}`));
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function refreshAccessToken() {
    const tokens = loadTokens();
    if (!tokens || !tokens.refresh_token) throw new Error('No GoTo refresh token');

    return new Promise((resolve, reject) => {
        const data = `grant_type=refresh_token&refresh_token=${encodeURIComponent(tokens.refresh_token)}`;
        const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

        const req = https.request({
            hostname: 'authentication.logmeininc.com',
            path: '/oauth/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data),
                'Accept': 'application/json'
            }
        }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const tokenData = JSON.parse(body);
                    saveTokens(tokenData);
                    resolve(tokenData);
                } else reject(new Error(`GoTo Refresh Error: ${body}`));
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function getValidAccessToken() {
    let tokens = loadTokens();
    if (!tokens || !tokens.access_token) return null;
    return tokens.access_token;
}

// ──────── HTTP helper ────────
async function apiGet(apiPath, extraHeaders = {}) {
    const token = await getValidAccessToken();
    if (!token) throw new Error('GoTo not authenticated');

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.getgo.com',
            path: apiPath,
            method: 'GET',
            timeout: 10000, // 10s timeout
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                ...extraHeaders
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
                } else if (res.statusCode === 401) {
                    // Tenta refresh e retry
                    refreshAccessToken()
                        .then(() => apiGet(apiPath, extraHeaders).then(resolve).catch(reject))
                        .catch(reject);
                } else {
                    reject(new Error(`GoTo API Error: ${res.statusCode} - ${data}`));
                }
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('GoTo API Timeout (10s)'));
        });

        req.on('error', reject);
        req.end();
    });
}

// O Cauê (SDR) utiliza o GoTo sob o nome "Celia" ou "Giovanna"
// Todas essas contas pertencem ao Cauê para fins de métricas
const AGENT_MAP = {
    'caue@crinvest.com': 'Cauê',
    'eunice.dias@crconsorcios.com': 'Eunice Dias',
    'celia@crinvest.com': 'Cauê',       // Cauê usa este perfil no GoTo
    'giovanna@crinvest.com': 'Cauê',    // Cauê também usa este perfil no GoTo
};

// Mapeamento reverso: nome exibido no GoTo -> nome local
const GOTO_DISPLAY_NAME_MAP = {
    'Celia': 'Cauê',
    'Giovanna': 'Cauê',
    'Cauê': 'Cauê',
    'Eunice': 'Eunice Dias',
    'Eunice Dias': 'Eunice Dias',
};

const ACCOUNT_KEY = '5629857328715948344';

async function getMeetingsHistory(startDate, endDate) {
    return apiGet(`/G2M/rest/historicalMeetings?startDate=${startDate}&endDate=${endDate}`);
}

async function getCallsHistory(startDate, endDate) {
    const start = startDate ? `${startDate}T00:00:00Z` : new Date().toISOString().split('T')[0] + 'T00:00:00Z';
    const end = endDate ? `${endDate}T23:59:59Z` : new Date().toISOString().split('T')[0] + 'T23:59:59Z';
    
    let allItems = [];
    let nextMarker = null;

    do {
        const path = `/call-history/v1/calls?accountKey=${ACCOUNT_KEY}&startTime=${start}&endTime=${end}&pageSize=1000${nextMarker ? `&nextPageMarker=${nextMarker}` : ''}`;
        const res = await apiGet(path, { 'Accept': 'application/json' });
        
        if (res.items) allItems = allItems.concat(res.items);
        nextMarker = res.nextPageMarker;
        
        // Safety break to avoid infinite loops if API misbehaves
        if (allItems.length > 5000) break; 
    } while (nextMarker);

    return { items: allItems };
}

module.exports = {
    getAuthorizationUrl,
    exchangeCodeForToken,
    getMeetingsHistory,
    getCallsHistory,
    refreshAccessToken,
    isAuthenticated: () => !!loadTokens(),
    AGENT_MAP,
    GOTO_DISPLAY_NAME_MAP
};
