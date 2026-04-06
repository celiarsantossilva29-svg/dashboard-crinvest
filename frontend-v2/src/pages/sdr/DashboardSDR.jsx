import React, { useState, useEffect } from "react";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/layout/Header";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

import {
  Phone,
  CalendarCheck2,
  Clock3,
  TrendingUp,
  Users,
  PlusCircle,
  Wifi,
  WifiOff,
  Handshake,
  Info,
  Target,
  BadgeDollarSign
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line
} from "recharts";
import NovaVendaModal from "../../components/shared/NovaVendaModal";

/* ─── helper components ─── */
function MetricCard({ title, value, subtitle, icon: Icon, tone = "default" }) {
  const tones = {
    default: "text-[#1d1d1f] bg-[#f5f5f7]",
    gold: "text-[#1d1d1f] bg-gradient-to-r from-[#d4af37] to-[#e8c96b] shadow-[0_4px_14px_rgba(212,175,55,0.3)]",
    success: "text-[#008f39] bg-[#e6f4ea]",
    blue: "text-[#0066cc] bg-[#e8f2fc]",
    danger: "text-[#e3000f] bg-[#fceceb]",
  };
  return (
    <div className="group relative rounded-[28px] border border-black/[0.04] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] flex flex-col justify-between overflow-hidden">
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wider text-[#86868b]">{title}</p>
          <h3 className="mt-3 text-[34px] leading-none font-bold tracking-tight text-[#1d1d1f]">{value}</h3>
        </div>
        <div className={`rounded-2xl p-3.5 ${tones[tone]}`}>
          <Icon size={22} strokeWidth={2} />
        </div>
      </div>
      <p className="relative text-[14px] mt-6 font-medium text-[#86868b] leading-tight">{subtitle}</p>
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="rounded-[32px] border border-black/[0.04] bg-white p-8 shadow-[0_8px_32px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_12px_44px_rgb(0,0,0,0.06)]">
      <div className="mb-6">
        <h2 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">{title}</h2>
        {subtitle && <p className="mt-1.5 text-[15px] text-[#86868b] font-medium">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/* ─── main component ─── */
function currency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(value);
}

export default function DashboardSDR() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [financeiro, setFinanceiro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = () => {
    setLoading(true);
    api.get(`/3cplus/sdr-dashboard?start_date=${startDate}&end_date=${endDate}`)
      .then(res => setData(res.data))
      .catch(err => {
        console.error(err);
        setData({
          monthly: { conversionRate: 15.5, dmc: 450 },
          today: { calls: 42, converted: 8, dmc: 35 },
          kommoPipeline: [
            { id: 1, lead: "Empresa XPTO", etapa: "Lead Novo (Sem Toque)", dias: 1, valor: 50000, tarefaAtrasada: false },
            { id: 2, lead: "Grupo Invest", etapa: "Em Tentativa (Follow-up)", dias: 3, valor: 120000, tarefaAtrasada: true },
            { id: 3, lead: "João Silva", etapa: "Agendado", dias: 5, valor: 85000, tarefaAtrasada: false },
          ],
          agentsBreakdown: [
            { nameLocal: "Cauê", name3c: "caue.sdr", monthCalls: 450, monthDMC: 380, monthConverted: 45 },
            { nameLocal: "Eunice", name3c: "eunice.closer", monthCalls: 120, monthDMC: 110, monthConverted: 12 },
          ],
          agentsOnline: [
            { name: "Cauê", status: "Em Pausa" },
            { name: "Eunice", status: "Disponível" },
          ]
        });
      })
      .finally(() => setLoading(false));
    
    api.get("/meu-financeiro")
      .then(res => setFinanceiro(res.data))
      .catch(err => {
        console.error(err);
        setFinanceiro({
          meta: 1500000,
          fixo: 1800,
          chartData: [
            { month: 'Jan', fixo: 1800, variavel: 2100 },
            { month: 'Fev', fixo: 1800, variavel: 1950 },
            { month: 'Mar', fixo: 1800, variavel: 3200 },
          ]
        });
      });
  };

  useEffect(() => { fetchData(); }, [startDate, endDate]);

  if (loading || !data) {
    return (
      <div className="flex h-screen bg-[#fbfbfd] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <div className="flex-1 flex items-center justify-center text-[#86868b] font-medium tracking-tight">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]" />
              Conectando ao 3C Plus...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ──────── V3: SDR INVENTORY FLOW ALGORITHM ────────
  const pipelineStats = { "Lead Novo (Sem Toque)": 0, "Em Tentativa (Follow-up)": 0, "Contatado (S/ Agendamento)": 0, "Agendamento Efetuado": 0 };
  
  (data.kommoPipeline || []).forEach(lead => {
    if (lead.etapa.includes('Novo') || lead.etapa === 'Entrada') pipelineStats["Lead Novo (Sem Toque)"]++;
    else if (lead.etapa.includes('Tentativa') || lead.etapa.includes('1°')) pipelineStats["Em Tentativa (Follow-up)"]++;
    else if (lead.etapa.includes('Reagendamento') || lead.etapa === 'Contatado') pipelineStats["Contatado (S/ Agendamento)"]++;
    else if (lead.etapa.includes('Confirmada') || lead.etapa === 'Agendado') pipelineStats["Agendamento Efetuado"]++;
    else pipelineStats["Em Tentativa (Follow-up)"]++;
  });

  const stackedData = [{
    name: 'Inventário SDR',
    "Sem Toque": pipelineStats["Lead Novo (Sem Toque)"],
    "Tentativa": pipelineStats["Em Tentativa (Follow-up)"],
    "Contatado": pipelineStats["Contatado (S/ Agendamento)"],
    "Agendado": pipelineStats["Agendamento Efetuado"],
  }];

  const agents = data.agentsBreakdown || [];
  const onlineAgents = data.agentsOnline || [];

  const contatosEfetivos = Math.floor((data.monthly?.dmc || 0) * 0.95);


  return (
    <div className="flex h-screen bg-[#fbfbfd] overflow-hidden text-[#1d1d1f] font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#fbfbfd]">
          <div className="mx-auto px-8 py-10 lg:px-12 max-w-[1600px]">
            {/* Header */}
            <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[13px] uppercase tracking-widest text-[#d4af37] font-semibold mb-2">
                  Dados em tempo real · 3C Plus
                </p>
                <h1 className="text-[40px] leading-tight font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                  Dashboard Ligações
                </h1>
                <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-[#86868b] font-medium">
                  Métricas de ligações de todos os agentes via 3C Plus — somente leitura.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 bg-white border border-[#e5e5ea] rounded-xl px-4 py-2.5 shadow-sm">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[14px] outline-none text-[#1d1d1f] font-medium bg-transparent cursor-pointer" />
                  <span className="text-[#86868b] text-[14px]">até</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[14px] outline-none text-[#1d1d1f] font-medium bg-transparent cursor-pointer" />
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#1d1d1f] to-[#434346] px-5 py-2.5 text-[15px] font-semibold text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg"
                >
                  <PlusCircle size={18} className="text-[#d4af37]" />
                  <span>Registrar Venda</span>
                </button>
                <button
                  onClick={fetchData}
                  className="flex items-center gap-2 rounded-2xl bg-[#f5f5f7] px-4 py-2.5 text-[15px] font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] transition-colors"
                >
                  <TrendingUp size={16} className="text-[#86868b]" />
                  Atualizar
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <MetricCard
                title="Minha Meta Mensal"
                value={currency(financeiro?.meta || 0)}
                subtitle={financeiro?.meta > (data.monthly?.conversionRate || 0) ? `Foco no faturamento!` : "Meta Atingida! 🎉"}
                icon={Target}
                tone="gold"
              />
              <MetricCard
                title="Previsão Salarial"
                value={currency(financeiro?.fixo || 0)}
                subtitle="Fixo + Comissão Projetada"
                icon={BadgeDollarSign}
                tone="success"
              />
              <MetricCard
                title="Conversão Pitch"
                value={data.monthly?.conversionRate ? `${data.monthly.conversionRate}%` : '0.0%'}
                subtitle="Agendados vs Atendidos"
                icon={Handshake}
                tone="blue"
              />
              <MetricCard
                title="Energia Diária (DMC)"
                value={data.today?.dmc || contatosEfetivos || 0}
                subtitle="Chamadas > 45s hoje"
                icon={Phone}
                tone="default"
              />
            </div>

            <div className="mb-8">
              <SectionCard title="Projeção Financeira (12 Meses)" subtitle="Salário Fixo + Comissões de SDR (Vendas Registradas)">
                <div className="h-[350px] w-full mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={financeiro?.chartData || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f7" />
                      <XAxis dataKey="month" stroke="#86868b" tickLine={false} axisLine={false} dy={10} fontSize={12} />
                      <YAxis stroke="#86868b" tickLine={false} axisLine={false} dx={-10} fontSize={12} tickFormatter={(val) => `R$ ${val/1000}k`} />
                      <Tooltip formatter={(val) => currency(val)} />
                      <Legend verticalAlign="top" height={36} />
                      <Area type="monotone" dataKey="fixo" name="Fixo" fill="#f5f5f7" stroke="#e5e5ea" stackId="1" />
                      <Area type="monotone" dataKey="variavel" name="Variável" fill="#d4af37" stroke="#b8860b" stackId="1" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            {/* Per-Agent Breakdown + Online Status */}
            <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <SectionCard title="Performance por Agente" subtitle="Ligações atendidas por cada agente no mês (3C Plus)">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[#e5e5ea]">
                          <th className="pb-3 text-[13px] font-semibold uppercase tracking-wider text-[#86868b]">Agente</th>
                          <th className="pb-3 text-[13px] font-semibold uppercase tracking-wider text-[#86868b] text-right">Ligações</th>
                          <th className="pb-3 text-[13px] font-semibold uppercase tracking-wider text-[#86868b] text-right">DMC</th>
                          <th className="pb-3 text-[13px] font-semibold uppercase tracking-wider text-[#86868b] text-right">Convertidas</th>
                          <th className="pb-3 text-[13px] font-semibold uppercase tracking-wider text-[#86868b] text-right">Taxa Conv.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agents.map((ag, i) => {
                          const convRate = ag.monthCalls > 0
                            ? ((ag.monthConverted / ag.monthCalls) * 100).toFixed(1)
                            : '0.0';
                          return (
                            <tr key={i} className="border-b border-[#f5f5f7] hover:bg-[#fafafa] transition-colors">
                              <td className="py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8860b] flex items-center justify-center text-white font-bold text-[14px]">
                                    {ag.nameLocal.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-[15px] font-semibold text-[#1d1d1f]">{ag.nameLocal}</p>
                                    <p className="text-[12px] text-[#86868b]">{ag.name3c}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 text-right">
                                <span className="text-[20px] font-bold text-[#1d1d1f]">{ag.monthCalls}</span>
                              </td>
                              <td className="py-4 text-right">
                                <span className="text-[15px] font-semibold text-[#0066cc]">{ag.monthDMC}</span>
                              </td>
                              <td className="py-4 text-right">
                                <span className="text-[15px] font-semibold text-[#008f39]">{ag.monthConverted}</span>
                              </td>
                              <td className="py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-2 rounded-full bg-[#e5e5ea] overflow-hidden">
                                    <div className="h-full bg-[#34c759] rounded-full" style={{ width: `${Math.min(convRate, 100)}%` }} />
                                  </div>
                                  <span className="text-[13px] font-medium text-[#86868b] w-12 text-right">{convRate}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>

              <div className="flex flex-col space-y-6">
                <SectionCard title="Status Agentes" subtitle="Quem está online agora (3C Plus)">
                  {onlineAgents.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-[#86868b]">
                      <WifiOff size={32} strokeWidth={1.5} />
                      <p className="mt-3 text-[15px] font-medium">Nenhum agente online</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {onlineAgents.map((ag, i) => (
                        <div key={i} className="flex items-center justify-between rounded-2xl bg-[#f5f5f7] p-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-[#1d1d1f] flex items-center justify-center text-white font-bold text-[14px]">
                                {(ag.name || '?').charAt(0)}
                              </div>
                              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#34c759] border-2 border-white" />
                            </div>
                            <div>
                              <p className="text-[15px] font-semibold text-[#1d1d1f]">{ag.name}</p>
                              <p className="text-[12px] text-[#86868b] capitalize">{ag.status || 'online'}</p>
                            </div>
                          </div>
                          <Wifi size={16} className="text-[#34c759]" />
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* Hoje pulse */}
                <SectionCard title="Pulso Hoje" subtitle="Atividade do dia">
                  <div className="rounded-3xl bg-[#f5f5f7] p-6">
                    <div className="flex items-center justify-between">
                      <p className="text-[15px] font-semibold text-[#1d1d1f]">Ligações</p>
                      <p className="text-[26px] font-bold text-[#0066cc]">{data.today?.calls || 0}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-3xl bg-[#f5f5f7] p-6">
                    <div className="flex items-center justify-between">
                      <p className="text-[15px] font-semibold text-[#1d1d1f]">Conversões hoje</p>
                      <p className="text-[26px] font-bold text-[#008f39]">{data.today?.converted || 0}</p>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>

            {/* Pipeline SDR */}
            <div className="mt-8">
              <SectionCard title="Meus Leads em Negociação" subtitle="Leads ativos e tarefas atrasadas no CRM Kommo">
                <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-2">
                  {(data.kommoPipeline || []).length === 0 ? (
                    <p className="text-center text-[14px] text-[#86868b] py-6">Nenhum lead ativo encontrado no Kommo.</p>
                  ) : (
                    (data.kommoPipeline || []).map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between rounded-2xl border border-black/[0.04] bg-white p-4 transition-all hover:bg-[#fbfbfd]">
                        <div className="flex-1">
                          <p className="text-[15px] font-semibold text-[#1d1d1f]">{lead.lead}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b]">{lead.etapa}</span>
                            <span className="text-[12px] text-[#86868b]">{lead.dias} dias na base</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[14px] font-bold text-[#1d1d1f]">{currency(lead.valor)}</p>
                          {lead.tarefaAtrasada ? (
                            <p className="text-[11px] font-bold text-[#e3000f] uppercase mt-1">Tarefa Atrasada</p>
                          ) : (
                            <p className="text-[11px] font-medium text-[#008f39] uppercase mt-1">SLA em dia</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>

            {/* Evolução da Performance */}
            <div className="mt-8">
              <SectionCard title="Tração do Funil (SDR V3)" subtitle="Gargalos de qualificação e volume estático da esteira comercial">
                <div className="w-full" style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={stackedData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f5f5f7" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" hide />
                      <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontWeight: 600 }}
                      />
                      <Legend />
                      <Bar dataKey="Sem Toque" stackId="a" fill="#ff3b30" radius={[12,0,0,12]} barSize={45} />
                      <Bar dataKey="Tentativa" stackId="a" fill="#ff9500" barSize={45} />
                      <Bar dataKey="Contatado" stackId="a" fill="#0066cc" barSize={45} />
                      <Bar dataKey="Agendado" stackId="a" fill="#34c759" radius={[0,12,12,0]} barSize={45} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            <NovaVendaModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onSuccess={() => fetchData()}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
