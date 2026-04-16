"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, Legend, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip, CartesianGrid, AreaChart, Area
} from "recharts";
import { Medal, Zap, Target } from "lucide-react";
import { useSession } from "next-auth/react";

// ─── helpers ────────────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().split("T")[0]; }
function getMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const mm = month < 10 ? `0${month}` : month;
  return { 
    start: `${year}-${mm}-01`, 
    end: `${year}-${mm}-${lastDay < 10 ? `0${lastDay}` : lastDay}` 
  };
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

function SpeedArcGauge({ value = 0 }: { value?: number }) {
  const cappedValue = Math.min(value, 60);
  const hasData = value > 0;
  const circumference = Math.PI * 60;
  const dashoffset = circumference - (cappedValue / 60) * circumference;
  let color = "#d97706";
  if (!hasData) color = "#d1d5db";
  else if (value <= 20) color = "#10b981";
  else if (value > 40) color = "#ef4444";
  return (
    <div className="relative flex flex-col items-center justify-center w-full h-[80px]">
      <svg width="140" height="70" viewBox="0 0 140 70" className="overflow-visible">
        <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="#f0f0f5" strokeWidth="12" strokeLinecap="round" />
        <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={hasData ? dashoffset : circumference - 1} style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }} />
      </svg>
      <div className="absolute bottom-2 text-center">
        <p className="text-[10px] text-[#9ca3af]">meta: ≤ 20min</p>
        <p className="text-[11px] font-medium text-[#1d1d1f]">{hasData ? `${Math.round(value)}m` : "Sem dados"}</p>
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
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [apiData, setApiData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [metaGeral, setMetaGeral] = useState<any>(null);
  const [metaGeralInput, setMetaGeralInput] = useState<string>("");
  const [savingMetaGeral, setSavingMetaGeral] = useState(false);
  const [metaAgend, setMetaAgend] = useState<number>(0);
  const [metaAgendInput, setMetaAgendInput] = useState<string>("");
  const [savingMeta, setSavingMeta] = useState(false);
  const { data: session } = useSession();

  // Scope enforcement
  const userRole = (session?.user as any)?.role;
  const userName = session?.user?.name;
  const isAdmin = userRole === "admin";
  const permsRaw = (session?.user as any)?.permissions;
  let scopeLocked = false;
  if (!isAdmin && permsRaw) {
    try {
      const perms = typeof permsRaw === "string" ? JSON.parse(permsRaw) : permsRaw;
      const sdrPerm = perms["PERF_SDR"] || perms["DASHBOARD"];
      if (sdrPerm?.scope === "own" && userName) {
        scopeLocked = true;
      }
    } catch(e) {}
  }

  useEffect(() => {
    if (scopeLocked && userName && selectedAgent !== userName) {
      setSelectedAgent(userName);
    }
  }, [scopeLocked, userName, selectedAgent]);

  // Load initial state from localStorage
  useEffect(() => {
    const savedStart = localStorage.getItem("perf-sdr-start");
    const savedEnd = localStorage.getItem("perf-sdr-end");
    const savedAgent = localStorage.getItem("perf-sdr-agent");
    
    if (savedStart && savedEnd) {
      setStart(savedStart);
      setEnd(savedEnd);
    } else {
      const { start: ds, end: de } = getMonthRange();
      setStart(ds);
      setEnd(de);
    }
    
    if (savedAgent) setSelectedAgent(savedAgent === "null" ? null : savedAgent);
    setIsInitialized(true);
  }, []);

  const userId = (session?.user as any)?.id;

  // Chave da meta:
  // - SDR sem filtro (ou scope=own) → chave pelo próprio nome
  // - Admin com SDR específico selecionado → chave pelo nome do SDR
  // - Admin sem filtro → chave global (aplica para todos que não têm meta individual)
  const metaAgentKey = (() => {
    if (selectedAgent) return `sdr_meta_pct_${selectedAgent.toLowerCase().replace(/\s+/g, "_")}`;
    if (!isAdmin && userName) return `sdr_meta_pct_${userName.toLowerCase().replace(/\s+/g, "_")}`;
    return "sdr_meta_pct_global"; // admin sem filtro = meta padrão do time
  })();
  const isGlobalMeta = metaAgentKey === "sdr_meta_pct_global";

  // Carrega meta quando o agente selecionado (ou usuário) mudar
  useEffect(() => {
    fetch(`/api/settings?key=${metaAgentKey}`)
      .then(r => r.json())
      .then(async j => {
        const v = parseInt(j.data ?? "0") || 0;
        if (v > 0) {
          setMetaAgend(v);
          setMetaAgendInput(String(v));
        } else if (!isGlobalMeta) {
          // Se não tem meta individual, tenta carregar a global como fallback
          const gRes = await fetch("/api/settings?key=sdr_meta_pct_global");
          const gJson = await gRes.json();
          const gv = parseInt(gJson.data ?? "0") || 0;
          setMetaAgend(gv);
          setMetaAgendInput(""); // não preenche o input com o valor herdado
        } else {
          setMetaAgend(0);
          setMetaAgendInput("");
        }
      })
      .catch(() => {});
  }, [metaAgentKey]);

  const saveMeta = async () => {
    const v = Math.min(100, Math.max(0, parseInt(metaAgendInput) || 0));
    setSavingMeta(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: metaAgentKey, value: String(v) }),
      });
      setMetaAgend(v);
    } finally {
      setSavingMeta(false);
    }
  };

  const saveMetaGeral = async () => {
    const goalId = metaGeral?.goal?.id;
    if (!goalId) return;
    const v = parseFloat(metaGeralInput.replace(/\./g, "").replace(",", ".")) || 0;
    setSavingMetaGeral(true);
    try {
      const res = await fetch(`/api/goals?id=${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: v }),
      });
      const json = await res.json();
      if (json.data) {
        setMetaGeral((prev: any) => ({ ...prev, goal: { ...prev.goal, target: json.data.target } }));
        setMetaGeralInput("");
      }
    } finally {
      setSavingMetaGeral(false);
    }
  };

  const fetchData = useCallback(async () => {
    if (!isInitialized || !start || !end) return;
    setError(null);
    try {
      const [res, resSales, resMeta] = await Promise.all([
        fetch(`/api/kpis/performance-sdr?start=${start}&end=${end}`),
        fetch(`/api/sales?start=${start}&end=${end}`),
        fetch("/api/kpis/meta?originSdr=true"),
      ]);
      const [json, jsonSales, jsonMeta] = await Promise.all([
        res.json(), resSales.json(), resMeta.json(),
      ]);

      if (json.error) throw new Error(json.error);
      setApiData(json.data);
      setSales(jsonSales.data || []);
      if (jsonMeta.data) setMetaGeral(jsonMeta.data);
      
      // Persist values
      localStorage.setItem("perf-sdr-start", start);
      localStorage.setItem("perf-sdr-end", end);
      localStorage.setItem("perf-sdr-agent", String(selectedAgent));
    } catch (e: any) { 
      setError(e.message); 
      setApiData(null); 
      setSales([]); 
    }
  }, [start, end, selectedAgent, isInitialized]);

  useEffect(() => { 
    if (isInitialized) fetchData(); 
  }, [fetchData, isInitialized]);

  const stats = apiData?.stats ?? [];
  const totais = apiData?.totais;
  
  // Fill daily leads array to always have 30 days for visual structure
  const dailyLeadsRaw = apiData?.dailyLeads ?? [];
  const mockDailyLeads = dailyLeadsRaw.length > 0 ? dailyLeadsRaw : Array.from({length: 30}).map((_, i) => ({
    dia: i + 1, leads: 0, agendamentos: 0
  }));
  const dailyAvg = totais ? parseFloat((totais.leadsGerados / Math.max(dailyLeadsRaw.length, 1)).toFixed(1)) : 0;
  
  const displayed = selectedAgent ? stats.filter((r: any) => r.agentName === selectedAgent) : stats;

  // Total de agendamentos:
  // - sem filtro: usa o total real (todos scheduledAt no período, qualquer scheduledBy)
  // - com filtro de agente: usa os agendamentos daquele SDR
  const sdrAgend = displayed.reduce((s: number, r: any) => s + (r.agendamentos || 0), 0);
  const iaAgend   = !selectedAgent ? (apiData?.agendamentosPorOrigem?.ia?.agendamentos    ?? 0) : 0;
  const totalAgendamentos = !selectedAgent
    ? (apiData?.agendamentosPorOrigem?.total ?? sdrAgend)
    : sdrAgend;

  // ── GAMIFICAÇÃO E PROJEÇÃO (SDR) ──
  const sdrSales = selectedAgent 
    ? sales.filter(s => s.sdrName && selectedAgent.toLowerCase().includes(s.sdrName.trim().toLowerCase()))
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
              value={selectedAgent ?? ""} onChange={(e) => { if (!scopeLocked) setSelectedAgent(e.target.value || null); }}
              disabled={scopeLocked}
              className={`border border-[#e5e5ea] rounded-md px-3 py-1.5 text-[13px] bg-white text-[#1d1d1f] hover:border-[#d1d1d6] outline-none transition-colors ${scopeLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {scopeLocked ? (
                <option value={userName || ""}>{userName}</option>
              ) : (
                <>
                  <option value="">Todos os SDRs</option>
                  {stats.map((r: any) => <option key={r.agentName} value={r.agentName}>{r.agentName}</option>)}
                </>
              )}
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

        {/* ── METAS ───────────────────────────────────────────────────────── */}
        <div className="flex gap-4 mb-6">

          {/* Meta Individual */}
          <div className="flex-1 bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-bold text-[#1d1d1f] uppercase tracking-wide">
                {isGlobalMeta ? "Meta Padrão · Todos os SDRs" : "Meta Individual · Agend."}
              </h3>
              <span className="text-[10px] text-[#86868b]">{mesLabel(start)}</span>
            </div>
            {(() => {
              // Encontra stats do agente visualizado (filtro selecionado ou usuário logado)
              const agentName = selectedAgent ?? userName;
              const myStats = agentName
                ? stats.find((r: any) => {
                    const n = agentName.toLowerCase();
                    const a = (r.agentName ?? "").toLowerCase();
                    return a.startsWith(n) || n.startsWith(a.split(" ")[0]);
                  })
                : null;

              // Para a meta: soma agendamentos do SDR + agendamentos da IA nos leads deste SDR
              const agendSdr = myStats?.agendamentos ?? sdrAgend;
              const agendIa  = myStats?.agendamentosIa ?? 0;
              const realizado = agendSdr + agendIa; // usado só na meta

              const leadsRecebidos = myStats?.leadsGerados ?? totais?.leadsGerados ?? 0;
              const metaEsperado = metaAgend > 0 ? Math.round(leadsRecebidos * metaAgend / 100) : 0;
              const pctAtingido = metaEsperado > 0 ? Math.min(100, Math.round((realizado / metaEsperado) * 100)) : 0;
              const color = pctAtingido >= 100 ? "#16a34a" : pctAtingido >= 60 ? "#d97706" : "#dc2626";
              return (
                <div className="mb-4">
                  {/* Linha principal: agendamentos feitos vs esperados */}
                  <div className="flex justify-between items-baseline mb-2">
                    <div>
                      <span className="text-[24px] font-black text-[#1d1d1f] leading-none">{realizado}</span>
                      <span className="text-[12px] text-[#86868b] ml-1">agend.</span>
                    </div>
                    <span className="text-[12px] text-[#86868b]">
                      esperado <strong className="text-[#1d1d1f]">{metaEsperado > 0 ? metaEsperado : "—"}</strong>
                    </span>
                  </div>
                  {/* Barra de progresso */}
                  <div className="w-full h-2 bg-[#f0f0f5] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctAtingido}%`, background: color }} />
                  </div>
                  <div className="flex justify-between mt-1 text-[10px]">
                    <span style={{ color }}>{pctAtingido}% da meta</span>
                    {metaEsperado > 0 && realizado < metaEsperado && (
                      <span className="text-[#86868b]">faltam {metaEsperado - realizado}</span>
                    )}
                  </div>
                  {/* Info secundária */}
                  <div className="flex gap-3 mt-2 pt-2 border-t border-[#f0f0f5] text-[10px] text-[#86868b]">
                    <span>{leadsRecebidos} leads recebidos</span>
                    <span>·</span>
                    {agendIa > 0 && <><span>{agendSdr} SDR + {agendIa} IA</span><span>·</span></>}
                    <span>meta: {metaAgend > 0 ? `${metaAgend}% de conv.` : "não definida"}</span>
                  </div>
                </div>
              );
            })()}
            <div className="flex items-center gap-2 border-t border-[#f0f0f5] pt-3">
              <div className="relative flex-1">
                <input
                  type="number" min={0} max={100} value={metaAgendInput}
                  onChange={e => setMetaAgendInput(e.target.value)}
                  placeholder={isGlobalMeta ? "meta % para todos (ex: 40)" : "meta % (ex: 40)"}
                  className="w-full border border-[#e5e5ea] rounded-lg pl-3 pr-7 py-1.5 text-[12px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#b49136]"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#86868b] pointer-events-none">%</span>
              </div>
              <button onClick={saveMeta} disabled={savingMeta || !metaAgendInput}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-[#1d1d1f] hover:bg-[#333] transition-colors disabled:opacity-50">
                {savingMeta ? "..." : "Salvar"}
              </button>
            </div>
          </div>

          {/* Meta Geral */}
          <div className="flex-1 bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-bold text-[#1d1d1f] uppercase tracking-wide">Meta Geral · Originadas via SDR</h3>
              <span className="text-[10px] text-[#86868b]">{metaGeral?.goal?.cycleName ?? "—"}</span>
            </div>
            {metaGeral ? (() => {
              const target = metaGeral.goal?.target ?? 0;
              const achieved = metaGeral.achieved ?? 0;
              const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
              const color = pct >= 100 ? "#16a34a" : pct >= 60 ? "#d97706" : "#dc2626";
              const fmtM = (v: number) => v >= 1_000_000
                ? `R$ ${(v/1_000_000).toFixed(2).replace(".", ",")}M`
                : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
              return (
                <>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[24px] font-black text-[#1d1d1f] leading-none">{fmtM(achieved)}</span>
                    <span className="text-[12px] text-[#86868b]">meta <strong className="text-[#1d1d1f]">{fmtM(target)}</strong></span>
                  </div>
                  <div className="w-full h-2 bg-[#f0f0f5] rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="flex justify-between text-[10px] mb-3">
                    <span style={{ color }}>{pct}% da meta</span>
                    {achieved < target && <span className="text-[#86868b]">faltam {fmtM(target - achieved)}</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-[#f0f0f5] pt-3 mb-3">
                    <div className="text-center">
                      <p className="text-[9px] text-[#86868b] uppercase tracking-wide mb-0.5">Vendas</p>
                      <p className="text-[14px] font-bold text-[#1d1d1f]">{metaGeral.wonCount ?? 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-[#86868b] uppercase tracking-wide mb-0.5">Ticket Médio</p>
                      <p className="text-[14px] font-bold text-[#1d1d1f]">{metaGeral.wonCount > 0 ? fmtM(achieved / metaGeral.wonCount) : "—"}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-[#86868b] uppercase tracking-wide mb-0.5">Dias Rest.</p>
                      <p className="text-[14px] font-bold text-[#1d1d1f]">{metaGeral.daysLeft ?? 0}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 border-t border-[#f0f0f5] pt-3">
                      <input
                        type="number" min={0} value={metaGeralInput}
                        onChange={e => setMetaGeralInput(e.target.value)}
                        placeholder="nova meta (R$)..."
                        className="flex-1 border border-[#e5e5ea] rounded-lg px-3 py-1.5 text-[12px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#b49136]"
                      />
                      <button onClick={saveMetaGeral} disabled={savingMetaGeral || !metaGeralInput}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-[#1d1d1f] hover:bg-[#333] transition-colors disabled:opacity-50">
                        {savingMetaGeral ? "..." : "Salvar"}
                      </button>
                    </div>
                  )}
                </>
              );
            })() : (
              <>
                <p className="text-[12px] text-[#86868b] mb-3">Nenhuma meta configurada.</p>
                {isAdmin && (
                  <p className="text-[11px] text-[#86868b]">Crie uma meta em Configurações para editar aqui.</p>
                )}
              </>
            )}
          </div>

        </div>

        {/* ── FUNIL ATIVO ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Funil Ativo</h2>
          <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm flex items-stretch divide-x divide-[#f0f0f5]">
            
            <div className="flex-1 p-6">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Leads Gerados</p>
              <p className="text-[32px] font-black leading-none text-[#1d1d1f] tracking-tight">{totais?.leadsGerados ?? 0}</p>
              <p className="text-[12px] text-[#86868b] mt-2">{totais?.leadsNoFunil ?? 0} no funil</p>
            </div>

            <div className="flex-1 p-6">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Agendamentos</p>
              <p className="text-[32px] font-black leading-none text-[#2563EB] tracking-tight">{totalAgendamentos}</p>
              <p className="text-[12px] text-[#86868b] mt-2">
                {(totais?.leadsGerados ?? 0) > 0
                  ? ((totalAgendamentos / totais!.leadsGerados) * 100).toFixed(1)
                  : "0"}% conversão geral
                {iaAgend > 0 && <span className="ml-1 text-[#86868b]">· {iaAgend} IA</span>}
              </p>
            </div>

            <div className="flex-1 p-6">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Reagendados</p>
              <p className="text-[32px] font-black leading-none text-[#F59E0B] tracking-tight">{totais?.reagendados ?? 0}</p>
              <p className="text-[12px] text-[#86868b] mt-2">leads com reagendamento</p>
            </div>

            <div className="flex-1 p-6">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Reuniões</p>
              <p className="text-[32px] font-black leading-none text-[#10B981] tracking-tight">{displayed.reduce((s: any, r: any) => s + (r.reunioes || 0), 0)}</p>
              <p className="text-[12px] text-[#86868b] mt-2">
                {totalAgendamentos > 0
                  ? ((displayed.reduce((s: any, r: any) => s + (r.reunioes || 0), 0) / totalAgendamentos) * 100).toFixed(1)
                  : "0"}% realizadas
              </p>
            </div>

            <div className="flex-1 p-6">
              <p className="text-[11px] font-semibold text-[#DC2626] uppercase tracking-widest mb-3">Tarefas Atrasadas</p>
              <p className="text-[32px] font-black leading-none text-[#DC2626] tracking-tight">{totais?.tarefasVencidas ?? 0}</p>
              <p className="text-[12px] text-[#DC2626]/60 mt-2">nextTask vencida</p>
            </div>

            <div className="flex-1 p-6">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Recuperação</p>
              <p className="text-[32px] font-black leading-none text-[#7C3AED] tracking-tight">{totais?.recuperacao ?? 0}</p>
              <p className="text-[12px] text-[#86868b] mt-2">ex-perdidos ativos</p>
            </div>

          </div>
        </div>

        {/* ── ORIGEM DOS AGENDAMENTOS ─────────────────────────────────────── */}
        {apiData?.agendamentosPorOrigem && (
          <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6 mb-8">
            <h2 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-4">Origem dos Agendamentos</h2>

            {(() => {
              const ia    = apiData.agendamentosPorOrigem.ia ?? { agendamentos: 0, noShows: 0, taxaNoShow: 0 };
              const other = apiData.agendamentosPorOrigem.other ?? { agendamentos: 0, noShows: 0, taxaNoShow: 0 };
              const sdrStats: any[] = stats;
              const cols = 1 + sdrStats.length + (other.agendamentos > 0 ? 1 : 0);
              const gridCols = cols <= 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-4";

              const PanelCard = ({ label, avatar, bg, agendamentos, noShows, taxaNoShow, highlight }: any) => {
                const nsColor = taxaNoShow > 35 ? "text-[#DC2626]" : "text-[#16A34A]";
                return (
                  <div className={`rounded-[10px] border p-4 ${highlight ? "border-[#b49136] bg-[#fffbeb]" : "border-[#f0f0f5] bg-[#fafafa]"}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${bg}`}>{avatar}</div>
                      <span className="font-semibold text-[12px] text-[#1d1d1f] truncate">{label}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#86868b]">Agendamentos</span>
                        <span className="font-black text-[18px] text-[#1d1d1f] leading-none">{agendamentos}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[#86868b]">No-shows</span>
                        <span className="font-bold text-[14px] text-[#1d1d1f]">{noShows}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-[#f0f0f5]">
                        <span className="text-[11px] text-[#86868b]">Taxa no-show</span>
                        <span className={`font-black text-[16px] ${nsColor}`}>{taxaNoShow.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              };

              const totalAgend = apiData.agendamentosPorOrigem.total ?? (ia.agendamentos + sdrStats.reduce((s: number, r: any) => s + (r.agendamentos || 0), 0) + other.agendamentos);

              return (
                <>
                  <div className={`grid ${gridCols} gap-4 mb-5`}>
                    <PanelCard label="IA (Automático)" avatar="IA" bg="bg-[#1d1d1f]" agendamentos={ia.agendamentos} noShows={ia.noShows} taxaNoShow={ia.taxaNoShow} highlight={false} />
                    {sdrStats.map((sdr: any) => (
                      <PanelCard
                        key={sdr.agentName}
                        label={sdr.agentName}
                        avatar={sdr.agentName.charAt(0).toUpperCase()}
                        bg="bg-[#b49136]"
                        agendamentos={sdr.agendamentos}
                        noShows={sdr.noShowsNoPeriodo ?? 0}
                        taxaNoShow={sdr.taxaNoShow ?? 0}
                        highlight={selectedAgent === sdr.agentName}
                      />
                    ))}
                    {other.agendamentos > 0 && (
                      <PanelCard label="Outros" avatar="?" bg="bg-[#9ca3af]" agendamentos={other.agendamentos} noShows={other.noShows} taxaNoShow={other.taxaNoShow} highlight={false} />
                    )}
                  </div>
                  {totalAgend > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] text-[#86868b] mb-1">
                        <span>IA {((ia.agendamentos / totalAgend) * 100).toFixed(0)}%</span>
                        <span className="font-semibold text-[#1d1d1f]">{totalAgend} total</span>
                        <span>SDR {((sdrStats.reduce((s: number, r: any) => s + (r.agendamentos || 0), 0) / totalAgend) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#f0f0f5] overflow-hidden flex">
                        <div className="h-full bg-[#1d1d1f]" style={{ width: `${(ia.agendamentos / totalAgend) * 100}%` }} />
                        {sdrStats.map((sdr: any, i: number) => (
                          <div key={sdr.agentName} className="h-full bg-[#b49136]" style={{ width: `${((sdr.agendamentos || 0) / totalAgend) * 100}%`, opacity: 1 - i * 0.25 }} />
                        ))}
                        {other.agendamentos > 0 && (
                          <div className="h-full bg-[#d1d5db] rounded-r-full" style={{ width: `${(other.agendamentos / totalAgend) * 100}%` }} />
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ── ESFORÇO OPERACIONAL ─────────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Esforço Operacional</h2>
          <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm flex items-stretch divide-x divide-[#f0f0f5]">

            <div className="flex-1 p-6 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest text-center mb-1">Speed-to-Lead</p>
              <SpeedArcGauge value={displayed.length > 0 ? displayed.reduce((s: any, r: any) => s + r.speedToLeadMin, 0) / displayed.length : 0} />
            </div>

            <div className="flex-1 p-6 flex flex-col justify-center gap-4">
              <div>
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Lig. / Lead</p>
                <p className="text-[28px] font-black leading-none text-[#1d1d1f] tracking-tight">{(totais?.ligacoesPorLeadMedio ?? 0).toFixed(1)}</p>
                <p className="text-[11px] text-[#86868b] mt-1">ligações por lead</p>
              </div>
              <div className="border-t border-[#f0f0f5] pt-4">
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Lig. / Dia útil</p>
                <p className="text-[28px] font-black leading-none text-[#1d1d1f] tracking-tight">{(totais?.ligacoesPorDiaMedio ?? 0).toFixed(1)}</p>
                <p className="text-[11px] text-[#86868b] mt-1">ligações por dia útil</p>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col justify-center">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Agenda, por dia</p>
              <p className="text-[32px] font-black leading-none text-[#1d1d1f] tracking-tight">{(totais?.agendPorDiaMedio ?? 0).toFixed(1)}</p>
              <p className="text-[12px] text-[#86868b] mt-2">agendamentos por dia</p>
            </div>

            <div className="flex-1 p-6 flex flex-col justify-center">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">No-Show</p>
              {(() => {
                const totalAgend = displayed.reduce((s: any, r: any) => s + (r.agendamentos || 0), 0);
                const totalNoShows = displayed.reduce((s: any, r: any) => s + (r.noShowsNoPeriodo || 0), 0);
                const val = totalAgend > 0 ? parseFloat(((totalNoShows / totalAgend) * 100).toFixed(1)) : 0;
                return (
                  <p className={`text-[32px] font-black leading-none tracking-tight ${val <= 35 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                    {val}%
                  </p>
                );
              })()}
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
                <span className="text-[11px] font-bold text-[#86868b]">Meta: 4/dia</span>
             </div>
          </div>
          
          <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm h-[200px] p-4 pt-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockDailyLeads} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f0f0f5" strokeDasharray="3 3" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} dx={-10} />
                <RechartsTooltip {...TOOLTIP_STYLE} formatter={(v: any, name: any) => [`${Math.round(v)}`, String(name).includes("Entrada") || name === "leads" ? "Entraram" : "Agendados"]} labelFormatter={(l) => `Dia ${l}`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#86868b", paddingTop: "5px" }} />
                <ReferenceLine y={4} stroke="#d97706" strokeWidth={1.5} />
                <Bar dataKey="leads" fill="#9ca3af" radius={[2, 2, 0, 0]} name='Leads ("Entrada")' />
                <Bar dataKey="agendamentos" fill="#2563EB" radius={[2, 2, 0, 0]} name="Agendamentos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── GRID INFERIOR ───────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">

          {/* LADO ESQUERDO (65%) */}
          <div className="w-full lg:w-[63%] flex flex-col gap-4">
             
             {/* Resultados de Agendamentos */}
             <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-[#1d1d1f] mb-6">Resultados de Agendamentos</h3>
                
                <div className="flex">
                   <div className="w-1/2 pr-6 flex flex-col gap-5 border-r border-[#f0f0f5]">
                      <div className="flex items-center justify-between">
                         <span className="text-[13px] text-[#374151]">Novos Agend. (Hoje)</span>
                         <div className="bg-[#f3f4f6] text-[#1d1d1f] font-bold rounded px-4 py-1.5 text-[15px]">{(() => { const today = new Date(); const dayNum = today.getDate(); const entry = (apiData?.dailyLeads ?? []).find((d: any) => d.dia === dayNum); return entry?.novosAgendamentos ?? 0; })()}</div>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[13px] text-[#374151]">Reagendados (Hoje)</span>
                         <div className="bg-[#f3f4f6] text-[#1d1d1f] font-bold rounded px-4 py-1.5 text-[15px]">{(() => { const today = new Date(); const dayNum = today.getDate(); const entry = (apiData?.dailyLeads ?? []).find((d: any) => d.dia === dayNum); return entry?.reagendamentosEfetivados ?? 0; })()}</div>
                      </div>
                   </div>
                   <div className="w-1/2 pl-6 flex flex-col gap-5">
                      <div className="flex items-center justify-between">
                         <span className="text-[13px] text-[#374151]">Agendamentos</span>
                         <span className="font-medium text-[16px]">{displayed.reduce((s: any, r: any) => s + r.agendamentos, 0)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <span className="text-[13px] text-[#374151]">Conversão SDR</span>
                           <span className="text-[9px] text-[#9ca3af] leading-tight">Agendamentos ÷ Leads<br/>atendimento</span>
                         </div>
                         {(() => { const ag = displayed.reduce((s: any, r: any) => s + r.agendamentos, 0); const lg = displayed.reduce((s: any, r: any) => s + r.leadsGerados, 0); const val = lg > 0 ? (ag / lg) * 100 : 0; return <span className={`font-bold text-[16px] ${val >= 35 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{val.toFixed(1)}%</span>; })()}
                      </div>
                   </div>
                </div>
             </div>

             {/* Passagem de Bastão + Passagem a SDR — lado a lado */}
             <div className="flex gap-4">
                <div className="flex-1 bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5">
                   <h3 className="text-[13px] font-bold text-[#1d1d1f] mb-4">Passagem de Bastão SDR → Closer</h3>
                   <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                         <span className="text-[12px] text-[#374151]">Leads passados a Closer</span>
                         <div className="bg-[#f3f4f6] text-[#1d1d1f] font-bold rounded px-3 py-1 text-[15px]">{displayed.reduce((s: any, r: any) => s + (r.reunioes || 0), 0)}</div>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#f0f0f5] pt-3">
                         <span className="text-[12px] text-[#374151]">Tarefas abertas</span>
                         <div className="bg-[#f3f4f6] text-[#1d1d1f] font-bold rounded px-3 py-1 text-[15px]">{totais?.tarefasVencidas ?? 0}</div>
                      </div>
                   </div>
                </div>

                <div className="flex-1 bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5">
                   <h3 className="text-[13px] font-bold text-[#1d1d1f] mb-4">Passagem a SDR</h3>
                   <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#374151]">Leads recebidos no período</span>
                      <div className="bg-[#f3f4f6] text-[#1d1d1f] font-bold rounded px-3 py-1 text-[15px]">{totais?.leadsGerados ?? 0}</div>
                   </div>
                   <div className="flex items-center justify-between border-t border-[#f0f0f5] pt-3 mt-3">
                      <span className="text-[12px] text-[#374151]">No funil</span>
                      <div className="bg-[#f3f4f6] text-[#1d1d1f] font-bold rounded px-3 py-1 text-[15px]">{totais?.leadsNoFunil ?? 0}</div>
                   </div>
                </div>
             </div>

          </div>

          {/* LADO DIREITO (37%) */}
          <div className="w-full lg:w-[37%] flex flex-col gap-6">
             
             {/* Qualidade do SDR */}
             <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-[#1d1d1f] mb-5">Qualidade do SDR</h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* No-show */}
                  {(() => {
                    const ag = displayed.reduce((s: any, x: any) => s + (x.agendamentos || 0), 0);
                    const ns = displayed.reduce((s: any, x: any) => s + (x.noShowsNoPeriodo || 0), 0);
                    const val = ag > 0 ? parseFloat(((ns / ag) * 100).toFixed(1)) : 0;
                    const isOk = val <= 35;
                    return (
                      <div className={`rounded-lg p-4 ${isOk ? "bg-[#f0fdf4]" : "bg-[#fef2f2]"}`}>
                        <p className="text-[11px] text-[#86868b] mb-1">No-show gerado</p>
                        <p className={`text-[22px] font-bold ${isOk ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{val}%</p>
                        <p className={`text-[10px] mt-1 ${isOk ? "text-[#16A34A]" : "text-[#DC2626]"}`}>meta ≤ 35%</p>
                      </div>
                    );
                  })()}

                  {/* Comparecimento */}
                  {(() => {
                    const ag = displayed.reduce((s: any, x: any) => s + (x.agendamentos || 0), 0);
                    const ns = displayed.reduce((s: any, x: any) => s + (x.noShowsNoPeriodo || 0), 0);
                    const val = ag > 0 ? parseFloat((((ag - ns) / ag) * 100).toFixed(1)) : 0;
                    const isOk = val >= 65;
                    return (
                      <div className={`rounded-lg p-4 ${isOk ? "bg-[#f0fdf4]" : "bg-[#fef2f2]"}`}>
                        <p className="text-[11px] text-[#86868b] mb-1">Comparecimento</p>
                        <p className={`text-[22px] font-bold ${isOk ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{val}%</p>
                        <p className={`text-[10px] mt-1 ${isOk ? "text-[#16A34A]" : "text-[#DC2626]"}`}>meta ≥ 65%</p>
                      </div>
                    );
                  })()}

                  {/* Taxa de retorno */}
                  <div className="rounded-lg p-4 bg-[#f8f9fa]">
                    <p className="text-[11px] text-[#86868b] mb-1">Taxa de retorno</p>
                    <p className="text-[22px] font-bold text-[#1d1d1f]">
                      {displayed.length > 0 ? (displayed.reduce((s: any, r: any) => s + (r.taxaReagendamento || 0), 0) / displayed.length).toFixed(1) : "0"}%
                    </p>
                    <p className="text-[10px] text-[#9ca3af] mt-1">reagendamentos</p>
                  </div>

                  {/* Score SDR */}
                  <div className="rounded-lg p-4 bg-[#fffbeb]">
                    <p className="text-[11px] text-[#86868b] mb-1">Score SDR</p>
                    <p className="text-[22px] font-bold text-[#d97706]">
                      {displayed.length > 0 ? Math.round(displayed.reduce((s: any, r: any) => s + (r.sdrScoreMedia || 0), 0) / displayed.length) : 0}
                      <span className="text-[13px] text-[#9ca3af] font-normal">/100</span>
                    </p>
                    <p className="text-[10px] text-[#9ca3af] mt-1">avaliação geral</p>
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
                           displayed.filter((row: any) => row.leadsGerados > 0 || row.agendamentos > 0).map((row: any, i: number) => (
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
                               {(() => { const val = row.leadsGerados > 0 ? (row.agendamentos / row.leadsGerados) * 100 : 0; return <td className={`py-3 text-right pr-4 font-semibold ${val >= 35 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{val.toFixed(1)}%</td>; })()}
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
