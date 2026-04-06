/**
 * 3C Plus API Integration – READ-ONLY
 * Only GET requests. No mutations. No login/logout/qualify actions.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.resolve(__dirname, 'database_3c_cache.json');
let CACHE_DATA = {};
let isSyncing = false;

function loadCache() {
    try {
        if (fs.existsSync(CACHE_PATH)) {
            CACHE_DATA = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
            console.log(`[3C Plus] Cache carregado: ${Object.keys(CACHE_DATA).length} dias em memória.`);
        }
    } catch (e) {
        console.error('[3C Plus] Erro ao carregar cache:', e.message);
        CACHE_DATA = {};
    }
}

function saveCache() {
    try {
        fs.writeFileSync(CACHE_PATH, JSON.stringify(CACHE_DATA, null, 2));
    } catch (e) {
        console.error('[3C Plus] Erro ao salvar cache:', e.message);
    }
}

// Carregar cache de forma assíncrona para não travar o boot
setTimeout(loadCache, 500);

const API_TOKEN = '1VVzqQ9SqTqvnzx7mzuXBiXUgipNgTEhVsC0qup43RSdhk2xJqCBhrQgXAZ7';
const BASE = 'https://app.3c.plus/api/v1';

// ──────── HTTP helper (GET only) ────────
function apiGet(path, extraParams = {}) {
    return new Promise((resolve, reject) => {
        const qs = new URLSearchParams({ api_token: API_TOKEN, ...extraParams }).toString();
        const url = `${BASE}${path}?${qs}`;
        https.get(url, { timeout: 15000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve({ status: res.statusCode, raw: data }); }
            });
        }).on('error', reject);
    });
}

// ──────── Agent mapping (3C Plus id → sistema id) ────────
// Maps 3C Plus agent names to the local sistema user names
const AGENT_MAP_3C_TO_LOCAL = {
    'Cauê Perpétuo': 'Cauê',
    'Eunice Dias': 'Eunice Dias',
};

// 3C Plus active agent IDs (auto-discovered)
const ACTIVE_AGENTS = {
    'Cauê Perpétuo': 207455,
    'Eunice Dias': 206069,
};

// ──────── Public API functions (all read-only) ────────

/** List all agents in the company */
async function getAgents() {
    return apiGet('/agents');
}

/** Current status of all agents (online/offline/idle/etc) */
async function getAgentsStatus() {
    return apiGet('/agents/status');
}

/** Online agents right now */
async function getAgentsOnline() {
    return apiGet('/agents/online');
}

/** Call statistics per day for a date range */
async function getCallStatistics(startDate, endDate, agentId) {
    const params = {
        start_date: startDate + ' 00:00:00',
        end_date: endDate + ' 23:59:59',
    };
    if (agentId) params.agent_id = agentId;
    return apiGet('/agent/statistics', params);
}

/** Status + metrics per agent with totals */
async function getAgentMetricsTotal(startDate, endDate) {
    return apiGet('/agents/status/metrics/total', {
        start_date: startDate + ' 00:00:00',
        end_date: endDate + ' 23:59:59',
        active: '1',
    });
}

/** Call history (paginated) */
async function getCallHistory(startDate, endDate, perPage = 50, page = 1) {
    return apiGet('/calls', {
        start_date: startDate + ' 00:00:00',
        end_date: endDate + ' 23:59:59',
        per_page: perPage,
        page: page,
        with_mailing: false,
    });
}

