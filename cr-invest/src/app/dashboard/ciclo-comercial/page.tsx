"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, Legend, ComposedChart,
} from "recharts";
import { Calendar, AlertCircle, Target, AlertTriangle, Phone, Users, ChevronDown, ChevronUp } from "lucide-react";

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatDate(d: Date): string { return d.toISOString().split("T")[0]; }

function getMonthRange() {
  const now = new Date();
  return {
    start: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function fmtShort(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
}

function seeded(seed: number, min: number, max: number) {
  const x = Math.sin(seed + 1) * 10000;
  return Math.round(min + (x - Math.floor(x)) * (max - min));
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunilData { leadsGerados: number; contatados: number; qualificados: number; reunioes: number; vendas: number; }
interface VendasData { cicloVendas: { value: number }; taxaConversao: { value: number; won: number; total: number }; ticketMedio: { value: number; total: number; count: number }; }

// ─── Gauge ────────────────────────────────────────────────────────────────────
function GaugeChart({ percentage, realized, meta }: { percentage: number; realized: string; meta: string }) {
  const radius = 80, cx = 120, cy = 100, sw = 22;
  const circum = Math.PI * radius;
  const pct = Math.min(Math.max(percentage, 0), 100);
  const offset = circum - (pct / 100) * circum;

  const gaugeColor = pct < 40 ? "#DC2626" : pct < 70 ? "#D97706" : "#D4AF37";
  const textColor = pct < 40 ? "text-red-600" : pct < 70 ? "text-[#d97706]" : "text-[#D4AF37]";
  const bgTrack = pct < 40 ? "#fef2f2" : pct < 70 ? "#fffbeb" : "#F3F4F6";
  const glowFilter = pct < 40 ? "drop-shadow(0 0 8px rgba(220,38,38,0.5))" : "none";

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative">
        <svg width="240" height="130" viewBox="0 0 240 130" className="overflow-visible">
          <path d={`M ${cx-radius},${cy} A ${radius},${radius} 0 0,1 ${cx+radius},${cy}`} fill="none" stroke={bgTrack} strokeWidth={sw} strokeLinecap="round"/>
          <path d={`M ${cx-radius},${cy} A ${radius},${radius} 0 0,1 ${cx+radius},${cy}`} fill="none" stroke={gaugeColor} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={circum} strokeDashoffset={offset} style={{transition:"stroke-dashoffset 1.2s ease-out", filter: glowFilter}}/>
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-3">
          <span className={`text-[34px] font-black ${textColor}`}>{pct.toFixed(1)}%</span>
        </div>
      </div>

      {pct < 50 && (
        <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full mt-2 animate-pulse">
          ⚠️ Urgência: Menos da metade da meta
        </div>
      )}

      <div className="flex w-full gap-3 mt-4 text-center">
        <div className="flex-1 bg-gray-50 rounded-lg py-2"><span className="text-[9px] text-gray-400 font-bold uppercase block">Realizado</span><span className="text-[15px] font-black text-[#111827]">{realized}</span></div>
        <div className={`flex-1 rounded-lg py-2 ${pct < 50 ? 'bg-red-50' : 'bg-gray-50'}`}><span className={`text-[9px] font-bold uppercase block ${pct < 50 ? 'text-red-400' : 'text-gray-400'}`}>Meta</span><span className={`text-[15px] font-black ${pct < 50 ? 'text-[#991b1b]' : 'text-[#111827]'}`}>{meta}</span></div>
      </div>
    </div>
  );
}

// ─── Funnel Box ───────────────────────────────────────────────────────────────
function FunnelBox({ value, target, label, sub, danger }: { value: number; target: number; label: string; sub?: string; danger: boolean }) {
  const missed = value < target;
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl px-4 py-4 min-w-[110px] border-2 transition-all shadow-sm ${danger ? "border-[#991b1b] bg-[#fef2f2]" : "border-gray-200 bg-white"}`}>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-[28px] font-black leading-none ${danger ? "text-[#991b1b]" : "text-[#111827]"}`}>{value}</span>
        <span className={`text-[14px] font-bold ${danger ? "text-red-400" : "text-gray-400"}`}>/{target}</span>
        {missed && <span className="text-red-500 font-black text-[14px] ml-1">✕</span>}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${danger ? "text-[#991b1b]" : "text-gray-500"}`}>{label}</span>
      {sub && <span className={`text-[10px] font-bold mt-0.5 ${danger ? "text-red-500" : "text-[#d97706]"}`}>{sub}</span>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CicloComercialPage() {
  const { start: ds, end: de } = getMonthRange();
  const [start, setStart] = useState(ds);
  const [end, setEnd] = useState(de);
  const [funilData, setFunilData] = useState<FunilData | null>(null);
  const [vendasData, setVendasData] = useState<VendasData | null>(null);
  const [salesData, setSalesData] = useState<{value: number}[]>([]);
  const [allSalesData, setAllSalesData] = useState<{value: number}[]>([]);
  const [drillOpen, setDrillOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [f, v, s, sAll] = await Promise.all([
        fetch(`/api/kpis/funil?start=${start}&end=${end}`),
        fetch(`/api/kpis/vendas?start=${start}&end=${end}`),
        fetch(`/api/sales?start=${start}&end=${end}`),
        fetch(`/api/sales`), // All sales for global ticket médio fallback
      ]);
      const [fj, vj, sj, sAllJ] = await Promise.all([f.json(), v.json(), s.json(), sAll.json()]);
      setFunilData(fj.data); setVendasData(vj.data);
      if (sj.data) setSalesData(sj.data);
      if (sAllJ.data) setAllSalesData(sAllJ.data);
    } catch {}
  }, [start, end]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Metas ───
  const META_CICLO = 5000000;
  const META_LIG_DIA = 120;
  const META_AGEND_DIA = 3;
  const META_REUN_DIA = 2;
  const META_VENDAS_DIA = 1;

  const hoje = new Date();
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const diaDeHoje = hoje.getDate();
  const diasRestantes = ultimoDia.getDate() - diaDeHoje;
  const totalDias = ultimoDia.getDate();

  // ─── Metrics (from real sales data) ───
  const dealsFeitos = salesData.length;
  const totalReceita = salesData.reduce((sum, s) => sum + (s.value || 0), 0);
  // Ticket médio: usa o período filtrado; se não tiver vendas, usa histórico global
  const globalReceita = allSalesData.reduce((sum, s) => sum + (s.value || 0), 0);
  const globalDeals = allSalesData.length;
  const ticketMedio = dealsFeitos > 0
    ? Math.round(totalReceita / dealsFeitos)
    : globalDeals > 0
      ? Math.round(globalReceita / globalDeals)
      : 0;
  const dealsFaltantes = ticketMedio > 0 ? Math.ceil(Math.max(0, META_CICLO - totalReceita) / ticketMedio) : 0;

  const ritmoAtual = parseFloat((dealsFeitos / Math.max(diaDeHoje, 1)).toFixed(1));
  const ritmoExigido = parseFloat((dealsFaltantes / Math.max(diasRestantes, 1)).toFixed(1));
  const projecaoMes = (totalReceita / Math.max(diaDeHoje, 1)) * totalDias;
  const gaugePercent = (totalReceita / META_CICLO) * 100;

  // ─── Daily SDR Mock ───
  const SDR_LIG_HOJE = seeded(diaDeHoje * 3, 80, 105);
  const SDR_LEADS_HOJE = seeded(diaDeHoje * 5 + 2, 6, 15); // Leads que entraram hoje
  const SDR_AGEND_HOJE = seeded(diaDeHoje * 7, 0, 2);
  const META_CONV_SDR = 30; // Meta de conversão: 30% dos leads
  const sdrConvReal = SDR_LEADS_HOJE > 0 ? parseFloat(((SDR_AGEND_HOJE / SDR_LEADS_HOJE) * 100).toFixed(1)) : 0;
  const sdrAbaixo = SDR_LIG_HOJE < META_LIG_DIA || SDR_AGEND_HOJE < META_AGEND_DIA;

  // ─── Daily Closer Mock ───
  const CLOSER_REUN_HOJE = seeded(diaDeHoje * 11, 0, 2);
  const CLOSER_VENDAS_HOJE = seeded(diaDeHoje * 19, 0, 1);
  const closerAbaixo = CLOSER_REUN_HOJE < META_REUN_DIA || CLOSER_VENDAS_HOJE < META_VENDAS_DIA;

  // ─── Per-Closer Daily Data ───
  const closersHoje = [
    { name: "Célia", img: "/img/celia.png", reunioes: seeded(diaDeHoje * 11, 0, 3), vendas: seeded(diaDeHoje * 23, 0, 2) },
    { name: "Eunice", img: "/img/eunice.png", reunioes: seeded(diaDeHoje * 17, 0, 3), vendas: seeded(diaDeHoje * 29, 0, 2) },
  ];

  // ─── Monthly Funnel ───
  const ligTotal = funilData?.contatados ? funilData.contatados * 4 : 450;
  const agendTotal = funilData?.qualificados || 124;
  const reunTotal = funilData?.reunioes || 85;
  const vendasTotal = funilData?.vendas || 18;
  const convGlobal = ligTotal > 0 ? ((vendasTotal / ligTotal) * 100).toFixed(1) : "0";

  // ─── Ranking ───
  const ranking = [
    { pos: 1, name: "Célia", img: "/img/celia.png", vendas: 8, fat: 860000 },
    { pos: 2, name: "Eunice", img: "/img/eunice.png", vendas: 6, fat: 620000 },
  ];

  // ─── Daily Evolution (drill-down data) ───
  const dailyData = Array.from({ length: diaDeHoje }).map((_, i) => {
    const d = i + 1;
    const lig = seeded(d * 11 + 3, 20, 55);
    const agend = seeded(d * 7 + 17, 0, 5);
    const reun = seeded(d * 13 + 7, 0, 3);
    const vend = seeded(d * 19 + 2, 0, 2);
    const taxaSdr = lig > 0 ? parseFloat(((agend / lig) * 100).toFixed(1)) : 0;
    const taxaCloser = reun > 0 ? parseFloat(((vend / reun) * 100).toFixed(1)) : 0;
    return { dia: `${String(d).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}`, Ligações: lig, Agendamentos: agend, Reuniões: reun, Vendas: vend, "SDR Conv%": taxaSdr, "Closer Conv%": taxaCloser };
  });

  // ─── Conversion Rate Data ───
  const convRateData = dailyData.map(d => ({ dia: d.dia, "SDR (%)": d["SDR Conv%"], "Closer (%)": d["Closer Conv%"] }));

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col font-sans">

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-[#F8F9FB] border-b border-gray-100">
        <h1 className="text-[22px] font-black tracking-tight text-[#111827]">Ciclo Comercial</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm text-[12px]">
            <input type="date" value={start} onChange={e => setStart(e.target.value)} className="border-none outline-none text-gray-600 font-bold bg-transparent w-[110px]" />
            <span className="text-gray-300">&ndash;</span>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="border-none outline-none text-gray-600 font-bold bg-transparent w-[110px]" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-8 pb-12 w-full mx-auto max-w-[1600px] flex flex-col gap-5 mt-3">

        {/* ═══ SUB-HEADER ROW ═══ */}
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 items-stretch">
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <span className="text-[15px] font-black text-[#111827]">Ciclo Comercial</span>
            <p className="text-[12px] text-gray-400 font-bold mt-1">Dia {diaDeHoje} de {totalDias} &bull; <span className="text-[#d97706] font-black">{diasRestantes} dias restantes</span></p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <span className="text-[9px] text-gray-400 font-black uppercase tracking-wider">Ticket Médio Real</span>
            <p className="mt-1.5"><span className="text-[20px] font-black text-[#111827]">R$ {new Intl.NumberFormat("pt-BR").format(ticketMedio)}</span></p>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">/ {dealsFeitos} vd</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <span className="text-[9px] text-gray-400 font-black uppercase tracking-wider">Restam para a Meta</span>
            <p className="mt-1.5"><span className="text-[20px] font-black text-[#d97706]">{dealsFaltantes}</span> <span className="text-[12px] font-bold text-gray-400">vd nec.</span></p>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">{ritmoExigido} vs {ritmoAtual} vend/dia</p>
          </div>
          <div className="bg-[#D4AF37] text-white rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-[9px] uppercase font-bold text-amber-100 tracking-wider">Projeção do Mês</span>
            <span className="text-[18px] font-black mt-1">{fmtShort(projecaoMes)}</span>
          </div>
        </div>

        {/* ═══ ALERTS ═══ */}

        {/* ═══ GAUGE + FUNNEL DO DIA + RITMO DIÁRIO ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Termômetro */}
          <div className="bg-white border border-gray-100 rounded-[16px] p-5 shadow-sm flex flex-col">
            <h2 className="text-[15px] font-black text-[#111827]">Termômetro de Meta</h2>
            <p className="text-[11px] text-gray-400 font-medium">{fmtShort(totalReceita)} de {fmtShort(META_CICLO)}</p>
            <div className="flex-1 flex items-center justify-center py-2">
              <GaugeChart percentage={gaugePercent} realized={fmtShort(totalReceita)} meta={fmtShort(META_CICLO)} />
            </div>
            <div className="text-[11px] pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-gray-600 font-bold">R$ {dealsFeitos} vendas</span>
              <span className="text-red-600 font-black">{fmtShort(META_CICLO - totalReceita)}</span>
            </div>
          </div>

          {/* Funil do Dia (SDR & Closer) */}
          <div className="bg-white border border-gray-100 rounded-[16px] p-5 shadow-sm flex flex-col">
            <h2 className="text-[15px] font-black text-[#111827]">Funil do Dia (SDR & Closer)</h2>
            <div className="grid grid-cols-4 gap-2 py-4">
              <FunnelBox value={SDR_LIG_HOJE} target={META_LIG_DIA} label="Ligações" sub={`Faltam ${Math.max(0, META_LIG_DIA - SDR_LIG_HOJE)}`} danger={SDR_LIG_HOJE < META_LIG_DIA} />
              <FunnelBox value={SDR_AGEND_HOJE} target={META_AGEND_DIA} label="Agend." sub={`Faltam ${Math.max(0, META_AGEND_DIA - SDR_AGEND_HOJE)}`} danger={SDR_AGEND_HOJE < META_AGEND_DIA} />
              <FunnelBox value={CLOSER_REUN_HOJE} target={META_REUN_DIA} label="Reuniões" sub={`Falta ${Math.max(0, META_REUN_DIA - CLOSER_REUN_HOJE)}`} danger={CLOSER_REUN_HOJE < META_REUN_DIA} />
              <FunnelBox value={CLOSER_VENDAS_HOJE} target={META_VENDAS_DIA} label="Vendas" sub={`Falta ${Math.max(0, META_VENDAS_DIA - CLOSER_VENDAS_HOJE)}`} danger={CLOSER_VENDAS_HOJE < META_VENDAS_DIA} />
            </div>

            {SDR_AGEND_HOJE < META_AGEND_DIA && (
              <div className="bg-[#fef2f2] border border-red-200 rounded-lg px-3 py-2 text-[11px] font-bold text-red-800 flex items-center gap-2">
                <AlertTriangle size={12} className="text-red-500 shrink-0" /> META SDR NÃO BATIDA
              </div>
            )}
            <div className="mt-auto pt-2 text-center">
              <span className="text-[10px] uppercase tracking-widest font-black text-gray-400">Status: </span>
              {(sdrAbaixo || closerAbaixo)
                ? <span className="text-[11px] font-black text-[#991b1b]">🔴 ABAIXO</span>
                : <span className="text-[11px] font-black text-emerald-600">🟢 NA META</span>
              }
            </div>
          </div>

          {/* Ritmo Diário */}
          <div className="bg-white border border-gray-100 rounded-[16px] p-5 shadow-sm flex flex-col">
            <h2 className="text-[15px] font-black text-[#111827]">Ritmo Diário</h2>
            <p className="text-[11px] text-gray-400 font-medium">Venda média vs Meta diária</p>
            
            <div className="flex-1 flex flex-col justify-center gap-5 py-4">
              {/* Barra Atual */}
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-bold text-gray-500 w-[72px] text-right">Atual</span>
                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                  {(() => {
                    const ritmoValor = totalReceita / Math.max(diaDeHoje, 1);
                    const metaDiaria = META_CICLO / totalDias;
                    const pctAtual = Math.min((ritmoValor / (metaDiaria * 2)) * 100, 100);
                    return <div className="h-full bg-[#2563EB] rounded-full transition-all" style={{width: `${pctAtual}%`}} />;
                  })()}
                </div>
              </div>
              {/* Barra Necessário */}
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-bold text-gray-500 w-[72px] text-right">Necessário</span>
                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                  {(() => {
                    const metaDiaria = META_CICLO / totalDias;
                    const ritmoNec = (META_CICLO - totalReceita) / Math.max(diasRestantes, 1);
                    const pctNec = Math.min((ritmoNec / (metaDiaria * 2)) * 100, 100);
                    return <div className="h-full bg-[#D4AF37] rounded-full transition-all" style={{width: `${pctNec}%`}} />;
                  })()}
                </div>
              </div>
            </div>

            {/* Alert */}
            {(() => {
              const ritmoValorDia = totalReceita / Math.max(diaDeHoje, 1);
              const ritmoNecDia = (META_CICLO - totalReceita) / Math.max(diasRestantes, 1);
              const isAbaixo = ritmoValorDia < ritmoNecDia;
              return (
                <div className={`rounded-lg px-3 py-2.5 flex items-center gap-2 mt-auto ${isAbaixo ? 'bg-[#fffbeb] border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                  <span className={`text-[16px]`}>{isAbaixo ? '📉' : '📈'}</span>
                  <div>
                    <span className={`text-[12px] font-black block ${isAbaixo ? 'text-[#92400e]' : 'text-emerald-700'}`}>
                      {isAbaixo ? 'Abaixo do necessário' : 'Dentro do ritmo'}
                    </span>
                    <span className="text-[11px] text-gray-500 font-bold">
                      {fmtBRL(ritmoValorDia)}<span className="text-gray-400">/dia</span> vs {fmtBRL(ritmoNecDia)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ═══ FUNIL MENSAL + SDR + CLOSERS + RANKING ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          
          {/* Funil Mensal */}
          <div className="bg-white border border-gray-100 rounded-[16px] p-5 shadow-sm flex flex-col">
            <h2 className="text-[15px] font-black text-[#111827]">Funil de Vendas</h2>
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[{ n: ligTotal, l: "Ligações" }, { n: agendTotal, l: "Agendamentos" }, { n: reunTotal, l: "Reuniões" }, { n: vendasTotal, l: "Vendas" }].map((s, i) => (
                <div key={s.l} className="text-center">
                  <span className="text-[20px] font-black text-[#111827]">{s.n}</span>
                  <span className="text-[9px] text-gray-400 font-bold block">{s.l}</span>
                  {i < 3 && (
                    <span className="text-[10px] text-[#d97706] font-bold block mt-1">
                      {(([agendTotal, reunTotal, vendasTotal][i] / [ligTotal, agendTotal, reunTotal][i]) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 text-[11px]">
              <p className="font-bold text-gray-600">FALTAM: <span className="text-[#111827] font-black">{dealsFaltantes} vendas</span></p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-400 font-bold">Conversão global:</span>
                <span className="font-black text-[#d97706]">{convGlobal}%</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10px] uppercase font-black text-gray-400">Status:</span>
                <span className="text-[10px] font-black text-[#991b1b]">🔴 ABAIXO</span>
              </div>
            </div>
          </div>

          {/* SDR — CAUÊ */}
          <div className="bg-white border border-gray-100 rounded-[16px] p-5 shadow-sm flex flex-col">
            <div className="flex items-center gap-2.5">
              <img src="/img/caue.png" alt="Cauê" className="w-7 h-7 rounded-full object-cover" />
              <h2 className="text-[14px] font-black text-[#111827]">SDR — Cauê</h2>
            </div>
            <div className="flex flex-col gap-4 mt-4 flex-1">
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-blue-500 shrink-0" />
                <div className="flex items-baseline gap-1">
                  <span className={`text-[22px] font-black ${SDR_LIG_HOJE < META_LIG_DIA ? 'text-[#991b1b]' : 'text-[#111827]'}`}>{SDR_LIG_HOJE}</span>
                  <span className="text-[14px] font-bold text-gray-400">/{META_LIG_DIA}</span>
                  <span className="text-[12px] font-bold text-gray-400 ml-1">ligações</span>
                  {SDR_LIG_HOJE < META_LIG_DIA && <span className="text-red-500 font-black text-[12px] ml-1">✕</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-[#d97706] shrink-0" />
                <div className="flex items-baseline gap-1">
                  <span className={`text-[22px] font-black ${SDR_AGEND_HOJE < META_AGEND_DIA ? 'text-[#991b1b]' : 'text-[#111827]'}`}>{SDR_AGEND_HOJE}</span>
                  <span className="text-[14px] font-bold text-gray-400">/{META_AGEND_DIA}</span>
                  <span className="text-[12px] font-bold text-gray-400 ml-1">agendamentos</span>
                  {SDR_AGEND_HOJE < META_AGEND_DIA && <span className="text-red-500 font-black text-[12px] ml-1">✕</span>}
                </div>
              </div>
              <div className={`rounded-lg px-3 py-2 text-center mt-1 border ${sdrConvReal >= META_CONV_SDR ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <span className={`text-[9px] font-bold uppercase tracking-wider block ${sdrConvReal >= META_CONV_SDR ? 'text-emerald-400' : 'text-red-400'}`}>Taxa de Conversão</span>
                <span className={`text-[18px] font-black ${sdrConvReal >= META_CONV_SDR ? 'text-emerald-600' : 'text-[#991b1b]'}`}>{sdrConvReal}%</span>
                <span className="text-[10px] text-gray-400 font-bold block">{SDR_LEADS_HOJE} leads → {SDR_AGEND_HOJE} agend (meta {META_CONV_SDR}%)</span>
              </div>
              <div className="mt-auto flex items-center gap-1.5 pt-3 border-t border-gray-100">
                <span className="text-[10px] uppercase font-black text-gray-400">Status:</span>
                {sdrAbaixo
                  ? <span className="text-[10px] font-black text-[#991b1b]">🔴 ABAIXO</span>
                  : <span className="text-[10px] font-black text-emerald-600">🟢 NA META</span>
                }
              </div>
            </div>
          </div>

          {/* CLOSERS — Um card por closer */}
          {closersHoje.map(c => {
            const rAbaixo = c.reunioes < META_REUN_DIA;
            const vAbaixo = c.vendas < META_VENDAS_DIA;
            const cAbaixo = rAbaixo || vAbaixo;
            return (
              <div key={c.name} className="bg-white border border-gray-100 rounded-[16px] p-5 shadow-sm flex flex-col">
                <div className="flex items-center gap-2.5">
                  <img src={c.img} alt={c.name} className="w-7 h-7 rounded-full object-cover" />
                  <h2 className="text-[14px] font-black text-[#111827]">{c.name}</h2>
                </div>
                <div className="flex flex-col gap-4 mt-4 flex-1">
                  <div className="flex items-center gap-3">
                    <Users size={16} className="text-emerald-500 shrink-0" />
                    <div className="flex items-baseline gap-1">
                      <span className={`text-[22px] font-black ${rAbaixo ? 'text-[#991b1b]' : 'text-[#111827]'}`}>{c.reunioes}</span>
                      <span className="text-[14px] font-bold text-gray-400">/{META_REUN_DIA}</span>
                      <span className="text-[12px] font-bold text-gray-400 ml-1">reuniões</span>
                      {rAbaixo && <span className="text-red-500 font-black text-[12px] ml-1">✕</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Target size={16} className="text-amber-500 shrink-0" />
                    <div className="flex items-baseline gap-1">
                      <span className={`text-[22px] font-black ${vAbaixo ? 'text-[#991b1b]' : 'text-[#111827]'}`}>{c.vendas}</span>
                      <span className="text-[14px] font-bold text-gray-400">/{META_VENDAS_DIA}</span>
                      <span className="text-[12px] font-bold text-gray-400 ml-1">vendas</span>
                      {vAbaixo && <span className="text-red-500 font-black text-[12px] ml-1">✕</span>}
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-center mt-1">
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block">Taxa de Conversão</span>
                    <span className="text-[18px] font-black text-emerald-600">{c.reunioes > 0 ? ((c.vendas / c.reunioes) * 100).toFixed(1) : '0.0'}%</span>
                    <span className="text-[10px] text-gray-400 font-bold block">Reunião → Venda</span>
                  </div>
                  <div className="mt-auto flex items-center gap-1.5 pt-3 border-t border-gray-100">
                    <span className="text-[10px] uppercase font-black text-gray-400">Status:</span>
                    {cAbaixo
                      ? <span className="text-[10px] font-black text-[#991b1b]">🔴 ABAIXO</span>
                      : <span className="text-[10px] font-black text-emerald-600">🟢 NA META</span>
                    }
                  </div>
                </div>
              </div>
            );
          })}

          {/* RANKING */}
          <div className="bg-white border border-gray-100 rounded-[16px] p-5 shadow-sm flex flex-col">
            <h2 className="text-[14px] font-black text-[#111827]">Ranking de Performance</h2>
            <div className="flex flex-col gap-3 mt-4 flex-1">
              {ranking.map(r => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="text-[16px] font-black text-[#D4AF37] w-5 shrink-0">{r.pos}</span>
                  <img src={r.img} alt={r.name} className="w-8 h-8 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-black text-[#111827] block truncate">{r.name}</span>
                    <span className="text-[11px] text-gray-400 font-bold">{r.vendas} vendas &mdash; {fmtShort(r.fat)}</span>
                  </div>
                </div>
              ))}
            </div>

            {sdrAbaixo && (
              <div className="mt-auto pt-3 border-t border-gray-100">
                <div className="bg-[#fef2f2] border border-red-200 rounded-lg px-3 py-2 text-[11px] font-bold text-red-800 flex items-center gap-2">
                  <AlertTriangle size={12} className="text-red-500 shrink-0" />
                  <span>SDR ABAIXO: CAUÊ — {SDR_AGEND_HOJE} agendamento (min. {META_AGEND_DIA})</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ EVOLUÇÃO DIÁRIA: LIGAÇÕES × AGENDAMENTOS (DRILL DOWN) ═══ */}
        <div className="bg-white border border-gray-100 rounded-[16px] p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-black text-[#111827]">Evolução Diária: Ligações × Agendamentos</h2>
              <p className="text-[11px] text-gray-400 font-medium">SDR — Acompanhamento dia a dia no período selecionado</p>
            </div>
            <button
              onClick={() => setDrillOpen(!drillOpen)}
              className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-gray-600 transition-colors"
            >
              {drillOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              {drillOpen ? "Fechar Detalhes" : "Drill-Down por Dia"}
            </button>
          </div>
          <div className="h-[260px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#D4AF37" }} axisLine={false} tickLine={false} unit="%" />
                <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                <Bar yAxisId="left" dataKey="Ligações" fill="#2563EB" barSize={12} radius={[3, 3, 0, 0]} opacity={0.8} />
                <Bar yAxisId="left" dataKey="Agendamentos" fill="#D4AF37" barSize={12} radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="SDR Conv%" stroke="#DC2626" strokeWidth={2} dot={{ r: 3, fill: "#DC2626" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* DRILL DOWN TABLE */}
          {drillOpen && (
            <div className="mt-4 pt-4 border-t border-gray-100 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-gray-400 uppercase text-[9px] tracking-wider font-bold border-b border-gray-100">
                    <th className="text-left pb-2 pr-3">Dia</th>
                    <th className="text-center pb-2">Ligações</th>
                    <th className="text-center pb-2">Agend.</th>
                    <th className="text-center pb-2">Reuniões</th>
                    <th className="text-center pb-2">Vendas</th>
                    <th className="text-center pb-2">Conv. SDR</th>
                    <th className="text-center pb-2">Conv. Closer</th>
                    <th className="text-center pb-2">Status SDR</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.map((d, i) => {
                    const agBad = d.Agendamentos < META_AGEND_DIA;
                    const ligBad = d.Ligações < (META_LIG_DIA / totalDias * 1);
                    return (
                      <tr key={i} className={`border-b border-gray-50 ${agBad ? "bg-red-50/50" : ""}`}>
                        <td className="py-2 pr-3 font-bold text-gray-600">{d.dia}</td>
                        <td className="text-center font-bold text-[#111827]">{d.Ligações}</td>
                        <td className={`text-center font-black ${agBad ? "text-[#991b1b]" : "text-[#111827]"}`}>{d.Agendamentos}</td>
                        <td className="text-center font-bold text-[#111827]">{d.Reuniões}</td>
                        <td className="text-center font-bold text-[#111827]">{d.Vendas}</td>
                        <td className="text-center font-bold text-blue-600">{d["SDR Conv%"]}%</td>
                        <td className="text-center font-bold text-emerald-600">{d["Closer Conv%"]}%</td>
                        <td className="text-center">
                          {agBad
                            ? <span className="text-[9px] font-black text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">ABAIXO</span>
                            : <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">OK</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══ TAXA DE CONVERSÃO: SDR vs CLOSER ═══ */}
        <div className="bg-white border border-gray-100 rounded-[16px] p-5 shadow-sm flex flex-col">
          <h2 className="text-[15px] font-black text-[#111827]">Taxa de Conversão: SDR vs Closer</h2>
          <p className="text-[11px] text-gray-400 font-medium mb-4">Evolução diária da taxa de conversão por perfil</p>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={convRateData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} unit="%" />
                <RechartsTooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                <Line type="monotone" dataKey="SDR (%)" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4, fill: "#2563EB", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Closer (%)" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 4, fill: "#16A34A", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </main>
    </div>
  );
}
