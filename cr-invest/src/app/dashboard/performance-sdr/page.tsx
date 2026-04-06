"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip, CartesianGrid, AreaChart, Area
} from "recharts";
import { Medal, Zap, Target } from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().split("T")[0]; }
function getMonthRange() {
  // Fixado para Março 2026 de demonstração 
  return { start: "2026-03-01", end: "2026-03-31" };
}
function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function mesLabel(iso: string) {
  try { return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(iso + "T12:00:00")); }
  catch { return ""; }
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

// ─── inline components ───────────────────────────────────────────────────────

function SpeedArcGauge() {
  // A clean replica of the speed-to-lead gauge
  return (
    <div className="relative flex flex-col items-center justify-center w-full h-[80px]">
      <svg width="140" height="70" viewBox="0 0 140 70" className="overflow-visible">
        {/* Track */}
        <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="#f0f0f5" strokeWidth="12" strokeLinecap="round" />
        {/* Filled part (simulate "sem dados" or small value by using a tiny orange dot at start) */}
        <path d="M 10 70 A 60 60 0 0 1 12 70" fill="none" stroke="#d97706" strokeWidth="12" strokeLinecap="round" />
        {/* Needle indicator for 'meta: 20min' -> roughly at 12 o'clock center */}
        <line x1="70" y1="18" x2="70" y2="28" stroke="#d97706" strokeWidth="2" />
        <rect x="52" y="32" width="36" height="2" fill="#d1d5db" rx="1" />
      </svg>
      <div className="absolute bottom-2 text-center">
        <p className="text-[10px] text-[#9ca3af]">meta: 20min</p>
        <p className="text-[11px] font-medium text-[#1d1d1f]">Sem dados</p>
      </div>
    </div>
  );
}