/** Fetch ALL call history by splitting date range into chunks and handling pagination */
async function getAllCallHistory(startDate, endDate) {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    const days = [];
    let cur = new Date(start);
    while (cur <= end) {
        days.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
    }

    if (isSyncing) {
        console.log('[3C Plus] Sincronização em curso. Aguardando...');
        let waitCount = 0;
        while (isSyncing && waitCount < 60) {
            await new Promise(r => setTimeout(r, 1000));
            waitCount++;
        }
        return days.map(d => CACHE_DATA[d] || []).flat();
    }

    isSyncing = true;
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        console.log(`[3C Plus] Iniciando busca inteligente de ${days.length} dias...`);
        
        // Sincronizar dias em paralelo (com limite implícito pelo Promise.all se necessário, mas 32 dias é ok)
        await Promise.all(days.map(async day => {
            // Se já temos o dia no cache e não é hoje, pulamos
            if (CACHE_DATA[day] && day !== todayStr) return; 

            const dayCalls = [];
            let page = 1;
            let totalPages = 1;
            const PER_PAGE = 500;

            try {
                do {
                    const res = await apiGet('/calls', {
                        start_date: day + ' 00:00:00',
                        end_date: day + ' 23:59:59',
                        per_page: PER_PAGE,
                        page: page
                    });
                    const data = res.data || [];
                    dayCalls.push(...data);
                    totalPages = res.last_page || (data.length === PER_PAGE ? page + 1 : page);
                    
                    if (page < totalPages) {
                        console.log(`[3C Plus] Buscando página ${page + 1} para o dia ${day}...`);
                        page++;
                    } else {
                        break;
                    }
                } while (page <= totalPages);

                CACHE_DATA[day] = dayCalls;
            } catch (err) {
                console.error(`[3C Plus] Erro no dia ${day}:`, err.message);
            }
        }));

        saveCache();
        return days.map(d => CACHE_DATA[d] || []).flat();
    } finally {
        isSyncing = false;
    }
}

/** Total call counts for a period */
async function getCallsTotal(startDate, endDate) {
    return apiGet('/calls/total', {
        start_date: startDate + ' 00:00:00',
        end_date: endDate + ' 23:59:59',
    });
}

/** Qualification statistics */
async function getQualificationStats(startDate, endDate) {
    return apiGet('/qualification/statistics', {
        start_date: startDate,
        end_date: endDate,
    });
}
/** List all qualifications (tabulacoes) */
async function getQualifications() {
    return apiGet('/qualifications');
}

/** List campaigns */
async function getCampaigns() {
    return apiGet('/campaigns');
}

/** Active calls right now */
async function getActiveCalls() {
    return apiGet('/company/calls');
}

/** Agents login history */
async function getLoginHistory(startDate, endDate) {
    return apiGet('/agents/login_history', {
        start_date: startDate + ' 00:00:00',
        end_date: endDate + ' 23:59:59',
    });
}

// ──────── Background Sync ────────
function startBackgroundSync() {
    console.log('[3C Plus] Iniciando worker de sincronização em segundo plano (5 min)...');
    
    const sync = async () => {
        try {
            const today = new Date();
            const start = new Date(today);
            start.setDate(today.getDate() - 32); // Ciclo de 32 dias
            
            const startDate = start.toISOString().split('T')[0];
            const endDate = today.toISOString().split('T')[0];
            
            await getAllCallHistory(startDate, endDate);
            console.log('[3C Plus] Sincronização em segundo plano concluída com sucesso.');
        } catch (e) {
            console.error('[3C Plus] Erro na sincronização em segundo plano:', e.message);
        }
    };

    // Executa imediatamente e depois a cada 5 minutos
    sync();
    setInterval(sync, 5 * 60 * 1000);
}

// Iniciar sync automático ao carregar o módulo
// Iniciar sync automático com atraso para dar tempo ao servidor subir
setTimeout(startBackgroundSync, 5000);

module.exports = {
    getAgents,
    getAgentsStatus,
    getAgentsOnline,
    getCallStatistics,
    getAgentMetricsTotal,
    getCallHistory,
    getAllCallHistory,
    getCallsTotal,
    getQualifications,
    getQualificationStats,
    getCampaigns,
    getActiveCalls,
    getLoginHistory,
    AGENT_MAP_3C_TO_LOCAL,
    ACTIVE_AGENTS,
    getCacheData: () => CACHE_DATA
};
