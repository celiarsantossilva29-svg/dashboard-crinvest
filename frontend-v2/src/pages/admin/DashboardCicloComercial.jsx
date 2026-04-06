
import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import api from '../../services/api';
import {
  Target, TrendingUp, Calendar, ChevronRight, AlertCircle,
  ArrowUpRight, ArrowDownRight, Phone, Zap, ShoppingCart, Users
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';

const BRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
const pct = (v) => `${(v || 0).toFixed(1).replace('.', ',')}%`;
const fmtTime = (s) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h}h${m}m`; };

const GOLD = '#c8a23c';
const GREEN = '#16a34a';
const RED = '#dc2626';
const BLUE = '#2563eb';
const PIE_COLORS = ['#c8a23c', '#2563eb', '#16a34a', '#dc2626', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899'];

// Reusable card wrapper
const Card = ({ children, className = '', span = 6 }) => (
  <div className={`col-span-12 xl:col-span-${span} bg-white rounded-2xl p-6 border border-gray-100 shadow-sm ${className}`}>
    {children}
  </div>
);

const CardTitle = ({ title, subtitle }) => (
  <div className="mb-5">
    <h2 className="text-xl font-black text-gray-900">{title}</h2>
    {subtitle && <p className="text-sm text-gray-500 font-medium mt-0.5">{subtitle}</p>}
  </div>
);

// Big KPI display
const KPI = ({ label, value, color = 'text-gray-900', sub }) => (
  <div>
    <p className="text-[10px] font-bold text-gray-400">{label}</p>
    <p className={`text-[22px] font-black ${color} mt-0.5 leading-tight tabular-nums`}>{value}</p>
    {sub && <p className="text-[11px] text-gray-400 font-semibold mt-0.5">{sub}</p>}
  </div>
);

export default function DashboardCicloComercial() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(22);
    if (new Date().getDate() < 22) d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(startDate); d.setMonth(d.getMonth() + 1); d.setDate(21);
    return d.toISOString().split('T')[0];
  });
  const [cycleGoal, setCycleGoal] = useState(5000000);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCycle = () => {
    setLoading(true); setError(null);
    api.get(`/metrics/cycle?start_date=${startDate}&end_date=${endDate}&goal=${cycleGoal}`)
      .then(res => setData(res.data))
      .catch(err => {
        console.error(err);
        // Mock data for layout preview
        setData({
          thermometer: { current: 1850000, goal: 5000000, percent: 37, remaining: 3150000 },
          rhythm: { current: 62000, required: 166000, factor: 0.37, status: 'LOW', projection: 2400000 },
          funnel: { agendados: 124, reunioes: 85, vendas: 18 },
          closerPerformance: [
             { name: 'Célia Invest', vendas: 8, conversao: 12, faturamento: 850000 },
             { name: 'Eunice Silva', vendas: 6, conversao: 10.5, faturamento: 620000 }
          ],
          alerts: ['Ritmo de vendas 63% abaixo do necessário', 'Projeção de fechamento abaixo da meta'],
          cycleInfo: { elapsedDays: 12, totalDays: 30, remainingDays: 18 },
          activityCalls: {
            sdr: { calls: 450, talkTime: 16200 },
            closer: { calls: 120, talkTime: 8400, qualifications: { 'Negociação': 45, 'Follow-up': 32, 'Sem Interesse': 20 } }
          },
          predictability: { ticketMedio: 102000, totalVendas: 18, vendasParaMeta: 32, vendasPorDia: 1.8, vendasRealizadasPorDia: 1.5, projectionPercent: 48 }
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCycle(); }, [startDate, endDate, cycleGoal]);

  if (loading) return (
    <div className="flex h-screen bg-gray-50"><Sidebar /><div className="flex-1 flex flex-col"><Header />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-14 h-14 border-4 border-amber-400/30 border-t-amber-500 rounded-full animate-spin" />
      </div></div></div>
  );

  if (error || !data) return (
    <div className="flex h-screen bg-gray-50"><Sidebar /><div className="flex-1 flex flex-col"><Header />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <AlertCircle size={48} className="text-red-500" />
        <p className="text-red-600 font-black text-xl">{error || 'Sem dados'}</p>
        <button onClick={fetchCycle} className="px-8 py-3 bg-amber-500 text-white rounded-xl font-bold text-lg">Tentar Novamente</button>
      </div></div></div>
  );

  const therm = data.thermometer || {};
  const rhy = data.rhythm || {};
  const fun = data.funnel || {};
  const perf = data.closerPerformance || [];
  const alts = data.alerts || [];
  const info = data.cycleInfo || {};
  const act = data.activityCalls || {};
  const sdrData = act.sdr || { calls: 0, talkTime: 0 };
  const closerData = act.closer || { calls: 0, talkTime: 0, qualifications: {} };
  const pred = data.predictability || {};

  const rhythmOk = rhy.status === 'OK';
  const projOk = (rhy.projection || 0) >= (therm.goal || 1);
  const tColor = (therm.percent || 0) >= 60 ? GREEN : (therm.percent || 0) >= 30 ? GOLD : RED;
  const totalQuals = Object.values(closerData.qualifications || {}).reduce((a, b) => a + b, 0);

  // Chart: Ritmo
  const rhythmData = [
    { name: 'Atual', valor: Math.round(rhy.current || 0) },
    { name: 'Necessário', valor: Math.round(rhy.required || 0) }
  ];

  // Chart: Atividade
  const callsData = [
    { name: 'SDR (Cauê)', chamadas: sdrData.calls || 0, tempo: Math.round((sdrData.talkTime || 0) / 60) },
    { name: 'Closer (Eunice)', chamadas: closerData.calls || 0, tempo: Math.round((closerData.talkTime || 0) / 60) },
  ];

  // Chart: Tabulações pie
  const qualData = Object.entries(closerData.qualifications || {})
    .sort(([, a], [, b]) => b - a).slice(0, 8)
    .map(([name, count]) => ({ name: name || 'Sem Tab', value: count }));

  // Funnel steps
  const funnelSteps = [
    { label: 'Ligações SDR', value: sdrData.calls || 0, color: BLUE },
    { label: 'Agendamentos', value: fun.agendados || 0, color: '#8b5cf6' },
    { label: 'Reuniões', value: fun.reunioes || 0, color: GOLD },
    { label: 'Vendas', value: fun.vendas || 0, color: GREEN },
  ];

  const gaugeData = [{ name: 'Meta', value: Math.max(0, Math.min(100, therm.percent || 0)), fill: tColor }];

    return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto px-4 py-3 font-sans text-[#1d1d1f]">
          <div className="mx-auto max-w-7xl">
            {/* HEADER + FILTERS */}
            <div className="mb-3 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
              <div>
                <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Ciclo Comercial</h1>
                <p className="text-[12px] text-gray-500 font-medium mt-0">
                  Dia <span className="font-bold text-gray-900 tabular-nums">{info.elapsedDays || 0}</span> de {info.totalDays || 0}  •  <span className="font-bold text-gray-900 tabular-nums">{info.remainingDays || 0} dias restantes</span>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                <div className="flex items-center gap-3 bg-white px-4 h-11 rounded-xl border border-gray-100 shadow-sm">
                  <Calendar size={18} className="text-gray-400" />
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm font-bold text-gray-900 bg-transparent border-none outline-none cursor-pointer w-[115px]" />
                  <span className="text-gray-300">→</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold text-gray-900 bg-transparent border-none outline-none cursor-pointer w-[115px]" />
                </div>

                <div className="flex items-center gap-2.5 px-4 h-11 rounded-xl shadow-md border group cursor-text focus-within:ring-2 focus-within:ring-white/50" style={{ background: `linear-gradient(135deg, ${GOLD}, #b49136)`, borderColor: '#b49136' }}>
                  <Target size={18} className="text-white/80" />
                  <div className="flex flex-col justify-center">
                    <span className="text-[9px] font-black text-white/70 leading-none mb-0.5">Meta do ciclo</span>
                    <div className="flex items-center">
                      <span className="text-[12px] font-bold text-white/90 mr-1">R$</span>
                      <input 
                        type="text" 
                        value={new Intl.NumberFormat('pt-BR').format(cycleGoal || 0)} 
                        onChange={e => setCycleGoal(Number(e.target.value.replace(/\D/g, '')))} 
                        className="w-28 text-[18px] font-black text-white bg-transparent border-none outline-none placeholder-white/50 leading-none group-hover:bg-white/10 px-1 rounded transition-colors tabular-nums" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>


          {/* ALERT BANNER */}
          {alts.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {alts.map((a, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-amber-50 border-l-4 border-amber-500 px-3 py-2 rounded-r-lg">
                  <AlertCircle className="text-amber-600 shrink-0" size={18} />
                  <p className="text-sm font-bold text-amber-900">{a}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-12 gap-3">

            {/* ══════════════════════════════════════════════ */}
            {/* ROW 1: TOP EXECUTIVE KPIs                     */}
            {/* ══════════════════════════════════════════════ */}
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col justify-center">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">Ticket médio real</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className="text-[20px] font-black text-gray-900 tabular-nums">{BRL(pred.ticketMedio)}</p>
                  <p className="text-[9px] font-bold text-gray-400">/ {pred.totalVendas || 0} vd</p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col justify-center">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">Restam para a meta</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className="text-[20px] font-black text-amber-600 tabular-nums">{pred.vendasParaMeta || 0}</p>
                  <p className="text-[9px] font-bold text-gray-400">vd nec.</p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col justify-center">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">Ritmo de vendas (Exigido / Atual)</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className="text-[20px] font-black text-gray-900 tabular-nums">{(pred.vendasPorDia || 0).toFixed(1).replace('.', ',')}</p>
                  <p className="text-[9px] font-bold text-gray-400">vs {(pred.vendasRealizadasPorDia || 0).toFixed(1).replace('.', ',')} at.</p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col justify-center">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">Projeção do mês</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className={`text-[20px] font-black tabular-nums ${projOk ? 'text-green-600' : 'text-amber-600'}`}>{BRL(rhy.projection)}</p>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════ */}
            {/* ROW 2: TERMÔMETRO + FUNIL                     */}
            {/* ══════════════════════════════════════════════ */}
            {/* TERMÔMETRO */}
            <div className="col-span-12 xl:col-span-4 bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col justify-between">
              <CardTitle title="Termômetro de Meta" subtitle={`${BRL(therm.current)} de ${BRL(therm.goal)}`} />
              <div className="flex-1 flex flex-col items-center justify-center -mt-4">
                <RadialBarChart width={160} height={100} cx={80} cy={95} innerRadius={50} outerRadius={85}
                  startAngle={180} endAngle={0} data={gaugeData} barSize={10}>
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#f3f4f6' }} />
                </RadialBarChart>
                <p className="text-[22px] font-black -mt-6" style={{ color: tColor }}>{pct(therm.percent)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 text-center">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Realizado</p>
                  <p className="text-[16px] font-black text-gray-900 tabular-nums">{BRL(therm.current)}</p>
                </div>
                <div className="bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 text-center">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Falta</p>
                  <p className="text-[16px] font-black text-gray-500 tabular-nums">{BRL(therm.remaining)}</p>
                </div>
              </div>
              <div className={`mt-2 p-2.5 rounded-lg border ${projOk ? 'bg-green-50/50 border-green-100' : 'bg-amber-50/50 border-amber-100'}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Projeção</p>
                    <p className={`text-[16px] font-black tabular-nums ${projOk ? 'text-green-700' : 'text-amber-800'}`}>{BRL(rhy.projection)}</p>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500">{pct(pred.projectionPercent)} meta</span>
                </div>
              </div>
            </div>



            {/* FUNIL */}
            <div className="col-span-12 xl:col-span-8 bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col justify-between">
              <CardTitle title="Funil de Vendas" subtitle="Etapas e conversão geral" />
              
              <div className="flex-1 flex items-center gap-1 mb-3">
                {funnelSteps.map((step, i) => {
                  const next = funnelSteps[i + 1];
                  const rate = next && step.value > 0 ? (next.value / step.value * 100) : null;
                  return (
                    <React.Fragment key={step.label}>
                      <div className="flex-1 rounded-lg p-2.5 text-center border bg-gray-50/50" style={{ borderColor: `${step.color}30`, borderBottomWidth: '4px', borderBottomColor: step.color }}>
                        <p className="text-[20px] font-black text-gray-900 tabular-nums">{step.value}</p>
                        <p className="text-[9px] font-bold text-gray-500 mt-1 leading-tight">{step.label}</p>
                      </div>
                      {i < funnelSteps.length - 1 && (
                        <div className="flex flex-col items-center justify-center px-0.5 shrink-0 text-center">
                          <p className="text-[8px] font-bold text-gray-400">Conv.</p>
                          <ChevronRight size={14} className="text-gray-300 -my-0.5" />
                          {rate !== null && <span className="text-[10px] font-black" style={{ color: rate >= 15 ? GREEN : RED }}>{pct(rate)}</span>}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="bg-gray-50 rounded-lg p-2.5 flex justify-between items-center border border-gray-100">
                <span className="text-xs font-bold text-gray-500">Conversão global (Lead → Venda)</span>
                <span className="text-lg font-black tabular-nums" style={{ color: (fun.vendas / (act.sdr.calls || 1) * 100) >= 1 ? GREEN : RED }}>
                  {act.sdr.calls > 0 ? pct(fun.vendas / act.sdr.calls * 100) : '0,0%'}
                </span>
              </div>
            </div>

            {/* ══════════════════════════════════════════════ */}
            {/* ROW 3: RITMO DIÁRIO + ATIVIDADE                 */}
            {/* ══════════════════════════════════════════════ */}

            {/* RITMO DIÁRIO (Movid) */}
            <div className="col-span-12 xl:col-span-6 bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col justify-between">
              <CardTitle title="Ritmo Diário" subtitle="Venda média vs Meta diária" />
              
              <div className="flex-1 flex flex-col justify-center">
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={rhythmData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}K` : v} tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} width={80} />
                    <Tooltip formatter={v => BRL(v)} cursor={{ fill: '#f9fafb' }} />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={24}>
                      <Cell fill={rhythmOk ? GREEN : '#3b82f6'} />
                      <Cell fill={GOLD} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={`mt-1.5 flex items-center gap-2.5 p-2.5 rounded-lg border ${rhythmOk ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${rhythmOk ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                  {rhythmOk ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                </div>
                <div>
                  <p className={`text-xs font-bold ${rhythmOk ? 'text-green-700' : 'text-amber-800'} leading-tight lowercase first-letter:uppercase`}>
                    {rhythmOk ? 'Acima do necessário' : 'Abaixo do necessário'}
                  </p>
                  <p className="text-[10px] text-gray-600 font-medium mt-0.5"><strong className="text-gray-900">{BRL(rhy.current)}</strong>/dia vs <strong className="text-gray-900">{BRL(rhy.required)}</strong></p>
                </div>
              </div>
            </div>

            {/* ATIVIDADE */}
            <div className="col-span-12 xl:col-span-6 bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col justify-between">
              <CardTitle title="Atividade Telefônica" subtitle="Volume e tempo de chamadas" />

              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={callsData} margin={{ left: -20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="chamadas" name="Chamadas" radius={[4, 4, 0, 0]} barSize={32}>
                    <Cell fill={BLUE} /><Cell fill={GREEN} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-bold text-gray-500 lowercase first-letter:uppercase">SDR • {act.sdr.calls}</p>
                    <p className="text-lg font-black text-blue-600 leading-none mt-1">{fmtTime(act.sdr.talkTime)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-gray-400 font-semibold">Média</p>
                    <p className="text-[12px] font-bold text-gray-700">{fmtTime(act.sdr.calls > 0 ? act.sdr.talkTime / act.sdr.calls : 0)}</p>
                  </div>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-bold text-gray-500 lowercase first-letter:uppercase">Closer • {act.closer.calls}</p>
                    <p className="text-lg font-black text-green-600 leading-none mt-1">{fmtTime(act.closer.talkTime)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-gray-400 font-semibold">Média</p>
                    <p className="text-[12px] font-bold text-gray-700">{fmtTime(act.closer.calls > 0 ? act.closer.talkTime / act.closer.calls : 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════ */}
            {/* ROW 3: TABULAÇÕES + RANKING                    */}
            {/* ══════════════════════════════════════════════ */}

            {totalQuals > 0 && (
              <div className="col-span-12 xl:col-span-4 bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex flex-col">
                <CardTitle title="Tabulações 3C" subtitle={`${totalQuals} ligações qualificadas`} />
                <div className="flex-1 flex flex-col justify-center gap-1 overflow-y-auto max-h-[220px] pr-2">
                  {qualData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs font-semibold text-gray-700 truncate flex-1">{item.name}</span>
                      <span className="text-sm font-black text-gray-900">{item.value}</span>
                      <span className="text-[10px] text-gray-400 font-bold w-10 text-right">{pct(item.value / totalQuals * 100)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`col-span-12 ${totalQuals > 0 ? 'xl:col-span-8' : ''} bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex flex-col`}>
              <CardTitle title="Ranking de Performance" subtitle="Resultados por membro do time" />
              <div className="flex-1 overflow-x-auto">
              {perf.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="pb-2 text-[10px] font-bold text-gray-400">Consultor</th>
                      <th className="pb-2 text-[10px] font-bold text-gray-400 text-center">Vendas</th>
                      <th className="pb-2 text-[10px] font-bold text-gray-400 text-center">Conversão</th>
                      <th className="pb-2 text-[10px] font-bold text-gray-400 text-right">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perf.map((c, i) => (
                      <tr key={c.name} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors`}>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            {c.name.toLowerCase().includes('célia') || c.name.toLowerCase().includes('cauê') || c.name.toLowerCase().includes('eunice') ? (
                              <div className="h-6 w-6 rounded-full border border-white shadow-sm ring-1 ring-gray-100 overflow-hidden shrink-0">
                                <img 
                                  src={
                                    c.name.toLowerCase().includes('célia') ? "/img/celia.png" : 
                                    c.name.toLowerCase().includes('cauê') ? "/img/caue.png" : 
                                    "/img/eunice.png"
                                  } 
                                  className="h-full w-full object-cover" 
                                />
                              </div>
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0 uppercase">
                                {c.name.charAt(0)}
                              </div>
                            )}
                            <span className="font-bold text-xs text-gray-900 truncate">{c.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-base font-black text-center text-gray-900">{c.vendas}</td>
                        <td className="py-2.5 text-center">
                          <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded inline-block min-w-10">{pct(c.conversao)}</span>
                        </td>
                        <td className="py-2.5 text-sm font-black text-right text-gray-900">{BRL(c.faturamento)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-6 text-gray-400">
                  <ShoppingCart size={32} className="mb-2 opacity-20" />
                  <p className="text-sm font-bold text-gray-500">Nenhuma venda registrada no ciclo</p>
                </div>
              )}
              </div>
            </div>

            </div> {/* end grid-cols-12 */}
          </div> {/* end max-w-7xl */}
        </main>
      </div>
    </div>
  );
}
