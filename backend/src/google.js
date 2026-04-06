const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// NOTA: O Token principal do Google será persistido aqui
const dbPath = path.resolve(__dirname, 'database.json');

// AS CHAVES VÊM DO PAINEL DO GOOGLE CLOUD AQUI (Substitua quando o usuário mandar):
const CLIENT_ID = 'PENDING';
const CLIENT_SECRET = 'PENDING';
const REDIRECT_URI = 'http://localhost:3001/api/google/callback';

let oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

function loadTokens() {
    try {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const item = db.Configuracoes?.find(c => c.chave === 'GOOGLE_TOKENS');
        return item ? JSON.parse(item.valor) : null;
    } catch { return null; }
}

function saveTokens(tokenData) {
    try {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!db.Configuracoes) db.Configuracoes = [];
        let item = db.Configuracoes.find(c => c.chave === 'GOOGLE_TOKENS');
        const payload = JSON.stringify(tokenData);
        if (item) {
            item.valor = payload;
        } else {
            db.Configuracoes.push({ id: 'config-google', chave: 'GOOGLE_TOKENS', valor: payload });
        }
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    } catch (e) { console.error('Error saving Google tokens:', e); }
}

function getAuthorizationUrl() {
    // Scopes necessários para baixar eventos do calendário e participações em conferência:
    const scopes = [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events.readonly'
    ];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Pede refresh token obrigatório
        prompt: 'consent',
        scope: scopes
    });
}

async function exchangeCodeForToken(code) {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    saveTokens(tokens);
    return tokens;
}

function getClient() {
    const tokens = loadTokens();
    if (tokens) {
        oauth2Client.setCredentials(tokens);
    }
    return oauth2Client;
}

module.exports = {
    getAuthorizationUrl,
    exchangeCodeForToken,
    getClient,
    isAuthenticated: () => !!loadTokens()
};