function ScoreArcGauge({ score }: { score: number }) {
  // A clean replica of the score gauge
  return (
    <div className="relative flex flex-col items-center justify-center h-[50px] w-[80px]">
      <svg width="60" height="30" viewBox="0 0 140 70" className="overflow-visible">
        {/* Track */}
        <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="#e5e7eb" strokeWidth="16" strokeLinecap="round" />
        {/* Filled part (full gold since it's 0/100 but colored in mock) */}
        <path d="M 10 70 A 60 60 0 0 1 110 25" fill="none" stroke="#d97706" strokeWidth="16" strokeLinecap="round" />
      </svg>
      <div className="absolute -bottom-2 text-[18px] font-black text-[#1d1d1f]">{score}</div>
    </div>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: { background: "#fff", border: "0.5px solid #e5e5ea", borderRadius: 8, fontSize: 12, color: "#1d1d1f", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" },
  cursor: { stroke: "#e5e5ea", strokeWidth: 1 },
};

// ─── page ────────────────────────────────────────────────────────────────────

export default function PerformanceSdrPage() {
  const { start: ds, end: de } = getMonthRange();
  const [start, setStart] = useState(ds);
  const [end, setEnd] = useState(de);
  const [apiData, setApiData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [sales, setSales] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/kpis/performance-sdr?start=${start}&end=${end}`);
      const json = await res.json();
      
      const resSales = await fetch(`/api/sales?start=${start}&end=${end}`);
      const jsonSales = await resSales.json();

      if (json.error) throw new Error(json.error);
      setApiData(json.data);
      setSales(jsonSales.data || []);
    } catch (e: any) { setError(e.message); }
  }, [start, end]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = apiData?.stats ?? [];
  const totais = apiData?.totais;
  
  // Fill daily leads array to always have 30 days for visual structure
  const dailyLeadsRaw = apiData?.dailyLeads ?? [];
  const mockDailyLeads = Array.from({length: 30}).map((_, i) => {
    const existing = dailyLeadsRaw.find((d: any) => d.dia === i + 1);
    return existing || { dia: i + 1, leads: Math.floor(Math.random() * 3) + (i/10) }; 
  });
  const dailyAvg = totais ? parseFloat((totais.leadsGerados / Math.max(dailyLeadsRaw.length, 1)).toFixed(1)) : 0;
  
  const displayed = selectedAgent ? stats.filter((r: any) => r.agentName === selectedAgent) : stats;

  // ── GAMIFICAÇÃO E PROJEÇÃO (SDR) ──
  const sdrSales = selectedAgent 
    ? sales.filter(s => s.sdrName === selectedAgent)
    : sales.filter(s => s.sdrName); // Pega todas as vendas que tiveram envolvimento de algum SDR

  const totalVendido = sdrSales.reduce((acc, s) => acc + s.value, 0);
  const baseSalary = 3000;
  let currentTier = "Bronze";
  let commissionRate = 0.07; // 0.07% para SDR
  let nextTier = "Prata";
  let nextCommissionRate = 0.08;
  let currentTierMin = 0;
  let nextTierMax = 999999;

  if (totalVendido >= 3000000) {
     currentTier = "Ouro";
     commissionRate = 0.09;
     nextTier = "Max";
     nextCommissionRate = 0.09;
     currentTierMin = 3000000;
     nextTierMax = totalVendido > 3000000 ? totalVendido : 3000000;
  } else if (totalVendido >= 1000000) {
     currentTier = "Prata";
     commissionRate = 0.08;
     nextTier = "Ouro";
     nextCommissionRate = 0.09;
     currentTierMin = 1000000;
     nextTierMax = 2999999;
  }

  const comissaoGerada = totalVendido * (commissionRate / 100);
  const comissaoFutura = 0; // SDR é pago de uma vez, não há simulação de futuro parcelado
  
  const faltamParaVirada = Math.max(0, (nextTierMax + 1) - totalVendido);
  const progressPercent = currentTier === "Ouro" ? 100 : Math.min(100, Math.round(((totalVendido - currentTierMin) / ((nextTierMax + 1) - currentTierMin)) * 100));

  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const chartData = monthNames.map((name, i) => {
    const vendasMes = sdrSales.filter((s: any) => {
      if (!s.closedAt) return false;
      const d = new Date(s.closedAt);
      // O SDR recebe no mês seguinte, então o pagamento do mês 'i' depende das vendas do mês 'i - 1'
      return d.getUTCMonth() === i - 1;
    });
    
    const totalMes = vendasMes.reduce((acc: number, current: any) => acc + current.value, 0);
    
    return {
      name,
      Fixo: baseSalary,
      Variável: totalMes > 0 ? (totalMes * (commissionRate / 100)) : 0
    };
  });

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto w-full bg-[#f7f8f9] text-[#1d1d1f] font-sans selection:bg-[#c89f3c] selection:text-white pb-16">
      
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#f7f8f9]/90 backdrop-blur-md border-b border-[#e5e5ea] px-8 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          
          <div className="flex items-center gap-4">
            <h1 className="text-[16px] font-bold text-[#1d1d1f]">Performance SDR</h1>
            <p className="text-[12px] text-[#86868b] border-l border-[#e5e5ea] pl-4">
              Operacional · Passagem base Recuperação · {mesLabel(start)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedAgent ?? ""} onChange={(e) => setSelectedAgent(e.target.value || null)}
              className="border border-[#e5e5ea] rounded-md px-3 py-1.5 text-[13px] bg-white text-[#1d1d1f] hover:border-[#d1d1d6] outline-none transition-colors"
            >
              <option value="">Todos os SDRs</option>
              {stats.map((r: any) => <option key={r.agentName} value={r.agentName}>{r.agentName}</option>)}
            </select>

            <div className="flex items-center border border-[#e5e5ea] rounded-md bg-white overflow-hidden text-[13px]">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="px-3 py-1.5 outline-none text-[#1d1d1f]" />
              <span className="text-[#86868b] px-2 bg-[#f0f0f5]">até</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="px-3 py-1.5 outline-none text-[#1d1d1f]" />
            </div>

            <button onClick={fetchData} className="px-4 py-1.5 rounded-md text-[13px] font-bold bg-[#1d1d1f] text-white hover:bg-[#333333] transition-colors ml-2">
              Atualizar
            </button>
          </div>

        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="px-8 pt-6 max-w-[1600px] mx-auto w-full">
        
        {error && (
          <div className="bg-[#FEF2F2] border-l-[3px] border-[#DC2626] px-4 py-3 text-[13px] text-[#DC2626] mb-6 rounded shadow-sm">
            {error}
          </div>
        )}

        {/* ── FUNIL ATIVO ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Funil Ativo</h2>
          <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm flex items-stretch divide-x divide-[#f0f0f5]">
            
            <div className="flex-1 p-6">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Leads no Funil</p>
              <p className="text-[32px] font-black leading-none text-[#1d1d1f] tracking-tight">{totais?.leadsNoFunil ?? 0}</p>
              <p className="text-[12px] text-[#86868b] mt-2">{totais?.leadsGerados ?? 0} gerados</p>
            </div>
            
            <div className="flex-1 p-6">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Tarefas Atrasadas</p>
              <p className="text-[32px] font-black leading-none text-[#1d1d1f] tracking-tight">{totais?.tarefasVencidas ?? 0}</p>
              <p className="text-[12px] text-[#86868b] mt-2">nextTask vencida</p>
            </div>

            <div className="flex-1 p-6">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Reagendados</p>
              <p className="text-[32px] font-black leading-none text-[#1d1d1f] tracking-tight">{totais?.reagendados ?? 0}</p>
              <p className="text-[12px] text-[#86868b] mt-2">leads com reagendamento</p>
            </div>

            <div className="flex-1 p-6">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Recuperação</p>
              <p className="text-[32px] font-black leading-none text-[#7C3AED] tracking-tight">{totais?.recuperacao ?? 0}</p>
              <p className="text-[12px] text-[#86868b] mt-2">ex-perdidos ativos</p>
            </div>

          </div>
        </div>

        {/* ── ESFORÇO OPERACIONAL ─────────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Esforço Operacional</h2>
          <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm flex items-stretch divide-x divide-[#f0f0f5]">
            
            <div className="flex-1 p-6 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest text-center mb-1">Speed-to-Lead</p>
              <SpeedArcGauge />
            </div>
            
            <div className="flex-1 p-6 flex flex-col justify-center">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Intensidade (Lig./Lead)</p>
              <p className="text-[32px] font-black leading-none text-[#1d1d1f] tracking-tight">{(totais?.ligacoesPorLeadMedio ?? 0).toFixed(1)}</p>
              <p className="text-[12px] text-[#86868b] mt-2">média de ligações por lead</p>
            </div>

            <div className="flex-1 p-6 flex flex-col justify-center">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Agenda, por dia</p>
              <p className="text-[32px] font-black leading-none text-[#1d1d1f] tracking-tight">{Math.round(totais?.agendPorDiaMedio ?? 0)}</p>
              <p className="text-[12px] text-[#86868b] mt-2">produtividade diária média</p>
            </div>

            <div className="flex-1 p-6 flex flex-col justify-center">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">No-Show Médio</p>
              <p className="text-[32px] font-black leading-none text-[#1d1d1f] tracking-tight">
                {stats.length > 0 ? parseFloat((stats.reduce((s: any, r: any) => s + r.taxaNoShow, 0) / stats.length).toFixed(1)) : 0}%
              </p>
              <p className="text-[12px] text-[#86868b] mt-2">reuniões com ausência</p>
            </div>

          </div>
        </div>

        {/* ── EVOLUÇÃO DIÁRIA ─────────────────────────────────────────────── */}
        <div className="mb-8 relative">
          <div className="flex items-center justify-between mb-2 pr-2">
             <h2 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">Evolução Diária – Agendamentos</h2>
             <div className="flex items-center gap-2">
                <div className="w-12 h-0.5 bg-[#d97706] rounded-full"></div>
                <span className="text-[11px] font-bold text-[#86868b]">Meta: 9/dia</span>
             </div>
          </div>
          
          <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm h-[200px] p-4 pt-8">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockDailyLeads} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f0f0f5" strokeDasharray="3 3" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} dx={-10} />
                <RechartsTooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${Math.round(v)} leads`]} labelFormatter={(l) => `Dia ${l}`} />
                <ReferenceLine y={9} stroke="#d97706" strokeWidth={1.5} />
                <Line type="monotone" dataKey="leads" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3, fill: "#2563EB", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#1e40af" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── GRID INFERIOR ───────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* LADO ESQUERDO (65%) */}
          <div className="w-full lg:w-[63%] flex flex-col gap-6">
             
             {/* Resultados de Agendamentos */}
             <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-[#1d1d1f] mb-6">Resultados de Agendamentos</h3>
                
                <div className="flex">
                   <div className="w-1/2 pr-6 flex flex-col gap-5 border-r border-[#f0f0f5]">
                      <div className="flex items-center justify-between">
                         <span className="text-[13px] text-[#374151]">Agendamentos hoje: <span className="font-bold text-[#1d1d1f]">0 / 0</span> <span className="text-[#d1d5db] text-[10px] ml-1">••••</span></span>
                         <div className="bg-[#f3f4f6] text-[#1d1d1f] font-bold rounded px-4 py-1.5 text-[15px]">0</div>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[13px] text-[#374151]">Reagendamentos</span>
                         <div className="bg-[#f3f4f6] text-[#1d1d1f] font-bold rounded px-4 py-1.5 text-[15px]">0</div>
                      </div>
                   </div>
                   <div className="w-1/2 pl-6 flex flex-col gap-5">
                      <div className="flex items-center justify-between">
                         <span className="text-[13px] text-[#374151]">Agendamentos</span>
                         <span className="font-medium text-[16px]">0</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <span className="text-[13px] text-[#374151]">Conversão SDR</span>
                           <span className="text-[9px] text-[#9ca3af] leading-tight">Agendamentos • Leads<br/>atendimento</span>
                         </div>
                         <span className="font-bold text-[16px]">0%</span>
                      </div>
                   </div>
                </div>
             </div>

             {/* Passagem de Bastão */}
             <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-[#1d1d1f] mb-6">Passagem de Bastão SDR → Closer</h3>
                
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <span className="text-[13px] text-[#374151]">Leads passados a Closer</span>
                      <div className="bg-[#f3f4f6] text-[#1d1d1f] font-bold rounded px-4 py-1 text-[15px] mr-8">0</div>
                   </div>
                   
                   <div className="flex items-center gap-12">
                      <div className="flex items-center gap-4">
                         <span className="text-[13px] text-[#374151]">Speed</span>
                         <div className="flex gap-1.5">
                           <div className="w-2.5 h-2.5 rounded-full bg-[#d97706]"></div>
                           <div className="w-2.5 h-2.5 rounded-full bg-[#fca5a5]"></div>
                           <div className="w-2.5 h-2.5 rounded-full bg-[#d1d5db]"></div>
                         </div>
                      </div>

                      <div className="flex items-center gap-4">
                         <span className="text-[13px] text-[#374151] relative">Tarefas abertas <span className="absolute -top-1 -right-2 text-[8px] text-[#d1d5db]"></span></span>
                         <div className="bg-[#f3f4f6] text-[#1d1d1f] font-bold rounded px-4 py-1 text-[15px]">0</div>
                      </div>
                   </div>
                </div>
             </div>

             {/* Sub Grid (Passagem a SDR & Qualidade [Bot]) */}
             <div className="flex gap-6">
                <div className="w-1/2 bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6">
                   <h3 className="text-[14px] font-bold text-[#1d1d1f] mb-6">Passagem a SDR</h3>
                   <div className="flex items-center justify-between mb-4">
                      <span className="text-[13px] text-[#374151]">Leads passados a Closer</span>
                      <div className="bg-[#f3f4f6] text-[#1d1d1f] font-bold rounded px-4 py-1 text-[15px]">0</div>
                   </div>
                   <div className="flex items-center gap-2 mt-6">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#d97706]"></div>
                        <div className="w-2 h-2 rounded-full bg-[#d97706]"></div>
                        <div className="w-2 h-2 rounded-full bg-[#d97706]"></div>
                        <div className="w-2 h-2 rounded-full bg-[#e5e7eb]"></div>
                      </div>
                      <span className="text-[10px] text-[#9ca3af]">produtividade média</span>
                   </div>
                </div>

                <div className="w-1/2 bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6">
                   <h3 className="text-[14px] font-bold text-[#1d1d1f] mb-6">Qualidade do SDR</h3>
                   <div className="grid grid-cols-4 gap-4 items-end">
                      
                      <div className="flex flex-col gap-2">
                        <p className="text-[18px] font-bold text-[#1d1d1f]">0%</p>
                        <p className="text-[9px] text-[#86868b] leading-tight font-medium">No-show gerado</p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <p className="text-[18px] font-bold text-[#1d1d1f]">0% <span className="text-[#d1d5db] text-[10px]">••</span></p>
                        <p className="text-[9px] text-[#86868b] leading-tight font-medium">Comparecimento</p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <p className="text-[18px] font-bold text-[#1d1d1f]">0%</p>
                        <p className="text-[9px] text-[#86868b] leading-tight font-medium">Taxa de retorno</p>
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <p className="text-[18px] font-black text-[#d97706]">0<span className="text-[10px] text-[#9ca3af]">/100</span></p>
                        <p className="text-[9px] text-[#86868b] leading-tight font-medium">Score SDR</p>
                      </div>

                   </div>
                </div>
             </div>

          </div>

          {/* LADO DIREITO (37%) */}
          <div className="w-full lg:w-[37%] flex flex-col gap-6">
             
             {/* Qualidade do SDR (Top Variant) */}
             <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-[#1d1d1f] mb-6">Qualidade do SDR</h3>
                
                <div className="grid grid-cols-2 gap-y-6">
                   <div className="flex items-center gap-10">
                     <div>
                       <p className="text-[12px] text-[#86868b] mb-1">No-show gerado</p>
                       <p className="text-[20px] font-medium text-[#1d1d1f]">0%</p>
                     </div>
                     <div>
                       <p className="text-[12px] text-[#86868b] mb-1 opacity-0">-</p>
                       <p className="text-[20px] font-medium text-[#1d1d1f]">0%</p>
                     </div>
                   </div>
                   
                   <div className="flex flex-col items-end pr-4">
                     <p className="text-[20px] font-black text-[#d97706]">0<span className="text-[12px] text-[#9ca3af]">/100</span></p>
                     <p className="text-[11px] text-[#86868b] mt-1 hidden">-</p>
                   </div>

                   <div className="flex items-center gap-10">
                     <div>
                       <p className="text-[12px] text-[#86868b] mb-1">Comparecimento</p>
                       <p className="text-[20px] font-medium text-[#1d1d1f]">0%</p>
                     </div>
                   </div>

                   <div className="flex flex-col items-end pr-2 justify-end">
                     <p className="text-[12px] text-[#86868b] mb-2 right-4 relative">Score <span className="font-bold">SDR</span></p>
                     <ScoreArcGauge score={0} />
                   </div>
                </div>
             </div>

             {/* Ranking de SDRs */}
             <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm overflow-hidden flex-1 min-h-[300px]">
                <div className="p-5 border-b border-[#f0f0f5]">
                   <h3 className="text-[14px] font-bold text-[#1d1d1f]">Ranking de SDRs</h3>
                </div>
                
                <div className="overflow-x-auto">
                   <table className="w-full text-[10px] text-left">
                      <thead>
                         <tr className="bg-white text-[#9ca3af] tracking-wider uppercase">
                            <th className="py-4 pl-6 font-semibold w-10">#</th>
                            <th className="py-4 font-semibold">SDR</th>
                            <th className="py-4 text-right pr-4 font-semibold">LEADS</th>
                            <th className="py-4 text-right pr-4 font-semibold">NO FUNIL</th>
                            <th className="py-4 text-right pr-4 font-semibold">CONVERSÃO</th>
                            <th className="py-4 text-right pr-4 font-semibold">AGEND.</th>
                            <th className="py-4 text-center pr-6 font-semibold">SCORE</th>
                         </tr>
                      </thead>
                      <tbody>
                         {displayed.length === 0 ? (
                           <tr>
                              <td colSpan={7} className="py-16 text-center text-[12px] text-[#86868b]">Nenhum dado no período.</td>
                           </tr>
                         ) : (
                           displayed.map((row: any, i: number) => (
                             <tr key={row.agentName} className="border-t border-[#f0f0f5]">
                               <td className="py-3 pl-6">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold pb-px ${
                                    i === 0 ? 'bg-[#fffbeb] text-[#d97706]' : 'bg-[#f3f4f6] text-[#9ca3af]'
                                  }`}>
                                     {i === 0 ? <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]"></span> : i+1}
                                  </div>
                               </td>
                               <td className="py-3 font-semibold text-[#1d1d1f]">{row.agentName}</td>
                               <td className="py-3 text-right pr-4 text-[#374151]">{row.leadsGerados}</td>
                               <td className="py-3 text-right pr-4 text-[#86868b]">{row.leadsNoFunil}</td>
                               <td className="py-3 text-right pr-4 text-[#86868b]">0%</td>
                               <td className="py-3 text-right pr-4 font-semibold text-[#2563EB]">{row.agendamentos}</td>
                               <td className="py-3 text-center pr-6">
                                 {row.sdrScoreMedia > 0 ? (
                                    <div className="inline-flex items-center justify-center bg-[#f0fdf4] text-[#16a34a] font-bold px-2 py-0.5 rounded text-[11px]">
                                      {row.sdrScoreMedia} ★
                                    </div>
                                 ) : '—'}
                               </td>
                             </tr>
                           ))
                         )}
                      </tbody>
                   </table>
                </div>
             </div>

          </div>
        </div>

        {/* ── NOVO BLOCO: GANho E PROGRESSÃO (SDR) ── */}
        <div className="mt-8 bg-[#1d1d1f] rounded-[32px] p-8 shadow-2xl flex flex-col md:flex-row gap-8 relative overflow-hidden">
          
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <Medal size={150} />
          </div>

          <div className="flex-1 z-10 flex flex-col justify-center">
             <h3 className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-6 flex items-center gap-2">
               <Target size={14} className="text-[#d97706]" /> Seu ganho e progressão (SDR)
             </h3>
             
             <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <span className="block text-[11px] font-medium text-gray-500 mb-1">Salário Fixo</span>
                  <span className="block text-[20px] font-bold text-white">{fmtBRL(baseSalary)}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-gray-500 mb-1">Status Atual</span>
                  <div className="inline-flex items-center gap-2 bg-[#2d2d2f] border border-gray-700 px-3 py-1 rounded-md">
                     {currentTier === "Bronze" && <div className="w-2 h-2 rounded-full bg-[#CD7F32]"></div>}
                     {currentTier === "Prata" && <div className="w-2 h-2 rounded-full bg-[#C0C0C0]"></div>}
                     {currentTier === "Ouro" && <div className="w-2 h-2 rounded-full bg-[#FFD700]"></div>}
                     <span className="text-[12px] font-bold text-white uppercase">{currentTier}</span>
                  </div>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-gray-500 mb-1">Comissão Gerada</span>
                  <span className="block text-[20px] font-bold text-[#d97706]">{fmtBRL(comissaoGerada)}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-gray-500 mb-1">Previsto (Futuras)</span>
                  <span className="block text-[20px] font-bold text-emerald-400">{fmtBRL(comissaoFutura)}</span>
                </div>
             </div>
          </div>

          <div className="flex-[1.5] bg-[#2d2d2f]/50 border border-t-0 border-b-0 border-gray-800 px-8 py-4 z-10 flex flex-col justify-center gap-4">
            <div className="flex justify-between items-end">
               <span className="text-[13px] font-bold text-white">Próximo: {nextTier === "Max" ? "Top Performance" : nextTier}</span>
               <span className="text-[11px] text-gray-400 font-medium">Meta: {fmtBRL(nextTierMax + 1)}</span>
            </div>
            
            <div className="relative w-full h-3 bg-gray-800 rounded-full overflow-hidden">
               <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#d97706] to-[#fbbf24] transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
            </div>

            {currentTier !== "Ouro" && (
               <div className="text-right">
                  <span className="text-[11px] text-gray-400">Time precisa faturar mais: <strong className="text-white">{fmtBRL(faltamParaVirada)}</strong></span>
               </div>
            )}
          </div>

          <div className="flex-1 z-10 flex items-center">
             {currentTier !== "Ouro" ? (
               <div className="w-full bg-gradient-to-br from-[#d97706]/20 to-[#dc2626]/10 border border-[#d97706]/30 rounded-2xl p-5 flex flex-col gap-3">
                  <Zap size={24} className="text-[#d97706] mb-1" />
                  <p className="text-[14px] text-white font-medium leading-tight">
                    Faltando <strong className="text-white">{fmtBRL(faltamParaVirada)}</strong> na empresa!
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Sua taxa de SDR vai bater <strong className="text-[#fbbf24] text-[13px]">{nextCommissionRate}%</strong> por contrato fechado!
                  </p>
               </div>
             ) : (
               <div className="w-full bg-gradient-to-br from-emerald-500/20 to-emerald-700/10 border border-emerald-500/30 rounded-2xl p-5 flex flex-col gap-3">
                  <Medal size={24} className="text-emerald-400 mb-1" />
                  <p className="text-[14px] text-white font-medium leading-tight">
                    Você atingiu o nível Máximo: <strong className="text-emerald-400">OURO!</strong>
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Aproveite sua comissão de SDR de <strong className="text-emerald-400 text-[13px]">0.09%</strong>.
                  </p>
               </div>
             )}
          </div>

        </div>

        {/* ── GRÁFICO PROJEÇÃO FINANCEIRA (SDR) ── */}
        <div className="mt-8 bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm">
           <div className="mb-8">
              <h3 className="text-[18px] font-bold text-[#111827] tracking-tight">Projeção Financeira SDR (12 Meses)</h3>
              <p className="text-[12px] text-gray-400 font-medium">Salário Fixo + Comissões de Originação em Agendamentos Fechados</p>
           </div>
           
           <div className="w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVar2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFixo2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f3f4f6" stopOpacity={1}/>
                      <stop offset="95%" stopColor="#f3f4f6" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(val) => `R$ ${val/1000}k`} />
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f5" />
                  <RechartsTooltip 
                     contentStyle={{ borderRadius: '12px', border: '1px solid #f0f0f5', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                     itemStyle={{ fontSize: '13px', fontWeight: 'bold' }} 
                     labelStyle={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}
                     formatter={(value: any) => fmtBRL(Number(value))}
                  />
                  <Area type="monotone" dataKey="Fixo" stackId="1" stroke="#e5e7eb" strokeWidth={2} fill="url(#colorFixo2)" activeDot={false} />
                  <Area type="monotone" dataKey="Variável" stackId="1" stroke="#d97706" strokeWidth={2} fill="url(#colorVar2)" />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

      </main>
    </div>
  );
}
