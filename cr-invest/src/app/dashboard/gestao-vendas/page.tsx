"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Calendar, Filter, Users, Medal, ChevronLeft, ChevronRight, Plus, X, CheckCircle, Zap, Target } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useSession } from "next-auth/react";

// ─── Utils ────────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtDateBR(iso: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function getInitials(name: string) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthRange() {
  // Para fins de demonstração dos dados reais enviados, vamos fixar em Março/2026
  return { start: "2026-03-01", end: "2026-03-31" };
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Sale {
  id: string;
  clientName: string;
  assignedTo: string;
  sdrName?: string | null;
  value: number;
  closedAt: string;
  administradora: string | null;
  installments?: { id: string; parcelaNumero: number; pago: boolean; status?: string; valorParcela: number; dataVencimento: string }[];
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function GestaoVendasPage() {
  const { start: ds, end: de } = getMonthRange();
  const [startDate, setStartDate] = useState(ds);
  const [endDate, setEndDate] = useState(de);
  const [search, setSearch] = useState("");
  const [closerFilter, setCloserFilter] = useState("");
  const [sdrFilter, setSdrFilter] = useState("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCampanha, setIsCampanha] = useState(false);

  const [comissaoConfig, setComissaoConfig] = useState({ fixedSalary: 3000, percentage: 0.5, installments: 12 });
  const { data: session } = useSession();
  const [teamRules, setTeamRules] = useState<Record<string, any>>({});

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales?start=${startDate}&end=${endDate}`);
      const json = await res.json();
      setSales(json.data || []);

      // Busca configs globais (como fallback)
      const cRes = await fetch("/api/config/commission");
      const cJson = await cRes.json();
      if (cJson.data) setComissaoConfig({
        fixedSalary: cJson.data.fixedSalary,
        percentage: cJson.data.percentage,
        installments: cJson.data.installments
      });

      // Busca regras individuais da equipe (Tiers e Permissões)
      const tRes = await fetch("/api/vendedores");
      const tJson = await tRes.json();
      const rules: Record<string, any> = {};
      (tJson.data || []).forEach((v: any) => {
        rules[v.nome] = v;
      });
      setTeamRules(rules);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Filtro e Escopo
  const filteredSales = useMemo(() => {
    let list = sales;

    // Verificar Escopo (Permissão "SÓ O DELE")
    const permsRaw = (session?.user as any)?.permissions;
    const userRole = (session?.user as any)?.role;
    const userName = session?.user?.name;

    if (userRole !== "admin" && permsRaw) {
      try {
        const perms = typeof permsRaw === "string" ? JSON.parse(permsRaw) : permsRaw;
        const scope = perms["GESTAO_VENDAS"]?.scope;
        if (scope === "own" && userName) {
          list = list.filter(s => s.assignedTo === userName || s.sdrName === userName);
        }
      } catch(e) {}
    }

    return list.filter(s => {
      const matchSearch = !search || 
        s.clientName.toLowerCase().includes(search.toLowerCase()) || 
        s.assignedTo.toLowerCase().includes(search.toLowerCase());
      const matchCloser = !closerFilter || s.assignedTo === closerFilter;
      const matchSdr = !sdrFilter || s.sdrName === sdrFilter;
      return matchSearch && matchCloser && matchSdr;
    });
  }, [sales, search, closerFilter, sdrFilter, session]);

  const uniqueClosers = useMemo(() => Array.from(new Set(sales.map(s => s.assignedTo).filter(Boolean))), [sales]);
  const uniqueSDRs = useMemo(() => Array.from(new Set(sales.map(s => s.sdrName).filter(Boolean))), [sales]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, closerFilter, sdrFilter, startDate, endDate]);

  // Aggregations
  const totalVendido = filteredSales.reduce((acc, s) => acc + s.value, 0);
  const ticketMedio = filteredSales.length > 0 ? totalVendido / filteredSales.length : 0;

  // Ranking (Sempre filtrado pelo escopo acima)
  const ranking = useMemo(() => {
    const map: Record<string, { name: string; vendas: number; total: number }> = {};
    for (const s of filteredSales) {
      if (!map[s.assignedTo]) map[s.assignedTo] = { name: s.assignedTo, vendas: 0, total: 0 };
      map[s.assignedTo].vendas += 1;
      map[s.assignedTo].total += s.value;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  // Paginação
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const paginatedSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // ── GAMIFICAÇÃO E PROJEÇÃO INDIVIDUALIZADA ──
  const baseSalary = comissaoConfig.fixedSalary;
  const isSdrMode = sdrFilter !== "" && closerFilter === "";

  // Se estiver filtrando um Closer específico, usamos os tiers dele. 
  // Senha houver filtro, usamos o total vendido para definir o tier visual.
  let currentTier = "Bronze";
  const userRules = closerFilter ? teamRules[closerFilter] : null;
  
  const thresholds = {
    silver: userRules?.silverMin || 1000000,
    gold: userRules?.goldMin || 3000000
  };

  let commissionRate = 0;
  let nextTier = "Prata";
  let nextCommissionRate = 0;
  let currentTierMin = 0;
  let nextTierMax = thresholds.silver - 1;

  if (totalVendido >= thresholds.gold) {
     currentTier = "Ouro";
     nextTier = "Max";
     currentTierMin = thresholds.gold;
     nextTierMax = totalVendido > thresholds.gold ? totalVendido : thresholds.gold;
  } else if (totalVendido >= thresholds.silver) {
     currentTier = "Prata";
     nextTier = "Ouro";
     currentTierMin = thresholds.silver;
     nextTierMax = thresholds.gold - 1;
  }

  // CÁLCULO DE COMISSÃO POR VENDA (DYNAMICO POR FAIXA DO VENDEDOR)
  let comissaoTotal = 0;
  let parcelasPerdidasValor = 0;
  let comissaoGeradaAcumulada = 0;

  filteredSales.forEach((s: any) => {
    const rule = teamRules[s.assignedTo] || { 
      bronzeRate: comissaoConfig.percentage, 
      silverRate: comissaoConfig.percentage + 0.1, 
      goldRate: comissaoConfig.percentage + 0.2,
      silverMin: 1000000,
      goldMin: 3000000,
      installments: comissaoConfig.installments 
    };

    // Descobrir em qual faixa este vendedor está BASEADO NO TOTAL VENDIDO (Soma de list original ou filtered?)
    // Para simplificar, usamos o faturamento total do vendedor no período.
    const faturamentoVendedor = ranking.find(r => r.name === s.assignedTo)?.total || 0;
    
    let rate = rule.bronzeRate;
    if (faturamentoVendedor >= rule.goldMin) rate = rule.goldRate;
    else if (faturamentoVendedor >= rule.silverMin) rate = rule.silverRate;

    if (isSdrMode) rate = 0.07; // Taxa fixa SDR por enquanto

    const instCount = isSdrMode ? 1 : rule.installments;
    const saleCommissionTotal = s.value * (rate / 100);
    const parcelaVal = saleCommissionTotal / instCount;

    comissaoTotal += saleCommissionTotal;

    if (!isSdrMode) {
      comissaoGeradaAcumulada += parcelaVal;
      if (s.installments) {
        for (let i = 0; i < instCount; i++) {
          const inst = s.installments[i];
          if (inst) {
             const st = inst.status || (inst.pago ? "PAGO" : "PENDENTE");
             if (st === "INADIMPLENTE" || st === "CANCELADO") parcelasPerdidasValor += parcelaVal;
          }
        }
      }
    } else {
       comissaoGeradaAcumulada += saleCommissionTotal;
       const statusPrimeira = s.installments && s.installments[0] ? (s.installments[0].status || (s.installments[0].pago?"PAGO":"PENDENTE")) : "PENDENTE";
       if (statusPrimeira === "INADIMPLENTE" || statusPrimeira === "CANCELADO") parcelasPerdidasValor += saleCommissionTotal;
    }
  });

  const comissaoGerada = comissaoGeradaAcumulada; 
  let comissaoFuturaCalculada = (comissaoTotal - comissaoGeradaAcumulada) - parcelasPerdidasValor;
  if (comissaoFuturaCalculada < 0) comissaoFuturaCalculada = 0;
  const comissaoFutura = isSdrMode ? 0 : comissaoFuturaCalculada;
  
  const faltamParaVirada = Math.max(0, (nextTierMax + 1) - totalVendido);
  const progressPercent = currentTier === "Ouro" ? 100 : Math.min(100, Math.round(((totalVendido - currentTierMin) / ((nextTierMax + 1) - currentTierMin)) * 100));



  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  
  // Inicialização base
  const monthlyData = monthNames.map(name => ({ name, Fixo: baseSalary, Variável: 0 }));

  // Distribuição no Gráfico
  filteredSales.forEach(s => {
    if (!s.closedAt) return;
    const d = new Date(s.closedAt);
    const m = d.getUTCMonth(); // índice do mês da venda
    
    const saleCommissionTotal = s.value * (commissionRate / 100);

    if (isSdrMode) {
      // SDR ganha tudo à vista no mês seguinte
      const statusPrimeira = s.installments && s.installments[0] ? (s.installments[0].status || (s.installments[0].pago?"PAGO":"PENDENTE")) : "PENDENTE";
      if (statusPrimeira === "INADIMPLENTE" || statusPrimeira === "CANCELADO") return;

      const targetMonth = m + 1;
      if (targetMonth < 12) {
         monthlyData[targetMonth].Variável += saleCommissionTotal;
      }
    } else {
      // Closer reflete em parcelas nos próximos 12 meses (a partir do mês seguinte)
      const parcelaVal = saleCommissionTotal / 12;
      for (let i = 0; i < 12; i++) {
        if (s.installments && s.installments[i]) {
           const st = s.installments[i].status || (s.installments[i].pago ? "PAGO" : "PENDENTE");
           if (st === "INADIMPLENTE" || st === "CANCELADO") {
             continue; // Pula esta parcela (não paga)
           }
        }

        const targetMonth = m + 1 + i; 
        if (targetMonth < 12) {
           monthlyData[targetMonth].Variável += parcelaVal;
        }
      }
    }
  });

  const chartData = monthlyData;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] flex flex-col font-sans">
      
      {/* Header Fixo */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-[#F8F9FA]">
        <h1 className="text-[26px] font-black tracking-tight text-[#111827]">Gestão de vendas</h1>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#1d1d1f] hover:bg-black transition-colors text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-sm">
          <Plus size={18} />
          Registrar Nova Venda
        </button>
      </header>

      <main className="flex-1 px-8 pb-12 flex flex-col gap-6 max-w-[1600px] w-full mx-auto">
        
        {/* ROW 1: KPIs & Filtros */}
        <div className="flex flex-col xl:flex-row gap-6">
          
          {/* Top Cards */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total vendido</span>
              <p className="text-[28px] font-black text-[#111827] mt-1 leading-none">{fmtBRL(totalVendido)}</p>
              <span className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1">
                ↗ +12% <span className="text-gray-400 font-medium">vs mês</span>
              </span>
            </div>

            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Ticket médio</span>
              <p className="text-[28px] font-black text-amber-500 mt-1 leading-none">{fmtBRL(ticketMedio)}</p>
            </div>

            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Nº de vendas</span>
              <p className="text-[28px] font-black text-[#111827] mt-1 leading-none">{filteredSales.length}</p>
            </div>
          </div>

          {/* Filtros e Controles */}
          <div className="w-full xl:w-[480px] grid grid-cols-2 gap-3 grid-rows-2">
            <div className="col-span-2 bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-gray-400">Período</span>
              <div className="flex items-center gap-3">
                <Calendar size={14} className="text-gray-400" />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm font-bold bg-transparent outline-none cursor-pointer" />
                <span className="text-gray-300">-</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold bg-transparent outline-none cursor-pointer" />
                <Calendar size={14} className="text-gray-400" />
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex items-center justify-center gap-2 relative">
              <Filter size={16} className="text-gray-400" />
              <select 
                title="Filtrar por SDR"
                value={sdrFilter} 
                onChange={(e) => setSdrFilter(e.target.value)}
                className="text-sm font-bold bg-transparent outline-none cursor-pointer w-full text-center appearance-none"
              >
                <option value="">Todos SDRs</option>
                {uniqueSDRs.map(sdr => <option key={sdr as string} value={sdr as string}>{sdr}</option>)}
              </select>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex items-center justify-center gap-2 relative">
              <Users size={16} className="text-gray-400" />
              <select 
                title="Filtrar por Closer"
                value={closerFilter} 
                onChange={(e) => setCloserFilter(e.target.value)}
                className="text-sm font-bold bg-transparent outline-none cursor-pointer w-full text-center appearance-none"
              >
                <option value="">Todos Closers</option>
                {uniqueClosers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ROW 2: Tabela Principal e Ranking Lateral */}
        <div className="flex flex-col xl:flex-row gap-6">
          
          {/* Esquerda: Histórico de Vendas */}
          <div className="flex-[3] bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[22px] font-bold text-[#111827] tracking-tight">Histórico de Vendas</h2>
              <div className="flex items-center bg-gray-50 rounded-xl px-4 py-2.5 w-[280px] border border-gray-100 focus-within:ring-2 focus-within:ring-gray-200 focus-within:bg-white transition-all">
                <Search size={16} className="text-gray-400" />
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar..." 
                  className="bg-transparent border-none outline-none text-sm font-medium text-gray-700 w-full ml-2" 
                />
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider font-sans">Data</th>
                    <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider font-sans">Cliente</th>
                    <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider font-sans">Responsável</th>
                    <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider font-sans">Admin.</th>
                    <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider font-sans text-right">Valor Venda</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                       <td colSpan={5} className="py-12 text-center text-sm font-bold text-gray-400">Carregando dados...</td>
                    </tr>
                  ) : paginatedSales.length === 0 ? (
                    <tr>
                       <td colSpan={5} className="py-12 text-center text-sm font-bold text-gray-400">Nenhuma venda encontrada para o período.</td>
                    </tr>
                  ) : (
                    paginatedSales.map(sale => (
                      <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                        <td className="py-4 text-sm font-medium text-gray-500">{fmtDateBR(sale.closedAt)}</td>
                        <td className="py-4 text-sm font-bold text-[#111827] truncate max-w-[200px]">{sale.clientName}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-cover bg-center bg-gray-200 border border-gray-100 flex items-center justify-center font-bold text-xs text-gray-500 overflow-hidden shrink-0">
                               {sale.assignedTo.toLowerCase().includes('célia') ? <img src="/img/celia.png" alt="Célia" /> : 
                                sale.assignedTo.toLowerCase().includes('caue') || sale.assignedTo.toLowerCase().includes('cauê') ? <img src="/img/caue.png" alt="Cauê" /> :
                                sale.assignedTo.toLowerCase().includes('eunice') ? <img src="/img/eunice.png" alt="Eunice" /> :
                                getInitials(sale.assignedTo)}
                            </div>
                            <div className="flex flex-col leading-tight">
                              <span className="text-sm font-bold text-[#111827]">{sale.assignedTo}</span>
                              <span className="text-[10px] font-bold text-gray-400 uppercase">Closer</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="px-2 py-1 bg-[#F1F3F5] text-gray-600 rounded-md text-[10px] uppercase font-bold tracking-wider inline-block">
                            {sale.administradora || "N/D"}
                          </span>
                        </td>
                        <td className="py-4 text-[15px] font-bold text-[#111827] text-right">
                          {fmtBRL(sale.value)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-50 mt-auto">
              <span className="text-xs font-semibold text-gray-400">Mostrando {paginatedSales.length} de {filteredSales.length} vendas</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                ><ChevronLeft size={16} /></button>
                
                <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#111827] text-white font-bold text-sm">{currentPage}</button>
                
                {currentPage < totalPages && (
                  <button onClick={() => setCurrentPage(currentPage + 1)} className="w-8 h-8 flex items-center justify-center rounded-xl text-[#111827] hover:bg-gray-50 font-bold text-sm">
                    {currentPage + 1}
                  </button>
                )}
                
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                ><ChevronRight size={16} /></button>
              </div>
            </div>
          </div>

          {/* Direita: Ranking dos Closers */}
          <div className="flex-[1] min-w-[320px] bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm flex flex-col relative overflow-hidden">
            <Medal size={48} className="absolute top-4 right-4 text-amber-500/10" />
            
            <div className="flex justify-between items-start mb-8">
               <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">Ranking dos Closers</h2>
               <div className="p-2 bg-amber-50 rounded-xl"><Medal size={20} className="text-amber-500" /></div>
            </div>

            <div className="flex flex-col gap-5 flex-1 overflow-y-auto">
               {ranking.map((closer, i) => (
                 <div key={closer.name} className="bg-[#F8F9FA] rounded-[24px] p-5 border border-gray-100/50 flex flex-col relative">
                    
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                         <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-cover bg-center bg-gray-200 border-[3px] border-white shadow-sm flex items-center justify-center font-bold text-sm text-gray-500 overflow-hidden">
                               {closer.name.toLowerCase().includes('célia') ? <img src="/img/celia.png" alt="Célia" /> : 
                                closer.name.toLowerCase().includes('caue') || closer.name.toLowerCase().includes('cauê') ? <img src="/img/caue.png" alt="Cauê" /> :
                                closer.name.toLowerCase().includes('eunice') ? <img src="/img/eunice.png" alt="Eunice" /> :
                                getInitials(closer.name)}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#111827] text-white rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white">
                                {i + 1}
                            </div>
                         </div>
                         <div className="flex flex-col leading-none gap-1">
                            <span className="font-bold text-[#111827]">{closer.name}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Closer</span>
                         </div>
                      </div>
                      
                      {i === 0 && <Medal size={20} className="text-amber-500" />}
                    </div>

                    <div className="flex justify-between items-end mb-3 pb-3 border-b border-gray-200/50">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Total vendido</span>
                        <span className="text-[18px] font-black text-[#111827] leading-none">{fmtBRL(closer.total)}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Vendas</span>
                        <span className="text-[18px] font-black text-amber-500 leading-none">{closer.vendas}</span>
                      </div>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-1">Ticket médio</span>
                        <span className="text-[14px] font-bold text-[#111827] leading-none">{fmtBRL(closer.total / closer.vendas)}</span>
                    </div>

                 </div>
               ))}
               {ranking.length === 0 && (
                 <p className="text-sm font-bold text-gray-400 text-center py-10">Ranking vazio</p>
               )}
            </div>
          </div>
        </div>

        {/* ── NOVO BLOCO: SEU GANHO E PROGRESSÃO ── */}
        <div className="bg-[#1d1d1f] rounded-[32px] p-8 shadow-2xl flex flex-col md:flex-row gap-8 relative overflow-hidden">
          
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <Medal size={150} />
          </div>

          <div className="flex-1 z-10 flex flex-col justify-center">
             <h3 className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-6 flex items-center gap-2">
               <Target size={14} className="text-[#d97706]" /> Seu ganho e progressão
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
                  <span className="text-[11px] text-gray-400">Faltam <strong className="text-white">{fmtBRL(faltamParaVirada)}</strong></span>
               </div>
            )}
          </div>

          <div className="flex-1 z-10 flex items-center">
             {currentTier !== "Ouro" ? (
               <div className="w-full bg-gradient-to-br from-[#d97706]/20 to-[#dc2626]/10 border border-[#d97706]/30 rounded-2xl p-5 flex flex-col gap-3">
                  <Zap size={24} className="text-[#d97706] mb-1" />
                  <p className="text-[14px] text-white font-medium leading-tight">
                    Faltam apenas <strong className="text-white">{fmtBRL(faltamParaVirada)}</strong> para você subir!
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Isso garante aumento da sua taxa para <strong className="text-[#fbbf24] text-[13px]">{nextCommissionRate}%</strong> na veia. Bora fechar!
                  </p>
               </div>
             ) : (
               <div className="w-full bg-gradient-to-br from-emerald-500/20 to-emerald-700/10 border border-emerald-500/30 rounded-2xl p-5 flex flex-col gap-3">
                  <Medal size={24} className="text-emerald-400 mb-1" />
                  <p className="text-[14px] text-white font-medium leading-tight">
                    Você atingiu o nível Máximo: <strong className="text-emerald-400">OURO!</strong>
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Aproveite sua taxa máxima de <strong className="text-emerald-400 text-[13px]">0.70%</strong>. O céu é o limite.
                  </p>
               </div>
             )}
          </div>

        </div>

        {/* ── GRÁFICO PROJEÇÃO FINANCEIRA ── */}
        <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm">
           <div className="mb-8">
              <h3 className="text-[18px] font-bold text-[#111827] tracking-tight">Projeção Financeira (12 Meses)</h3>
              <p className="text-[12px] text-gray-400 font-medium">Salário Fixo + Comissões de Vendas Registradas</p>
           </div>
           
           <div className="w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorFixo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f3f4f6" stopOpacity={1}/>
                      <stop offset="95%" stopColor="#f3f4f6" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(val) => `R$ ${val/1000}k`} />
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f5" />
                  <Tooltip 
                     contentStyle={{ borderRadius: '12px', border: '1px solid #f0f0f5', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                     itemStyle={{ fontSize: '13px', fontWeight: 'bold' }} 
                     labelStyle={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}
                     formatter={(value: any) => fmtBRL(Number(value))}
                  />
                  <Area type="monotone" dataKey="Fixo" stackId="1" stroke="#e5e7eb" strokeWidth={2} fill="url(#colorFixo)" activeDot={false} />
                  <Area type="monotone" dataKey="Variável" stackId="1" stroke="#d97706" strokeWidth={2} fill="url(#colorVar)" />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

      </main>

      {/* Modal Registrar Venda Oficial */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative bg-[#F8F9FA] rounded-3xl w-full max-w-[800px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-end p-4 pb-0">
               <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition">
                  <X size={20} />
               </button>
            </div>
            
            <div className="px-10 pb-4">
               <h2 className="text-[24px] font-bold text-[#111827] tracking-tight">Registrar Venda Oficial</h2>
               <p className="text-[13px] text-gray-500 mt-1">Insira os dados do contrato faturado para processamento de comissões.</p>
            </div>

            {/* Modal Body */}
            <div className="px-10 pb-10 overflow-y-auto">
               <div className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col gap-5">
                  
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[11px] font-bold text-gray-500">Cliente (Nome completo)</label>
                     <input type="text" placeholder="Ex: João Silva Mendes" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827]" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Cidade</label>
                        <input type="text" placeholder="Ex: São Paulo" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827]" />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Gênero</label>
                        <select className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none cursor-pointer">
                           <option>Selecione</option>
                           <option>Masculino</option>
                           <option>Feminino</option>
                           <option>Outro</option>
                        </select>
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Estado Civil</label>
                        <select className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none cursor-pointer">
                           <option>Selecione</option>
                           <option>Solteiro(a)</option>
                           <option>Casado(a)</option>
                           <option>Divorciado(a)</option>
                           <option>Viúvo(a)</option>
                        </select>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">CPF do cliente</label>
                        <input type="text" placeholder="000.000.000-00" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827]" />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Valor do crédito fechado (R$)</label>
                        <input type="text" placeholder="$ Ex: 500000.00" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827]" />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Data do fechamento</label>
                        <input type="date" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827]" />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Administradora</label>
                        <select className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none">
                           <option>Porto Seguro</option>
                           <option>Embracon</option>
                        </select>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Venda por SDR (Opcional)</label>
                        <select className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none">
                           <option>Prospecção direta (Sem SDR)</option>
                           <option>Guilherme (SDR)</option>
                        </select>
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Venda por Closer (Obrigatório)</label>
                        <select className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none">
                           <option>Selecione o Closer</option>
                           <option>Caue Macedo</option>
                           <option>Célia Mendes</option>
                        </select>
                     </div>
                  </div>

                  <div 
                     className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 mt-2 border border-gray-100 cursor-pointer select-none"
                     onClick={() => setIsCampanha(!isCampanha)}
                  >
                     <div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors duration-300 ${isCampanha ? 'bg-[#d97706]' : 'bg-gray-200'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${isCampanha ? 'translate-x-4' : 'translate-x-0'}`}></div>
                     </div>
                     <span className="text-[12px] font-bold text-[#111827]">Venda realizada através de Campanha Promocional Especial</span>
                  </div>

                  <div className="flex justify-end mt-4">
                     <button onClick={() => { alert('Venda Registrada com Sucesso! (Desenvolvimento)'); setIsModalOpen(false); setIsCampanha(false); }} className="flex items-center gap-2 bg-[#d97706] hover:bg-[#b45f06] transition-colors text-white px-6 py-3 rounded-xl text-[13px] font-bold shadow-md">
                        <CheckCircle size={18} />
                        Confirmar Venda
                     </button>
                  </div>
                  
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
