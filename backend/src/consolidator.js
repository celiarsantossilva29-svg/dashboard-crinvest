const gotoApi = require('./goto');
const tcPlus = require('./threecplus');
const db = require('./db');

class Consolidator {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutos de cache
    }

    /** Normalização de telefone para chave de cruzamento */
    static normalizePhone(phone) {
        if (!phone) return '';
        let clean = String(phone).replace(/\D/g, '');
        if (clean.startsWith('55') && clean.length > 10) {
            clean = clean.substring(2);
        }
        return clean;
    }

    /** 
     * Consolidação baseada em Telefonia e Financeiro Local (Sem Kommo)
     */
    async getConsolidatedData(startDate, endDate) {
        const cacheKey = `${startDate}_${endDate}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
            console.log(`[Consolidator V7] Retornando do cache para ${startDate} a ${endDate} (válido por 5min)`);
            return cached.data;
        }

        console.log(`[Consolidator V7] Iniciando consolidação pesada de ${startDate} a ${endDate}...`);

        const [gotoCallsRes, tcCallsRes, tcDailyStatsRes] = await Promise.all([
            gotoApi.getCallsHistory(startDate, endDate).catch(e => { console.error('Erro GoTo:', e.message); return { items: [] }; }),
            tcPlus.getAllCallHistory(startDate, endDate).catch(e => { console.error('Erro 3C Plus:', e.message); return { data: [] }; }),
            tcPlus.getCallStatistics(startDate, endDate).catch(e => { console.error('Erro 3C Stats:', e.message); return { data: [] }; })
        ]);

        const gotoCalls = gotoCallsRes.items || [];
        const tcCalls = tcCallsRes.data || [];
        const tcDailyStats = tcDailyStatsRes.data || []; // Stats diários: {date, answered, dmc, converted}
        const vendasLocais = db.dbData.Vendas || [];

        // Total real de chamadas 3C Plus (vem das estatísticas, que são mais completas que o histórico paginado)
        const totalTcCalls = tcDailyStats.reduce((s, d) => s + (d.answered || 0), 0);
        const totalDmc = tcDailyStats.reduce((s, d) => s + (d.dmc || 0), 0);

        // Contadores de qualificação do 3C Plus
        let qualAgendado = 0;
        let qualNegociacao = 0;
        let qualSemInteresse = 0;

        console.log(`[Consolidator] Chamadas GoTo: ${gotoCalls.length}, Chamadas 3C: ${tcCalls.length}, Vendas: ${vendasLocais.length}`);

        const masterLeads = {};

        // Helper: parse "HH:MM:SS" → seconds
        function parseDuration(str) {
            if (!str || str === '-') return 0;
            const parts = String(str).split(':').map(Number);
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            return 0;
        }

        // 1. Processar Chamadas GoTo (SDR)
        gotoCalls.forEach(call => {
            const phone = call.callee?.number || call.caller?.number;
            const norm = Consolidator.normalizePhone(phone);
            if (!norm) return;

            if (!masterLeads[norm]) {
                masterLeads[norm] = this.createEmptyLead(norm, phone);
            }
            
            const lead = masterLeads[norm];
            lead.activity.total_calls_goto++;
            const callStart = new Date(call.startTime).toISOString();
            if (!lead.timeline.first_contact_at || callStart < lead.timeline.first_contact_at) {
                lead.timeline.first_contact_at = callStart;
            }
            if (call.duration > 45) lead.activity.total_effective_contacts++;
        });

        // 2. Processar Chamadas 3C Plus (Closer) — COM QUALIFICAÇÕES
        tcCalls.forEach(call => {
            const norm = Consolidator.normalizePhone(call.number);
            if (!norm) return;

            if (!masterLeads[norm]) {
                masterLeads[norm] = this.createEmptyLead(norm, call.number);
            }

            const lead = masterLeads[norm];
            lead.activity.total_calls_3c++;
            
            // Enriquecer nome do lead via mailing_data (3C Plus)
            if (call.mailing_data?.identifier && lead.lead_name.startsWith('Lead ')) {
                lead.lead_name = call.mailing_data.identifier;
            }
            
            const callDate = new Date(call.call_date).toISOString();
            if (!lead.timeline.first_contact_at || callDate < lead.timeline.first_contact_at) {
                lead.timeline.first_contact_at = callDate;
            }
            
            // Duração efetiva (parse HH:MM:SS)
            const durationSec = parseDuration(call.speaking_with_agent_time);
            if (durationSec > 45 || call.is_dmc) lead.activity.total_effective_contacts++;
            
            // QUALIFICAÇÃO (Tabulação 3C Plus) — Fonte de Verdade para Status
            const qual = (call.qualification || '').toLowerCase();
            if (qual !== '-' && qual !== '') {
                // Agendamento: "Retornar para Cliente", "Agendamento - Retorno", "Showroom"
                if (qual.includes('retornar') || qual.includes('agend') || qual.includes('showroom')) {
                    lead.metrics.scheduled = true;
                    qualAgendado++;
                }
                // Negociação: "Em negociação whatsApp"
                if (qual.includes('negocia')) {
                    lead.metrics.negociacao = true;
                    qualNegociacao++;
                }
                // Sem interesse
                if (qual.includes('sem interesse')) {
                    qualSemInteresse++;
                }
            }
        });

        const leadsArray = Object.values(masterLeads);

        // 3. Cruzamento Financeiro (Database Local) — Direto por data, sem dependência de telefone
        const vendasNoPeriodo = vendasLocais.filter(v => {
            if (!v.data_fechamento) return false;
            return v.data_fechamento >= startDate && v.data_fechamento <= endDate;
        });

        // Vínculo por nome (cliente_nome) com leads quando possível
        vendasNoPeriodo.forEach(v => {
            // Tenta vincular pelo nome do cliente nos leads existentes
            const matchingLead = leadsArray.find(l => l.lead_name && l.lead_name === v.cliente_nome);
            if (matchingLead) {
                matchingLead.metrics.won = true;
                matchingLead.price = v.valor_venda;
                matchingLead.phone = v.cliente_telefone || matchingLead.phone;
                matchingLead.location = v.cliente_localizacao;
            }
        });

        // Resumo Final
        const totalFaturamento = vendasNoPeriodo.reduce((acc, v) => acc + (v.valor_venda || 0), 0);
        const totalComissao = vendasNoPeriodo.reduce((acc, v) => acc + (v.valor_comissao_total_closer || 0) + (v.valor_comissao_total_sdr || 0), 0);

        // Contar leads por status de qualificação
        const leadsAgendados = leadsArray.filter(l => l.metrics.scheduled).length;
        const leadsNegociacao = leadsArray.filter(l => l.metrics.negociacao).length;

        const summary = {
            totalCalls: gotoCalls.length + totalTcCalls,  // Usa total real do statistics (não paginado)
            gotoCalls: gotoCalls.length,
            threeCCalls: totalTcCalls,
            effectiveContacts: totalDmc,   // DMC vem das stats (mais preciso)
            won: vendasNoPeriodo.length,
            faturamento: totalFaturamento,
            comissaoTotal: totalComissao,
            scheduled: leadsAgendados,          // "Retornar para Cliente" / "Agendado" via 3C Plus
            meetingHeld: leadsNegociacao,        // "Em negociação" via 3C Plus  
            noShow: qualSemInteresse,            // "Sem interesse" via 3C Plus
            qualBreakdown: {                     // Detalhamento para debug
                agendado: qualAgendado,
                negociacao: qualNegociacao,
                semInteresse: qualSemInteresse
            }
        };

        const daily = {};

        // 4. Dados diários do gráfico — fonte primária: getCallStatistics (cobertura completa)
        tcDailyStats.forEach(d => {
            const day = d.date.split(' ')[0]; // "2026-03-02 00:00:00" → "2026-03-02" 
            if (!daily[day]) daily[day] = { date: day, calls: 0, effective: 0, won: 0, faturamento: 0 };
            daily[day].calls += (d.answered || 0);
            daily[day].effective += (d.dmc || 0);
        });

        // Adicionar chamadas GoTo aos dias
        gotoCalls.forEach(call => {
            const day = new Date(call.startTime).toISOString().split('T')[0];
            if (!daily[day]) daily[day] = { date: day, calls: 0, effective: 0, won: 0, faturamento: 0 };
            daily[day].calls++;
            if (call.duration > 45) daily[day].effective++;
        });

        // Distribuir vendas nos dias corretos (pela data_fechamento)
        vendasNoPeriodo.forEach(v => {
            const day = v.data_fechamento;
            if (!daily[day]) daily[day] = { date: day, calls: 0, effective: 0, won: 0, faturamento: 0 };
            daily[day].won++;
            daily[day].faturamento += (v.valor_venda || 0);
        });

        const dailyStats = Object.values(daily).sort((a,b) => a.date.localeCompare(b.date));

        // Resolver IDs de Closer/SDR para nomes
        const usuarios = db.dbData.Usuarios || [];
        const getUserName = (id) => {
            if (!id) return '—';
            const user = usuarios.find(u => u.id === id);
            return user ? user.nome : id.substring(0, 8);
        };

        const result = {
            summary,
            dailyStats,
            leads: leadsArray.slice(0, 50),
            vendas: vendasNoPeriodo.map(v => ({
                cliente: v.cliente_nome,
                valor: v.valor_venda,
                data: v.data_fechamento,
                administradora: v.administradora,
                closer: getUserName(v.closer_id),
                sdr: getUserName(v.sdr_id),
                comissaoCloser: v.valor_comissao_total_closer || 0,
                comissaoSdr: v.valor_comissao_total_sdr || 0,
                cliente_telefone: v.cliente_telefone,
                cliente_cnpj: v.cliente_cnpj,
                cliente_localizacao: v.cliente_localizacao
            }))
        };

        // Salvar no cache
        this.cache.set(cacheKey, { timestamp: Date.now(), data: result });
        return result;
    }

    createEmptyLead(norm, originalPhone) {
        return {
            phone_normalized: norm,
            phone: originalPhone,
            lead_name: `Lead ${norm.slice(-4)}`,
            price: 0,
            timeline: { first_contact_at: null },
            activity: { total_calls_goto: 0, total_calls_3c: 0, total_effective_contacts: 0 },
            metrics: { won: false, scheduled: false, negociacao: false }
        };
    }
}

module.exports = new Consolidator();
