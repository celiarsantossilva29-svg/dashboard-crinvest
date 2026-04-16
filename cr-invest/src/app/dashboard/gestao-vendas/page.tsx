"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Calendar, Filter, Users, Medal, ChevronLeft, ChevronRight, Plus, X, CheckCircle, Zap, Target, Pencil } from "lucide-react";
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

function getMonthRange() {
  return { start: "2026-03-01", end: "2026-03-31" };
}

function parseBRL(val: string | number) {
  if (!val) return 0;
  const str = String(val).trim();
  if (str.includes(',') && str.includes('.')) {
    return Number(str.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.'));
  }
  if (str.includes(',')) {
    return Number(str.replace(/[^\d,]/g, '').replace(',', '.'));
  }
  return Number(str.replace(/[^\d.]/g, ''));
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
  clienteCpf?: string;
  notes?: string;
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

  // Venda Form States
  const [fClientName, setFClientName] = useState("");
  const [fCity, setFCity] = useState("");
  const [fGender, setFGender] = useState("Selecione");
  const [fCivil, setFCivil] = useState("Selecione");
  const [fCpf, setFCpf] = useState("");
  const [fValue, setFValue] = useState("");
  const [fClosedAt, setFClosedAt] = useState("");
  const [fAdmin, setFAdmin] = useState("Porto Seguro");
  const [fSdr, setFSdr] = useState("Prospecção direta (Sem SDR)");
  const [fCloser, setFCloser] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

  const resetForm = () => {
    setFClientName(""); setFCity(""); setFGender("Selecione"); setFCivil("Selecione"); 
    setFCpf(""); setFValue(""); setFClosedAt(""); setFAdmin("Porto Seguro"); 
    setFSdr("Prospecção direta (Sem SDR)"); setFCloser(""); setIsCampanha(false);
    setEditingSaleId(null);
  };

  const openNewModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (sale: Sale) => {
    resetForm();
    setEditingSaleId(sale.id);
    setFClientName(sale.clientName);
    setFValue(sale.value.toString());
    setFClosedAt(new Date(sale.closedAt).toISOString().split('T')[0]);
    setFCloser(sale.assignedTo);
    setFSdr(sale.sdrName || "Prospecção direta (Sem SDR)");
    setFAdmin(sale.administradora || "Porto Seguro");
    setFCpf(sale.clienteCpf || "");
    
    const note = sale.notes || "";
    setIsCampanha(note.includes("Campanha Promocional Especial"));
    
    const cityMatch = note.match(/Cidade:\s*(.+)/);
    const genderMatch = note.match(/Gênero:\s*(.+)/);
    const civilMatch = note.match(/Estado Civil:\s*(.+)/);
    
    setFCity(cityMatch ? cityMatch[1] : "");
    setFGender(genderMatch ? genderMatch[1] : "Selecione");
    setFCivil(civilMatch ? civilMatch[1] : "Selecione");

    setIsModalOpen(true);
  };

  const handleRegisterSale = async () => {
    if (!fClientName || !fValue || !fClosedAt || !fCloser || fCloser === "Selecione o Closer" || fCloser === "") {
       alert("Preencha todos os campos obrigatórios (Cliente, Valor, Data e Closer).");
       return;
    }
    setIsSubmitting(true);
    try {
      const method = editingSaleId ? "PUT" : "POST";
      const res = await fetch("/api/sales", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           id: editingSaleId,
           clientName: fClientName,
           value: parseBRL(fValue),
           closedAt: fClosedAt,
           assignedTo: fCloser,
           sdrName: fSdr,
           administradora: fAdmin,
           clienteCpf: fCpf,
           notes: isCampanha 
              ? "Venda via Campanha Promocional Especial\n" + `Cidade: ${fCity}\nGênero: ${fGender}\nEstado Civil: ${fCivil}` 
              : `Cidade: ${fCity}\nGênero: ${fGender}\nEstado Civil: ${fCivil}`,
        })
      });
      if (res.ok) {
         setIsModalOpen(false);
         resetForm();
         fetchSales();
      } else {
         const err = await res.json();
         alert("Erro: " + err.error);
      }
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [comissaoConfig, setComissaoConfig] = useState({ fixedSalary: 3000, percentage: 0.5, installments: 12 });
  const { data: session } = useSession();
  const [teamRules, setTeamRules] = useState<Record<string, any>>({});

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales?start=${startDate}&end=${endDate}`);
      const json = await res.json();
      setSales(json.data || []);

      const cRes = await fetch("/api/config/commission");
      const cJson = await cRes.json();
      if (cJson.data) setComissaoConfig({
        fixedSalary: cJson.data.fixedSalary,
        percentage: cJson.data.percentage,
        installments: cJson.data.installments
      });

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

  const filteredSales = useMemo(() => {
    let list = sales;
    const permsRaw = (session?.user as any)?.permissions;
    const userRole = (session?.user as any)?.role;
    const userName = session?.user?.name;

    if (userRole !== "admin" && permsRaw) {
      try {
        const perms = typeof permsRaw === "string" ? JSON.parse(permsRaw) : permsRaw;
        const scope = perms["GESTAO_VENDAS"]?.scope;
        if (scope === "own" && userName) {
          const n = userName.toLowerCase();
          const matchPartial = (field: string | null | undefined) => {
            if (!field) return false;
            const f = field.toLowerCase();
            const fFirst = f.split(" ")[0];
            const nFirst = n.split(" ")[0];
            return f.startsWith(n) || n.startsWith(fFirst) || fFirst === nFirst;
          };
          list = list.filter(s => matchPartial(s.assignedTo) || matchPartial(s.sdrName));
        }
      } catch(e) {}
    }

    return list.filter(s => {
      const matchSearch = !search || 
        s.clientName.toLowerCase().includes(search.toLowerCase()) || 
        s.assignedTo.toLowerCase().includes(search.toLowerCase());
      const matchCloser = !closerFilter || (() => {
        const a = (s.assignedTo ?? "").toLowerCase();
        const f = closerFilter.toLowerCase();
        return a.startsWith(f) || f.startsWith(a.split(" ")[0]);
      })();
      const matchSdr = !sdrFilter || (() => {
        const a = (s.sdrName ?? "").toLowerCase();
        const f = sdrFilter.toLowerCase();
        return a.startsWith(f) || f.startsWith(a.split(" ")[0]);
      })();
      return matchSearch && matchCloser && matchSdr;
    });
  }, [sales, search, closerFilter, sdrFilter, session]);

  const uniqueClosers = useMemo(() => Array.from(new Set(sales.map(s => s.assignedTo).filter(Boolean))), [sales]);
  const uniqueSDRs = useMemo(() => Array.from(new Set(sales.map(s => s.sdrName).filter(Boolean))), [sales]);

  // Scope enforcement for UI filters
  const userRole = (session?.user as any)?.role;
  const userName = session?.user?.name;
  const isAdmin = userRole === "admin";
  const scopeLocked = useMemo(() => {
    if (isAdmin) return false;
    const permsRaw = (session?.user as any)?.permissions;
    if (!permsRaw) return false;
    try {
      const perms = typeof permsRaw === "string" ? JSON.parse(permsRaw) : permsRaw;
      const scope = perms["GESTAO_VENDAS"]?.scope;
      return scope === "own";
    } catch(e) { return false; }
  }, [session, isAdmin]);

  useEffect(() => {
    if (scopeLocked && userName) {
      // SDR: filtra pelo campo sdrName; CLOSER/ADMIN: pelo campo assignedTo
      if (userRole === "SDR") {
        setSdrFilter(userName);
        setCloserFilter("");
      } else {
        setCloserFilter(userName);
        setSdrFilter("");
      }
    }
  }, [scopeLocked, userName, userRole]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, closerFilter, sdrFilter, startDate, endDate]);

  const totalVendido = filteredSales.reduce((acc, s) => acc + s.value, 0);
  const ticketMedio = filteredSales.length > 0 ? totalVendido / filteredSales.length : 0;

  const ranking = useMemo(() => {
    const map: Record<string, { name: string; vendas: number; total: number }> = {};
    for (const s of filteredSales) {
      if (!map[s.assignedTo]) map[s.assignedTo] = { name: s.assignedTo, vendas: 0, total: 0 };
      map[s.assignedTo].vendas += 1;
      map[s.assignedTo].total += s.value;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const paginatedSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const baseSalary = comissaoConfig.fixedSalary;
  const isSdrMode = sdrFilter !== "" && closerFilter === "";

  // Busca regras do vendedor por match parcial de nome (ex: "Cauê" casa com "Cauê Perpétuo")
  const findRules = (name: string | null | undefined) => {
    if (!name) return null;
    const n = name.toLowerCase();
    const key = Object.keys(teamRules).find(k => {
      const kl = k.toLowerCase();
      return kl.startsWith(n) || n.startsWith(kl.split(" ")[0]);
    });
    return key ? teamRules[key] : null;
  };

  let currentTier = "Bronze";
  const defaultRules = {
      bronzeRate: comissaoConfig.percentage,
      silverRate: comissaoConfig.percentage + 0.1,
      goldRate: comissaoConfig.percentage + 0.2,
      silverMin: 1000000,
      goldMin: 3000000,
      installments: comissaoConfig.installments || 12
  };
  // SDR mode: usa regras do SDR filtrado; Closer mode: usa regras do closer filtrado
  const activeFilter = isSdrMode ? sdrFilter : closerFilter;
  const userRules = findRules(activeFilter) || defaultRules;
  
  const thresholds = {
    silver: userRules?.silverMin || 1000000,
    gold: userRules?.goldMin || 3000000
  };

  let nextTier = "Prata";
  let nextCommissionRate = userRules?.silverRate || 0.6;
  let currentTierMin = 0;
  let nextTierMax = thresholds.silver - 1;

  if (totalVendido >= thresholds.gold) {
     currentTier = "Ouro";
     nextTier = "Max";
     currentTierMin = thresholds.gold;
     nextTierMax = totalVendido > thresholds.gold ? totalVendido : thresholds.gold;
     nextCommissionRate = userRules?.goldRate || 0.7;
  } else if (totalVendido >= thresholds.silver) {
     currentTier = "Prata";
     nextTier = "Ouro";
     currentTierMin = thresholds.silver;
     nextTierMax = thresholds.gold - 1;
     nextCommissionRate = userRules?.goldRate || 0.7;
  }

  let comissaoTotal = 0;
  let parcelasPerdidasValor = 0;
  let comissaoGeradaAcumulada = 0;

  filteredSales.forEach((s: any) => {
    const sellerName = isSdrMode ? s.sdrName : s.assignedTo;
    const rule = findRules(sellerName) || defaultRules;

    const faturamentoVendedor = isSdrMode
       ? filteredSales.reduce((acc: number, item: any) => {
           const sn = (item.sdrName ?? "").toLowerCase();
           const sl = (sellerName ?? "").toLowerCase();
           return (sn.startsWith(sl) || sl.startsWith(sn.split(" ")[0])) ? acc + item.value : acc;
         }, 0)
       : ranking.find(r => r.name === s.assignedTo)?.total || 0;
    
    let rate = rule.bronzeRate;
    if (faturamentoVendedor >= rule.goldMin) rate = rule.goldRate;
    else if (faturamentoVendedor >= rule.silverMin) rate = rule.silverRate;

    const instCount = isSdrMode ? 1 : (rule.installments || 12);
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
  const monthlyData = monthNames.map(name => ({ name, Fixo: baseSalary, Variável: 0 }));

  filteredSales.forEach(s => {
    if (!s.closedAt) return;
    const d = new Date(s.closedAt);
    let cycleMonth = d.getUTCMonth();
    if (d.getUTCDate() >= 23) {
      cycleMonth += 1;
    }

    const sellerName = isSdrMode ? s.sdrName : s.assignedTo;
    const rule = findRules(sellerName) || userRules || defaultRules;
    const faturamentoVendedor = isSdrMode
       ? filteredSales.reduce((acc: number, item: any) => {
           const sn = (item.sdrName ?? "").toLowerCase();
           const sl = (sellerName ?? "").toLowerCase();
           return (sn.startsWith(sl) || sl.startsWith(sn.split(" ")[0])) ? acc + item.value : acc;
         }, 0)
       : ranking.find(r => r.name === s.assignedTo)?.total || 0;
    
    let rate = rule.bronzeRate || 0.5;
    if (faturamentoVendedor >= (rule.goldMin || 3000000)) rate = rule.goldRate || 0.7;
    else if (faturamentoVendedor >= (rule.silverMin || 1000000)) rate = rule.silverRate || 0.6;

    const saleCommissionTotal = s.value * (rate / 100);

    if (isSdrMode) {
      const statusPrimeira = s.installments && s.installments[0] ? (s.installments[0].status || (s.installments[0].pago?"PAGO":"PENDENTE")) : "PENDENTE";
      if (statusPrimeira === "INADIMPLENTE" || statusPrimeira === "CANCELADO") return;

      const targetMonth = cycleMonth + 1;
      if (targetMonth < 12) {
         monthlyData[targetMonth].Variável += saleCommissionTotal;
      }
    } else {
      const instCount = rule.installments || 12;
      const parcelaVal = saleCommissionTotal / instCount;
      for (let i = 0; i < instCount; i++) {
        if (s.installments && s.installments[i]) {
           const st = s.installments[i].status || (s.installments[i].pago ? "PAGO" : "PENDENTE");
           if (st === "INADIMPLENTE" || st === "CANCELADO") {
             continue;
           }
        }

        const targetMonth = cycleMonth + 1 + i; 
        if (targetMonth < 12) {
           monthlyData[targetMonth].Variável += parcelaVal;
        }
      }
    }
  });

  const chartData = monthlyData;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] flex flex-col font-sans">
      
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-[#F8F9FA]">
        <h1 className="text-[26px] font-black tracking-tight text-[#111827]">Gestão de vendas</h1>
        <button onClick={openNewModal} className="flex items-center gap-2 bg-[#1d1d1f] hover:bg-black transition-colors text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-sm">
          <Plus size={18} />
          Registrar Nova Venda
        </button>
      </header>

      <main className="flex-1 px-8 pb-12 flex flex-col gap-6 max-w-[1600px] w-full mx-auto">
        
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total vendido</span>
              <p className="text-[28px] font-black text-[#111827] mt-1 leading-none">{fmtBRL(totalVendido)}</p>
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
            <div className={`bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex items-center justify-center gap-2 relative ${scopeLocked ? 'opacity-50' : ''}`}>
              <Filter size={16} className="text-gray-400" />
              <select 
                title="Filtrar por SDR"
                value={sdrFilter} 
                onChange={(e) => { if (!scopeLocked) setSdrFilter(e.target.value); }}
                disabled={scopeLocked}
                className={`text-sm font-bold bg-transparent outline-none w-full text-center appearance-none ${scopeLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {scopeLocked ? (
                  <option value="">Bloqueado</option>
                ) : (
                  <>
                    <option value="">Todos SDRs</option>
                    {uniqueSDRs.map(sdr => <option key={sdr as string} value={sdr as string}>{sdr}</option>)}
                  </>
                )}
              </select>
            </div>
            <div className={`bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex items-center justify-center gap-2 relative ${scopeLocked ? 'opacity-50' : ''}`}>
              <Users size={16} className="text-gray-400" />
              <select 
                title="Filtrar por Closer"
                value={closerFilter} 
                onChange={(e) => { if (!scopeLocked) setCloserFilter(e.target.value); }}
                disabled={scopeLocked}
                className={`text-sm font-bold bg-transparent outline-none w-full text-center appearance-none ${scopeLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {scopeLocked ? (
                  <option value={userName || ""}>{userName}</option>
                ) : (
                  <>
                    <option value="">Todos Closers</option>
                    {uniqueClosers.map(c => <option key={c} value={c}>{c}</option>)}
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-6">
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
                    <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider font-sans text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                       <td colSpan={6} className="py-12 text-center text-sm font-bold text-gray-400">Carregando dados...</td>
                    </tr>
                  ) : paginatedSales.length === 0 ? (
                    <tr>
                       <td colSpan={6} className="py-12 text-center text-sm font-bold text-gray-400">Nenhuma venda encontrada para o período.</td>
                    </tr>
                  ) : (
                    paginatedSales.map(sale => (
                      <tr key={sale.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                        <td className="py-4 text-sm font-medium text-gray-500">{fmtDateBR(sale.closedAt)}</td>
                        <td className="py-4 text-sm font-bold text-[#111827] truncate max-w-[200px]">{sale.clientName}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-cover bg-center bg-gray-200 border border-gray-100 flex items-center justify-center font-bold text-xs text-gray-500 overflow-hidden shrink-0">
                               {getInitials(sale.assignedTo)}
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
                        <td className="py-4 text-right">
                          <button onClick={() => openEditModal(sale)} className="text-gray-400 hover:text-[#d97706] transition-colors p-2">
                            <Pencil size={16} />
                          </button>
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
                               {getInitials(closer.name)}
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
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="bg-[#1d1d1f] rounded-[32px] p-8 shadow-2xl flex flex-col md:flex-row gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5"><Medal size={150} /></div>
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
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm">
           <div className="mb-8">
              <h3 className="text-[18px] font-bold text-[#111827] tracking-tight">Projeção Financeira (12 Meses)</h3>
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-[#F8F9FA] rounded-3xl w-full max-w-[800px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-end p-4 pb-0">
               <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition"><X size={20} /></button>
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
                     <input type="text" value={fClientName} onChange={e=>setFClientName(e.target.value)} placeholder="Ex: João Silva Mendes" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827]" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Cidade</label>
                        <input type="text" value={fCity} onChange={e=>setFCity(e.target.value)} placeholder="Ex: São Paulo" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827]" />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Gênero</label>
                        <select value={fGender} onChange={e=>setFGender(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none cursor-pointer">
                           <option>Selecione</option>
                           <option>Masculino</option>
                           <option>Feminino</option>
                           <option>Outro</option>
                        </select>
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Estado Civil</label>
                        <select value={fCivil} onChange={e=>setFCivil(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none cursor-pointer">
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
                        <input type="text" value={fCpf} onChange={e=>setFCpf(e.target.value)} placeholder="000.000.000-00" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827]" />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Valor do crédito fechado (R$)</label>
                        <input type="text" value={fValue} onChange={e=>setFValue(e.target.value)} placeholder="$ Ex: 500000.00" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827]" />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Data do fechamento</label>
                        <input type="date" value={fClosedAt} onChange={e=>setFClosedAt(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827]" />
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Administradora</label>
                        <select value={fAdmin} onChange={e=>setFAdmin(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none">
                           <option>Porto Seguro</option>
                           <option>Embracon</option>
                        </select>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Venda por SDR (Opcional)</label>
                        <select value={fSdr} onChange={e=>setFSdr(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none">
                           <option value="Prospecção direta (Sem SDR)">Prospecção direta (Sem SDR)</option>
                           {Object.values(teamRules).filter(u => u.role?.toLowerCase() === "sdr").map(u => (
                             <option key={u.id} value={u.nome}>{u.nome}</option>
                           ))}
                        </select>
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500">Venda por Closer (Obrigatório)</label>
                        <select value={fCloser} onChange={e=>setFCloser(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#d97706]/20 transition-all text-[#111827] appearance-none">
                           <option value="">Selecione o Closer</option>
                           {Object.values(teamRules).filter(u => u.role?.toLowerCase() === "closer").map(u => (
                             <option key={u.id} value={u.nome}>{u.nome}</option>
                           ))}
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
                     <button 
                        onClick={handleRegisterSale} 
                        disabled={isSubmitting}
                        className="flex items-center gap-2 bg-[#d97706] hover:bg-[#b45f06] transition-colors text-white px-6 py-3 rounded-xl text-[13px] font-bold shadow-md disabled:opacity-50"
                     >
                        <CheckCircle size={18} />
                        {isSubmitting ? "Salvando..." : (editingSaleId ? "Salvar Alterações" : "Confirmar Venda")}
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
