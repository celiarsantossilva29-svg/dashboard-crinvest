const https = require('https');
const fs = require('fs');
const path = require('path');

// ──────── CREDENCIAIS ────────
const CLIENT_ID = 'edabb90b-e538-441b-9b66-63176969e900';
const CLIENT_SECRET = 'nSpfk1UugADoTPUsx6eKc25EgV5XuB76gYLd2dCKx4lhOrr12wkgKWcXdW8l4yIg';
const SUBDOMAIN = 'celiarsantossilva';
const REDIRECT_URI = 'http://localhost:3001/api/kommo/callback';
const BASE_HOST = `${SUBDOMAIN}.kommo.com`;

const dbPath = path.resolve(__dirname, 'database.json');

// ──────── TOKEN PERSISTENCE ────────
function loadTokens() {
    try {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const item = db.Configuracoes?.find(c => c.chave === 'KOMMO_TOKENS');
        return item ? JSON.parse(item.valor) : null;
    } catch { return null; }
}

function saveTokens(tokenData) {
    try {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!db.Configuracoes) db.Configuracoes = [];
        let item = db.Configuracoes.find(c => c.chave === 'KOMMO_TOKENS');
        const payload = JSON.stringify(tokenData);
        if (item) {
            item.valor = payload;
        } else {
            db.Configuracoes.push({ id: 'config-kommo', chave: 'KOMMO_TOKENS', valor: payload });
        }
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    } catch (e) { console.error('Error saving Kommo tokens:', e); }
}

// ──────── OAUTH 2.0 ────────
function getAuthorizationUrl() {
    return `https://www.kommo.com/oauth?client_id=${CLIENT_ID}&state=kommo_auth&mode=post_message`;
}

function exchangeCodeForToken(code) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI
        });

        const req = https.request({
            hostname: BASE_HOST,
            path: '/oauth2/access_token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const tokenData = JSON.parse(data);
                    tokenData._saved_at = Date.now();
                    saveTokens(tokenData);
                    resolve(tokenData);
                } else reject(new Error(`Kommo OAuth Error ${res.statusCode}: ${data}`));
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function refreshAccessToken() {
    const tokens = loadTokens();
    if (!tokens || !tokens.refresh_token) throw new Error('No Kommo refresh token');

    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: tokens.refresh_token,
            redirect_uri: REDIRECT_URI
        });

        const req = https.request({
            hostname: BASE_HOST,
            path: '/oauth2/access_token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const tokenData = JSON.parse(data);
                    tokenData._saved_at = Date.now();
                    saveTokens(tokenData);
                    resolve(tokenData);
                } else reject(new Error(`Kommo Refresh Error ${res.statusCode}: ${data}`));
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function getValidAccessToken() {
    let tokens = loadTokens();
    if (!tokens || !tokens.access_token) return null;

    // Token expira em ~24h. Refresh se passou mais de 20h.
    const elapsed = Date.now() - (tokens._saved_at || 0);
    if (elapsed > 20 * 60 * 60 * 1000) {
        try {
            tokens = await refreshAccessToken();
        } catch (e) {
            console.error('Kommo token refresh failed:', e.message);
            return null;
        }
    }
    return tokens.access_token;
}

// ──────── HTTP GET HELPER (somente leitura!) ────────
async function apiGet(apiPath) {
    const token = await getValidAccessToken();
    if (!token) throw new Error('Kommo not authenticated');

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: BASE_HOST,
            path: apiPath,
            method: 'GET',
            timeout: 10000,
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
                } else if (res.statusCode === 401) {
                    // Token expirou, tenta refresh
                    refreshAccessToken()
                        .then(() => apiGet(apiPath).then(resolve).catch(reject))
                        .catch(reject);
                } else {
                    reject(new Error(`Kommo API ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy(new Error(`Timeout na requisição Kommo API (${apiPath}) após 10s.`));
        });
        req.end();
    });
}

// ──────── ENDPOINTS DE LEITURA ────────

// Buscar leads (com filtros opcionais)
async function getLeads(query = '') {
    return apiGet(`/api/v4/leads${query ? '?' + query : ''}`);
}

// Buscar pipelines e etapas
async function getPipelines() {
    return apiGet('/api/v4/leads/pipelines');
}

// Buscar contatos
async function getContacts(query = '') {
    return apiGet(`/api/v4/contacts${query ? '?' + query : ''}`);
}

// Buscar usuários (responsáveis)
async function getUsers() {
    return apiGet('/api/v4/users');
}

// Buscar informações da conta
async function getAccount() {
    return apiGet('/api/v4/account');
}

// Buscar Eventos (Timeline de mudanças de status)
async function getEvents(query = '') {
    // Se a query não tiver limit, forçamos um padrão alto para evitar múltiplas requisições
    const finalQuery = query.includes('limit=') ? query : (query ? `${query}&limit=250` : 'limit=250');
    return apiGet(`/api/v4/events?${finalQuery}`);
}

module.exports = {
    getAuthorizationUrl,
    exchangeCodeForToken,
    getLeads,
    getPipelines,
    getContacts,
    getUsers,
    getAccount,
    getEvents,
    apiGet,
    isAuthenticated: () => !!loadTokens(),
    SUBDOMAIN
};
