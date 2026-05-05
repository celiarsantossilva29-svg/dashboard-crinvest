"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Search, Medal, ChevronLeft, ChevronRight, ChevronDown, Target, Calendar } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useSession } from "next-auth/react";

// ─── Utils ─────────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtDateBR(iso: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
}

function getInitials(name: string) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface Sale {
  id: string;
  clientName: string;
  clienteCpf?: string | null;
  assignedTo: string;
  sdrName?: string | null;
  value: number;
  closedAt: string;
  administradora: string | null;
  statusValidacao: string;
  valorComissaoCloser?: number;
  installments?: { id: string; parcelaNumero: number; pago: boolean; status?: string; valorParcela: number; dataVencimento: string }[];
}

interface SaleGroup {
  key: string;
  clientName: string;
  clienteCpf?: string | null;
  assignedTo: string;
  sdrName?: string | null;
  administradora: string | null;
  closedAt: string;
  totalValue: number;
  totalCotas: number;
  sales: Sale[];
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ComissoesPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const userName  = session?.user?.name ?? "";
  const isAdmin   = userRole === "admin";

  // ── Date Range ────────────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useLocalStorage("filter:comissoes:start", (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })());
  const [endDate, setEndDate] = useLocalStorage("filter:comissoes:end", (() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  })());

  // ── Data ─────────────────────────────────────────────────────────────────────
  const [sales, setSales] = useState<Sale[]>([]);
  const [allCloserSales, setAllCloserSales] = useState<Sale[]>([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);
  const [comissaoConfig, setComissaoConfig] = useState({ fixedSalary: 3000, percentage: 0.5, installments: 12 });
  const [teamRules, setTeamRules] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [closerFilter, setCloserFilter] = useState("");
  const [sdrFilter, setSdrFilter] = useState("");

  // ── Admin tab ─────────────────────────────────────────────────────────────────
  const [adminTab, setAdminTab] = useState<"comissao" | "pagamento">("comissao");
  const [pagamentoMes, setPagamentoMes] = useLocalStorage("filter:comissoes:pagamento-mes", new Date().toISOString().substring(0, 7));
  const [pagamentoData, setPagamentoData] = useState<{ data: any[]; totalAPagar: number; totalPendente: number } | null>(null);
  const [pagamentoLoading, setPagamentoLoading] = useState(false);
  const [expandedAssoc, setExpandedAssoc] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [parcelasStatusFilter, setParcelasStatusFilter] = useState("TODOS");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [salesRes, commRes, teamRes] = await Promise.all([
        fetch(`/api/sales?start=${startDate}&end=${endDate}`),
        fetch("/api/config/commission"),
        fetch("/api/vendedores"),
      ]);
      const [salesJson, commJson, teamJson] = await Promise.all([
        salesRes.json(), commRes.json(), teamRes.json(),
      ]);
      setSales(salesJson.data || []);
      if (commJson.data) setComissaoConfig(commJson.data);
      const rules: Record<string, any> = {};
      (teamJson.data || []).forEach((v: any) => { rules[v.nome] = v; });
      setTeamRules(rules);
    } finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setCurrentPage(1); }, [search, closerFilter, sdrFilter, startDate, endDate]);

  // Fetch pagamento a associados (admin only)
  useEffect(() => {
    if (!isAdmin || adminTab !== "pagamento") return;
    setPagamentoLoading(true);
    fetch(`/api/comissoes/pagamento-associados?mes=${pagamentoMes}`)
      .then(r => r.json())
      .then(j => setPagamentoData(j))
      .catch(() => setPagamentoData(null))
      .finally(() => setPagamentoLoading(false));
  }, [isAdmin, adminTab, pagamentoMes]);

  // Fetch all sales (sem filtro de data) — usado na seção Parcelas a Receber
  useEffect(() => {
    setLoadingParcelas(true);
    const url = closerFilter
      ? `/api/sales?closer=${encodeURIComponent(closerFilter)}&noDateFilter=true`
      : `/api/sales?noDateFilter=true`;
    fetch(url)
      .then(r => r.json())
      .then(j => setAllCloserSales(j.data || []))
      .catch(() => setAllCloserSales([]))
      .finally(() => setLoadingParcelas(false));
  }, [closerFilter]);

  // ── Scope ────────────────────────────────────────────────────────────────────
  const scopeLocked = useMemo(() => {
    if (isAdmin) return false;
    const permsRaw = (session?.user as any)?.permissions;
    if (!permsRaw) return false;
    try {
      const perms = typeof permsRaw === "string" ? JSON.parse(permsRaw) : permsRaw;
      return perms["COMISSOES"]?.scope === "own" || perms["GESTAO_VENDAS"]?.scope === "own";
    } catch { return false; }
  }, [session, isAdmin]);

  useEffect(() => {
    if (scopeLocked && userName) {
      if (userRole === "SDR") { setSdrFilter(userName); setCloserFilter(""); }
      else { setCloserFilter(userName); setSdrFilter(""); }
    }
  }, [scopeLocked, userName, userRole]);

  // ── Filter ───────────────────────────────────────────────────────────────────
  const findRules = (name: string | null | undefined) => {
    if (!name) return null;
    const n = name.toLowerCase();
    const key = Object.keys(teamRules).find(k => {
      const kl = k.toLowerCase();
      return kl.startsWith(n) || n.startsWith(kl.split(" ")[0]);
    });
    return key ? teamRules[key] : null;
  };

  // ── Groups (same logic as vendas page) ─────────────────────────────────────
  const allGroups = useMemo(() => {
    const map = new Map<string, SaleGroup>();
    for (const sale of sales) {
      const dateKey = sale.closedAt?.split("T")[0] ?? "unknown";
      const clientKey = sale.clienteCpf?.replace(/\D/g, "") ?? sale.clientName.toLowerCase().trim();
      const key = `${clientKey}|${dateKey}|${sale.administradora ?? ""}`;
      if (!map.has(key)) {
        map.set(key, {
          key, clientName: sale.clientName, clienteCpf: sale.clienteCpf,
          assignedTo: sale.assignedTo, sdrName: sale.sdrName,
          administradora: sale.administradora, closedAt: sale.closedAt,
          totalValue: 0, totalCotas: 0, sales: [],
        });
      }
      const g = map.get(key)!;
      g.totalValue += sale.value;
      g.totalCotas += sale.installments?.length ?? 0;
      g.sales.push(sale);
    }
    return Array.from(map.values());
  }, [sales]);

  const filteredGroups = useMemo(() => {
    return allGroups.filter(g => {
      const matchSearch = !search || g.clientName.toLowerCase().includes(search.toLowerCase()) || g.assignedTo.toLowerCase().includes(search.toLowerCase()) || (g.clienteCpf || "").includes(search);
      const matchCloser = !closerFilter || (() => {
        const a = (g.assignedTo ?? "").toLowerCase();
        const f = closerFilter.toLowerCase();
        return a.startsWith(f) || f.startsWith(a.split(" ")[0]);
      })();
      const matchSdr = !sdrFilter || (() => {
        const a = (g.sdrName ?? "").toLowerCase();
        if (!a) return false;
        const f = sdrFilter.toLowerCase();
        return a.startsWith(f) || f.startsWith(a.split(" ")[0]);
      })();
      return matchSearch && matchCloser && matchSdr;
    });
  }, [allGroups, search, closerFilter, sdrFilter]);

  // Flat filtered sales (for KPIs, ranking, comissão calc)
  const filteredSales = useMemo(() => filteredGroups.flatMap(g => g.sales), [filteredGroups]);

  const uniqueClosers = useMemo(() => Array.from(new Set(sales.map(s => s.assignedTo).filter(Boolean))), [sales]);

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const totalVendido = filteredSales.reduce((acc, s) => acc + s.value, 0);

  // Conta vendas únicas por (cliente + dia) — mesmo cliente com múltiplas cotas no mesmo dia = 1 venda
  const numVendas = useMemo(() => {
    const seen = new Set<string>();
    for (const g of filteredGroups) {
      const dateKey = g.closedAt?.split("T")[0] ?? "unknown";
      const clientKey = g.clienteCpf?.replace(/\D/g, "") || g.clientName.toLowerCase().trim();
      seen.add(`${clientKey}|${dateKey}`);
    }
    return seen.size;
  }, [filteredGroups]);

  const ticketMedio = numVendas > 0 ? totalVendido / numVendas : 0;

  // ── Ranking ──────────────────────────────────────────────────────────────────
  const ranking = useMemo(() => {
    const map: Record<string, { name: string; vendas: number; total: number }> = {};
    for (const s of filteredSales) {
      if (!map[s.assignedTo]) map[s.assignedTo] = { name: s.assignedTo, vendas: 0, total: 0 };
      map[s.assignedTo].vendas++;
      map[s.assignedTo].total += s.value;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  // ── Progressão ───────────────────────────────────────────────────────────────
  const defaultRules = {
    bronzeRate: comissaoConfig.percentage,
    silverRate: comissaoConfig.percentage + 0.1,
    goldRate:   comissaoConfig.percentage + 0.2,
    silverMin:  1_000_000,
    goldMin:    3_000_000,
    installments: comissaoConfig.installments || 12,
    fixoMensal: comissaoConfig.fixedSalary,
  };
  const isSdrMode   = sdrFilter !== "" && closerFilter === "";
  const activeFilter = isSdrMode ? sdrFilter : closerFilter;
  const userRules   = findRules(activeFilter) || defaultRules;
  const thresholds  = { silver: userRules?.silverMin || 1_000_000, gold: userRules?.goldMin || 3_000_000 };

  let currentTier  = "Bronze";
  let nextTier     = "Prata";
  let nextCommissionRate = userRules?.silverRate || 0.6;
  let currentTierMin = 0;
  let nextTierMax    = thresholds.silver - 1;

  if (totalVendido >= thresholds.gold) {
    currentTier = "Ouro"; nextTier = "Max";
    currentTierMin = thresholds.gold; nextTierMax = Math.max(totalVendido, thresholds.gold);
    nextCommissionRate = userRules?.goldRate || 0.7;
  } else if (totalVendido >= thresholds.silver) {
    currentTier = "Prata"; nextTier = "Ouro";
    currentTierMin = thresholds.silver; nextTierMax = thresholds.gold - 1;
    nextCommissionRate = userRules?.goldRate || 0.7;
  }

  let comissaoTotal = 0, comissaoGeradaAcumulada = 0, parcelasPerdidasValor = 0;
  filteredSales.forEach((s: any) => {
    const sellerName = isSdrMode ? s.sdrName : s.assignedTo;
    const rule = findRules(sellerName) || defaultRules;
    const faturamento = ranking.find(r => r.name === (isSdrMode ? s.sdrName : s.assignedTo))?.total || 0;
    let rate = rule.bronzeRate;
    if (faturamento >= rule.goldMin) rate = rule.goldRate;
    else if (faturamento >= rule.silverMin) rate = rule.silverRate;

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
      const st0 = s.installments?.[0] ? (s.installments[0].status || (s.installments[0].pago ? "PAGO" : "PENDENTE")) : "PENDENTE";
      if (st0 === "INADIMPLENTE" || st0 === "CANCELADO") parcelasPerdidasValor += saleCommissionTotal;
    }
  });

  const comissaoGerada  = comissaoGeradaAcumulada;
  const comissaoFutura  = isSdrMode ? 0 : Math.max(0, comissaoTotal - comissaoGeradaAcumulada - parcelasPerdidasValor);
  const progressPercent = currentTier === "Ouro" ? 100 : Math.min(100, Math.round(((totalVendido - currentTierMin) / ((nextTierMax + 1) - currentTierMin)) * 100));
  const baseSalary      = userRules?.fixoMensal ?? comissaoConfig.fixedSalary;

  // ── Parcelas a Receber (só quando um Closer específico está selecionado) ──────
  const selectedYear  = parseInt(startDate.split("-")[0]);
  const selectedMonth = parseInt(startDate.split("-")[1]);
  const parcelasDoMes = useMemo(() => {
    if (!allCloserSales.length) return [];
    const result: Array<{
      saleId: string; clientName: string; clienteCpf?: string | null;
      saleValue: number; closedAt: string; parcelaNumero: number; totalParcelas: number;
      valorParcela: number; dataVencimento: string; status: string; comissaoParcelaVal: number;
    }> = [];
    for (const sale of allCloserSales) {
      if (!sale.installments?.length) continue;
      const totalParcelas = sale.installments.length;
      const comissaoTotalSale = (sale.valorComissaoCloser && sale.valorComissaoCloser > 0)
        ? sale.valorComissaoCloser
        : sale.value * ((comissaoConfig.percentage || 0.5) / 100);
      const comissaoParcelaVal = comissaoTotalSale / totalParcelas;
      for (const inst of sale.installments) {
        if (!inst.dataVencimento) continue;
        const d = new Date(inst.dataVencimento);
        if (d.getUTCFullYear() !== selectedYear || d.getUTCMonth() + 1 !== selectedMonth) continue;
        result.push({
          saleId: sale.id, clientName: sale.clientName, clienteCpf: sale.clienteCpf,
          saleValue: sale.value, closedAt: sale.closedAt,
          parcelaNumero: inst.parcelaNumero, totalParcelas,
          valorParcela: inst.valorParcela, dataVencimento: inst.dataVencimento,
          status: inst.status || (inst.pago ? "PAGO" : "PENDENTE"),
          comissaoParcelaVal,
        });
      }
    }
    return result.sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime());
  }, [allCloserSales, selectedYear, selectedMonth, comissaoConfig.percentage]);

  const kpiParcelas = useMemo(() => {
    let aReceber = 0, recebido = 0, inadimplente = 0, cancelado = 0;
    for (const p of parcelasDoMes) {
      if (p.status === "PAGO") recebido += p.comissaoParcelaVal;
      else if (p.status === "INADIMPLENTE") inadimplente += p.comissaoParcelaVal;
      else if (p.status === "CANCELADO") cancelado += p.comissaoParcelaVal;
      else aReceber += p.comissaoParcelaVal;
    }
    return { aReceber, recebido, inadimplente, cancelado };
  }, [parcelasDoMes]);

  const toggleExpanded = useCallback((key: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => { setExpandedClients(new Set()); }, [parcelasStatusFilter]);

  const parcelasAgrupadas = useMemo(() => {
    const prio = (s: string) => s === "INADIMPLENTE" ? 3 : s === "CANCELADO" ? 2 : s === "PENDENTE" ? 1 : 0;
    type P = typeof parcelasDoMes[number];
    const map = new Map<string, { clientKey: string; clientName: string; clienteCpf?: string | null; parcelas: P[]; totalComissao: number; worstStatus: string }>();
    for (const p of parcelasDoMes) {
      const norm = p.status === "PAGO" ? "PAGO" : p.status === "INADIMPLENTE" ? "INADIMPLENTE" : p.status === "CANCELADO" ? "CANCELADO" : "PENDENTE";
      if (parcelasStatusFilter !== "TODOS" && norm !== parcelasStatusFilter) continue;
      const key = p.clienteCpf?.replace(/\D/g, "") || p.clientName.toLowerCase().trim();
      if (!map.has(key)) map.set(key, { clientKey: key, clientName: p.clientName, clienteCpf: p.clienteCpf, parcelas: [], totalComissao: 0, worstStatus: "PAGO" });
      const g = map.get(key)!;
      g.parcelas.push(p);
      g.totalComissao += p.comissaoParcelaVal;
      if (prio(p.status) > prio(g.worstStatus)) g.worstStatus = p.status;
    }
    return Array.from(map.values()).sort((a, b) => prio(b.worstStatus) - prio(a.worstStatus));
  }, [parcelasDoMes, parcelasStatusFilter]);

  // ── Chart ─────────────────────────────────────────────────────────────────────
  const monthNames  = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const monthlyData = monthNames.map(name => ({ name, Fixo: baseSalary, Variável: 0 }));

  filteredSales.forEach(s => {
    if (!s.closedAt) return;
    const d = new Date(s.closedAt);
    let cycleMonth = d.getUTCMonth();
    if (d.getUTCDate() >= 23) cycleMonth += 1;

    const sellerName = isSdrMode ? s.sdrName : s.assignedTo;
    const rule = findRules(sellerName) || defaultRules;
    const faturamento = ranking.find(r => r.name === (isSdrMode ? (s as any).sdrName : s.assignedTo))?.total || 0;
    let rate = rule.bronzeRate || 0.5;
    if (faturamento >= (rule.goldMin || 3_000_000)) rate = rule.goldRate || 0.7;
    else if (faturamento >= (rule.silverMin || 1_000_000)) rate = rule.silverRate || 0.6;

    const saleCommissionTotal = s.value * (rate / 100);
    if (isSdrMode) {
      const st0 = (s as any).installments?.[0] ? ((s as any).installments[0].status || ((s as any).installments[0].pago ? "PAGO" : "PENDENTE")) : "PENDENTE";
      if (st0 === "INADIMPLENTE" || st0 === "CANCELADO") return;
      const targetMonth = cycleMonth + 1;
      if (targetMonth < 12) monthlyData[targetMonth].Variável += saleCommissionTotal;
    } else {
      const instCount = rule.installments || 12;
      const parcelaVal = saleCommissionTotal / instCount;
      for (let i = 0; i < instCount; i++) {
        const inst = (s as any).installments?.[i];
        if (inst) {
          const st = inst.status || (inst.pago ? "PAGO" : "PENDENTE");
          if (st === "INADIMPLENTE" || st === "CANCELADO") continue;
        }
        const targetMonth = cycleMonth + 1 + i;
        if (targetMonth < 12) monthlyData[targetMonth].Variável += parcelaVal;
      }
    }
  });

  // Dados do gráfico enriquecidos quando um Closer está selecionado
  const closerChartData = useMemo(() => {
    if (!allCloserSales.length) return null;
    const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    const data = names.map(name => ({ name, Fixo: baseSalary, Recebido: 0, "A Receber": 0, Inadimplente: 0 }));
    for (const sale of allCloserSales) {
      if (!sale.installments?.length) continue;
      const totalParcelas = sale.installments.length;
      const comissaoTotalSale = (sale.valorComissaoCloser && sale.valorComissaoCloser > 0)
        ? sale.valorComissaoCloser
        : sale.value * ((comissaoConfig.percentage || 0.5) / 100);
      const comissaoVal = comissaoTotalSale / totalParcelas;
      for (const inst of sale.installments) {
        if (!inst.dataVencimento) continue;
        const d = new Date(inst.dataVencimento);
        if (d.getUTCFullYear() !== selectedYear) continue;
        const mi = d.getUTCMonth();
        const st = inst.status || (inst.pago ? "PAGO" : "PENDENTE");
        if (st === "PAGO") data[mi].Recebido += comissaoVal;
        else if (st === "INADIMPLENTE") data[mi].Inadimplente += comissaoVal;
        else if (st !== "CANCELADO") data[mi]["A Receber"] += comissaoVal;
      }
    }
    return data;
  }, [allCloserSales, selectedYear, baseSalary, comissaoConfig.percentage]);

  // ── Pagination ────────────────────────────────────────────────────────────────
  const itemsPerPage  = 10;
  const totalPages    = Math.max(1, Math.ceil(filteredGroups.length / itemsPerPage));
  const paginatedGroups = filteredGroups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] flex flex-col font-sans">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-[#F8F9FA]">
        <div className="flex items-center gap-6">
          <h1 className="text-[26px] font-black tracking-tight text-[#111827]">Comissões</h1>
          {isAdmin && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button onClick={() => setAdminTab("comissao")}
                className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all ${adminTab === "comissao" ? "bg-white shadow-sm text-[#111827]" : "text-gray-400 hover:text-gray-600"}`}>
                Minha Comissão
              </button>
              <button onClick={() => setAdminTab("pagamento")}
                className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all ${adminTab === "pagamento" ? "bg-white shadow-sm text-[#111827]" : "text-gray-400 hover:text-gray-600"}`}>
                Pagamento a Associados
              </button>
            </div>
          )}
        </div>
      </header>

      <main className={`flex-1 px-8 pb-12 flex flex-col gap-4 max-w-[1600px] w-full mx-auto ${isAdmin && adminTab === "pagamento" ? "hidden" : ""}`}>

        {/* ── KPIs + Period ── */}
        <div className="flex flex-col xl:flex-row items-start gap-4">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total vendido</span>
              <p className="text-[30px] font-black text-[#111827] mt-1 leading-none">{fmtBRL(totalVendido)}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Ticket médio</span>
              <p className="text-[30px] font-black text-amber-500 mt-1 leading-none">{fmtBRL(ticketMedio)}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Nº de vendas</span>
              <p className="text-[30px] font-black text-[#111827] mt-1 leading-none">{numVendas}</p>
            </div>
          </div>

          {/* Period + Filters */}
          <div className="w-full xl:w-auto flex flex-col gap-3">
            {/* Date range filter — inline */}
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
              <span className="text-[10px] uppercase font-bold text-gray-400 whitespace-nowrap">Período</span>
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[13px] font-bold text-[#111827] outline-none focus:ring-2 focus:ring-amber-200 transition-all w-[130px]" />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[13px] font-bold text-[#111827] outline-none focus:ring-2 focus:ring-amber-200 transition-all w-[130px]" />
              </div>
            </div>

            {/* SDR + Closer filters row */}
            <div className="flex items-center gap-3">
              <div className={`flex-1 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-center justify-center ${scopeLocked && userRole !== "SDR" ? "opacity-50" : ""}`}>
                <select value={sdrFilter} onChange={e => { if (!scopeLocked) setSdrFilter(e.target.value); }} disabled={scopeLocked && userRole !== "SDR"}
                  className="text-[13px] font-bold bg-transparent outline-none w-full text-center appearance-none cursor-pointer">
                  {scopeLocked && userRole === "SDR" ? <option value={userName}>{userName}</option> : (
                    <>
                      <option value="">SDR: Todos</option>
                      {Array.from(new Set(sales.map(s => s.sdrName).filter(Boolean))).map(sdr => (
                        <option key={sdr as string} value={sdr as string}>{sdr}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div className={`flex-1 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-center justify-center ${scopeLocked && userRole !== "CLOSER" ? "opacity-50" : ""}`}>
                <select value={closerFilter} onChange={e => { if (!scopeLocked) setCloserFilter(e.target.value); }} disabled={scopeLocked && userRole !== "CLOSER"}
                  className="text-[13px] font-bold bg-transparent outline-none w-full text-center appearance-none cursor-pointer">
                  {scopeLocked && (userRole === "CLOSER" || userRole === "closer") ? <option value={userName}>{userName}</option> : (
                    <>
                      <option value="">Closer: Todos</option>
                      {uniqueClosers.map(c => <option key={c} value={c}>{c}</option>)}
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Histórico + Ranking — removido da aba de Comissões ── */}
        {false && (
          <div className="flex flex-col xl:flex-row gap-6">

            {/* Histórico de Vendas */}
            <div className="flex-[3] bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[22px] font-bold text-[#111827] tracking-tight">Histórico de Vendas</h2>
                <div className="flex items-center bg-gray-50 rounded-xl px-4 py-2.5 w-[280px] border border-gray-100 focus-within:ring-2 focus-within:ring-gray-200 focus-within:bg-white transition-all">
                  <Search size={16} className="text-gray-400" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                    className="bg-transparent border-none outline-none text-sm font-medium text-gray-700 w-full ml-2" />
                </div>
              </div>

              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-50">
                      <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider">Data</th>
                      <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider">Cliente</th>
                      <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider">Responsável</th>
                      <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider">Admin.</th>
                      <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider text-right">Valor Venda</th>
                      <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="py-12 text-center text-sm font-bold text-gray-400">Carregando dados...</td></tr>
                    ) : paginatedGroups.length === 0 ? (
                      <tr><td colSpan={6} className="py-12 text-center text-sm font-bold text-gray-400">Nenhuma venda encontrada para o período.</td></tr>
                    ) : (
                      paginatedGroups.map(group => (
                        <tr key={group.key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 text-sm font-medium text-gray-500 whitespace-nowrap">{fmtDateBR(group.closedAt)}</td>
                          <td className="py-4 truncate max-w-[200px]">
                            <div className="flex flex-col leading-tight">
                              <span className="text-sm font-bold text-[#111827]">{group.clientName}</span>
                              {group.clienteCpf && <span className="text-[11px] font-medium text-gray-400">{group.clienteCpf}</span>}
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-100 flex items-center justify-center font-bold text-xs text-gray-500 shrink-0">
                                {getInitials(group.assignedTo)}
                              </div>
                              <div className="flex flex-col leading-tight">
                                <span className="text-sm font-bold text-[#111827]">{group.assignedTo}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Closer</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className="px-2 py-1 bg-[#F1F3F5] text-gray-600 rounded-md text-[10px] uppercase font-bold tracking-wider inline-block">
                              {group.administradora || "N/D"}
                            </span>
                          </td>
                          <td className="py-4 text-[15px] font-bold text-[#111827] text-right">{fmtBRL(group.totalValue)}</td>
                          <td className="py-4 text-right text-[12px] text-gray-400">
                            {group.sales.length > 1 ? (
                              <span>{group.sales.length} cotas · {group.totalCotas} parc.</span>
                            ) : (
                              <span>{group.totalCotas} cota{group.totalCotas !== 1 ? "s" : ""}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-gray-50 mt-auto">
                <span className="text-xs font-semibold text-gray-400">Mostrando {paginatedGroups.length} de {filteredGroups.length} vendas</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50">
                    <ChevronLeft size={16} />
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#111827] text-white font-bold text-sm">{currentPage}</button>
                  {currentPage < totalPages && (
                    <button onClick={() => setCurrentPage(currentPage + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-[#111827] hover:bg-gray-50 font-bold text-sm">
                      {currentPage + 1}
                    </button>
                  )}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Ranking dos Closers */}
            <div className="flex-[1] min-w-[320px] bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm flex flex-col relative overflow-hidden">
              <Medal size={48} className="absolute top-4 right-4 text-amber-500/10" />
              <div className="flex justify-between items-start mb-8">
                <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">Ranking dos Closers</h2>
                <div className="p-2 bg-amber-50 rounded-xl"><Medal size={20} className="text-amber-500" /></div>
              </div>
              <div className="flex flex-col gap-5 flex-1 overflow-y-auto">
                {ranking.length === 0 && <p className="text-sm font-bold text-gray-400 text-center py-8">Sem dados no período</p>}
                {ranking.map((closer, i) => (
                  <div key={closer.name} className="bg-[#F8F9FA] rounded-[24px] p-5 border border-gray-100/50 flex flex-col relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gray-200 border-[3px] border-white shadow-sm flex items-center justify-center font-bold text-sm text-gray-500">
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

        )}

        {/* ── SEU GANHO E PROGRESSÃO (dark card) ── */}
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
              <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#d97706] to-[#fbbf24] transition-all duration-1000"
                style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        {/* ── Projeção Financeira ── */}
        <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm">
          <div className="mb-6">
            <h3 className="text-[18px] font-bold text-[#111827] tracking-tight">Projeção Financeira {selectedYear}</h3>
            {!isSdrMode && closerChartData && (
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Recebido
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />A Receber
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />Inadimplente
                </span>
              </div>
            )}
          </div>
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(isSdrMode ? monthlyData : closerChartData || monthlyData) as any[]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFixo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f3f4f6" stopOpacity={1} />
                    <stop offset="95%" stopColor="#f3f4f6" stopOpacity={1} />
                  </linearGradient>
                  <linearGradient id="colorVar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRecebido" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorAReceber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorInad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `R$ ${v / 1000}k`} />
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f5" />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #f0f0f5", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  itemStyle={{ fontSize: "13px", fontWeight: "bold" }}
                  labelStyle={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}
                  formatter={(value: unknown) => fmtBRL(Number(value))}
                />
                <Area type="monotone" dataKey="Fixo" stackId="1" stroke="#e5e7eb" strokeWidth={2} fill="url(#colorFixo)" activeDot={false} />
                {!isSdrMode && closerChartData ? (
                  <>
                    <Area type="monotone" dataKey="Recebido" stackId="1" stroke="#10b981" strokeWidth={2} fill="url(#colorRecebido)" />
                    <Area type="monotone" dataKey="A Receber" stackId="1" stroke="#d97706" strokeWidth={2} fill="url(#colorAReceber)" />
                    <Area type="monotone" dataKey="Inadimplente" stroke="#ef4444" strokeWidth={1.5} fill="url(#colorInad)" strokeDasharray="4 2" />
                  </>
                ) : (
                  <Area type="monotone" dataKey="Variável" stackId="1" stroke="#d97706" strokeWidth={2} fill="url(#colorVar)" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Parcelas a Receber (não aparece no modo SDR) ── */}
        {!isSdrMode && <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm flex flex-col gap-6">

            {/* Header + KPIs */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-bold text-[#111827] tracking-tight flex items-center gap-2">
                  <Calendar size={20} className="text-amber-500" />
                  Parcelas a Receber — {monthNames[selectedMonth - 1]} {selectedYear}
                </h3>
                {loadingParcelas && <span className="text-xs text-gray-400 font-medium animate-pulse">Carregando...</span>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                  <span className="block text-[10px] uppercase font-bold text-amber-600 tracking-wider mb-1">A Receber</span>
                  <span className="block text-[22px] font-black text-amber-600">{fmtBRL(kpiParcelas.aReceber)}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
                  <span className="block text-[10px] uppercase font-bold text-emerald-600 tracking-wider mb-1">Já Recebido</span>
                  <span className="block text-[22px] font-black text-emerald-600">{fmtBRL(kpiParcelas.recebido)}</span>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                  <span className="block text-[10px] uppercase font-bold text-red-500 tracking-wider mb-1">Inadimplente</span>
                  <span className="block text-[22px] font-black text-red-500">{fmtBRL(kpiParcelas.inadimplente)}</span>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                  <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Cancelado</span>
                  <span className="block text-[22px] font-black text-gray-400">{fmtBRL(kpiParcelas.cancelado)}</span>
                </div>
              </div>
            </div>

            {/* Filtros de status */}
            <div className="flex items-center gap-2 flex-wrap">
              {(["TODOS", "PENDENTE", "PAGO", "INADIMPLENTE", "CANCELADO"] as const).map(s => {
                const label = s === "TODOS" ? "Todos" : s === "PENDENTE" ? "Ativo" : s === "PAGO" ? "Pago" : s === "INADIMPLENTE" ? "Inadimplente" : "Cancelado";
                const active = parcelasStatusFilter === s;
                const color = active
                  ? s === "INADIMPLENTE" ? "bg-red-600 text-white" : s === "CANCELADO" ? "bg-gray-500 text-white" : s === "PAGO" ? "bg-emerald-600 text-white" : s === "PENDENTE" ? "bg-blue-600 text-white" : "bg-[#111827] text-white"
                  : "bg-gray-100 text-gray-400 hover:bg-gray-200";
                return (
                  <button key={s} onClick={() => setParcelasStatusFilter(s)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${color}`}>
                    {label}
                  </button>
                );
              })}
              <span className="ml-auto text-[11px] text-gray-400 font-medium">{parcelasAgrupadas.length} cliente{parcelasAgrupadas.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Tabela agrupada por cliente */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[560px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 w-8" />
                    <th className="pb-3 font-semibold text-[11px] text-gray-400 uppercase tracking-wider">Cliente</th>
                    <th className="pb-3 font-semibold text-[11px] text-gray-400 uppercase tracking-wider text-center">Parcelas</th>
                    <th className="pb-3 font-semibold text-[11px] text-gray-400 uppercase tracking-wider text-right">Total Comissão</th>
                    <th className="pb-3 font-semibold text-[11px] text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingParcelas ? (
                    <tr><td colSpan={5} className="py-10 text-center text-sm font-bold text-gray-400">Carregando parcelas...</td></tr>
                  ) : parcelasAgrupadas.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-sm font-bold text-gray-400">Nenhuma parcela para este filtro.</td></tr>
                  ) : parcelasAgrupadas.flatMap(group => {
                    const isOpen  = expandedClients.has(group.clientKey);
                    const isInad  = group.worstStatus === "INADIMPLENTE";
                    const isCanc  = group.worstStatus === "CANCELADO";
                    const isPago  = group.worstStatus === "PAGO";
                    const wLabel  = isPago ? "Pago" : isInad ? "Inadimplente" : isCanc ? "Cancelado" : "Ativo";
                    const wClass  = isPago ? "bg-emerald-100 text-emerald-700" : isInad ? "bg-red-100 text-red-600" : isCanc ? "bg-gray-100 text-gray-400" : "bg-blue-50 text-blue-600";
                    const rows = [
                      <tr key={`g-${group.clientKey}`}
                        onClick={() => toggleExpanded(group.clientKey)}
                        className={`border-b border-gray-50 cursor-pointer transition-colors ${isOpen ? "bg-gray-50/70" : "hover:bg-gray-50/50"}`}>
                        <td className="py-3.5 pl-2">
                          <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
                        </td>
                        <td className="py-3.5">
                          <div className="flex flex-col leading-tight">
                            <span className="text-sm font-bold text-[#111827]">{group.clientName}</span>
                            {group.clienteCpf && <span className="text-[11px] text-gray-400">{group.clienteCpf}</span>}
                          </div>
                        </td>
                        <td className="py-3.5 text-sm font-bold text-gray-500 text-center">{group.parcelas.length}</td>
                        <td className="py-3.5 text-sm font-bold text-[#111827] text-right whitespace-nowrap">{fmtBRL(group.totalComissao)}</td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${wClass}`}>{wLabel}</span>
                        </td>
                      </tr>
                    ];
                    if (isOpen) {
                      group.parcelas.forEach((p, pi) => {
                        const pPago = p.status === "PAGO";
                        const pInad = p.status === "INADIMPLENTE";
                        const pCanc = p.status === "CANCELADO";
                        const pLabel = pPago ? "Pago" : pInad ? "Inadimplente" : pCanc ? "Cancelado" : "Ativo";
                        const pClass = pPago ? "bg-emerald-100 text-emerald-700" : pInad ? "bg-red-100 text-red-600" : pCanc ? "bg-gray-100 text-gray-400" : "bg-blue-50 text-blue-600";
                        rows.push(
                          <tr key={`${p.saleId}-${p.parcelaNumero}-${pi}`} className="border-b border-gray-50/50 bg-[#fafafa]">
                            <td className="py-2 pl-2" />
                            <td className="py-2">
                              <span className="text-[12px] text-gray-400">Fechamento: {fmtDateBR(p.closedAt)}</span>
                            </td>
                            <td className="py-2 text-[12px] font-bold text-gray-500 text-center">{p.parcelaNumero}/{p.totalParcelas}</td>
                            <td className="py-2 text-[12px] font-bold text-gray-700 text-right whitespace-nowrap">
                              {fmtBRL(p.comissaoParcelaVal)}
                              <span className="text-[10px] text-gray-400 ml-1.5">venc. {fmtDateBR(p.dataVencimento)}</span>
                            </td>
                            <td className="py-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${pClass}`}>{pLabel}</span>
                            </td>
                          </tr>
                        );
                      });
                    }
                    return rows;
                  })}
                </tbody>
              </table>
            </div>

          </div>}

        {/* ── Histórico de Vendas ── */}
        {(
          <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[22px] font-bold text-[#111827] tracking-tight">Histórico de Vendas</h2>
              <div className="flex items-center bg-gray-50 rounded-xl px-4 py-2.5 w-[280px] border border-gray-100 focus-within:ring-2 focus-within:ring-gray-200 focus-within:bg-white transition-all">
                <Search size={16} className="text-gray-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                  className="bg-transparent border-none outline-none text-sm font-medium text-gray-700 w-full ml-2" />
              </div>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider">Data</th>
                    <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider">Cliente</th>
                    <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider">Closer</th>
                    <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider">Admin.</th>
                    <th className="pb-4 font-semibold text-[11px] text-gray-400 uppercase tracking-wider text-right">Valor Venda</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="py-12 text-center text-sm font-bold text-gray-400">Carregando dados...</td></tr>
                  ) : paginatedGroups.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-sm font-bold text-gray-400">Nenhuma venda encontrada para o período.</td></tr>
                  ) : (
                    paginatedGroups.map(group => (
                      <tr key={group.key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 text-sm font-medium text-gray-500 whitespace-nowrap">{fmtDateBR(group.closedAt)}</td>
                        <td className="py-4 truncate max-w-[220px]">
                          <div className="flex flex-col leading-tight">
                            <span className="text-sm font-bold text-[#111827]">{group.clientName}</span>
                            {group.clienteCpf && <span className="text-[11px] font-medium text-gray-400">{group.clienteCpf}</span>}
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center font-bold text-xs text-gray-500 shrink-0">
                              {getInitials(group.assignedTo)}
                            </div>
                            <span className="text-sm font-bold text-[#111827]">{group.assignedTo}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="px-2 py-1 bg-[#F1F3F5] text-gray-600 rounded-md text-[10px] uppercase font-bold tracking-wider inline-block">
                            {group.administradora || "N/D"}
                          </span>
                        </td>
                        <td className="py-4 text-[15px] font-bold text-[#111827] text-right">{fmtBRL(group.totalValue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between pt-6 border-t border-gray-50 mt-auto">
              <span className="text-xs font-semibold text-gray-400">Mostrando {paginatedGroups.length} de {filteredGroups.length} vendas</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50">
                  <ChevronLeft size={16} />
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#111827] text-white font-bold text-sm">{currentPage}</button>
                {currentPage < totalPages && (
                  <button onClick={() => setCurrentPage(currentPage + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-[#111827] hover:bg-gray-50 font-bold text-sm">
                    {currentPage + 1}
                  </button>
                )}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ── Pagamento a Associados (admin only) ── */}
      {isAdmin && adminTab === "pagamento" && (
        <main className="flex-1 px-8 pb-12 flex flex-col gap-6 max-w-[1600px] w-full mx-auto">

          {/* Month selector + KPIs */}
          <div className="flex flex-col xl:flex-row items-start gap-4">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Já confirmado — pagar agora</span>
                <p className="text-[30px] font-black text-red-500 mt-1 leading-none">
                  {pagamentoLoading ? "..." : fmtBRL(pagamentoData?.totalAPagar ?? 0)}
                </p>
                <span className="text-[10px] text-gray-400 mt-1">parcelas PAGAS recebidas da administradora</span>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Compromisso futuro</span>
                <p className="text-[30px] font-black text-amber-500 mt-1 leading-none">
                  {pagamentoLoading ? "..." : fmtBRL(pagamentoData?.totalPendente ?? 0)}
                </p>
                <span className="text-[10px] text-gray-400 mt-1">parcelas pendentes ainda a receber</span>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Associados com comissão</span>
                <p className="text-[30px] font-black text-[#111827] mt-1 leading-none">
                  {pagamentoLoading ? "..." : (pagamentoData?.data?.length ?? 0)}
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
              <span className="text-[10px] uppercase font-bold text-gray-400 whitespace-nowrap">Mês</span>
              <input
                type="month"
                value={pagamentoMes}
                onChange={e => setPagamentoMes(e.target.value)}
                className="px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[13px] font-bold text-[#111827] outline-none focus:ring-2 focus:ring-amber-200 transition-all"
              />
              {pagamentoLoading && <span className="text-xs text-gray-400 animate-pulse">Carregando...</span>}
            </div>
          </div>

          {/* Per-associate table */}
          {!pagamentoLoading && pagamentoData?.data && (
            <div className="bg-white border border-gray-100 rounded-[32px] shadow-sm overflow-hidden">
              <div className="px-8 pt-8 pb-4">
                <h3 className="text-[18px] font-bold text-[#111827] tracking-tight">
                  Cruzamento de Clientes × Associados —{" "}
                  {new Date(pagamentoMes + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })}
                </h3>
                <p className="text-[12px] text-gray-400 mt-1">
                  Baseado nas parcelas com vencimento no mês. Parcelas PAGAS = você recebeu da administradora → deve ao associado.
                </p>
              </div>

              {pagamentoData.data.length === 0 && (
                <div className="px-8 pb-8 text-center text-gray-400 text-sm font-medium py-12">
                  Nenhum associado com parcelas neste mês.
                </div>
              )}

              <div className="divide-y divide-gray-50">
                {pagamentoData.data.map((assoc: any) => {
                  const key = `${assoc.tipo}:${assoc.nome}`;
                  const expanded = expandedAssoc.has(key);
                  const pagoClients = assoc.clientes.filter((c: any) => c.status === "PAGO");
                  const pendClients = assoc.clientes.filter((c: any) => c.status === "PENDENTE");
                  const perdClients = assoc.clientes.filter((c: any) => c.status === "INADIMPLENTE" || c.status === "CANCELADO");

                  return (
                    <div key={key}>
                      {/* Row */}
                      <button
                        className="w-full flex items-center gap-4 px-8 py-5 hover:bg-gray-50 transition-colors text-left"
                        onClick={() => setExpandedAssoc(prev => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key); else next.add(key);
                          return next;
                        })}
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[13px] text-gray-600 shrink-0">
                          {getInitials(assoc.nome)}
                        </div>

                        {/* Name + tipo */}
                        <div className="min-w-[160px]">
                          <p className="font-bold text-[14px] text-[#111827]">{assoc.nome}</p>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${assoc.tipo === "CLOSER" ? "text-amber-600" : "text-blue-500"}`}>
                            {assoc.tipo}
                          </span>
                        </div>

                        {/* Stats */}
                        <div className="flex-1 grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Clientes</p>
                            <p className="text-[15px] font-black text-[#111827]">{assoc.clientes.length}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider mb-0.5">A pagar (PAGO)</p>
                            <p className="text-[15px] font-black text-emerald-600">{fmtBRL(assoc.pago)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-amber-500 tracking-wider mb-0.5">Pendente</p>
                            <p className="text-[15px] font-black text-amber-500">{fmtBRL(assoc.pendente)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-red-400 tracking-wider mb-0.5">Perdido</p>
                            <p className="text-[15px] font-black text-red-400">{fmtBRL(assoc.perdido)}</p>
                          </div>
                        </div>

                        {/* Chevron */}
                        <ChevronDown
                          size={16}
                          className={`shrink-0 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                        />
                      </button>

                      {/* Expanded clients */}
                      {expanded && (
                        <div className="px-8 pb-6 bg-gray-50/60">
                          <table className="w-full text-left border-collapse mt-2">
                            <thead>
                              <tr>
                                <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cliente</th>
                                <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Administradora</th>
                                <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Parcela</th>
                                <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                                <th className="pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Comissão</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {assoc.clientes.map((c: any, i: number) => {
                                const statusColor =
                                  c.status === "PAGO" ? "bg-emerald-100 text-emerald-700" :
                                  c.status === "INADIMPLENTE" ? "bg-red-100 text-red-600" :
                                  c.status === "CANCELADO" ? "bg-gray-100 text-gray-400" :
                                  "bg-amber-50 text-amber-600";
                                const statusLabel =
                                  c.status === "PAGO" ? "Pago" :
                                  c.status === "INADIMPLENTE" ? "Inadimplente" :
                                  c.status === "CANCELADO" ? "Cancelado" : "Pendente";
                                return (
                                  <tr key={i} className="hover:bg-white transition-colors">
                                    <td className="py-2.5 text-[13px] font-semibold text-[#111827]">{c.clientName}</td>
                                    <td className="py-2.5 text-[12px] text-gray-500">{c.administradora || "—"}</td>
                                    <td className="py-2.5 text-center text-[12px] text-gray-500">
                                      {c.parcelaNumero}/{c.totalParcelas}
                                    </td>
                                    <td className="py-2.5 text-center">
                                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor}`}>
                                        {statusLabel}
                                      </span>
                                    </td>
                                    <td className={`py-2.5 text-right text-[13px] font-bold ${c.status === "PAGO" ? "text-emerald-600" : c.status === "INADIMPLENTE" || c.status === "CANCELADO" ? "text-red-400 line-through" : "text-amber-500"}`}>
                                      {fmtBRL(c.valorComissao)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-gray-200">
                                <td colSpan={4} className="pt-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total a pagar</td>
                                <td className="pt-3 text-right text-[15px] font-black text-emerald-600">{fmtBRL(assoc.pago)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </main>
      )}

    </div>
  );
}
