"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LabelList, Legend, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip as RechartsTooltip, CartesianGrid, ReferenceArea
} from "recharts";
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
  const [drillMonth, setDrillMonth] = useState<string | null>(null); // "2025-3" → drill dia
  const [sales, setSales] = useState<any[]>([]);
  const [metaGeral, setMetaGeral] = useState<any>(null);
  const [metaGeralInput, setMetaGeralInput] = useState<string>("");
  const [savingMetaGeral, setSavingMetaGeral] = useState(false);
  const [metaAgend, setMetaAgend] = useState<number>(0);
  const [metaAgendInput, setMetaAgendInput] = useState<string>("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [cadenciaData, setCadenciaData] = useState<any>(null);
  const [leadsRecentes, setLeadsRecentes] = useState<any>(null);
  const [leadsRecentesSince, setLeadsRecentesSince] = useState<string>("2026-04-18");
  const [leadsRecentesUntil, setLeadsRecentesUntil] = useState<string>("");
  const [showLeadsDetail, setShowLeadsDetail] = useState(false);
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
    if (selectedAgent) return `sdr_meta_agend_${selectedAgent.toLowerCase().replace(/\s+/g, "_")}`;
    if (!isAdmin && userName) return `sdr_meta_agend_${userName.toLowerCase().replace(/\s+/g, "_")}`;
    return "sdr_meta_agend_global";
  })();
  const isGlobalMeta = metaAgentKey === "sdr_meta_agend_global";

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
    const v = parseFloat(metaGeralInput.replace(/\./g, "").replace(",", ".")) || 0;
    if (!v) return;
    setSavingMetaGeral(true);
    try {
      const goalId = metaGeral?.goal?.id;
      if (goalId) {
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
      } else {
        // Cria nova meta para o ciclo do período selecionado
        const cycleName = mesLabel(start);
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cycleName, startDate: start, endDate: end, target: v }),
        });
        const json = await res.json();
        if (json.data) {
          setMetaGeralInput("");
          fetchData();
        }
      }
    } finally {
      setSavingMetaGeral(false);
    }
  };

  const fetchLeadsRecentes = useCallback(async () => {
    if (!isInitialized) return;
    const agentParam = selectedAgent ? `&agent=${encodeURIComponent(selectedAgent)}` : "";
    const untilParam = leadsRecentesUntil ? `&until=${leadsRecentesUntil}` : "";
    try {
      const res = await fetch(`/api/kpis/leads-recentes?since=${leadsRecentesSince}${untilParam}${agentParam}`);
      const json = await res.json();
      if (json.data) setLeadsRecentes(json.data);
    } catch {
      // não quebra os outros dados
    }
  }, [isInitialized, selectedAgent, leadsRecentesSince, leadsRecentesUntil]);

  const fetchData = useCallback(async () => {
    if (!isInitialized || !start || !end) return;
    setError(null);
    try {
      const agentParam = selectedAgent ? `&agent=${encodeURIComponent(selectedAgent)}` : "";
      const [res, resSales, resMeta, resCadencia] = await Promise.all([
        fetch(`/api/kpis/performance-sdr?start=${start}&end=${end}`),
        fetch(`/api/sales?start=${start}&end=${end}`),
        fetch(`/api/kpis/meta?originSdr=true&start=${start}&end=${end}`),
        fetch(`/api/kpis/cadencia?start=${start}&end=${end}${agentParam}`),
      ]);
      const [json, jsonSales, jsonMeta, jsonCadencia] = await Promise.all([
        res.json(), resSales.json(), resMeta.json(), resCadencia.json(),
      ]);

      if (json.error) throw new Error(json.error);
      setApiData(json.data);
      setSales(jsonSales.data || []);
      if (jsonMeta.data) setMetaGeral(jsonMeta.data);
      if (jsonCadencia.data) setCadenciaData(jsonCadencia.data);

      // Persist values
      localStorage.setItem("perf-sdr-start", start);
      localStorage.setItem("perf-sdr-end", end);
      localStorage.setItem("perf-sdr-agent", String(selectedAgent));
    } catch (e: any) {
      setError(e.message);
      setApiData(null);
      setSales([]);
    }
    // Leads recentes em paralelo, sem bloquear os KPIs principais
    fetchLeadsRecentes();
  }, [start, end, selectedAgent, isInitialized, fetchLeadsRecentes]);

  useEffect(() => {
    if (isInitialized) fetchData();
  }, [fetchData, isInitialized]);

  useEffect(() => {
    if (isInitialized) fetchLeadsRecentes();
  }, [fetchLeadsRecentes, isInitialized]);

  // Auto-refresh a cada 5 minutos
  useEffect(() => {
    if (!isInitialized) return;
    const interval = setInterval(() => { fetchData(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
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

  // Total de agendamentos (Funil Ativo e gráfico — sem IA):
  // - sem filtro: usa o total real (todos scheduledAt no período, qualquer scheduledBy)
  // - com filtro de agente: só os agendamentos daquele SDR
  const sdrAgend = displayed.reduce((s: number, r: any) => s + (r.agendamentos || 0), 0);
  const iaAgend   = !selectedAgent ? (apiData?.agendamentosPorOrigem?.ia?.agendamentos ?? 0) : 0;
  const totalAgendamentos = !selectedAgent
    ? (apiData?.agendamentosPorOrigem?.total ?? sdrAgend)
    : sdrAgend;
  const totalReagendados = displayed.reduce((s: number, r: any) => s + (r.reagendados || 0), 0);
  // Denominador correto para % realizadas e no-show: agendamentos + reagendamentos
  const totalSlots = totalAgendamentos + totalReagendados;


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

          {/* Meta de Agendamento (% de conversão sobre leads) */}
          {(() => {
            const leadsRecebidos = totais?.leadsGerados ?? 0;
            const realizado = totalAgendamentos;
            const metaPct = metaAgend > 0 ? metaAgend : 0;
            const metaEsperado = metaPct > 0 && leadsRecebidos > 0
              ? Math.round(leadsRecebidos * metaPct / 100)
              : 0;
            const pctAtingido = metaEsperado > 0 ? Math.min(100, Math.round((realizado / metaEsperado) * 100)) : 0;
            const barColor = pctAtingido >= 100 ? "#16a34a" : "#b49136";
            
            return (
              <div className="flex-1 bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[11px] font-bold text-[#1d1d1f] uppercase tracking-wider">
                    {isGlobalMeta ? "Meta Padrão - Todos os SDRs" : "Meta Individual - Agend."}
                  </h3>
                  <span className="text-[10px] text-[#86868b]">{mesLabel(start)}</span>
                </div>

                <div className="flex items-end justify-between mb-2">
                  <div>
                    <span className="text-[32px] font-black text-[#1d1d1f] leading-none">{realizado}</span>
                    <span className="text-[12px] font-bold text-[#86868b] ml-2">agend.</span>
                  </div>
                  <div className="text-[11px] text-[#86868b] font-medium pb-1">
                    esperado <strong className="text-[#1d1d1f]">{metaEsperado > 0 ? metaEsperado : "—"}</strong>
                  </div>
                </div>

                <div className="w-full h-2 bg-[#f0f0f5] rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctAtingido}%`, backgroundColor: barColor }} />
                </div>

                <div className="flex justify-between text-[10px] mb-4">
                  <span className="font-bold" style={{ color: barColor }}>{pctAtingido}% da meta</span>
                  <span className="text-[#86868b]">faltam {metaEsperado > realizado ? metaEsperado - realizado : 0}</span>
                </div>

                <div className="text-[11px] text-[#86868b] mb-4">
                  {leadsRecebidos} leads recebidos <span className="mx-1">•</span> meta: {metaPct}% de conv.
                </div>

                <div className="mt-auto flex items-center gap-2 border-t border-[#f0f0f5] pt-4">
                  <div className="relative flex-1">
                    <input
                      type="number" min={0} max={100} value={metaAgendInput}
                      onChange={e => setMetaAgendInput(e.target.value)}
                      placeholder={metaPct > 0 ? `${metaPct}% atual` : ""}
                      className="w-full border border-[#e5e5ea] rounded-md pl-3 pr-6 py-1.5 text-[12px] text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#86868b] pointer-events-none">%</span>
                  </div>
                  <button onClick={saveMeta} disabled={savingMeta || !metaAgendInput}
                    className="px-4 py-1.5 rounded-md text-[11px] font-bold text-white bg-[#1d1d1f] hover:bg-[#333] transition-colors disabled:opacity-50">
                    {savingMeta ? "..." : "Salvar"}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Meta Geral */}
          {(() => {
            const target = metaGeral?.goal?.target ?? 0;
            const achieved = metaGeral?.achieved ?? 0;
            const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
            const barColor = pct >= 100 ? "#16a34a" : "#b49136";
            const fmtM = (v: number) => v >= 1_000_000
              ? `R$ ${(v/1_000_000).toFixed(2).replace(".", ",")}M`
              : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
            
            return (
              <div className="flex-1 bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[11px] font-bold text-[#1d1d1f] uppercase tracking-wider">Meta Geral - Originadas via SDR</h3>
                  <span className="text-[10px] text-[#86868b]">{metaGeral?.goal?.cycleName ?? mesLabel(start)}</span>
                </div>

                <div className="flex items-end justify-between mb-2">
                  <p className="text-[32px] font-black text-[#1d1d1f] leading-none">
                    {achieved > 0 ? fmtM(achieved) : "—"}
                  </p>
                  <div className="text-[11px] text-[#86868b] font-medium pb-1">
                    meta <strong className="text-[#1d1d1f]">{target > 0 ? fmtM(target) : "—"}</strong>
                  </div>
                </div>

                <div className="w-full h-2 bg-[#f0f0f5] rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                </div>

                <div className="flex justify-between text-[10px] mb-4">
                  <span className="font-bold" style={{ color: barColor }}>{pct}% da meta</span>
                  <span className="text-[#86868b]">faltam {target > achieved ? fmtM(target - achieved) : "—"}</span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4 text-center mt-2">
                  <div>
                    <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest mb-1.5">Vendas</p>
                    <p className="text-[14px] font-black text-[#1d1d1f]">{metaGeral?.wonCount ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest mb-1.5">Ticket Médio</p>
                    <p className="text-[14px] font-black text-[#1d1d1f]">{metaGeral?.wonCount > 0 ? fmtM(achieved / metaGeral.wonCount) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest mb-1.5">Dias Rest.</p>
                    <p className="text-[14px] font-black text-[#1d1d1f]">{metaGeral?.daysLeft ?? 0}</p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="mt-auto flex items-center gap-2 border-t border-[#f0f0f5] pt-4">
                    <input
                      type="text" value={metaGeralInput}
                      onChange={e => setMetaGeralInput(e.target.value)}
                      placeholder="nova meta (R$)..."
                      className="flex-1 border border-[#e5e5ea] rounded-md px-3 py-1.5 text-[12px] text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#1d1d1f]"
                    />
                    <button onClick={saveMetaGeral} disabled={savingMetaGeral || !metaGeralInput}
                      className="px-4 py-1.5 rounded-md text-[11px] font-bold text-white bg-[#86868b] hover:bg-[#1d1d1f] transition-colors disabled:opacity-50">
                      {savingMetaGeral ? "..." : "Salvar"}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

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
                {totalSlots > 0
                  ? ((displayed.reduce((s: any, r: any) => s + (r.reunioes || 0), 0) / totalSlots) * 100).toFixed(1)
                  : "0"}% realizadas
              </p>
            </div>

            <div className="flex-1 p-6">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">No-Show</p>
              {(() => {
                const ia = apiData?.agendamentosPorOrigem?.ia ?? { agendamentos: 0, noShows: 0 };
                const sdr = apiData?.agendamentosPorOrigem?.sdr ?? { agendamentos: 0, noShows: 0 };
                const totalAgend = ia.agendamentos + sdr.agendamentos;
                const totalNs = ia.noShows + sdr.noShows;
                const taxa = totalAgend > 0 ? (totalNs / totalAgend) * 100 : 0;
                const colorClass = taxa > 35 ? "text-[#DC2626]" : "text-[#16A34A]";
                return (
                  <>
                    <p className={`text-[32px] font-black leading-none tracking-tight ${colorClass}`}>{taxa.toFixed(1)}%</p>
                    <p className="text-[12px] text-[#86868b] mt-2">reuniões com ausência</p>
                  </>
                );
              })()}
            </div>

          </div>
        </div>

        {/* ── ORIGEM DOS AGENDAMENTOS ─────────────────────────────────────── */}
        {apiData?.agendamentosPorOrigem && (
          <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6 mb-8">
            <h2 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-4">Origem dos Agendamentos</h2>

            {(() => {
              const ia    = apiData.agendamentosPorOrigem.ia ?? { agendamentos: 0, noShows: 0, taxaNoShow: 0 };
              const sdrStats: any[] = stats;
              const cols = 1 + sdrStats.length;
              const gridCols = cols <= 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-4";

              const PanelCard = ({ label, avatar, bg, agendamentos, noShows, taxaNoShow, highlight, conversao, taxaRetorno, score }: any) => {
                const nsColor = taxaNoShow > 35 ? "text-[#DC2626]" : "text-[#16A34A]";
                const convColor = conversao != null ? (conversao >= 35 ? "text-[#16A34A]" : "text-[#DC2626]") : null;
                return (
                  <div className={`rounded-[10px] border p-4 ${highlight ? "border-[#b49136] bg-[#fffbeb]" : "border-[#f0f0f5] bg-[#fafafa]"}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${bg}`}>{avatar}</div>
                      <span className="font-semibold text-[12px] text-[#1d1d1f] truncate">{label}</span>
                      {score != null && score > 0 && (
                        <span className="ml-auto text-[10px] bg-[#f0fdf4] text-[#16a34a] font-bold px-1.5 py-0.5 rounded">{score} ★</span>
                      )}
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
                      {conversao != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-[#86868b]">Conversão SDR</span>
                          <span className={`font-bold text-[14px] ${convColor}`}>{conversao.toFixed(1)}%</span>
                        </div>
                      )}
                      {taxaRetorno != null && taxaRetorno > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-[#86868b]">Taxa de retorno</span>
                          <span className="font-bold text-[14px] text-[#374151]">{taxaRetorno.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              };

              const totalAgend = apiData.agendamentosPorOrigem.total ?? (ia.agendamentos + sdrStats.reduce((s: number, r: any) => s + (r.agendamentos || 0), 0));

              return (
                <>
                  <div className={`grid ${gridCols} gap-4 mb-5`}>
                    <PanelCard label="IA (Automático)" avatar="IA" bg="bg-[#1d1d1f]" agendamentos={ia.agendamentos} noShows={ia.noShows} taxaNoShow={ia.taxaNoShow} highlight={false} />
                    {sdrStats.map((sdr: any) => {
                      const conv = (totais?.leadsGerados ?? 0) > 0 ? (sdr.agendamentos / totais!.leadsGerados) * 100 : null;
                      return (
                        <PanelCard
                          key={sdr.agentName}
                          label={sdr.agentName}
                          avatar={sdr.agentName.charAt(0).toUpperCase()}
                          bg="bg-[#b49136]"
                          agendamentos={sdr.agendamentosProprios ?? sdr.agendamentos}
                          noShows={sdr.noShowsProprios ?? sdr.noShowsNoPeriodo ?? 0}
                          taxaNoShow={sdr.taxaNoShowPropria ?? sdr.taxaNoShow ?? 0}
                          highlight={selectedAgent === sdr.agentName}
                          conversao={conv}
                          taxaRetorno={sdr.taxaReagendamento ?? null}
                          score={sdr.sdrScoreMedia > 0 ? Math.round(sdr.sdrScoreMedia) : null}
                        />
                      );
                    })}

                  </div>
                  {totalAgend > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] text-[#86868b] mb-1">
                        <span>IA {((ia.agendamentos / totalAgend) * 100).toFixed(0)}%</span>
                        <span className="font-semibold text-[#1d1d1f]">{totalAgend} total</span>
                        <span>SDR {((sdrStats.reduce((s: number, r: any) => s + (r.agendamentosProprios ?? r.agendamentos ?? 0), 0) / totalAgend) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#f0f0f5] overflow-hidden flex">
                        <div className="h-full bg-[#1d1d1f]" style={{ width: `${(ia.agendamentos / totalAgend) * 100}%` }} />
                        {sdrStats.map((sdr: any, i: number) => (
                          <div key={sdr.agentName} className="h-full bg-[#b49136]" style={{ width: `${((sdr.agendamentosProprios ?? sdr.agendamentos ?? 0) / totalAgend) * 100}%`, opacity: 1 - i * 0.25 }} />
                        ))}

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
                const totalNoShows = displayed.reduce((s: any, r: any) => s + (r.noShowsNoPeriodo || 0), 0);
                const val = totalSlots > 0 ? parseFloat(((totalNoShows / totalSlots) * 100).toFixed(1)) : 0;
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
        {(() => {
          const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
          const allDays = mockDailyLeads as any[];

          type MonthBucket = { key: string; label: string; leads: number; agendamentos: number; reunioes: number; pct: number; days: any[] };
          const monthMap = new Map<string, MonthBucket>();
          for (const entry of allDays) {
            if (!entry.date) continue;
            const d = new Date(entry.date + "T12:00:00");
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!monthMap.has(key)) monthMap.set(key, { key, label: `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`, leads: 0, agendamentos: 0, reunioes: 0, pct: 0, days: [] });
            const b = monthMap.get(key)!;
            b.leads += entry.leads ?? 0;
            b.agendamentos += entry.novosAgendamentos ?? entry.agendamentos ?? 0;
            b.reunioes += entry.reunioes ?? 0;
            b.days.push(entry);
          }
          // % conversão = agendamentos / leads por mês
          const months = Array.from(monthMap.values()).map(m => ({
            ...m,
            pct: m.leads > 0 ? parseFloat(((m.agendamentos / m.leads) * 100).toFixed(0)) : 0,
          }));
          const isMultiMonth = months.length > 1;
          const viewMonthly = isMultiMonth && drillMonth === null;
          const dailyData = (drillMonth && drillMonth !== "__all__")
            ? (monthMap.get(drillMonth)?.days ?? allDays)
            : allDays;
          const BAR_W = 18;
          const dailyW = Math.max(dailyData.length * BAR_W, 400);

          const tooltipLabelMonthly = (val: any) => months.find(m => m.label === val)?.label ?? String(val);
          const tooltipLabelDaily = (val: any) => {
            const entry = dailyData.find((d: any) => d.dia === val);
            if (!entry?.date) return `Dia ${val}`;
            return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(entry.date + "T12:00:00"));
          };

          return (
            <div className="mb-8">
              {/* header com navegação */}
              <div className="flex items-center justify-between mb-2 pr-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                    Evolução – Agendamentos
                  </h2>
                  {/* breadcrumb */}
                  {isMultiMonth && (
                    <div className="flex items-center gap-1 text-[11px]">
                      <button onClick={() => setDrillMonth(null)} className={`transition-colors ${viewMonthly ? "text-[#1d1d1f] font-semibold" : "text-[#2563EB] hover:underline"}`}>
                        Geral
                      </button>
                      {drillMonth && (
                        <>
                          <span className="text-[#9ca3af]">›</span>
                          <span className="text-[#1d1d1f] font-semibold">
                            {drillMonth === "__all__" ? "Todos os dias" : monthMap.get(drillMonth)?.label}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {!viewMonthly && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-0.5 bg-[#d97706] rounded-full"></div>
                      <span className="text-[10px] text-[#86868b]">Meta: 4/dia</span>
                    </div>
                  )}
                  {/* botão drill ↓ / ↑ */}
                  {isMultiMonth && (
                    <button
                      onClick={() => setDrillMonth(viewMonthly ? "__all__" : null)}
                      title={viewMonthly ? "Ver por dia" : "Ver por mês"}
                      className="w-7 h-7 flex items-center justify-center rounded-md border border-[#e5e5ea] bg-white hover:bg-[#f0f0f5] transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        {viewMonthly
                          ? <path d="M2 4l4 4 4-4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          : <path d="M2 8l4-4 4 4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        }
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-4">
                {viewMonthly ? (
                  /* ── VISTA MENSAL (responsiva, sem scroll) ── */
                  <ResponsiveContainer width="100%" height={185}>
                    <BarChart data={months} barCategoryGap="30%" barGap={0} margin={{ top: 24, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#f0f0f5" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickFormatter={(v) => String(v).split(" ")[0]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} dy={6} interval={0} />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} dx={-6} />
                      <RechartsTooltip {...TOOLTIP_STYLE} formatter={(v: any, name: any) => {
                        if (name === "leads") return [`${Math.round(v)}`, "Leads recebidos"];
                        return [`${Math.round(v)}`, "Agendamentos"];
                      }} labelFormatter={tooltipLabelMonthly} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#86868b", paddingTop: "4px" }} formatter={(v) => v === "leads" ? "Leads" : "Agendamentos"} />
                      <Bar dataKey="leads" fill="#e5e7eb" radius={[3, 3, 0, 0]} name="leads" maxBarSize={80} />
                      <Bar dataKey="agendamentos" fill="#2563EB" radius={[3, 3, 0, 0]} name="agendamentos" maxBarSize={80}>
                        <LabelList
                          dataKey="pct"
                          position="top"
                          formatter={(v: any) => v > 0 ? `${v}%` : ""}
                          style={{ fontSize: 10, fontWeight: 700, fill: "#10b981" }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  /* ── VISTA DIÁRIA ── */
                  (() => {
                    const DailyTick = ({ x, y, index }: any) => {
                      const entry = (dailyData as any[])[index];
                      if (!entry?.date) return null;
                      const d = new Date(entry.date + "T12:00:00");
                      const dayNum = d.getDate();
                      const isNewMonth = index > 0 && dayNum === 1;
                      return (
                        <g transform={`translate(${x},${y})`}>
                          {isNewMonth && (
                            <>
                              <line x1={0} y1={-145} x2={0} y2={4} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 2" />
                              <text x={0} y={0} dy={22} textAnchor="middle" fill="#2563EB" fontSize={9} fontWeight={700}>{MONTH_SHORT[d.getMonth()]}</text>
                            </>
                          )}
                          <text x={0} y={0} dy={12} textAnchor="middle" fill={isNewMonth ? "#2563EB" : "#9ca3af"} fontSize={9} fontWeight={isNewMonth ? 700 : 400}>
                            {dayNum}
                          </text>
                        </g>
                      );
                    };
                    return (
                      <ResponsiveContainer width="100%" height={isMultiMonth ? 190 : 170}>
                        <BarChart data={dailyData} barCategoryGap="10%" barGap={0} margin={{ top: 10, right: 10, left: -20, bottom: isMultiMonth ? 14 : 0 }}>
                          <CartesianGrid vertical={false} stroke="#f0f0f5" strokeDasharray="3 3" />
                          <XAxis dataKey="dia" tick={<DailyTick />} axisLine={false} tickLine={false} interval={0} />
                          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} dx={-6} />
                          <RechartsTooltip {...TOOLTIP_STYLE} formatter={(v: any, name: any) => [`${Math.round(v)}`, name === "leads" ? "Entraram" : "Agendados"]} labelFormatter={tooltipLabelDaily} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "#86868b", paddingTop: "4px" }} />
                          <ReferenceLine y={4} stroke="#d97706" strokeWidth={1.5} />
                          <Bar dataKey="leads" fill="#e5e7eb" radius={[2, 2, 0, 0]} name="leads" />
                          <Bar dataKey="agendamentos" fill="#2563EB" radius={[2, 2, 0, 0]} name="agendamentos" />
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()
                )}
              </div>
            </div>
          );
        })()}

        {/* ── ANÁLISE DE CADÊNCIA vs NO-SHOW ──────────────────────────────── */}
        <div className="mt-8 mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">Cadência vs No-Show</h2>
            <span className="text-[10px] text-[#86868b]">dias entre chegada do lead e agendamento</span>
          </div>
          <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6">
            {!cadenciaData ? (
              <p className="text-[12px] text-[#86868b]">Carregando análise...</p>
            ) : cadenciaData.totalLeads === 0 ? (
              <p className="text-[12px] text-[#86868b]">Nenhum agendamento no período.</p>
            ) : (
              <>
                {/* Cabeçalho compacto: resumo + novos vs reagendamentos */}
                {cadenciaData.comparativo && (() => {
                  const n = cadenciaData.comparativo.novos;
                  const r = cadenciaData.comparativo.reagendados;
                  const taxaColor = (t: number) => t <= 35 ? "#16a34a" : t <= 50 ? "#d97706" : "#dc2626";
                  return (
                    <div className="flex items-stretch mb-6 rounded-xl overflow-hidden" style={{ background: "#111827" }}>
                      {/* Totais gerais */}
                      <div className="flex-1 px-5 py-4">
                        <p className="text-[10px] text-[#6b7280] font-semibold uppercase tracking-widest mb-3">Geral</p>
                        <div className="flex items-end justify-between">
                          <div>
                            <span className="text-[28px] font-black text-white leading-none">{cadenciaData.totalLeads}</span>
                            <span className="text-[11px] text-[#9ca3af] ml-2">agendamentos</span>
                          </div>
                          <span className="text-[13px] font-bold px-2.5 py-1 rounded-lg" style={{
                            background: cadenciaData.taxaGeral <= 35 ? "#052e16" : cadenciaData.taxaGeral <= 50 ? "#1c1404" : "#1f0e0e",
                            color: cadenciaData.taxaGeral <= 35 ? "#4ade80" : cadenciaData.taxaGeral <= 50 ? "#fbbf24" : "#f87171"
                          }}>{cadenciaData.taxaGeral}% no-show</span>
                        </div>
                      </div>
                      {/* Divisor */}
                      <div className="w-px bg-[#1f2937]" />
                      {/* Novos */}
                      <div className="flex-1 px-5 py-4">
                        <p className="text-[10px] text-[#6b7280] font-semibold uppercase tracking-widest mb-3">
                          Novos {(n.ia ?? 0) > 0 && <span className="text-[#818cf8] normal-case font-normal">· {n.ia} via IA</span>}
                        </p>
                        <div className="flex items-end justify-between">
                          <div>
                            <span className="text-[28px] font-black text-white leading-none">{n.total}</span>
                            <span className="text-[11px] text-[#9ca3af] ml-2">{n.noShow} faltaram</span>
                          </div>
                          <span className="text-[13px] font-bold px-2.5 py-1 rounded-lg" style={{
                            background: n.taxa <= 35 ? "#052e16" : n.taxa <= 50 ? "#1c1404" : "#1f0e0e",
                            color: n.taxa <= 35 ? "#4ade80" : n.taxa <= 50 ? "#fbbf24" : "#f87171"
                          }}>{n.taxa}%</span>
                        </div>
                      </div>
                      {/* Divisor */}
                      <div className="w-px bg-[#1f2937]" />
                      {/* Reagendamentos */}
                      <div className="flex-1 px-5 py-4">
                        <p className="text-[10px] text-[#6b7280] font-semibold uppercase tracking-widest mb-3">Reagendamentos</p>
                        <div className="flex items-end justify-between">
                          <div>
                            <span className="text-[28px] font-black text-white leading-none">{r.total > 0 ? r.total : "—"}</span>
                            {r.total > 0 && <span className="text-[11px] text-[#9ca3af] ml-2">{r.noShow} faltaram</span>}
                          </div>
                          {r.total > 0 && (
                            <span className="text-[13px] font-bold px-2.5 py-1 rounded-lg" style={{
                              background: r.taxa <= 35 ? "#052e16" : r.taxa <= 50 ? "#1c1404" : "#1f0e0e",
                              color: r.taxa <= 35 ? "#4ade80" : r.taxa <= 50 ? "#fbbf24" : "#f87171"
                            }}>{r.taxa}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Distribuição por número de reagendamentos */}
                {cadenciaData.reagendadoDist && cadenciaData.reagendadoDist.length > 0 && (
                  <div className="mb-5 pb-5 border-b border-[#f0f0f5]">
                    <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide mb-3">Vezes que o lead reagendou</p>
                    <div className="flex gap-3">
                      {(cadenciaData.reagendadoDist as any[]).map((row: any) => {
                        const nsColor = row.taxa > 60 ? "#dc2626" : row.taxa > 40 ? "#d97706" : "#16a34a";
                        const nsBg   = row.taxa > 60 ? "#fef2f2" : row.taxa > 40 ? "#fffbeb" : "#f0fdf4";
                        return (
                          <div key={row.vezes} className="flex-1 rounded-lg border border-[#e5e5ea] bg-[#fafafa] px-4 py-3">
                            <p className="text-[13px] font-black text-[#1d1d1f] mb-1">{row.label}</p>
                            <p className="text-[11px] text-[#86868b]">{row.total} leads · {row.noShow} faltaram</p>
                            <p className="text-[15px] font-black mt-2" style={{ color: nsColor }}>{row.taxa}%</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tabela por dia de cadência */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-[10px] text-[#9ca3af] uppercase tracking-wider border-b border-[#f0f0f5]">
                        <th className="pb-2 text-left font-semibold">Dia</th>
                        <th className="pb-2 text-right font-semibold">Agendados</th>
                        <th className="pb-2 font-semibold w-[16%]"></th>
                        <th className="pb-2 text-right font-semibold">Faltaram</th>
                        <th className="pb-2 text-right font-semibold">No-show</th>
                        <th className="pb-2 text-right font-semibold">Vendas</th>
                        <th className="pb-2 text-right font-semibold">Conv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const maxTotal = Math.max(...(cadenciaData.rows as any[]).map((r: any) => r.total));
                        return (cadenciaData.rows as any[]).map((row: any) => {
                        const nsColor = row.taxaNoShow > 50 ? "#dc2626" : row.taxaNoShow > 35 ? "#d97706" : "#16a34a";
                        const nsBg   = row.taxaNoShow > 50 ? "#fef2f2" : row.taxaNoShow > 35 ? "#fffbeb" : "#f0fdf4";
                        const isHighVol = row.total >= 10;
                        const barPct = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0;
                        return (
                          <tr key={row.diaCad} className="border-b border-[#f0f0f5] last:border-0 hover:bg-[#fafafa]">
                            <td className="py-2.5 font-medium text-[#1d1d1f]">
                              {row.diaLabel}
                              {!isHighVol && <span className="ml-1.5 text-[9px] text-[#c0c0c0]">*</span>}
                            </td>
                            <td className="py-2.5 text-right text-[#374151] pr-3">{row.total}</td>
                            <td className="py-2.5">
                              <div className="h-1.5 bg-[#f0f0f5] rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-[#1d1d1f]" style={{ width: `${barPct}%` }} />
                              </div>
                            </td>
                            <td className="py-2.5 text-right text-[#374151]">{row.noShow}</td>
                            <td className="py-2.5 text-right">
                              <span className="font-bold text-[12px] px-2 py-0.5 rounded" style={{ color: nsColor, background: nsBg }}>{row.taxaNoShow}%</span>
                            </td>
                            <td className="py-2.5 text-right text-[#374151]">{row.ganhos ?? 0}</td>
                            <td className="py-2.5 text-right font-semibold" style={{ color: (row.taxaConversao ?? 0) > 0 ? "#16a34a" : "#9ca3af" }}>{row.taxaConversao ?? 0}%</td>
                          </tr>
                        );
                      })})()}
                    </tbody>
                  </table>
                </div>

                {/* Insight */}
                {(() => {
                  const rows: any[] = cadenciaData.rows ?? [];
                  const highVol = rows.filter((r: any) => r.total >= 10);
                  if (highVol.length < 2) return null;
                  const bestNs = highVol.reduce((a: any, b: any) => a.taxaNoShow < b.taxaNoShow ? a : b);
                  const bestConv = highVol.reduce((a: any, b: any) => (a.taxaConversao ?? 0) > (b.taxaConversao ?? 0) ? a : b);
                  return (
                    <div className="mt-4 pt-4 border-t border-[#f0f0f5] space-y-2">
                      <div className="bg-[#fffbeb] rounded-lg p-3 text-[11px] text-[#92400e]">
                        <strong>No-show:</strong> Menor taxa no <strong>{bestNs.diaLabel}</strong> ({bestNs.taxaNoShow}%).
                        {bestNs.diaCad <= 3 ? " Leads contactados mais cedo faltam menos." : ` Vale continuar a cadência — ${bestNs.diaLabel} tem menos no-show.`}
                      </div>
                      {(bestConv.ganhos ?? 0) > 0 && (
                        <div className="bg-[#f0fdf4] rounded-lg p-3 text-[11px] text-[#14532d]">
                          <strong>Conversão:</strong> Maior taxa de venda no <strong>{bestConv.diaLabel}</strong> ({bestConv.taxaConversao}% — {bestConv.ganhos} {bestConv.ganhos === 1 ? "venda" : "vendas"} de {bestConv.total} agendados).
                          {bestConv.diaCad !== bestNs.diaCad && ` Atenção: o dia com menor no-show (${bestNs.diaLabel}) não é o de maior conversão (${bestConv.diaLabel}).`}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>

        {/* ── RAIO-X LEADS RECENTES ────────────────────────────────────────── */}
        <div className="mt-8 mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                Raio-X · Leads Recentes por Administradora
              </h2>
              <p className="text-[10px] text-[#a1a1aa] mt-0.5 max-w-lg">
                <span className="font-medium text-[#71717a]">Análise de Safra:</span> Exibe a jornada exclusiva dos leads que <strong className="font-medium">chegaram</strong> no período filtrado. (Ex: se um lead chegou no período, mas a reunião ocorreu fora dele, ele conta aqui. Se a reunião ocorreu no período, mas o lead chegou antes, ele <strong className="font-medium">não</strong> conta aqui).
              </p>
            </div>
            <div className="flex items-center gap-2 border border-[#e5e5ea] rounded-md bg-white overflow-hidden text-[12px]">
              <span className="text-[#86868b] pl-2 bg-[#f0f0f5]">desde</span>
              <input
                type="date"
                value={leadsRecentesSince}
                onChange={(e) => setLeadsRecentesSince(e.target.value)}
                className="px-2 py-1 bg-white text-[#1d1d1f] outline-none"
              />
              <span className="text-[#86868b] px-2 bg-[#f0f0f5]">até</span>
              <input
                type="date"
                value={leadsRecentesUntil}
                onChange={(e) => setLeadsRecentesUntil(e.target.value)}
                className="px-2 py-1 bg-white text-[#1d1d1f] outline-none"
              />
            </div>
            <button
              onClick={fetchLeadsRecentes}
              className="px-3 py-1.5 rounded-md text-[11px] font-bold bg-[#1d1d1f] text-white hover:bg-[#333] transition-colors ml-2"
            >
              Filtrar
            </button>
          </div>

          {leadsRecentes && (
            <div className="space-y-4">
              {/* Funil resumo — barra visual de conversão */}
              {(() => {
                const sinceLabel = new Date(leadsRecentesSince + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                const t = leadsRecentes.total || 1; // evita divisão por zero
                const steps = [
                  { label: "Chegaram", value: leadsRecentes.total, color: "#1d1d1f", pct: 100 },
                  { label: "Ligação", value: leadsRecentes.comLigacao, color: "#2563EB", pct: leadsRecentes.total > 0 ? Math.round((leadsRecentes.comLigacao / t) * 100) : 0 },
                  { label: "Agendados", value: leadsRecentes.agendados, color: "#b49136", pct: leadsRecentes.total > 0 ? Math.round((leadsRecentes.agendados / t) * 100) : 0 },
                  { label: "Reunião", value: leadsRecentes.reuniao, color: "#10B981", pct: leadsRecentes.agendados > 0 ? Math.round((leadsRecentes.reuniao / leadsRecentes.agendados) * 100) : 0 },
                  { label: "No-Show", value: leadsRecentes.noShows, color: "#DC2626", pct: leadsRecentes.agendados > 0 ? Math.round((leadsRecentes.noShows / leadsRecentes.agendados) * 100) : 0 },
                  { label: "Vendas", value: leadsRecentes.vendas, color: "#D946EF", pct: leadsRecentes.reuniao > 0 ? Math.round((leadsRecentes.vendas / leadsRecentes.reuniao) * 100) : 0 },
                ];
                return (
                  <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[11px] font-semibold text-[#1d1d1f]">Funil desde {sinceLabel}</p>
                      <div className="flex gap-2 text-[10px] text-[#86868b]">
                        <span className="text-[#7C3AED] font-semibold">
                          {leadsRecentes.recuperacao} recuperação ({Math.round((leadsRecentes.recuperacao / t) * 100)}%)
                        </span>
                        <span>·</span>
                        <span className="text-[#DC2626] font-semibold">
                          {leadsRecentes.perdidos} perdidos ({Math.round((leadsRecentes.perdidos / t) * 100)}%)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-end gap-3">
                      {steps.map((s, i) => (
                        <React.Fragment key={s.label}>
                          <div className="flex-1 flex flex-col items-center gap-1.5">
                            <p className="text-[18px] font-black leading-none" style={{ color: s.color }}>{s.value}</p>
                            <div className="w-full h-2 bg-[#f0f0f5] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.pct}%`, background: s.color }} />
                            </div>
                            <p className="text-[10px] font-semibold text-[#86868b]">{s.label}</p>
                            <p className="text-[9px] text-[#9ca3af]">
                              {s.label === "Vendas" ? `${s.pct}% das reun.` : s.label === "No-Show" || s.label === "Reunião" ? `${s.pct}% dos agend.` : `${s.pct}% chegaram`}
                            </p>
                          </div>
                          {i < steps.length - 1 && (
                            <div className="text-[#d1d5db] text-[12px] mb-6">›</div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Tabela por administradora */}
              {Object.keys(leadsRecentes.byTag).length > 0 && (
                <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#f0f0f5] flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Por Administradora</p>
                    <p className="text-[10px] text-[#86868b]">{Object.keys(leadsRecentes.byTag).length} administradoras · {leadsRecentes.total} leads</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-[10px] text-[#9ca3af] uppercase tracking-wider border-b border-[#f0f0f5] bg-[#fafafa]">
                          <th className="py-3 pl-5 text-left font-semibold">Administradora</th>
                          <th className="py-3 pr-3 text-right font-semibold">Chegaram</th>
                          <th className="py-3 pr-3 text-right font-semibold text-[#2563EB]">Ligação</th>
                          <th className="py-3 pr-3 text-right font-semibold text-[#b49136]">Agendados</th>
                          <th className="py-3 pr-3 text-right font-semibold text-[#10B981]">Reunião</th>
                          <th className="py-3 pr-3 text-right font-semibold text-[#DC2626]">No-Show</th>
                          <th className="py-3 pr-4 text-right font-semibold text-[#D946EF]">Vendas</th>
                          <th className="py-3 pr-4 text-right font-semibold text-[#7C3AED]">Recuperação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(leadsRecentes.byTag as Record<string, any>).map(([tag, data]: [string, any]) => {
                          const isSemTag = tag === "Sem administradora";
                          const pctLig = data.chegaram > 0 ? ((data.comLigacao / data.chegaram) * 100).toFixed(0) : "0";
                          const pctAgend = data.chegaram > 0 ? ((data.agendados / data.chegaram) * 100).toFixed(0) : "0";
                          const pctNs = data.agendados > 0 ? ((data.noShows / data.agendados) * 100).toFixed(0) : "0";
                          const pctVenda = data.reuniao > 0 ? ((data.vendas / data.reuniao) * 100).toFixed(0) : "0";
                          return (
                            <tr key={tag} className={`border-b border-[#f0f0f5] last:border-0 hover:bg-[#fafafa] ${isSemTag ? "opacity-40" : ""}`}>
                              <td className="py-3 pl-5 font-semibold text-[#1d1d1f]">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSemTag ? "bg-[#d1d5db]" : "bg-[#b49136]"}`} />
                                  {tag}
                                </div>
                              </td>
                              <td className="py-3 pr-3 text-right font-bold text-[#1d1d1f]">{data.chegaram}</td>
                              <td className="py-3 pr-3 text-right">
                                <span className="font-semibold text-[#2563EB]">{data.comLigacao}</span>
                                <span className="text-[10px] text-[#86868b] ml-1">({pctLig}%)</span>
                              </td>
                              <td className="py-3 pr-3 text-right">
                                <span className="font-semibold text-[#b49136]">{data.agendados}</span>
                                <span className="text-[10px] text-[#86868b] ml-1">({pctAgend}%)</span>
                              </td>
                              <td className="py-3 pr-3 text-right font-semibold text-[#10B981]">{data.reuniao}</td>
                              <td className="py-3 pr-3 text-right">
                                <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${data.noShows > 0 ? "text-[#DC2626] bg-[#fef2f2]" : "text-[#9ca3af]"}`}>
                                  {data.noShows}{data.noShows > 0 ? ` (${pctNs}%)` : ""}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-right">
                                <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${data.vendas > 0 ? "text-[#D946EF] bg-[#fdf4ff]" : "text-[#9ca3af]"}`}>
                                  {data.vendas}{data.vendas > 0 ? ` (${pctVenda}%)` : ""}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-right font-semibold text-[#7C3AED]">{data.recuperacao}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Lista de Clientes Processados */}
              {leadsRecentes.leads && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowLeadsDetail(!showLeadsDetail)}
                    className="w-full flex items-center justify-between px-5 py-3 bg-white rounded-xl border border-[#e5e5ea] shadow-sm hover:bg-[#fafafa] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showLeadsDetail ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                      <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Detalhamento de Leads (Vendas, Agendados, No-Show, Recuperação, Perdidos)</span>
                    </div>
                    <span className="text-[10px] text-[#86868b]">
                      {leadsRecentes.leads.filter((l: any) => ["scheduled", "meeting", "won"].includes(l.status) || l.noShow || l.isRecuperacao || l.isPerdido).length} clientes
                    </span>
                  </button>
                  {showLeadsDetail && (
                  <div className="bg-white rounded-b-xl border border-t-0 border-[#e5e5ea] shadow-sm overflow-hidden">
                  <div className="p-0 max-h-[400px] overflow-y-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-[10px] text-[#9ca3af] uppercase tracking-wider border-b border-[#f0f0f5]">
                          <th className="py-2 pl-5 text-left font-semibold">Cliente</th>
                          <th className="py-2 pr-3 text-left font-semibold">Telefone</th>
                          <th className="py-2 pr-3 text-left font-semibold">Kommo ID</th>
                          <th className="py-2 pr-3 text-left font-semibold">Administradora</th>
                          <th className="py-2 pr-5 text-right font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadsRecentes.leads
                          .filter((l: any) => ["scheduled", "meeting", "won"].includes(l.status) || l.noShow || l.isRecuperacao || l.isPerdido)
                          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .map((l: any) => {
                            let statusLabel = "Agendado";
                            let statusColor = "text-[#b49136] bg-[#fffbeb] border-[#fde68a]";
                            
                            if (l.isVenda) {
                              statusLabel = "Venda";
                              statusColor = "text-[#10B981] bg-[#ecfdf5] border-[#a7f3d0]";
                            } else if (l.isPerdido) {
                              statusLabel = "Perdido";
                              statusColor = "text-[#1d1d1f] bg-[#f0f0f5] border-[#d1d5db]";
                            } else if (l.isRecuperacao) {
                              statusLabel = "Recuperação";
                              statusColor = "text-[#7C3AED] bg-[#ede9fe] border-[#ddd6fe]";
                            } else if (l.noShow) {
                              statusLabel = "No-Show";
                              statusColor = "text-[#DC2626] bg-[#fef2f2] border-[#fecaca]";
                            }

                            return (
                              <tr key={l.id} className="border-b border-[#f0f0f5] last:border-0 hover:bg-[#fafafa]">
                                <td className="py-2.5 pl-5 font-semibold text-[#1d1d1f]">
                                  {l.name || "Sincronizando..."}
                                </td>
                                <td className="py-2.5 pr-3 text-[#1d1d1f]">
                                  {l.phone ? (
                                    <a href={`https://wa.me/55${l.phone}`} target="_blank" rel="noreferrer" className="hover:underline text-[#16A34A] flex items-center gap-1">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                                      {l.phone}
                                    </a>
                                  ) : (
                                    <span className="text-[#9ca3af]">N/A</span>
                                  )}
                                </td>
                                <td className="py-2.5 pr-3 text-[#2563EB]">
                                  <a href={`https://crinvestimentos1.kommo.com/leads/detail/${l.id}`} target="_blank" rel="noreferrer" className="hover:underline">
                                    #{l.id}
                                  </a>
                                </td>
                                <td className="py-2.5 pr-3 text-[#86868b]">
                                  {l.admTag}
                                </td>
                                <td className="py-2.5 pr-5 text-right">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor}`}>
                                    {statusLabel}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        {leadsRecentes.leads.filter((l: any) => ["scheduled", "meeting", "won", "lost"].includes(l.status) || l.noShow).length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-[#86868b] text-[12px]">
                              Nenhum cliente agendado nesse período.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  </div>
                  )}
                </div>
              )}

              {leadsRecentes.total === 0 && (
                <div className="bg-[#fffbeb] border border-[#fcd34d] rounded-xl p-4 text-[12px] text-[#92400e]">
                  Nenhum lead encontrado desde {new Date(leadsRecentesSince + "T12:00:00").toLocaleDateString("pt-BR")}.
                  As tags de administradora preenchem automaticamente após o próximo sync do Kommo.
                </div>
              )}
            </div>
          )}

          {!leadsRecentes && (
            <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-8 text-center text-[12px] text-[#86868b]">
              Carregando leads recentes...
            </div>
          )}
        </div>

        {/* ── RANKING DE SDRs ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm overflow-hidden mt-8">
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
                       <th className="py-4 text-right pr-4 font-semibold">NO-SHOW</th>
                       <th className="py-4 text-center pr-6 font-semibold">SCORE</th>
                    </tr>
                 </thead>
                 <tbody>
                    {displayed.length === 0 ? (
                      <tr>
                         <td colSpan={8} className="py-16 text-center text-[12px] text-[#86868b]">Nenhum dado no período.</td>
                      </tr>
                    ) : (
                      displayed.filter((row: any) => row.leadsGerados > 0 || row.agendamentos > 0).map((row: any, i: number) => {
                        const conv = (totais?.leadsGerados ?? 0) > 0 ? (row.agendamentos / totais!.leadsGerados) * 100 : 0;
                        const rowSlots = (row.agendamentos || 0) + (row.reagendados || 0);
                        const ns = rowSlots > 0 ? ((row.noShowsNoPeriodo ?? 0) / rowSlots) * 100 : 0;
                        return (
                          <tr key={row.agentName} className="border-t border-[#f0f0f5]">
                            <td className="py-3 pl-6">
                               <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold pb-px ${
                                 i === 0 ? 'bg-[#fffbeb] text-[#d97706]' : 'bg-[#f3f4f6] text-[#9ca3af]'
                               }`}>
                                  {i === 0 ? <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]"></span> : i+1}
                               </div>
                            </td>
                            <td className="py-3 font-semibold text-[#1d1d1f]">{row.agentName}</td>
                            <td className="py-3 text-right pr-4 text-[#374151]">{totais?.leadsGerados ?? row.leadsGerados}</td>
                            <td className="py-3 text-right pr-4 text-[#86868b]">{row.leadsNoFunil}</td>
                            <td className={`py-3 text-right pr-4 font-semibold ${conv >= 35 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{conv.toFixed(1)}%</td>
                            <td className="py-3 text-right pr-4 font-semibold text-[#2563EB]">{row.agendamentos}</td>
                            <td className={`py-3 text-right pr-4 font-semibold ${ns <= 35 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{ns.toFixed(1)}%</td>
                            <td className="py-3 text-center pr-6">
                              {row.sdrScoreMedia > 0 ? (
                                 <div className="inline-flex items-center justify-center bg-[#f0fdf4] text-[#16a34a] font-bold px-2 py-0.5 rounded text-[11px]">
                                   {row.sdrScoreMedia} ★
                                 </div>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                 </tbody>
              </table>
           </div>
        </div>

      </main>
    </div>
  );
}
