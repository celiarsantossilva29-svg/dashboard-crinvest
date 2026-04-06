import React, { useMemo, useState, useEffect } from "react";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/layout/Header";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

import {
  CalendarCheck2,
  Target,
  TrendingUp,
  BadgeDollarSign,
  Filter,
  UserCircle,
  Phone,
  Clock3,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  UserCheck,
  CalendarCheck
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

function currency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value) {
  if (!Number.isFinite(value)) return "0,0%";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function MetricCard({ title, value, subtitle, icon: Icon, tone = "default" }) {
  const tones = {
    default: "text-[#1d1d1f] bg-[#f5f5f7]",
    gold: "text-[#1d1d1f] bg-gradient-to-r from-[#d4af37] to-[#e8c96b] shadow-[0_4px_14px_rgba(212,175,55,0.3)]",
    success: "text-[#008f39] bg-[#e6f4ea]",
    blue: "text-[#0066cc] bg-[#e8f2fc]",
    danger: "text-[#e3000f] bg-[#fceceb]"
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

function SectionCard({ title, subtitle, children, right }) {
  return (
    <section className="rounded-[32px] border border-black/[0.04] bg-white p-8 shadow-[0_8px_32px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_12px_44px_rgb(0,0,0,0.06)]">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">{title}</h2>
          {subtitle && <p className="mt-1.5 text-[15px] text-[#86868b] font-medium">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function DashboardCloser() {
  const { user } = useAuth();
  const [closerData, setCloserData] = useState(null);
  const [financeiro, setFinanceiro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterPerson, setFilterPerson] = useState('todos');
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchDashboardData = () => {
    setLoading(true);
    api.get(`/metrics/consolidated?startDate=${startDate}&endDate=${endDate}`)
      .then(res => setCloserData(res.data))
      .catch(err => {
        console.error(err);
        // Mock for layout
        setCloserData({
          summary: { scheduled: 12, meetingHeld: 8, won: 3, totalCalls: 145, effectiveContacts: 42, faturamento: 450000 },
          dailyStats: [
            { date: '2024-03-01', faturamento: 150000, calls: 20, effective: 5 },
            { date: '2024-03-02', faturamento: 0, calls: 25, effective: 8 },
            { date: '2024-03-03', faturamento: 300000, calls: 18, effective: 4 },
          ],
          leads: [
            { lead_name: "Roberto Almeida", phone: "11999999999", timeline: { first_contact_at: "2024-03-10T10:00:00Z" }, activity: { total_calls_3c: 5, total_calls_goto: 2 }, metrics: { won: true }, price: 1250000 },
            { lead_name: "Mariana Souza", phone: "11888888888", timeline: { first_contact_at: "2024-03-12T14:30:00Z" }, activity: { total_calls_3c: 3, total_calls_goto: 0 }, metrics: { won: false }, price: 850000 },
          ],
          vendas: [
             { data: '2024-03-10', cliente: 'Roberto Almeida', closer: 'Célia Invest', sdr: 'Cauê', administradora: 'Porto', valor: 1250000, comissaoCloser: 6250, comissaoSdr: 1250 }
          ]
        });
      })
      .finally(() => setLoading(false));
  };

  const fetchFinanceiro = () => {
    api.get("/meu-financeiro")
      .then(res => setFinanceiro(res.data))
      .catch(err => {
        console.error(err);
        setFinanceiro({
          meta: 2000000,
          fixo: 2500,
          chartData: [
            { month: 'Jan', fixo: 2500, variavel: 4500 },
            { month: 'Fev', fixo: 2500, variavel: 3800 },
            { month: 'Mar', fixo: 2500, variavel: 6200 },
          ]
        });
      });
  };

  useEffect(() => {
    fetchDashboardData();
    fetchFinanceiro();
  }, [startDate, endDate]);

  if (loading || !closerData || !closerData.summary) {
    return (
      <div className="flex h-screen bg-[#fbfbfd] overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <div className="flex-1 flex items-center justify-center text-[#86868b] font-medium tracking-tight">
            {!closerData || !closerData.summary 
              ? (loading ? "Consolidando dados (GoTo + 3C Plus + Vendas)..." : "Erro de conexão: Certifique-se que o backend (server.js) foi reiniciado.")
              : "Consolidando dados (GoTo + 3C Plus + Vendas)..."}
          </div>
        </div>
      </div>
    );
  }

  const { summary, dailyStats, leads, vendas } = closerData;

  // Show-Rate: "Em negociação" / "Agendamentos" (quantos agendados viraram negociação)
  const showRate = (summary.meetingHeld / (summary.scheduled || 1)) * 100;
  // Conversão: Vendas / (Agendamentos + Negociação) — base real de oportunidades trabalhadas
  const totalOportunidades = (summary.scheduled || 0) + (summary.meetingHeld || 0);
  const closingRate = (summary.won / (totalOportunidades || 1)) * 100;

  // Filtrar leads por pessoa selecionada
  const filteredLeads = filterPerson === 'todos' ? leads : leads.filter(l => {
    if (filterPerson === 'eunice') return l.activity.total_calls_3c > 0;
    if (filterPerson === 'caue') return l.activity.total_calls_goto > 0;
    return true;
  });

  return (
    <div className="flex h-screen bg-[#fbfbfd] overflow-hidden text-[#1d1d1f] font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#fbfbfd]">
          <div className="mx-auto px-8 py-10 lg:px-12 max-w-[1600px]">
            <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[13px] uppercase tracking-widest text-[#0066cc] font-semibold mb-2">
                  Visão de Fechamento V7
                </p>
                <h1 className="text-[40px] leading-tight font-semibold tracking-[-0.03em] text-[#1d1d1f]">
                  Inteligência Closer
                </h1>
                <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-[#86868b] font-medium">
                  Cruzamento em tempo real: GoTo Connect + 3C Plus + Vendas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 bg-white border border-[#e5e5ea] rounded-xl px-4 py-2.5 shadow-sm">
                  <UserCircle size={16} className="text-[#86868b]" />
                  <select 
                    value={filterPerson} 
                    onChange={e => setFilterPerson(e.target.value)} 
                    className="text-[14px] outline-none text-[#1d1d1f] font-medium bg-transparent cursor-pointer"
                  >
                    <option value="todos">Todos</option>
                    <option value="eunice">Eunice (Closer)</option>
                    <option value="caue">Cauê (SDR)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-white border border-[#e5e5ea] rounded-xl px-4 py-2.5 shadow-sm">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[14px] outline-none text-[#1d1d1f] font-medium bg-transparent cursor-pointer" />
                  <span className="text-[#86868b] text-[14px]">até</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[14px] outline-none text-[#1d1d1f] font-medium bg-transparent cursor-pointer" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-8">
              <MetricCard
                title="Minha Meta"
                value={currency(financeiro?.meta || 0)}
                subtitle={financeiro?.meta > summary.faturamento ? `Falta ${currency(financeiro.meta - summary.faturamento)}` : "Meta Atingida! 🎉"}
                icon={Target}
                tone="gold"
              />
              <MetricCard
                title="Fixo + Comissão"
                value={currency(financeiro?.fixo || 0)}
                subtitle="Salário base mensal"
                icon={BadgeDollarSign}
                tone="success"
              />
              <MetricCard
                title="Fechamento"
                value={percent(closingRate)}
                subtitle={`${summary.won} vendas / ${totalOportunidades} oport.`}
                icon={TrendingUp}
                tone="blue"
              />
              <MetricCard
                title="Efetividade"
                value={summary.effectiveContacts}
                subtitle="Chamadas > 45s"
                icon={UserCheck}
                tone="success"
              />
              <MetricCard
                title="SDR Score"
                value={summary.totalCalls}
                subtitle="Volume 3C + GoTo"
                icon={Phone}
                tone="default"
              />
            </div>

            <div className="mb-8">
              <SectionCard title="Projeção Salarial (12 Meses)" subtitle="Previsão baseada em parcelas de vendas e fixo mensal">
                <div className="h-[350px] w-full mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={financeiro?.chartData || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f7" />
                      <XAxis dataKey="month" stroke="#86868b" tickLine={false} axisLine={false} dy={10} fontSize={12} />
                      <YAxis stroke="#86868b" tickLine={false} axisLine={false} dx={-10} fontSize={12} tickFormatter={(val) => `R$ ${val/1000}k`} />
                      <Tooltip formatter={(val) => currency(val)} />
                      <Legend verticalAlign="top" height={36} />
                      <Area type="monotone" dataKey="fixo" name="Fixo" fill="#f5f5f7" stroke="#e5e5ea" stackId="1" />
                      <Area type="monotone" dataKey="variavel" name="Variável (Comissões)" fill="#d4af37" stroke="#b8860b" stackId="1" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SectionCard title="Performance Financeira" subtitle="Venda diária baseada em data de contato">
                <div className="h-[350px] w-full mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f7" />
                      <XAxis dataKey="date" stroke="#86868b" tickLine={false} axisLine={false} dy={10} fontSize={12} tickFormatter={(val) => new Date(val + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} />
                      <YAxis stroke="#86868b" tickLine={false} axisLine={false} dx={-10} fontSize={12} />
                      <Tooltip />
                      <Legend verticalAlign="top" height={36} />
                      <Area type="monotone" dataKey="faturamento" fill="#e8f2fc" stroke="#0066cc" name="Venda (R$)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title="Atividade de Telefonia" subtitle="Chamadas vs Contato Efetivo">
                <div className="h-[350px] w-full mt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f7" />
                      <XAxis dataKey="date" stroke="#86868b" tickLine={false} axisLine={false} dy={10} fontSize={12} tickFormatter={(val) => new Date(val + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} />
                      <YAxis stroke="#86868b" tickLine={false} axisLine={false} dx={-10} fontSize={12} />
                      <Tooltip />
                      <Legend verticalAlign="top" height={36} />
                      <Bar dataKey="calls" fill="#1d1d1f" radius={[4, 4, 0, 0]} name="Total Chamadas" />
                      <Line type="monotone" dataKey="effective" stroke="#008f39" strokeWidth={2} name="Contatos Efetivos" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>

            {/* Tabela de Vendas */}
            {vendas && vendas.length > 0 && (
              <div className="mt-8">
                <SectionCard title="Vendas do Período" subtitle={`${vendas.length} vendas confirmadas`}>
                  <div className="overflow-x-auto mt-6">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="border-b border-black/[0.04]">
                          <th className="px-4 py-4 text-[13px] font-bold text-[#86868b] uppercase">Data</th>
                          <th className="px-4 py-4 text-[13px] font-bold text-[#86868b] uppercase">Cliente</th>
                          <th className="px-4 py-4 text-[13px] font-bold text-[#86868b] uppercase">Closer</th>
                          <th className="px-4 py-4 text-[13px] font-bold text-[#86868b] uppercase">SDR</th>
                          <th className="px-4 py-4 text-[13px] font-bold text-[#86868b] uppercase">Administradora</th>
                          <th className="px-4 py-4 text-[13px] font-bold text-[#86868b] uppercase text-right">Valor</th>
                          <th className="px-4 py-4 text-[13px] font-bold text-[#86868b] uppercase text-right">Comissão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendas.map((v, idx) => (
                          <tr key={idx} className="border-b border-black/[0.02] last:border-0 hover:bg-[#fbfbfd]">
                            <td className="px-4 py-5 text-[14px] text-[#1d1d1f]">
                              {new Date(v.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-4 py-5">
                              <p className="text-[15px] font-bold text-[#1d1d1f]">{v.cliente}</p>
                            </td>
                            <td className="px-4 py-5">
                              <span className="inline-flex rounded-full px-3 py-1 text-[12px] font-bold bg-purple-100 text-purple-700">
                                {v.closer}
                              </span>
                            </td>
                            <td className="px-4 py-5">
                              <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold ${v.sdr !== '—' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                {v.sdr}
                              </span>
                            </td>
                            <td className="px-4 py-5 text-[14px] text-[#1d1d1f]">{v.administradora}</td>
                            <td className="px-4 py-5 text-right">
                              <p className="text-[15px] font-bold text-[#008f39]">{currency(v.valor)}</p>
                            </td>
                            <td className="px-4 py-5 text-right">
                              <p className="text-[14px] text-[#1d1d1f]">{currency(v.comissaoCloser + v.comissaoSdr)}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            )}

            <div className="mt-8">
              <SectionCard 
                title="Log de Contatos Recentes" 
                subtitle="Cruzamento de voz e conversão financeira"
              >
                <div className="overflow-x-auto mt-6">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="border-b border-black/[0.04]">
                        <th className="px-4 py-4 text-[13px] font-bold text-[#86868b] uppercase">Contato</th>
                        <th className="px-4 py-4 text-[13px] font-bold text-[#86868b] uppercase">Primeiro Toque</th>
                        <th className="px-4 py-4 text-[13px] font-bold text-[#86868b] uppercase text-center">3C Plus (Eunice)</th>
                        <th className="px-4 py-4 text-[13px] font-bold text-[#86868b] uppercase text-center">GoTo (Cauê)</th>
                        <th className="px-4 py-4 text-[13px] font-bold text-[#86868b] uppercase text-right">Venda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((l, idx) => (
                        <tr key={idx} className="border-b border-black/[0.02] last:border-0 hover:bg-[#fbfbfd]">
                          <td className="px-4 py-5">
                            <p className="text-[15px] font-bold text-[#1d1d1f]">{l.lead_name}</p>
                            <p className="text-[13px] text-[#86868b]">{l.phone}</p>
                          </td>
                          <td className="px-4 py-5">
                            <span className="text-[14px] text-[#1d1d1f]">
                              {l.timeline.first_contact_at ? new Date(l.timeline.first_contact_at).toLocaleString('pt-BR') : 'Sem contato'}
                            </span>
                          </td>
                          <td className="px-4 py-5 text-center">
                            <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold ${
                              l.activity.total_calls_3c > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {l.activity.total_calls_3c} ligações
                            </span>
                          </td>
                          <td className="px-4 py-5 text-center">
                            <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold ${
                              l.activity.total_calls_goto > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {l.activity.total_calls_goto} ligações
                            </span>
                          </td>
                          <td className="px-4 py-5 text-right">
                            <p className={`text-[15px] font-bold ${l.metrics.won ? 'text-[#008f39]' : 'text-[#86868b]'}`}>
                              {l.metrics.won ? currency(l.price) : '--'}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
