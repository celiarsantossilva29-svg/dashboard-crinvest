"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Search, Calendar, Filter, Users, Medal, ChevronLeft, ChevronRight, ChevronDown, Plus, X, CheckCircle, Zap, Target, Pencil, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useSession } from "next-auth/react";

// ─── Utils ────────────────────────────────────────────────────────────────────

function maskCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const padded = digits.padStart(3, "0");
  const intPart = padded.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  const decPart = padded.slice(-2);
  return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decPart}`;
}

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
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(last).padStart(2, "0")}` };
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
  origem?: string | null;
  closerExterno?: string | null;
  percentualExterno?: number | null;
  installments?: { id: string; parcelaNumero: number; pago: boolean; status?: string; valorParcela: number; dataVencimento: string }[];
}

const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

// ─── Page Component ───────────────────────────────────────────────────────────

export default function GestaoVendasPage() {
  const { start: ds, end: de } = getMonthRange();
  const [startDate, setStartDate] = useLocalStorage("filter:gestao-vendas:start", ds);
  const [endDate, setEndDate] = useLocalStorage("filter:gestao-vendas:end", de);
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
  const [fEstado, setFEstado] = useState("Selecione");
  const [fGender, setFGender] = useState("Selecione");
  const [fCivil, setFCivil] = useState("Selecione");
  const [fCpf, setFCpf] = useState("");
  const [fValue, setFValue] = useState("");
  const [fClosedAt, setFClosedAt] = useState("");
  const [fAdmin, setFAdmin] = useState("Porto Seguro");
  const [fSdr, setFSdr] = useState("Prospecção direta (Sem SDR)");
  const [fCloser, setFCloser] = useState("");
  const [fTipoProduto, setFTipoProduto] = useState("");
  const [fFinalidade, setFFinalidade] = useState("Selecione");
  const [fParcelasComissao, setFParcelasComissao] = useState("");
  const [fOrigem, setFOrigem] = useState("Selecione");
  const [isExternoCloser, setIsExternoCloser] = useState(false);
  const [fCloserExternoNome, setFCloserExternoNome] = useState("");
  const [fPercentualExterno, setFPercentualExterno] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingSaleId(null); setFClientName(""); setFCity(""); setFEstado("Selecione");
    setFGender("Selecione"); setFCivil("Selecione"); setFCpf(""); setFValue("");
    setFClosedAt(""); setFAdmin("Porto Seguro"); setFSdr("Prospecção direta (Sem SDR)");
    setFCloser(""); setIsCampanha(false); setFTipoProduto(""); setFFinalidade("Selecione");
    setFParcelasComissao(""); setFOrigem("Selecione"); setIsExternoCloser(false);
    setFCloserExternoNome(""); setFPercentualExterno("");
  };

  const openNewModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (sale: Sale) => {
    resetForm();
    setEditingSaleId(sale.id);
    setFClientName(sale.clientName);
    setFValue(maskCurrency(Math.round(sale.value * 100).toString()));
    setFClosedAt(new Date(sale.closedAt).toISOString().split('T')[0]);
    setFCloser(sale.assignedTo);
    setFSdr(sale.sdrName || "Prospecção direta (Sem SDR)");
    setFAdmin(sale.administradora || "Porto Seguro");
    setFCpf(sale.clienteCpf || "");
    setFOrigem(sale.origem || "Selecione");
    if (sale.closerExterno) {
      setIsExternoCloser(true);
      setFCloserExternoNome(sale.closerExterno);
      setFPercentualExterno(sale.percentualExterno ? String(sale.percentualExterno) : "");
    }
    const note = sale.notes || "";
    setIsCampanha(note.includes("Campanha Promocional Especial"));
    setFCity(note.match(/Cidade:\s*(.+)/)?.[1] || "");
    setFEstado(note.match(/Estado:\s*(.+)/)?.[1] || "Selecione");
    setFGender(note.match(/Gênero:\s*(.+)/)?.[1] || "Selecione");
    setFCivil(note.match(/Estado Civil:\s*(.+)/)?.[1] || "Selecione");
    setFTipoProduto(note.match(/Tipo:\s*(.+)/)?.[1] || "");
    setFFinalidade(note.match(/Finalidade:\s*(.+)/)?.[1] || "Selecione");
    setFParcelasComissao(note.match(/Parcelas comissão:\s*(.+)/)?.[1] || "");
    setIsModalOpen(true);
  };

  const handleRegisterSale = async () => {
    if (editingSaleId && !isAdmin) {
      alert("Apenas administradores podem alterar vendas.");
      return;
    }
    const closerValido = isExternoCloser ? fCloserExternoNome.trim() !== "" : (fCloser !== "" && fCloser !== "Selecione o Closer");
    if (!fClientName || !fValue || !fClosedAt || !closerValido) {
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
          assignedTo: isExternoCloser ? fCloserExternoNome : fCloser,
          sdrName: fSdr,
          administradora: fAdmin,
          clienteCpf: fCpf,
          origem: fOrigem !== "Selecione" ? fOrigem : null,
          closerExterno: isExternoCloser ? fCloserExternoNome : null,
          percentualExterno: fPercentualExterno ? Number(fPercentualExterno) : null,
          notes: [
            isCampanha ? "Venda via Campanha Promocional Especial" : null,
            fCity ? `Cidade: ${fCity}` : null,
            fEstado !== "Selecione" ? `Estado: ${fEstado}` : null,
            fGender !== "Selecione" ? `Gênero: ${fGender}` : null,
            fCivil !== "Selecione" ? `Estado Civil: ${fCivil}` : null,
            fTipoProduto ? `Tipo: ${fTipoProduto}` : null,
            fTipoProduto === "Imóvel" && fFinalidade !== "Selecione" ? `Finalidade: ${fFinalidade}` : null,
            fParcelasComissao ? `Parcelas comissão: ${fParcelasComissao}` : null,
          ].filter(Boolean).join("\n"),
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
  const [allSales, setAllSales] = useState<Sale[]>([]);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const [res, allRes] = await Promise.all([
        fetch(`/api/sales?start=${startDate}&end=${endDate}`),
        fetch("/api/sales?start=2020-01-01&end=2030-01-01"),
      ]);
      const [json, allJson] = await Promise.all([res.json(), allRes.json()]);
      setSales(json.data || []);
      setAllSales(allJson.data || []);

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
        if (!s.sdrName) return false;
        const a = s.sdrName.toLowerCase();
        const f = sdrFilter.toLowerCase();
        return a.startsWith(f) || f.startsWith(a.split(" ")[0]);
      })();
      return matchSearch && matchCloser && matchSdr;
    });
  }, [sales, search, closerFilter, sdrFilter]);

  const uniqueClosers = useMemo(() => Array.from(new Set(sales.map(s => s.assignedTo).filter(Boolean))), [sales]);
  const uniqueSDRs = useMemo(() => Array.from(new Set(sales.map(s => s.sdrName).filter(Boolean))), [sales]);

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

  const isOverviewMode = !closerFilter && !sdrFilter;

  const minDateForUser = useMemo(() => {
    if (!scopeLocked || !userName) return "";
    const n = userName.toLowerCase();
    const mp = (f: string | null | undefined) => {
      if (!f) return false;
      const fl = f.toLowerCase();
      return fl.startsWith(n) || n.startsWith(fl.split(" ")[0]) || fl.split(" ")[0] === n.split(" ")[0];
    };
    const dates = allSales.filter(s => mp(s.assignedTo) || mp(s.sdrName)).map(s => s.closedAt).filter(Boolean);
    if (!dates.length) return "";
    return dates.sort()[0].substring(0, 10);
  }, [allSales, scopeLocked, userName]);

  const inadimplentAlerts = useMemo(() => {
    if (!userName) return [];
    const n = userName.toLowerCase();
    const match = (field: string | null | undefined) => {
      if (!field) return false;
      const f = field.toLowerCase();
      return f.startsWith(n) || n.startsWith(f.split(" ")[0]) || f.split(" ")[0] === n.split(" ")[0];
    };
    const result: { clientName: string; parcelaNumero: number; dataVencimento: string }[] = [];
    for (const s of allSales) {
      if (!match(s.assignedTo)) continue;
      for (const i of (s.installments || [])) {
        if (i.status === "INADIMPLENTE") {
          result.push({ clientName: s.clientName, parcelaNumero: i.parcelaNumero, dataVencimento: i.dataVencimento });
        }
      }
    }
    return result;
  }, [allSales, userName]);

  const inadimplentSaleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of allSales) {
      if ((s.installments || []).some(i => i.status === "INADIMPLENTE")) ids.add(s.id);
    }
    return ids;
  }, [allSales]);

  const chartSales = useMemo(() => {
    let list = allSales;
    return list.filter(s => {
      const mc = !closerFilter || (() => { const a = (s.assignedTo ?? "").toLowerCase(); const f = closerFilter.toLowerCase(); return a.startsWith(f) || f.startsWith(a.split(" ")[0]); })();
      const ms = !sdrFilter || (() => { if (!s.sdrName) return false; const a = s.sdrName.toLowerCase(); const f = sdrFilter.toLowerCase(); return a.startsWith(f) || f.startsWith(a.split(" ")[0]); })();
      return mc && ms;
    });
  }, [allSales, closerFilter, sdrFilter]);



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

  const groupedSales = useMemo(() => {
    const map = new Map<string, { key: string; sales: Sale[]; totalValue: number; hasInadimplent: boolean }>();
    for (const s of filteredSales) {
      const day = s.closedAt ? s.closedAt.substring(0, 10) : "";
      const key = `${s.clientName}||${s.assignedTo}||${day}`;
      if (!map.has(key)) map.set(key, { key, sales: [], totalValue: 0, hasInadimplent: false });
      const g = map.get(key)!;
      g.sales.push(s);
      g.totalValue += s.value;
      if (inadimplentSaleIds.has(s.id)) g.hasInadimplent = true;
    }
    return Array.from(map.values());
  }, [filteredSales, inadimplentSaleIds]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const itemsPerPage = 10;
  const totalPages = Math.ceil(groupedSales.length / itemsPerPage);
  const paginatedGroups = groupedSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


  const baseSalary = comissaoConfig.fixedSalary;
  const isSdrMode = sdrFilter !== "" && closerFilter === "";

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

  // Pre-computa totais por ciclo para cálculo de tier correto (regra do dia 22)
  const getCycleKey = (closedAt: string) => {
    const d = new Date(closedAt);
    let m = d.getUTCMonth();
    if (d.getUTCDate() >= 23) m += 1;
    return `${d.getUTCFullYear()}-${m}`;
  };

  const sdrCycleTotals: Record<string, number> = {};
  if (isSdrMode) {
    for (const s of filteredSales) {
      if (!s.sdrName || !s.closedAt) continue;
      const sn = s.sdrName.toLowerCase();
      const sl = sdrFilter.toLowerCase();
      if (!(sn.startsWith(sl) || sl.startsWith(sn.split(" ")[0]))) continue;
      const ck = getCycleKey(s.closedAt);
      sdrCycleTotals[ck] = (sdrCycleTotals[ck] || 0) + s.value;
    }
  }

  let comissaoTotal = 0;
  let parcelasPerdidasValor = 0;
  let comissaoGeradaAcumulada = 0;

  filteredSales.forEach((s: any) => {
    const sellerName = isSdrMode ? s.sdrName : s.assignedTo;
    const rule = findRules(sellerName) || defaultRules;

    const faturamentoVendedor = isSdrMode
      ? (sdrCycleTotals[getCycleKey(s.closedAt)] || 0)
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
      const statusPrimeira = s.installments && s.installments[0] ? (s.installments[0].status || (s.installments[0].pago ? "PAGO" : "PENDENTE")) : "PENDENTE";
      if (statusPrimeira === "INADIMPLENTE" || statusPrimeira === "CANCELADO") parcelasPerdidasValor += saleCommissionTotal;
    }
  });

  const comissaoGerada = comissaoGeradaAcumulada;
  let comissaoFuturaCalculada = (comissaoTotal - comissaoGeradaAcumulada) - parcelasPerdidasValor;
  if (comissaoFuturaCalculada < 0) comissaoFuturaCalculada = 0;
  const comissaoFutura = isSdrMode ? 0 : comissaoFuturaCalculada;

  const progressPercent = currentTier === "Ouro" ? 100 : Math.min(100, Math.round(((totalVendido - currentTierMin) / ((nextTierMax + 1) - currentTierMin)) * 100));

  const currentYear = new Date().getUTCFullYear();
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthlyData = monthNames.map(name => ({ name, Fixo: baseSalary, Variável: 0 }));

  // Pre-computa totais por ciclo para o gráfico (SDR mode)
  const sdrCycleTotalsChart: Record<string, number> = {};
  if (isSdrMode) {
    for (const s of chartSales) {
      if (!s.sdrName || !s.closedAt) continue;
      const sn = s.sdrName.toLowerCase();
      const sl = sdrFilter.toLowerCase();
      if (!(sn.startsWith(sl) || sl.startsWith(sn.split(" ")[0]))) continue;
      const ck = getCycleKey(s.closedAt);
      sdrCycleTotalsChart[ck] = (sdrCycleTotalsChart[ck] || 0) + s.value;
    }
  }

  chartSales.forEach(s => {
    if (!s.closedAt) return;
    const d = new Date(s.closedAt);
    let cycleMonth = d.getUTCMonth();
    if (d.getUTCDate() >= 23) cycleMonth += 1;

    const sellerName = isSdrMode ? s.sdrName : s.assignedTo;
    const rule = findRules(sellerName) || userRules || defaultRules;
    const faturamentoVendedor = isSdrMode
      ? (sdrCycleTotalsChart[getCycleKey(s.closedAt)] || 0)
      : chartSales.filter((cs: any) => cs.assignedTo === s.assignedTo).reduce((acc: number, cs: any) => acc + cs.value, 0);

    let rate = rule.bronzeRate || 0.5;
    if (faturamentoVendedor >= (rule.goldMin || 3000000)) rate = rule.goldRate || 0.7;
    else if (faturamentoVendedor >= (rule.silverMin || 1000000)) rate = rule.silverRate || 0.6;

    const saleCommissionTotal = s.value * (rate / 100);

    if (isSdrMode) {
      const inst0 = s.installments?.[0];
      const statusPrimeira = inst0 ? (inst0.status || (inst0.pago ? "PAGO" : "PENDENTE")) : "PENDENTE";
      if (statusPrimeira === "INADIMPLENTE" || statusPrimeira === "CANCELADO") return;
      // Regra do ciclo: vendido até dia 22 do mês M → pago em M+1; dia 23+ → pago em M+2
      // cycleMonth já foi ajustado para +1 em datas >= 23, então sempre targetMonth = cycleMonth + 1
      const targetMonth = cycleMonth + 1;
      if (targetMonth >= 0 && targetMonth < 12) monthlyData[targetMonth].Variável += saleCommissionTotal;
    } else {
      const instCount = rule.installments || 12;
      const parcelaVal = saleCommissionTotal / instCount;
      for (let i = 0; i < instCount; i++) {
        const inst = s.installments?.[i];
        if (inst) {
          const st = inst.status || (inst.pago ? "PAGO" : "PENDENTE");
          if (st === "INADIMPLENTE" || st === "CANCELADO") continue;
        }
        let targetMonth: number;
        if (inst?.dataVencimento) {
          const iv = new Date(inst.dataVencimento);
          if (iv.getUTCFullYear() !== currentYear) continue;
          targetMonth = iv.getUTCMonth();
        } else {
          targetMonth = cycleMonth + 1 + i;
          if (targetMonth < 0 || targetMonth >= 12) continue;
        }
        if (targetMonth >= 0 && targetMonth < 12) monthlyData[targetMonth].Variável += parcelaVal;
      }
    }
  });

  const chartData = monthlyData;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] flex flex-col font-sans">

      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-[#F8F9FA]">
        <h1 className="text-[26px] font-black tracking-tight text-[#111827]">Gestão de vendas</h1>
        {userRole !== "SDR" && (
          <button onClick={openNewModal} className="flex items-center gap-2 bg-[#1d1d1f] hover:bg-black text-white px-4 py-2 rounded-xl text-[13px] font-bold shadow-sm transition-colors">
            <Plus size={15} /> Registrar venda
          </button>
        )}
      </header>

      {inadimplentAlerts.length > 0 && (
        <div className="mx-8 mt-2 mb-0 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p className="text-[13px] font-bold text-red-700">
              {inadimplentAlerts.length === 1 ? "1 cliente inadimplente" : `${inadimplentAlerts.length} clientes inadimplentes`} na sua carteira
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {inadimplentAlerts.map((a, i) => (
              <span key={i} className="flex items-center gap-1.5 bg-white border border-red-200 text-red-700 text-[11px] font-bold px-3 py-1 rounded-lg">
                {a.clientName} · P{a.parcelaNumero} · {fmtDateBR(a.dataVencimento)}
              </span>
            ))}
          </div>
        </div>
      )}

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
                <input type="date" value={startDate} min={minDateForUser || undefined} onChange={e => setStartDate(e.target.value)} className="text-sm font-bold bg-transparent outline-none cursor-pointer" />
                <span className="text-gray-300">-</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold bg-transparent outline-none cursor-pointer" />
                <Calendar size={14} className="text-gray-400" />
              </div>
            </div>
            <div className={`bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex items-center justify-center gap-2 relative ${scopeLocked && userRole !== "SDR" ? 'opacity-50' : ''}`}>
              <Filter size={16} className="text-gray-400" />
              <select
                title="Filtrar por SDR"
                value={sdrFilter}
                onChange={(e) => setSdrFilter(e.target.value)}
                disabled={scopeLocked && userRole !== "SDR"}
                className={`text-sm font-bold bg-transparent outline-none w-full text-center appearance-none ${scopeLocked && userRole !== "SDR" ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {scopeLocked && userRole === "SDR" ? (
                  <>
                    <option value="">Visão Geral (Todas as Vendas)</option>
                    {userName && <option value={userName}>Minha Comissão ({userName.split(" ")[0]})</option>}
                  </>
                ) : scopeLocked && userRole !== "SDR" ? (
                  <option value="">Visão Geral</option>
                ) : (
                  <>
                    <option value="">Todos SDRs</option>
                    {uniqueSDRs.map(sdr => <option key={sdr as string} value={sdr as string}>{sdr}</option>)}
                  </>
                )}
              </select>
            </div>
            <div className={`bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex items-center justify-center gap-2 relative ${scopeLocked && userRole === "SDR" ? 'opacity-50' : ''}`}>
              <Users size={16} className="text-gray-400" />
              <select
                title="Filtrar por Closer"
                value={closerFilter}
                onChange={(e) => setCloserFilter(e.target.value)}
                disabled={scopeLocked && userRole === "SDR"}
                className={`text-sm font-bold bg-transparent outline-none w-full text-center appearance-none ${scopeLocked && userRole === "SDR" ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {scopeLocked && userRole !== "SDR" ? (
                  <>
                    <option value="">Visão Geral (Todas as Vendas)</option>
                    {userName && <option value={userName}>Minha Comissão ({userName.split(" ")[0]})</option>}
                  </>
                ) : scopeLocked && userRole === "SDR" ? (
                  <option value="">Visão Geral</option>
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

        {isOverviewMode ? (
          /* ── TEAM OVERVIEW ─────────────────────────────────────────────── */
          <div className="flex flex-col xl:flex-row gap-6">
            {/* Ranking table */}
            <div className="flex-[2] bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm flex flex-col">
              <h3 className="text-[18px] font-bold text-[#111827] tracking-tight mb-6 flex items-center gap-2">
                <Medal size={18} className="text-[#d97706]" /> Ranking de Closers
              </h3>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="pb-3 font-semibold text-[10px] text-gray-400 uppercase tracking-wider">#</th>
                    <th className="pb-3 font-semibold text-[10px] text-gray-400 uppercase tracking-wider">Closer</th>
                    <th className="pb-3 font-semibold text-[10px] text-gray-400 uppercase tracking-wider text-right">Vendas</th>
                    <th className="pb-3 font-semibold text-[10px] text-gray-400 uppercase tracking-wider text-right">Volume</th>
                    <th className="pb-3 font-semibold text-[10px] text-gray-400 uppercase tracking-wider text-right">% do total</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-400">Nenhuma venda no período.</td></tr>
                  ) : ranking.map((r, idx) => (
                    <tr key={r.name} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 text-sm font-bold text-gray-400">{idx + 1}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">{getInitials(r.name)}</div>
                          <span className="text-sm font-bold text-[#111827]">{r.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-sm font-medium text-gray-500 text-right">{r.vendas}</td>
                      <td className="py-3 text-sm font-bold text-[#111827] text-right">{fmtBRL(r.total)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#d97706] rounded-full" style={{ width: `${totalVendido ? Math.round((r.total / totalVendido) * 100) : 0}%` }} />
                          </div>
                          <span className="text-[11px] font-bold text-gray-500 w-8 text-right">{totalVendido ? Math.round((r.total / totalVendido) * 100) : 0}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Donut distribution chart */}
            <div className="flex-[1] bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm flex flex-col">
              <h3 className="text-[18px] font-bold text-[#111827] tracking-tight mb-6">Distribuição por Carteira</h3>
              {ranking.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Sem dados</div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={ranking} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                        {ranking.map((_, i) => {
                          const palette = ["#d97706","#f59e0b","#fbbf24","#fcd34d","#1d1d1f","#374151","#6b7280","#9ca3af","#d1d5db"];
                          return <Cell key={i} fill={palette[i % palette.length]} />;
                        })}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtBRL(Number(v))} contentStyle={{ borderRadius: "12px", border: "1px solid #f0f0f5" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 w-full">
                    {ranking.map((r, i) => {
                      const palette = ["#d97706","#f59e0b","#fbbf24","#fcd34d","#1d1d1f","#374151","#6b7280","#9ca3af","#d1d5db"];
                      return (
                        <div key={r.name} className="flex items-center justify-between text-[12px]">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: palette[i % palette.length] }} />
                            <span className="font-medium text-gray-600 truncate max-w-[120px]">{r.name.split(" ")[0]}</span>
                          </div>
                          <span className="font-bold text-[#111827]">{totalVendido ? Math.round((r.total / totalVendido) * 100) : 0}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── INDIVIDUAL VIEW ──────────────────────────────────────────── */
          <>
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
                        <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorFixo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f3f4f6" stopOpacity={1} />
                        <stop offset="95%" stopColor="#f3f4f6" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(val) => `R$ ${val / 1000}k`} />
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
          </>
        )}

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
                    <tr><td colSpan={6} className="py-12 text-center text-sm font-bold text-gray-400">Carregando dados...</td></tr>
                  ) : paginatedGroups.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-sm font-bold text-gray-400">Nenhuma venda encontrada para o período.</td></tr>
                  ) : (
                    paginatedGroups.flatMap(group => {
                      const rep = group.sales[0];
                      const isGroup = group.sales.length > 1;
                      const expanded = expandedGroups.has(group.key);
                      const rows = [];

                      rows.push(
                        <tr key={group.key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                          <td className="py-4 text-sm font-medium text-gray-500">{fmtDateBR(rep.closedAt)}</td>
                          <td className="py-4 max-w-[200px]">
                            <div className="flex items-center gap-1.5">
                              {group.hasInadimplent && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                              <span className="text-sm font-bold text-[#111827] truncate">{rep.clientName}</span>
                              {isGroup && (
                                <button onClick={() => toggleGroup(group.key)} className="flex items-center gap-1 ml-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[10px] font-bold shrink-0 hover:bg-amber-100 transition-colors">
                                  {group.sales.length} cotas
                                  <ChevronDown size={10} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-100 flex items-center justify-center font-bold text-xs text-gray-500 shrink-0">
                                {getInitials(rep.assignedTo)}
                              </div>
                              <div className="flex flex-col leading-tight">
                                <span className="text-sm font-bold text-[#111827]">{rep.assignedTo}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">{isSdrMode ? `SDR: ${rep.sdrName || "—"}` : "Closer"}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className="px-2 py-1 bg-[#F1F3F5] text-gray-600 rounded-md text-[10px] uppercase font-bold tracking-wider inline-block">
                              {rep.administradora || "N/D"}
                            </span>
                          </td>
                          <td className="py-4 text-[15px] font-bold text-[#111827] text-right">{fmtBRL(group.totalValue)}</td>
                          <td className="py-4 text-right">
                            {isAdmin && !isGroup && (
                              <button onClick={() => openEditModal(rep)} className="text-gray-400 hover:text-[#d97706] transition-colors p-2">
                                <Pencil size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );

                      if (isGroup && expanded) {
                        group.sales.forEach((sale, i) => rows.push(
                          <tr key={sale.id} className="border-b border-gray-50 bg-gray-50/60">
                            <td className="py-2.5 pl-4 text-xs text-gray-400">↳ Cota {i + 1}</td>
                            <td className="py-2.5 text-xs text-gray-500 truncate max-w-[200px]">
                              <div className="flex items-center gap-1">
                                {inadimplentSaleIds.has(sale.id) && <AlertTriangle size={12} className="text-red-400 shrink-0" />}
                                {sale.clientName}
                              </div>
                            </td>
                            <td className="py-2.5 text-xs text-gray-400">{sale.assignedTo}</td>
                            <td className="py-2.5">
                              <span className="px-2 py-0.5 bg-[#F1F3F5] text-gray-500 rounded text-[10px] uppercase font-bold">{sale.administradora || "N/D"}</span>
                            </td>
                            <td className="py-2.5 text-sm font-bold text-gray-600 text-right">{fmtBRL(sale.value)}</td>
                            <td className="py-2.5 text-right">
                              {isAdmin && (
                                <button onClick={() => openEditModal(sale)} className="text-gray-400 hover:text-[#d97706] transition-colors p-1">
                                  <Pencil size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ));
                      }

                      return rows;
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-50 mt-auto">
              <span className="text-xs font-semibold text-gray-400">Mostrando {paginatedGroups.length} de {groupedSales.length} {groupedSales.length !== filteredSales.length ? `grupos (${filteredSales.length} vendas)` : "vendas"}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronLeft size={16} />
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#111827] text-white font-bold text-sm">{currentPage}</button>
                {currentPage < totalPages && (
                  <button onClick={() => setCurrentPage(currentPage + 1)} className="w-8 h-8 flex items-center justify-center rounded-xl text-[#111827] hover:bg-gray-50 font-bold text-sm">
                    {currentPage + 1}
                  </button>
                )}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-[#F8F9FA] rounded-3xl w-full max-w-[800px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-end p-4 pb-0">
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="px-10 pb-4">
              <h2 className="text-[22px] font-bold text-[#111827]">{editingSaleId ? "Editar venda" : "Registrar nova venda"}</h2>
            </div>
            <div className="px-10 pb-10 overflow-y-auto">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-gray-500">Cliente</label>
                  <input type="text" value={fClientName} onChange={e => setFClientName(e.target.value)} placeholder="Nome completo" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#d97706]/20 text-[#111827]" />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500">CPF</label>
                    <input type="text" value={fCpf} onChange={e => setFCpf(e.target.value)} placeholder="000.000.000-00" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#d97706]/20 text-[#111827]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500">Valor do crédito (R$)</label>
                    <input type="text" inputMode="numeric" value={fValue} onChange={e => setFValue(maskCurrency(e.target.value))} placeholder="Ex: 500.000,00" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#d97706]/20 text-[#111827]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500">Data do fechamento</label>
                    <input type="date" value={fClosedAt} onChange={e => setFClosedAt(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#d97706]/20 text-[#111827]" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500">Administradora</label>
                    <select value={fAdmin} onChange={e => setFAdmin(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#d97706]/20 text-[#111827] appearance-none">
                      <option>Porto Seguro</option>
                      <option>Embracon</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-gray-500">Tipo de produto</label>
                  <div className="flex gap-3">
                    {(["Imóvel", "Automóvel"] as const).map(tipo => (
                      <button key={tipo} type="button" onClick={() => { setFTipoProduto(tipo); setFFinalidade("Selecione"); }}
                        className={`flex-1 py-3 rounded-xl text-[13px] font-semibold border transition-all ${fTipoProduto === tipo ? "bg-[#1d1d1f] text-white border-[#1d1d1f]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                        {tipo === "Imóvel" ? "🏠 Imóvel" : "🚗 Automóvel"}
                      </button>
                    ))}
                  </div>
                </div>
                {fTipoProduto && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500">Parcelas da comissão</label>
                    <input type="number" min={1} max={120} value={fParcelasComissao} onChange={e => setFParcelasComissao(e.target.value)} placeholder={fTipoProduto === "Automóvel" ? "Ex: 1" : "Ex: 12"} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#d97706]/20 text-[#111827]" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500">SDR <span className="font-normal text-gray-400">(opcional)</span></label>
                    <select value={fSdr} onChange={e => setFSdr(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#d97706]/20 text-[#111827] appearance-none">
                      <option value="Prospecção direta (Sem SDR)">Sem SDR</option>
                      {Object.values(teamRules).filter((u: any) => u.role?.toLowerCase() === "sdr").map((u: any) => (
                        <option key={u.id} value={u.nome}>{u.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500">Closer</label>
                    <select value={isExternoCloser ? "__externo__" : fCloser}
                      onChange={e => { if (e.target.value === "__externo__") { setIsExternoCloser(true); setFCloser(""); } else { setIsExternoCloser(false); setFCloserExternoNome(""); setFCloser(e.target.value); } }}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#d97706]/20 text-[#111827] appearance-none">
                      <option value="">Selecione</option>
                      {Object.values(teamRules).filter((u: any) => u.role?.toLowerCase() === "closer").map((u: any) => (
                        <option key={u.id} value={u.nome}>{u.nome}</option>
                      ))}
                      <option value="__externo__">Closer externo</option>
                    </select>
                  </div>
                </div>
                {isExternoCloser && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-amber-700">Nome do closer externo</label>
                      <input type="text" value={fCloserExternoNome} onChange={e => setFCloserExternoNome(e.target.value)} placeholder="Ex: Maria Souza" className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-[13px] outline-none text-[#111827]" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-amber-700">Comissão do closer externo (%)</label>
                      <div className="relative">
                        <input
                          type="number" min={0} max={100} step={0.5}
                          value={fPercentualExterno}
                          onChange={e => setFPercentualExterno(e.target.value)}
                          placeholder="Ex: 2"
                          className="w-full px-4 py-3 pr-10 bg-white border border-amber-200 rounded-xl text-[13px] outline-none text-[#111827]"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-gray-400 font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-amber-600">Percentual sobre o valor do crédito pago ao closer externo</p>
                    </div>
                  </div>
                )}

                {/* ── Dados do cliente ── */}
                <div className="border-t border-gray-100 pt-4 flex flex-col gap-3">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Dados do cliente <span className="font-normal normal-case">(opcional — para análise)</span></p>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500">Cidade</label>
                      <input
                        type="text"
                        value={fCity}
                        onChange={e => setFCity(e.target.value)}
                        placeholder="Ex: São Paulo"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#d97706]/20 text-[#111827]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-gray-500">Estado</label>
                      <select
                        value={fEstado}
                        onChange={e => setFEstado(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-[#d97706]/20 text-[#111827] appearance-none"
                      >
                        <option value="Selecione">Selecione</option>
                        {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-gray-500">Estado civil</label>
                    <div className="flex gap-2 flex-wrap">
                      {(["Solteiro/a", "Casado/a", "Divorciado/a", "Viúvo/a"] as const).map(op => (
                        <button
                          key={op} type="button"
                          onClick={() => setFCivil(fCivil === op ? "Selecione" : op)}
                          className={`px-4 py-2 rounded-xl text-[12px] font-semibold border transition-all ${fCivil === op ? "bg-[#1d1d1f] text-white border-[#1d1d1f]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 border border-gray-100 cursor-pointer" onClick={() => setIsCampanha(!isCampanha)}>
                  <div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${isCampanha ? "bg-[#d97706]" : "bg-gray-200"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isCampanha ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                  <span className="text-[12px] font-bold text-[#111827]">Venda via Campanha Promocional Especial</span>
                </div>
                <div className="flex justify-end mt-4">
                  <button onClick={handleRegisterSale} disabled={isSubmitting} className="flex items-center gap-2 bg-[#d97706] hover:bg-[#b45f06] text-white px-6 py-3 rounded-xl text-[13px] font-bold shadow-md disabled:opacity-50 transition-colors">
                    <CheckCircle size={18} />
                    {isSubmitting ? "Salvando..." : editingSaleId ? "Salvar alterações" : "Confirmar venda"}
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
