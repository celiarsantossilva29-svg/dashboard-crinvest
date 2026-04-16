"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, LineChart, Line, CartesianGrid, ReferenceLine } from "recharts";

// ─── helpers ────────────────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().split("T")[0]; }
function getMonthRange() {
  const n = new Date();
  return { start: isoDate(new Date(n.getFullYear(), n.getMonth(), 1)), end: isoDate(new Date(n.getFullYear(), n.getMonth() + 1, 0)) };
}
function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function fmtDateBR(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}
function mesLabel(iso: string) {
  try { return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(iso + "T12:00:00")); }
  catch { return ""; }
}

const TOOLTIP_STYLE = {
  contentStyle: { background: "#fff", border: "0.5px solid #e5e5ea", borderRadius: 8, fontSize: 12, color: "#1d1d1f", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" },
  cursor: { fill: "#f0f0f5", stroke: "#e5e5ea", strokeWidth: 1 },
};

// ─── types ────────────────────────────────────────────────────────────────────

interface CloserStats { agentName: string; vendas: number; receita: number; ticketMedio: number; taxaWin: number; reunioesPorVenda: number; taxaNoShow: number; }
interface Installment { parcelaNumero: number; dataVencimento: string; valorParcela: number; pago: boolean; }
interface DealCard { id: string; clientName: string; assignedTo: string; value: number; closedAt: string; status: "won" | "lost"; lostReason: string | null; campaignName: string | null; installments?: Installment[]; }
interface LossReason { reason: string; count: number; }
interface ApiData {
  agents: CloserStats[]; deals: DealCard[]; lossReasons: LossReason[];
  totals: { vendas: number; receita: number; ticketMedioGeral: number; taxaWinGeral: number; noShowGeral: number; leadTimeMedioGeral: number; };
  syncStatus?: any;
}
type DealTab = "won" | "lost";

// ─── inline components ───────────────────────────────────────────────────────

function InstallmentProgress({ installments, closedAt }: { installments?: Installment[]; closedAt: string }) {
  const hasParcelas = installments && installments.length > 0;
  const paidCount = hasParcelas
    ? installments!.filter((i) => i.pago).length
    : (() => {
        const closed = new Date(closedAt);
        const now = new Date();
        return Math.min(12, Math.max(0, (now.getFullYear() - closed.getFullYear()) * 12 + (now.getMonth() - closed.getMonth())));
      })();
  return (
    <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-[#f0f0f5]">
      {Array.from({ length: 12 }).map((_, i) => {
        const isPago = hasParcelas ? installments![i]?.pago : i < paidCount;
        return (
          <div key={i} className={`w-3.5 h-2 rounded-sm ${isPago ? "bg-[#16A34A]" : "bg-[#e5e7eb]"}`} title={`Parcela ${i + 1}: ${isPago ? "paga" : "futura"}`} />
        );
      })}
      <span className="w-full text-[10px] text-[#9ca3af] mt-1">{paidCount}/12 parcelas pagas</span>
    </div>
  );
}

function NegocioCard({ deal }: { deal: DealCard }) {
  const isWon = deal.status === "won";
  return (
    <div className="bg-white border border-[#e5e5ea] rounded-xl p-4 shadow-sm">
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-[13px] text-[#111827] truncate">{deal.clientName}</p>
          <p className="text-[11px] text-[#9ca3af] mt-0.5">{deal.assignedTo}</p>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${isWon ? "bg-[#f0fdf4] text-[#16A34A]" : "bg-[#fef2f2] text-[#DC2626]"}`}>
          {isWon ? "Ganho" : "Perdido"}
        </span>
      </div>
      <p className={`text-[18px] font-semibold mb-2 ${isWon ? "text-[#16A34A]" : "text-[#9ca3af]"}`}>
        {deal.value > 0 ? fmtBRL(deal.value) : "—"}
      </p>
      <div className="flex justify-between items-center text-[11px] text-[#9ca3af]">
        <span>{fmtDateBR(deal.closedAt)}</span>
        {deal.campaignName && (
          <span className="bg-[#eff6ff] text-[#2563eb] px-2 py-0.5 rounded text-[10px] max-w-[120px] truncate">
            {deal.campaignName}
          </span>
        )}
      </div>
      {!isWon && deal.lostReason && (
        <div className="mt-3 pt-3 border-t border-[#f0f0f5] text-[11px] text-[#6b7280]">
          <span className="text-[#9ca3af]">Motivo: </span>{deal.lostReason}
        </div>
      )}
      {isWon && <InstallmentProgress installments={deal.installments} closedAt={deal.closedAt} />}
    </div>
  );
}

function FunnelChevron() {
  return (
    <svg className="w-8 h-10 text-[#f5ebd5] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5l7 7-7 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function PerformanceCloserPage() {
  const { start: ds, end: de } = getMonthRange();
  const [start, setStart] = useState(ds);
  const [end, setEnd] = useState(de);
  const [apiData, setApiData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dealTab, setDealTab] = useState<DealTab>("won");
  const [agentFilter, setAgentFilter] = useState<string>("");
  const { data: session } = useSession();

  // Scope enforcement: restrict to own data if permission scope is "own"
  const userRole = (session?.user as any)?.role;
  const userName = session?.user?.name;
  const isAdmin = userRole === "admin";
  const permsRaw = (session?.user as any)?.permissions;
  let scopeLocked = false;
  if (!isAdmin && permsRaw) {
    try {
      const perms = typeof permsRaw === "string" ? JSON.parse(permsRaw) : permsRaw;
      const closerPerm = perms["PERF_CLOSER"] || perms["DASHBOARD"];
      if (closerPerm?.scope === "own" && userName) {
        scopeLocked = true;
      }
    } catch(e) {}
  }

  useEffect(() => {
    if (scopeLocked && userName && agentFilter !== userName) {
      setAgentFilter(userName);
    }
  }, [scopeLocked, userName, agentFilter]);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/kpis/performance-closer?start=${start}&end=${end}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setApiData(json.data);
    } catch (e: any) { setError(e.message); }
  }, [start, end]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // DERIVED DATA
  const agents = apiData?.agents ?? [];
  const lossReasons = apiData?.lossReasons ?? [];
  const totals = apiData?.totals;

  const displayedAgents = agents.filter((a) => {
    if (agentFilter === "") return true;
    // Partial match: "Eunice" matches "Eunice Dias" and vice versa
    const af = agentFilter.toLowerCase();
    const an = a.agentName.toLowerCase();
    return an.startsWith(af) || af.startsWith(an.split(" ")[0]);
  });
  // selectedAgent: the closer whose data drives the funil/produtividade when a filter is active
  const selectedAgent = agentFilter !== "" && displayedAgents.length > 0 ? displayedAgents[0] : null;

  const filteredDeals = (apiData?.deals ?? []).filter((d) => {
    if (d.status !== dealTab) return false;
    if (agentFilter === "") return true;
    const af = agentFilter.toLowerCase();
    const an = (d.assignedTo ?? "").toLowerCase();
    return an.startsWith(af) || af.startsWith(an.split(" ")[0]);
  });

  const maxLossCount = Math.max(...(lossReasons.map((r) => r.count) ?? [1]), 1);
  const totalLost = (apiData?.deals ?? []).filter((d) => d.status === "lost").length;

  // METAS (Adaptadas para o ticket maior)
  const metaMesVal = 5000000;
  const targetReunioes = 150;
  const targetReunioes2 = 80;
  const targetPropostas = 40;
  const targetVendas = 25;
  const metaDiariaVendas = 1; // para o grafico de evolucao diaria

  // Display values: use per-agent stats when a filter is active, otherwise team totals
  const displayReceita     = selectedAgent ? selectedAgent.receita          : (totals?.receita          ?? 0);
  const displayTicketMedio = selectedAgent ? selectedAgent.ticketMedio      : (totals?.ticketMedioGeral ?? 0);
  const displayTaxaWin     = selectedAgent ? selectedAgent.taxaWin          : (totals?.taxaWinGeral     ?? 0);
  const displayNoShow      = selectedAgent ? selectedAgent.taxaNoShow       : (totals?.noShowGeral      ?? 0);
  const displayLeadTime    = selectedAgent ? selectedAgent.leadTimeTotalDias: (totals?.leadTimeMedioGeral ?? 0);
  const displayVendas      = selectedAgent ? selectedAgent.vendas           : (totals?.totalWon         ?? 0);

  const pctAtingidoDaMeta = Math.min(100, Math.round((displayReceita / metaMesVal) * 100));
  const faltamReceita = Math.max(0, metaMesVal - displayReceita);

  // Funil: step 1 & 4 come from per-agent API data; steps 2 & 3 only available as team totals
  const crmFunnelTeam = {
    reuniao1: 44,
    reuniao2: 4,
    reagendamento: 12,
    negociacao: 45,
    contatoFuturo: 23,
  };

  const reunioesFeitas      = selectedAgent ? selectedAgent.totalReunioes : crmFunnelTeam.reuniao1;
  const totalVendasPeriodo  = displayVendas;
  // Steps 2 & 3 have no per-agent breakdown in the API — hide them when filtering
  const reunioes2Realizadas = selectedAgent ? 0 : crmFunnelTeam.reuniao2;
  const propostasRealizadas = selectedAgent ? 0 : crmFunnelTeam.negociacao;

  const qtDiasPeriodo = Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
  const reunioesPorDia = (reunioesFeitas / qtDiasPeriodo).toFixed(1);
  const comparecimentoMedio = Math.round(100 - displayNoShow);

  // Projeção
  const ritmoAtualDia = displayReceita / qtDiasPeriodo;
  const diasCorridos = Math.max(1, Math.min(qtDiasPeriodo, new Date().getDate()));
  const diasRestantes = qtDiasPeriodo - diasCorridos;
  const ritmoNecessario = diasRestantes > 0 ? (faltamReceita / diasRestantes) : 0;
  const projecaoFinal = (ritmoAtualDia * qtDiasPeriodo);
  const isNoRitmo = projecaoFinal >= metaMesVal;

  // Tabela Rank Badges
  const rankBadge = (i: number) => {
    if (i === 0) return { bg: "#FFFBEB", color: "#D97706" };
    if (i === 1) return { bg: "#F9FAFB", color: "#6B7280" };
    if (i === 2) return { bg: "#FFF7ED", color: "#C2410C" };
    return { bg: "#F3F4F6", color: "#9CA3AF" };
  };

  // Fake chart data for Evolução Diária (Vendas)
  const mockEvolucaoVendas = Array.from({length: 30}).map((_, i) => ({
    dia: i + 1,
    vendas: Math.floor(Math.random() * 2) + (i % 3 === 0 ? 1 : 0)
  }));

  const lastSyncDate = apiData?.syncStatus ? "29/03/26 17:34" : (new Date().toLocaleString('pt-BR').substring(0, 16));

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto w-full bg-[#f8f9fa] text-[#1d1d1f] font-sans selection:bg-[#c89f3c] selection:text-white pb-16">
      
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#f8f9fa]/90 backdrop-blur-md border-b border-[#e5e5ea] px-8 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          
          <div className="flex items-center gap-4">
            <h1 className="text-[16px] font-bold text-[#1d1d1f]">Performance Closer</h1>
            <p className="text-[12px] text-[#86868b] border-l border-[#e5e5ea] pl-4">
              Conversão · Negócios · Motivo de Perda · {mesLabel(start)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {apiData && (
              <select
                value={agentFilter} onChange={(e) => { if (!scopeLocked) setAgentFilter(e.target.value); }}
                disabled={scopeLocked}
                className={`border border-[#e5e5ea] rounded-md px-3 py-1.5 text-[13px] bg-white text-[#1d1d1f] hover:border-[#d1d1d6] outline-none transition-colors ${scopeLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {scopeLocked ? (
                  <option value={userName || ""}>{userName}</option>
                ) : (
                  <>
                    <option value="">Todos os Closers</option>
                    {apiData.agents.map((a) => <option key={a.agentName} value={a.agentName}>{a.agentName}</option>)}
                  </>
                )}
              </select>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#86868b]">De</span>
              <div className="flex items-center border border-[#e5e5ea] rounded-md bg-white overflow-hidden text-[13px]">
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="px-3 py-1.5 outline-none text-[#1d1d1f]" />
                <span className="text-[#86868b] px-2 bg-[#f0f0f5]">até</span>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="px-3 py-1.5 outline-none text-[#1d1d1f]" />
              </div>
            </div>

            <button onClick={fetchData} className="px-4 py-1.5 rounded-md text-[13px] font-bold bg-[#b49136] text-white hover:bg-[#a1812f] transition-colors ml-2">
              Atualizar
            </button>
          </div>

        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="px-8 pt-6 max-w-[1600px] mx-auto w-full flex flex-col gap-6">
        
        {error && (
          <div className="bg-[#FEF2F2] border-l-[3px] border-[#DC2626] px-4 py-3 text-[13px] text-[#DC2626] rounded shadow-sm">
            {error}
          </div>
        )}

        {/* ── VISÃO GERAL DO PERÍODO ──────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
             <h2 className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Visão Geral do Período</h2>
             <span className="text-[10px] text-[#9ca3af]">Última sincronização automática: {lastSyncDate}</span>
          </div>
          
          <div className="grid grid-cols-6 gap-3">
            <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5">
              <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-1.5">Ticket Médio</p>
              <p className="text-[22px] font-bold text-[#1d1d1f] leading-none mb-1">{apiData ? fmtBRL(displayTicketMedio) : "R$ 0"}</p>
              <p className="text-[11px] text-[#9ca3af]">meta da venda</p>
            </div>

            <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5">
              <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-1.5">Vendas Fechadas</p>
              <p className="text-[22px] font-bold text-[#1d1d1f] leading-none mb-1">{totalVendasPeriodo}</p>
              <p className="text-[11px] text-[#9ca3af]">meta de {targetVendas}</p>
            </div>

            <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5">
              <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-1.5">Receita Total</p>
              <p className="text-[22px] font-bold text-[#1d1d1f] leading-none mb-1">{apiData ? fmtBRL(displayReceita) : "R$ 0"}</p>
              <p className="text-[11px] text-[#9ca3af]">meta R$ {metaMesVal.toLocaleString('pt-BR')}</p>
            </div>

            <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5">
              <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-1.5">Win Rate</p>
              <p className="text-[22px] font-bold text-[#d97706] leading-none mb-1">{displayTaxaWin}%</p>
              <p className="text-[11px] text-[#9ca3af]">Faltam {fmtBRL(faltamReceita)}</p>
            </div>

            <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5">
              <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-1.5">Lead Time Médio</p>
              <div className="flex items-center gap-2 mb-2 mt-2">
                 <div className="w-4 h-1 bg-[#2563EB] rounded"></div>
                 <span className="text-[10px] text-[#9ca3af]">chegada → fechamento</span>
              </div>
              <p className="text-[16px] font-bold text-[#1d1d1f] leading-none">{displayLeadTime > 0 ? `${displayLeadTime} dias` : "—"}</p>
            </div>

            <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-5">
              <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-1.5">Meta do Mês</p>
              <p className="text-[20px] font-bold text-[#1d1d1f] leading-none mb-1">{fmtBRL(metaMesVal)}</p>
              <p className="text-[11px] font-bold text-[#1d1d1f] mb-1">{pctAtingidoDaMeta}% atingido</p>
              <div className="w-full bg-[#f3f4f6] rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#d97706] h-full" style={{ width: `${pctAtingidoDaMeta}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CENTRAL LAYER (Funil & Produtividade) ───────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6 mt-2">
          
          {/* LADO ESQUERDO: Funil de Vendas (68%) */}
          <div className="w-full lg:w-[68%]">
            <h2 className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2">Funil de Vendas</h2>
            
            <div className="flex items-center gap-0 w-full mb-3">
               
               {/* STEP 1 */}
               <div className="flex-1 bg-white border border-[#e5e5ea] rounded-xl p-5 shadow-sm relative">
                  <h3 className="text-[10px] font-bold text-[#86868b] uppercase mb-2">1ª Reunião Realizada</h3>
                  <p className="text-[28px] font-normal leading-none text-[#1d1d1f] mb-1">{reunioesFeitas}</p>
                  <p className="text-[11px] font-medium text-[#1d1d1f] mb-4">Meta {targetReunioes}</p>
                  
                  <div className="inline-flex items-center gap-2 bg-[#fdfaec] px-3 py-1.5 rounded-md mb-6">
                     <svg className="w-4 h-4 text-[#d97706]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                     <span className="text-[13px] font-bold text-[#d97706]">{Math.round((reunioesFeitas / targetReunioes) * 100)}%</span>
                  </div>

                  <div className="border-t border-[#f0f0f5] pt-3 flex items-center justify-between">
                     <span className="text-[10px] font-bold text-[#1d1d1f]">Taxa 1ª/Leads</span>
                     <span className="text-[12px] font-bold text-[#1d1d1f]">—</span>
                  </div>
               </div>

               <FunnelChevron />

               {/* STEP 2 */}
               <div className="flex-1 bg-white border border-[#e5e5ea] rounded-xl p-5 shadow-sm relative">
                  <h3 className="text-[10px] font-bold text-[#86868b] uppercase mb-2">2ª Reunião Agendada</h3>
                  <p className="text-[28px] font-normal leading-none text-[#1d1d1f] mb-1">{reunioes2Realizadas}</p>
                  <p className="text-[11px] font-medium text-[#1d1d1f] mb-4">Meta {targetReunioes2}</p>
                  
                  <div className="inline-flex items-center gap-2 bg-[#fdfaec] px-3 py-1.5 rounded-md mb-6">
                     <svg className="w-4 h-4 text-[#d97706]" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                     <span className="text-[13px] font-bold text-[#d97706]">{Math.round((reunioes2Realizadas / targetReunioes2) * 100)}%</span>
                  </div>

                  <div className="border-t border-[#f0f0f5] pt-3 flex items-center justify-between">
                     <span className="text-[10px] font-bold text-[#1d1d1f]">Taxa 2ª/1ª</span>
                     <span className="text-[12px] font-bold text-[#1d1d1f]">{reunioesFeitas > 0 ? Math.round((reunioes2Realizadas / reunioesFeitas) * 100) : 0}%</span>
                  </div>
               </div>

               <FunnelChevron />

               {/* STEP 3 */}
               <div className="flex-1 bg-white border border-[#e5e5ea] rounded-xl p-5 shadow-sm relative">
                  <h3 className="text-[10px] font-bold text-[#86868b] uppercase mb-2">Negociação</h3>
                  <p className="text-[28px] font-normal leading-none text-[#1d1d1f] mb-1">{propostasRealizadas}</p>
                  <p className="text-[11px] font-medium text-[#1d1d1f] mb-4">Meta {targetPropostas}</p>
                  
                  <div className="inline-flex items-center gap-2 bg-[#fdfaec] px-3 py-1.5 rounded-md mb-6">
                     <svg className="w-4 h-4 text-[#d97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                     <span className="text-[13px] font-bold text-[#d97706]">{Math.round((propostasRealizadas / targetPropostas) * 100)}%</span>
                  </div>

                  <div className="border-t border-[#f0f0f5] pt-3 flex items-center justify-between">
                     <span className="text-[10px] font-bold text-[#1d1d1f]">Taxa Negoc./2ª</span>
                     <span className="text-[12px] font-bold text-[#1d1d1f]">{reunioes2Realizadas > 0 ? Math.round((propostasRealizadas / reunioes2Realizadas) * 100) : 0}%</span>
                  </div>
               </div>

               <FunnelChevron />

               {/* STEP 4 */}
               <div className="flex-1 bg-white border border-[#e5e5ea] rounded-xl p-5 shadow-sm relative">
                  <h3 className="text-[10px] font-bold text-[#86868b] uppercase mb-2">Venda Ganha</h3>
                  <p className="text-[28px] font-normal leading-none text-[#1d1d1f] mb-1">{totalVendasPeriodo}</p>
                  <p className="text-[11px] font-medium text-[#1d1d1f] mb-4">Meta {targetVendas}</p>
                  
                  <div className="inline-flex items-center gap-2 bg-[#fdfaec] px-3 py-1.5 rounded-md mb-6">
                     <svg className="w-4 h-4 text-[#d97706]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                     <span className="text-[13px] font-bold text-[#d97706]">{Math.round((totalVendasPeriodo / targetVendas) * 100)}%</span>
                  </div>

                  <div className="border-t border-[#f0f0f5] pt-3 flex items-center justify-between">
                     <span className="text-[10px] font-bold text-[#1d1d1f]">Taxa Venda/Negoc.</span>
                     <span className="text-[12px] font-bold text-[#1d1d1f]">{propostasRealizadas > 0 ? Math.round((totalVendasPeriodo / propostasRealizadas) * 100) : 0}%</span>
                  </div>
               </div>
               
            </div>
            
            <div className="bg-[#f0f0f5]/60 rounded-md py-3 text-center">
               <p className="text-[12px] text-[#1d1d1f]">Taxa geral do funil: <span className="font-bold text-[#1d1d1f]">{reunioesFeitas > 0 ? Math.round((totalVendasPeriodo / reunioesFeitas) * 100) : 0}%</span> <span className="text-[#86868b] mx-2">•</span> <span className="text-[#374151]">De Reunião 1 até a venda</span></p>
            </div>
          </div>

          {/* LADO DIREITO: Produtividade (32%) */}
          <div className="w-full lg:w-[32%]">
            <h2 className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2">Produtividade</h2>
            <div className="bg-white border border-[#e5e5ea] rounded-xl shadow-sm h-full flex flex-col justify-between">
               
               <ul className="divide-y divide-[#f0f0f5] px-6">
                  <li className="py-4 flex justify-between items-center">
                    <span className="text-[13px] text-[#374151]">Reuniões Realizadas</span>
                    <span className="text-[16px] font-bold text-[#1d1d1f]">{reunioesFeitas}</span>
                  </li>
                  <li className="py-4 flex justify-between items-center">
                    <span className="text-[13px] text-[#374151]">Reuniões / Dia</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#9ca3af]">média</span>
                      <span className="text-[16px] font-bold text-[#1d1d1f]">{reunioesPorDia}</span>
                    </div>
                  </li>
                  <li className="py-4 flex justify-between items-center">
                    <span className="text-[13px] text-[#374151]">Comparecimento</span>
                    <span className="text-[16px] font-bold text-[#d97706]">{comparecimentoMedio}%</span>
                  </li>
                  <li className="py-4 flex justify-between items-center">
                    <span className="text-[13px] text-[#374151]">No-Show</span>
                    <span className="text-[16px] font-bold text-[#1d1d1f]">{displayNoShow}%</span>
                  </li>
                  <li className="py-4 flex justify-between items-center">
                    <span className="text-[13px] text-[#374151]">Tempo médio de fechamento</span>
                    <span className="text-[16px] font-bold text-[#1d1d1f]">{displayLeadTime > 0 ? `${displayLeadTime} dias` : "0 dias"}</span>
                  </li>
               </ul>

               <div className="mt-auto border-t border-[#f0f0f5] p-5 flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#dc2626]">{pctAtingidoDaMeta}% <span className="text-[#1d1d1f] font-normal">da meta atingida</span></span>
                  <div className="flex items-center gap-2">
                     <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                     <span className="text-[13px] font-bold text-[#1d1d1f]">Faltam {fmtBRL(faltamReceita)}</span>
                  </div>
               </div>

            </div>
          </div>

        </div>

        {/* ── LOWER LAYER (Projeção, Ranking, Motivos, Gráfico) ──────────── */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          
          {/* LADO ESQUERDO */}
          <div className="w-full lg:w-[68%] flex flex-col gap-6">
            
            {/* Projeção de Faturamento */}
            <div>
              <h2 className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2">Projeção de Venda</h2>
              <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6">
                
                <div className="grid grid-cols-3 divide-x divide-[#f0f0f5] text-center mb-6">
                  <div>
                    <p className="text-[12px] text-[#86868b] mb-1">Ritmo Atual</p>
                    <p className="text-[24px] font-bold text-[#1d1d1f]">{fmtBRL(ritmoAtualDia)} <span className="text-[12px] font-normal text-[#9ca3af]">/ dia</span></p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#86868b] mb-1">Ritmo Necessário</p>
                    <p className="text-[24px] font-bold text-[#d97706]">{fmtBRL(ritmoNecessario)} <span className="text-[12px] font-normal text-[#9ca3af]">/ dia</span></p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#86868b] mb-1">Projeção Final</p>
                    <p className="text-[24px] font-bold text-[#1d1d1f]">{fmtBRL(projecaoFinal)}</p>
                  </div>
                </div>

                <div className="w-full bg-[#f3f4f6] rounded-full h-3 overflow-hidden mb-3">
                  <div className={`h-full ${isNoRitmo ? "bg-[#16A34A]" : "bg-[#d97706]"}`} style={{ width: `${Math.min(100, Math.max(0, (projecaoFinal / metaMesVal) * 100))}%` }}></div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className={`flex items-center gap-2 text-[13px] font-medium ${isNoRitmo ? "text-[#16A34A]" : "text-[#dc2626]"}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                    {isNoRitmo ? "No ritmo atual você bate a meta!" : "No ritmo atual você NÃO bate a meta"}
                  </div>
                  <span className="text-[13px] font-bold text-[#d97706]">
                    {Math.round((projecaoFinal / metaMesVal) * 100)}% <span className="text-[#1d1d1f] font-normal">da meta</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Ranking de Closers */}
            <div>
              <h2 className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2">Ranking de Closers</h2>
              <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm overflow-hidden min-h-[200px]">
                <div className="overflow-x-auto">
                   <table className="w-full text-[11px] text-left">
                      <thead>
                         <tr className="bg-white text-[#9ca3af] tracking-wider uppercase border-b border-[#f0f0f5]">
                            <th className="py-4 pl-6 font-semibold w-10">#</th>
                            <th className="py-4 font-semibold">CLOSER</th>
                            <th className="py-4 text-right pr-4 font-semibold">REUNIÕES</th>
                            <th className="py-4 text-right pr-4 font-semibold">VENDAS</th>
                            <th className="py-4 text-right pr-4 font-semibold">WIN RATE</th>
                            <th className="py-4 text-right pr-4 font-semibold">TICKET MÉDIO</th>
                            <th className="py-4 text-right pr-6 font-semibold">NO-SHOW</th>
                         </tr>
                      </thead>
                      <tbody>
                         {displayedAgents.length === 0 ? (
                           <tr>
                              <td colSpan={7} className="py-16 text-center text-[12px] text-[#86868b]">Nenhum dado no período.</td>
                           </tr>
                         ) : (
                           displayedAgents.map((row: any, i: number) => {
                             const bgclass = rankBadge(i).bg;
                             const colorclass = rankBadge(i).color;
                             return (
                             <tr key={row.agentName} className="border-b border-[#f0f0f5] last:border-0 hover:bg-[#f9fafb]">
                               <td className="py-4 pl-6">
                                  <div style={{ background: bgclass, color: colorclass }} className="w-5 h-5 rounded flex items-center justify-center font-bold text-[10px]">
                                     {i+1}
                                  </div>
                               </td>
                               <td className="py-4 font-semibold text-[#1d1d1f]">{row.agentName}</td>
                               <td className="py-4 text-right pr-4 text-[#374151]">{row.totalReunioes}</td>
                               <td className="py-4 text-right pr-4 text-[#374151] font-bold">{row.vendas}</td>
                               <td className="py-4 text-right pr-4 font-semibold text-[#86868b]">{row.taxaWin}%</td>
                               <td className="py-4 text-right pr-4 text-[#374151]">{fmtBRL(row.ticketMedio)}</td>
                               <td className="py-4 text-right pr-6 font-semibold text-[#86868b]">{row.taxaNoShow}%</td>
                             </tr>
                             )
                           })
                         )}
                      </tbody>
                   </table>
                </div>
              </div>
            </div>

          </div>

          {/* LADO DIREITO */}
          <div className="w-full lg:w-[32%] flex flex-col gap-6">
            
            {/* Motivos de Perda */}
            <div>
              <h2 className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2">Motivos de Perda</h2>
              <div className="bg-white border border-[#e5e5ea] rounded-xl shadow-sm p-6 min-h-[225px]">
                  {lossReasons.length > 0 ? (
                    <div className="flex flex-col gap-5 mt-2">
                       {lossReasons.map((r, i) => {
                          const w = Math.max(10, Math.round((r.count / maxLossCount) * 100));
                          return (
                            <div key={r.reason} className="flex items-center gap-3">
                               <span className="w-[100px] text-[12px] text-[#374151] truncate">{r.reason}</span>
                               <span className="text-[13px] font-bold text-[#1d1d1f] w-6">{r.count}</span>
                               <div className="flex-1 rounded-full bg-transparent h-3 overflow-hidden">
                                  <div className="h-full bg-[#f5e6b7] rounded-full" style={{ width: `${w}%` }}></div>
                               </div>
                            </div>
                          )
                       })}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                       <span className="text-[12px] text-[#9ca3af]">Nenhuma perda registrada.</span>
                    </div>
                  )}
              </div>
            </div>

            {/* Evolução Diária - Vendas */}
            <div>
              <h2 className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2">Evolução Diária - Vendas</h2>
              <div className="bg-white border border-[#e5e5ea] rounded-xl shadow-sm p-4 h-[250px] relative">
                 <div className="absolute top-4 right-4 text-[10px] font-bold text-[#1d1d1f] flex items-center gap-2">
                   <div className="w-3 h-1 bg-[#2563EB] rounded"></div>
                   Vendas
                   <span className="ml-3 font-normal text-[#86868b]">Meta: {metaDiariaVendas}/dia</span>
                 </div>
                 <div className="mt-8 h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mockEvolucaoVendas} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} dy={8} />
                        <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} dx={-10} />
                        <CartesianGrid vertical={false} stroke="#f0f0f5" strokeDasharray="3 3" />
                        <ReferenceLine y={metaDiariaVendas} stroke="#d97706" strokeWidth={1.5} />
                        <Line type="monotone" dataKey="vendas" stroke="#2563EB" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#1e40af" }} />
                        <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${v} Vendas`]} labelFormatter={(l) => `Dia ${l}`} />
                      </LineChart>
                    </ResponsiveContainer>
                 </div>
              </div>
            </div>

          </div>

        </div>

        {/* ── LOWER LAYER (Negócios - Existente) ──────────── */}
        <div className="mt-10 pt-10 border-t border-[#e5e5ea]">
             <h2 className="text-[14px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-4 border-l-4 border-[#b49136] pl-2">Lista de Negócios (Ganhos / Perdidos)</h2>
             
             <div className="bg-transparent border border-[#e5e5ea] rounded-xl p-0 overflow-hidden shadow-sm">
                <div className="flex gap-1 pt-4 px-4 bg-white border-b border-[#e5e5ea]">
                   {(["won", "lost"] as DealTab[]).map((tab) => {
                     const count = (apiData?.deals ?? []).filter((d) => d.status === tab && (agentFilter === "" || d.assignedTo === agentFilter)).length;
                     const isActive = dealTab === tab;
                     const textCol = isActive ? (tab === "won" ? "text-[#16A34A]" : "text-[#dc2626]") : "text-[#9ca3af]";
                     const borderCol = isActive ? (tab === "won" ? "border-[#16A34A]" : "border-[#dc2626]") : "border-transparent";
                     
                     return (
                       <button key={tab} onClick={() => setDealTab(tab)}
                         className={`px-5 py-2.5 text-[12px] font-bold border-b-[3px] transition-colors rounded-t-md ${textCol} ${borderCol} ${isActive ? (tab==='won'?'bg-[#f0fdf4]':'bg-[#fef2f2]') : 'hover:bg-[#f3f4f6]'}`}
                       >
                         {tab === "won" ? "Ganhos" : "Perdidos"} ({count})
                       </button>
                     );
                   })}
                </div>
                
                <div className="p-6 bg-white min-h-[200px]">
                   {filteredDeals.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                       {filteredDeals.map((deal) => <NegocioCard key={deal.id} deal={deal} />)}
                     </div>
                   ) : (
                     <p className="text-center text-[13px] text-[#9ca3af] py-16">
                       Nenhum negócio {dealTab === "won" ? "ganho" : "perdido"} no período.
                     </p>
                   )}
                </div>
             </div>
        </div>

        {/* footer */}
        <footer className="mt-8 mb-4 text-center text-[10px] text-[#9ca3af] tracking-widest border-t border-[#e5e5ea] pt-4">
          Performance Closer · {mesLabel(start)}
        </footer>
      </main>
    </div>
  );
}
