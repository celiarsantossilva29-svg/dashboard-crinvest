"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  Search, Plus, X, Pencil, CheckCircle, Check, Ban,
  ChevronRight, ChevronDown, AlertTriangle, Loader2, Upload,
  Calendar, TrendingUp, Printer, Clock, Database,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

// ─── Utils ────────────────────────────────────────────────────────────────────

function maskCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const padded = digits.padStart(3, "0");
  const intPart = padded.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  const decPart = padded.slice(-2);
  return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decPart}`;
}

function parseBRL(val: string | number) {
  const str = String(val).trim();
  if (str.includes(",") && str.includes("."))
    return Number(str.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", "."));
  if (str.includes(",")) return Number(str.replace(/[^\d,]/g, "").replace(",", "."));
  return Number(str.replace(/[^\d.]/g, ""));
}

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

function rangeLabel(start: string, end: string) {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  if (sy === ey && sm === em) {
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(Date.UTC(sy, sm - 1, 15)));
  }
  return `${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${start}T12:00:00Z`))} até ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${end}T12:00:00Z`))}`;
}

function parsePortoCSV(text: string): string[] {
  const cpfs: string[] = [];
  for (const line of text.trim().split("\n")) {
    const cols = line.includes("\t") ? line.split("\t") : line.split(";");
    if (cols.length < 3) continue;
    const cpf = cols[2].trim().replace(/\D/g, "");
    if (cpf.length >= 11) cpfs.push(cpf);
  }
  return Array.from(new Set(cpfs));
}

// ─── Comissão helpers ─────────────────────────────────────────────────────────
const PORTO_ROYALTIES  = 0.084;
const PORTO_IMPOSTOS   = 0.069;
const EMBRACON_IMPOSTOS = 0.07;

function getDeductions(adm: string | null) {
  if ((adm || "").toLowerCase().includes("embracon"))
    return { royalties: 0, impostos: EMBRACON_IMPOSTOS };
  return { royalties: PORTO_ROYALTIES, impostos: PORTO_IMPOSTOS };
}

function getNetFactor(adm: string | null): number {
  const { royalties, impostos } = getDeductions(adm);
  return 1 - royalties - impostos;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Installment {
  id: string;
  parcelaNumero: number;
  pago: boolean;
  status?: string;
  valorParcela: number;
  dataVencimento: string;
  dataPagamento?: string | null;
}

interface Sale {
  id: string;
  clientName: string;
  assignedTo: string;
  sdrName?: string | null;
  value: number;
  closedAt: string;
  administradora: string | null;
  produto?: string | null;
  clienteCpf?: string | null;
  notes?: string | null;
  origem?: string | null;
  closerExterno?: string | null;
  percentualExterno?: number | null;
  installments?: Installment[];
}

interface SaleGroup {
  key: string;
  clientName: string;
  assignedTo: string;
  sdrName?: string | null;
  administradora: string | null;
  produto: string;
  clienteCpf?: string | null;
  closedAt: string;
  totalValue: number;
  sales: Sale[];
}

// ─── InstEditPanel ────────────────────────────────────────────────────────────

function InstEditPanel({ insts, selectedInstId, confirmingId, onStatus, onSkip, onClose }: {
  insts: Installment[];
  selectedInstId: string | null;
  confirmingId: string | null;
  onStatus: (id: string, st: string) => void;
  onSkip: (id: string) => void;
  onClose: () => void;
}) {
  const selInst = selectedInstId ? insts.find(i => i.id === selectedInstId) : null;
  if (!selInst) {
    if (!selectedInstId) {
      return <p className="text-[10px] text-gray-400 mb-2">Clique em uma parcela para alterar o status</p>;
    }
    return null;
  }
  const selSt = selInst.status || (selInst.pago ? "PAGO" : "PENDENTE");
  return (
    <div className="mb-3 p-3 bg-white border border-gray-200 rounded-xl flex items-center gap-3 flex-wrap">
      <div>
        <p className="text-[11px] font-black text-[#111827]">P{selInst.parcelaNumero} · {fmtDateBR(selInst.dataVencimento)}</p>
        <p className="text-[10px] text-gray-400">Status atual: {selSt}</p>
      </div>
      <div className="flex items-center gap-1.5 ml-auto flex-wrap">
        <button disabled={confirmingId === selInst.id} onClick={() => onStatus(selInst.id, "PAGO")}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50 transition-colors">Pago</button>
        <button disabled={confirmingId === selInst.id} onClick={() => onStatus(selInst.id, "PENDENTE")}
          className="bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50 transition-colors">Pendente</button>
        <button disabled={confirmingId === selInst.id} onClick={() => onStatus(selInst.id, "INADIMPLENTE")}
          className="bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50 transition-colors">Inadimplente</button>
        <button disabled={confirmingId === selInst.id} onClick={() => onStatus(selInst.id, "CANCELADO")}
          className="bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50 transition-colors">Cancelar</button>
        {selSt !== "PAGO" && selSt !== "CANCELADO" && (
          <button disabled={confirmingId === selInst.id} onClick={() => onSkip(selInst.id)}
            className="bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50 transition-colors">Pular mês</button>
        )}
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={13} /></button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export default function VendasPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === "admin";

  // ── Date range selector ─────────────────────────────────────────────────────
  const [startDate, setStartDate] = useLocalStorage("filter:vendas:start", (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })());
  const [endDate, setEndDate] = useLocalStorage("filter:vendas:end", (() => {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth() + 1;
    return `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  })());

  // ── Data ────────────────────────────────────────────────────────────────────
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamRules, setTeamRules] = useState<Record<string, any>>({});
  // confirmedAmounts: "YYYY_MM" → net amount received (from PDF via AppSetting)
  const [confirmedAmounts, setConfirmedAmounts] = useState<Record<string, number>>({});
  // dados brutos da API (incluem todos os contratos)
  const [projecaoPortoRaw, setProjecaoPortoRaw] = useState<Record<string, number>>({});
  const [detalhesPortoRaw, setDetalhesPortoRaw] = useState<Record<string, any[]>>({});
  // modal de detalhe do mês
  const [mesModal, setMesModal] = useState<string | null>(null);

  // ── Tabs ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"comissoes" | "pagamento">("comissoes");
  const [assocMes, setAssocMes] = useState(() => new Date().toISOString().substring(0, 7));
  const [assocData, setAssocData] = useState<any>(null);
  const [assocLoading, setAssocLoading] = useState(false);
  const [assocExpanded, setAssocExpanded] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const [salesRes, teamRes, settingsRes, projecaoRes] = await Promise.all([
        fetch("/api/sales?start=2020-01-01&end=2030-01-01"),
        fetch("/api/vendedores"),
        fetch("/api/app-settings?prefix=confirmed_"),
        fetch("/api/projecao-porto"),
      ]);
      const [salesJson, teamJson, settingsJson, projecaoJson] = await Promise.all([
        salesRes.json(), teamRes.json(), settingsRes.json(), projecaoRes.json(),
      ]);
      setSales(salesJson.data || []);
      const rules: Record<string, any> = {};
      (teamJson.data || []).forEach((v: any) => { rules[v.nome] = v; });
      setTeamRules(rules);
      setConfirmedAmounts(settingsJson.data || {});
      setProjecaoPortoRaw(projecaoJson.totais || projecaoJson.data || {});
      setDetalhesPortoRaw(projecaoJson.detalhes || {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [closerFilter, setCloserFilter] = useState("Todos");
  const [sdrFilter, setSdrFilter] = useState("Todos");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [selectedInstId, setSelectedInstId] = useState<string | null>(null);
  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [alertsCollapsed, setAlertsCollapsed] = useState(false);
  const [pendentesExpanded, setPendentesExpanded] = useState(false);
  const [pendentesSearch, setPendentesSearch] = useState("");

  // ── Porto confirm ───────────────────────────────────────────────────────────
  const [portoOpen, setPortoOpen] = useState(false);
  const [portoLinhas, setPortoLinhas] = useState("");
  const [portoPreview, setPortoPreview] = useState<{ apolice: string; valor: number; nome: string; nova: boolean }[] | null>(null);
  const [portoPreviewLoading, setPortoPreviewLoading] = useState(false);
  const [portoSaveLoading, setPortoSaveLoading] = useState(false);
  const [portoResult, setPortoResult] = useState<{ processadas: number; novas: number } | null>(null);
  const [portoError, setPortoError] = useState("");

  const [portoReconcileCount, setPortoReconcileCount] = useState<number | null>(null);

  // ── Modal ───────────────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCampanha, setIsCampanha] = useState(false);
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

  const resetForm = () => {
    setEditingSaleId(null); setFClientName(""); setFCity(""); setFEstado("Selecione");
    setFGender("Selecione"); setFCivil("Selecione"); setFCpf(""); setFValue("");
    setFClosedAt(""); setFAdmin("Porto Seguro"); setFSdr("Prospecção direta (Sem SDR)");
    setFCloser(""); setIsCampanha(false); setFTipoProduto(""); setFFinalidade("Selecione");
    setFParcelasComissao(""); setFOrigem("Selecione"); setIsExternoCloser(false);
    setFCloserExternoNome(""); setFPercentualExterno("");
  };

  const openNewModal = () => { resetForm(); setIsModalOpen(true); };

  const openEditModal = (sale: Sale) => {
    resetForm();
    setEditingSaleId(sale.id);
    setFClientName(sale.clientName);
    setFValue(maskCurrency(Math.round(sale.value * 100).toString()));
    setFClosedAt(new Date(sale.closedAt).toISOString().split("T")[0]);
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
    if (editingSaleId && !isAdmin) { alert("Apenas administradores podem alterar vendas."); return; }
    const closerValido = isExternoCloser ? fCloserExternoNome.trim() !== "" : (fCloser !== "" && fCloser !== "Selecione o Closer");
    if (!fClientName || !fValue || !fClosedAt || !closerValido) {
      alert("Preencha todos os campos obrigatórios (Cliente, Valor, Data e Closer)."); return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/sales", {
        method: editingSaleId ? "PUT" : "POST",
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
        }),
      });
      if (res.ok) { setIsModalOpen(false); resetForm(); fetchSales(); }
      else { const e = await res.json(); alert("Erro: " + e.error); }
    } finally { setIsSubmitting(false); }
  };

  // ── Installment actions ─────────────────────────────────────────────────────
  const handleInstStatus = async (id: string, status: string) => {
    setConfirmingId(id);
    try {
      await fetch("/api/validations/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installmentId: id, status }),
      });
      fetchSales();
    } finally { setConfirmingId(null); }
  };

  const handleSkipMonth = async (id: string) => {
    setConfirmingId(id);
    try {
      await fetch("/api/installments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "skip-month" }),
      });
      fetchSales();
    } finally { setConfirmingId(null); }
  };

  // ── Pagamento a Associados ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "pagamento") return;
    setAssocLoading(true);
    fetch(`/api/comissoes/pagamento-associados?mes=${assocMes}`)
      .then(r => r.json())
      .then(d => setAssocData(d))
      .catch(console.error)
      .finally(() => setAssocLoading(false));
  }, [activeTab, assocMes]);

  // ── Month range (for bulk confirm / KPIs) ───────────────────────────────────
  const monthStart = new Date(`${startDate}T00:00:00.000Z`);
  const monthEnd   = new Date(`${endDate}T23:59:59.999Z`);

  // ── Groups ──────────────────────────────────────────────────────────────────
  const allGroups = useMemo(() => {
    const map = new Map<string, SaleGroup>();
    for (const sale of sales) {
      const insts = sale.installments || [];
      if (insts.length > 0 && insts.every(i => i.status === "CANCELADO")) continue;
      const saleDate = sale.closedAt?.split("T")[0] ?? "";

      const dateKey = saleDate || "unknown";
      const produto  = (sale as any).produto ?? "outro";
      const clientKey = sale.clienteCpf?.replace(/\D/g, "") ?? (sale.clientName || "").toLowerCase().trim();
      const key = `${clientKey}|${dateKey}|${produto}`;
      if (!map.has(key)) {
        map.set(key, {
          key, clientName: sale.clientName, assignedTo: sale.assignedTo,
          sdrName: sale.sdrName, administradora: sale.administradora,
          produto, clienteCpf: sale.clienteCpf, closedAt: sale.closedAt,
          totalValue: 0, sales: [],
        });
      }
      const g = map.get(key)!;
      g.totalValue += sale.value;
      g.sales.push(sale);
    }
    return Array.from(map.values());
  }, [sales]);

  const filteredGroups = useMemo(() => {
    let result = allGroups.filter(g => {
      const insts = g.sales.flatMap(s => s.installments || []);
      const hasActive = insts.some(i => !i.pago && i.status !== "CANCELADO" && i.status !== "PAGO" && i.status !== "INADIMPLENTE");
      const hasInadimplente = insts.some(i => i.status === "INADIMPLENTE");
      return hasActive || hasInadimplente;
    });
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(g =>
        g.clientName.toLowerCase().includes(q) ||
        g.assignedTo.toLowerCase().includes(q) ||
        (g.clienteCpf || "").includes(q)
      );
    }
    if (closerFilter !== "Todos") {
      result = result.filter(g => g.assignedTo === closerFilter);
    }
    if (sdrFilter !== "Todos") {
      result = result.filter(g => (g.sdrName || "Prospecção direta (Sem SDR)") === sdrFilter);
    }
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return [...result].sort((a, b) => {
      const priority = (g: SaleGroup) => {
        const insts = g.sales.flatMap(s => s.installments || []);
        if (insts.some(i => i.status === "INADIMPLENTE")) return 0;
        if (insts.some(i => !i.pago && i.status === "PENDENTE" && new Date(i.dataVencimento) < hoje)) return 1;
        return 2;
      };
      return priority(a) - priority(b);
    });
  }, [allGroups, search, closerFilter, sdrFilter]);

  // IDs e CPFs de vendas canceladas (pagas parcialmente + resto cancelado)
  const cancelledSaleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of sales) {
      const insts = s.installments || [];
      if (insts.length === 0) continue;
      const canceladas = insts.filter(i => i.status === "CANCELADO").length;
      const pendentes  = insts.filter(i => i.status === "PENDENTE" && !i.pago).length;
      if (canceladas > 0 && pendentes === 0) ids.add(s.id);
    }
    return ids;
  }, [sales]);

  // Nomes normalizados de clientes com todas as vendas canceladas (para filtrar projeção Porto)
  const cancelledNames = useMemo(() => {
    const names = new Set<string>();
    for (const s of sales) {
      if (!cancelledSaleIds.has(s.id)) continue;
      // Só exclui da projeção se TODAS as vendas desse cliente estão canceladas
      const clientSales = sales.filter(x => x.clientName === s.clientName);
      const allCancelled = clientSales.every(x => cancelledSaleIds.has(x.id));
      if (allCancelled) names.add(s.clientName.toUpperCase().trim());
    }
    return names;
  }, [sales, cancelledSaleIds]);

  // Projeção Porto filtrada — remove contratos de clientes cancelados
  const projecaoPorto = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [mes, contratos] of Object.entries(detalhesPortoRaw)) {
      const ativos = (contratos as any[]).filter(c => !cancelledNames.has((c.nome || "").toUpperCase().trim()));
      if (ativos.length > 0) result[mes] = ativos.reduce((s: number, c: any) => s + c.commMensal, 0);
    }
    return result;
  }, [detalhesPortoRaw, cancelledNames]);

  const detalhesPorto = useMemo(() => {
    const result: Record<string, any[]> = {};
    for (const [mes, contratos] of Object.entries(detalhesPortoRaw)) {
      const ativos = (contratos as any[]).filter(c => !cancelledNames.has((c.nome || "").toUpperCase().trim()));
      if (ativos.length > 0) result[mes] = ativos;
    }
    return result;
  }, [detalhesPortoRaw, cancelledNames]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let carteiraAtiva = 0, qtContratos = 0;
    let comissaoPrevistaMes = 0, qtParcMes = 0;
    let emRisco = 0;
    let recebidoEmbracon = 0, qtPagas = 0;
    let comissaoTotal = 0, qtPendentes = 0;
    let totalVendido = 0, qtVendas = 0;
    let portoBruto = 0, portoRoyalties = 0, portoImpostos = 0;
    let embraconBruto = 0, embraconImpostos = 0;

    const startMesKey = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;
    const endMesKey   = `${monthEnd.getUTCFullYear()}-${String(monthEnd.getUTCMonth() + 1).padStart(2, "0")}`;

    for (const s of sales) {
      if (s.closedAt && new Date(s.closedAt).getUTCFullYear() < 2025) continue;
      if (cancelledSaleIds.has(s.id)) continue;
      const insts = s.installments || [];
      const allCancelled = insts.length > 0 && insts.every(i => i.status === "CANCELADO");
      if (allCancelled) continue;

      const brutoPerInst = (s.value * 0.04) / Math.max(1, insts.length);
      const { royalties: rRate, impostos: iRate } = getDeductions(s.administradora);
      const commPerInst = brutoPerInst * (1 - rRate - iRate);
      const isEmbracon = (s.administradora || "").toLowerCase().includes("embracon");

      const saleDate = s.closedAt?.split("T")[0] ?? "";
      const inSelectedMonth = saleDate >= startDate && saleDate <= endDate;
      if (inSelectedMonth) { totalVendido += s.value; qtVendas++; }

      const hasActivePending = insts.some(i => !i.pago && i.status !== "CANCELADO" && i.status !== "PAGO");
      if (inSelectedMonth && hasActivePending) { carteiraAtiva += s.value; qtContratos++; }

      for (const i of insts) {
        if (i.status === "CANCELADO") continue;
        const venc = new Date(i.dataVencimento);
        const inPeriod = venc >= monthStart && venc <= monthEnd;

        // Em risco: all-time
        if (i.status === "INADIMPLENTE") emRisco += commPerInst;
        else if (i.status === "PENDENTE") qtPendentes++;

        // Comissão total: apenas meses futuros (após o período selecionado)
        if (venc > monthEnd && i.status !== "CANCELADO" && !(i.pago || i.status === "PAGO")) {
          comissaoTotal += commPerInst;
        }

        if (inPeriod) {
          if (isEmbracon) {
            embraconBruto    += brutoPerInst;
            embraconImpostos += brutoPerInst * iRate;
            if (i.status === "PENDENTE") { comissaoPrevistaMes += commPerInst; qtParcMes++; }
            if (i.pago || i.status === "PAGO") { recebidoEmbracon += commPerInst; qtPagas++; }
          } else {
            portoBruto     += brutoPerInst;
            portoRoyalties += brutoPerInst * rRate;
            portoImpostos  += brutoPerInst * iRate;
          }
        }
      }
    }

    // Porto: prevista = projeção; recebido = depósitos confirmados via relatório mensal
    for (const [key, val] of Object.entries(projecaoPorto)) {
      if (key >= startMesKey && key <= endMesKey) comissaoPrevistaMes += val;
    }
    let recebidoPorto = 0;
    for (const [key, val] of Object.entries(confirmedAmounts)) {
      // chave pode ser "YYYY_MM" ou "YYYY-MM"
      const normalized = key.replace("_", "-");
      if (normalized >= startMesKey && normalized <= endMesKey) recebidoPorto += val;
    }

    const recebido = recebidoPorto + recebidoEmbracon;
    const faltante = comissaoPrevistaMes - recebido;

    const breakdown = {
      porto:    { bruto: portoBruto,    royalties: portoRoyalties, impostos: portoImpostos,    liquido: portoBruto    - portoRoyalties - portoImpostos },
      embracon: { bruto: embraconBruto, royalties: 0,              impostos: embraconImpostos, liquido: embraconBruto - embraconImpostos },
    };
    return { carteiraAtiva, qtContratos, comissaoPrevistaMes, qtParcMes, emRisco, recebido, qtPagas, comissaoTotal, faltante, qtPendentes, breakdown, totalVendido, qtVendas };
  }, [sales, startDate, endDate, projecaoPorto, confirmedAmounts]); // eslint-disable-line

  // ── Bulk confirm preview ────────────────────────────────────────────────────
  const bulkPreview = useMemo(() => {
    let toConfirm = 0, skipped = 0;
    for (const s of sales) {
      if (s.closedAt && new Date(s.closedAt).getUTCFullYear() < 2025) continue;
      if (cancelledSaleIds.has(s.id)) continue;
      const insts = s.installments || [];
      // Ignora vendas completamente canceladas (registros legados/inativos)
      if (insts.length > 0 && insts.every(i => i.status === "CANCELADO")) continue;
      for (const i of insts) {
        const venc = new Date(i.dataVencimento);
        if (venc >= monthStart && venc <= monthEnd) {
          if (!i.pago && i.status === "PENDENTE") toConfirm++;
          else if (i.status === "INADIMPLENTE") skipped++;
        }
      }
    }
    return { toConfirm, skipped };
  }, [sales, startDate, endDate]); // eslint-disable-line

  // ── Pendentes list for the month ────────────────────────────────────────────
  const pendentesDoMes = useMemo(() => {
    const result: { sale: Sale; inst: Installment; commPerInst: number }[] = [];
    for (const s of sales) {
      if (s.closedAt && new Date(s.closedAt).getUTCFullYear() < 2025) continue;
      if (cancelledSaleIds.has(s.id)) continue;
      const insts = s.installments || [];
      // Oculta vendas encerradas: 100% canceladas OU 100% pagas (ciclo concluído)
      if (insts.length > 0 && insts.every(i => i.status === "CANCELADO")) continue;
      if (insts.length > 0 && insts.every(i => i.pago || i.status === "PAGO")) continue;
      const commPerInst = (s.value * 0.04) / Math.max(1, insts.length) * getNetFactor(s.administradora);
      for (const i of insts) {
        const venc = new Date(i.dataVencimento);
        if (venc >= monthStart && venc <= monthEnd && !i.pago && i.status === "PENDENTE") {
          result.push({ sale: s, inst: i, commPerInst });
        }
      }
    }
    return result.sort((a, b) => new Date(a.inst.dataVencimento).getTime() - new Date(b.inst.dataVencimento).getTime());
  }, [sales, startDate, endDate]); // eslint-disable-line

  const handleBulkConfirm = async () => {
    setIsConfirming(true);
    try {
      const res = await fetch("/api/installments/bulk-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      if (res.ok) { setBulkPreviewOpen(false); fetchSales(); }
    } finally { setIsConfirming(false); }
  };

  // ── Alerts (only problems) ──────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const result: {
      saleId: string; clientName: string; assignedTo: string; sdrName?: string | null;
      type: "inadimplente" | "atrasado";
      inst: Installment; sale: Sale; commPerInst: number; diffDays: number;
    }[] = [];

    for (const s of sales) {
      // Só alertar sobre vendas a partir de 2025 — dados de 2023/2024 são legado sem acompanhamento
      if (s.closedAt && new Date(s.closedAt).getUTCFullYear() < 2025) continue;
      if (cancelledSaleIds.has(s.id)) continue;
      const insts = s.installments || [];
      const allCancelled = insts.length > 0 && insts.every(i => i.status === "CANCELADO");
      if (allCancelled) continue;
      const commPerInst = (s.value * 0.04) / Math.max(1, insts.length) * getNetFactor(s.administradora);

      for (const inst of insts) {
        if (inst.status === "CANCELADO") continue;
        const venc = new Date(inst.dataVencimento); venc.setUTCHours(0, 0, 0, 0);
        const diffDays = Math.floor((venc.getTime() - hoje.getTime()) / 86400000);
        if (inst.status === "INADIMPLENTE") {
          result.push({ saleId: s.id, clientName: s.clientName, assignedTo: s.assignedTo, sdrName: s.sdrName, type: "inadimplente", inst, sale: s, commPerInst, diffDays });
        } else if (!inst.pago && inst.status === "PENDENTE" && diffDays < 0) {
          result.push({ saleId: s.id, clientName: s.clientName, assignedTo: s.assignedTo, sdrName: s.sdrName, type: "atrasado", inst, sale: s, commPerInst, diffDays });
        }
      }
    }
    return result.sort((a, b) => a.diffDays - b.diffDays);
  }, [sales]);

  // ── Chart Data ──────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const monthsData: Record<string, { month: string, Recebido: number, Pendente: number, Confirmado: number, Inadimplente: number, Projecao: number, sortKey: string }> = {};

    // Seed meses com projeção Porto (fonte correta: contratos-porto.txt)
    for (const [key, val] of Object.entries(projecaoPorto)) {
      const date = new Date(Date.UTC(parseInt(key.split("-")[0]), parseInt(key.split("-")[1]) - 1, 1));
      const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date).replace(". de ", "/").replace(" de ", "/").toUpperCase();
      monthsData[key] = { month: monthName, Recebido: 0, Pendente: 0, Confirmado: 0, Inadimplente: 0, Projecao: val, sortKey: key };
    }

    for (const s of sales) {
      if (cancelledSaleIds.has(s.id)) continue;
      const insts = s.installments || [];
      if (insts.length > 0 && insts.every(i => i.status === "CANCELADO")) continue;
      const commPerInst = (s.value * 0.04) / Math.max(1, insts.length) * getNetFactor(s.administradora);

      for (const i of insts) {
        if (i.status === "CANCELADO") continue;

        const date = new Date(i.dataVencimento);
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, "0");
        const key = `${y}-${m}`;

        if (!monthsData[key]) {
          const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date).replace(". de ", "/").replace(" de ", "/").toUpperCase();
          monthsData[key] = { month: monthName, Recebido: 0, Pendente: 0, Confirmado: 0, Inadimplente: 0, Projecao: 0, sortKey: key };
        }

        if (i.status === "INADIMPLENTE") monthsData[key].Inadimplente += commPerInst;
        else if (i.pago || i.status === "PAGO") monthsData[key].Recebido += commPerInst;
        else if (i.status === "PENDENTE") monthsData[key].Pendente += commPerInst;
        // Porto: projeção vem do contratos-porto.txt (mais preciso). Embracon: sempre usa o banco.
        const isEmbracon = (s.administradora || "").toLowerCase().includes("embracon");
        if (isEmbracon || !projecaoPorto[key]) monthsData[key].Projecao += commPerInst;
      }
    }

    // Overlay confirmed PDF amounts: replace calculated values with actual deposit
    for (const [settingKey, amount] of Object.entries(confirmedAmounts)) {
      const [y, m] = settingKey.split("_");
      const chartKey = `${y}-${m}`;
      if (!monthsData[chartKey]) {
        const date = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, 1));
        const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date).replace(". de ", "/").replace(" de ", "/").toUpperCase();
        monthsData[chartKey] = { month: monthName, Recebido: 0, Pendente: 0, Confirmado: 0, Inadimplente: 0, Projecao: 0, sortKey: chartKey };
      }
      monthsData[chartKey].Confirmado = amount;
      // Projecao mantida: mostra o que era esperado vs o que o PDF confirmou
      monthsData[chartKey].Recebido = 0;
      monthsData[chartKey].Pendente = 0;
      monthsData[chartKey].Inadimplente = 0;
    }

    // Janela: últimos 12 meses até dez do ano corrente
    const now = new Date();
    const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
    const windowEnd   = new Date(Date.UTC(now.getUTCFullYear(), 11, 31)); // dez do ano atual
    const startKey = `${windowStart.getUTCFullYear()}-${String(windowStart.getUTCMonth() + 1).padStart(2, "0")}`;
    const endKey   = `${windowEnd.getUTCFullYear()}-12`;

    const nowKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    return Object.values(monthsData)
      .filter(d => d.sortKey >= startKey && d.sortKey <= endKey)
      .map(d => {
        const proj = projecaoPorto[d.sortKey] || d.Projecao || 0;
        if (d.sortKey > nowKey) {
          // Meses futuros: barra inteira = projeção (tudo cinza "a receber")
          return { ...d, Recebido: 0, Pendente: proj, Confirmado: 0, Inadimplente: 0 };
        }
        if (d.sortKey === nowKey) {
          // Mês atual: confirmado/recebido já entrou, resto da projeção = cinza
          const jaEntrou = d.Confirmado + d.Recebido + d.Inadimplente;
          return { ...d, Pendente: Math.max(0, proj - jaEntrou) };
        }
        return d;
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [sales, confirmedAmounts, projecaoPorto]);

  // ── Dots helper ─────────────────────────────────────────────────────────────
  const instDots = (insts: Installment[]) =>
    insts.map(i => {
      const st = i.status || (i.pago ? "PAGO" : "PENDENTE");
      const color = st === "PAGO" ? "bg-emerald-500" : st === "INADIMPLENTE" ? "bg-red-500" : st === "CANCELADO" ? "bg-gray-300" : "bg-gray-200";
      return <div key={i.id} title={`P${i.parcelaNumero}: ${st}`} className={`w-2.5 h-2.5 rounded-full ${color}`} />;
    });

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] flex flex-col font-sans">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-[#F8F9FA] border-b border-gray-100">
        <div>
          <h1 className="text-[22px] font-black tracking-tight text-[#111827]">Carteira de Comissões</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">contratos ativos · parcelas do mês</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date range selector */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="text-[13px] font-bold text-[#111827] bg-transparent border-none outline-none cursor-pointer" />
            <span className="text-[12px] text-gray-400 font-medium">até</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="text-[13px] font-bold text-[#111827] bg-transparent border-none outline-none cursor-pointer" />
          </div>
          <button
            onClick={() => { setPortoOpen(true); setPortoResult(null); setPortoPreview(null); setPortoError(""); setPortoLinhas(""); setPortoReconcileCount(null); }}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 px-3 py-2 rounded-xl text-[13px] font-bold shadow-sm transition-colors"
          >
            <Upload size={14} />
            Relatório Porto
          </button>
          <button onClick={openNewModal} className="flex items-center gap-2 bg-[#1d1d1f] hover:bg-black text-white px-4 py-2 rounded-xl text-[13px] font-bold shadow-sm transition-colors">
            <Plus size={15} /> Registrar venda
          </button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="border-b border-gray-100 bg-[#F8F9FA]">
        <div className="flex px-8 max-w-[1400px] mx-auto">
          {([
            { id: "comissoes", label: "Comissões" },
            { id: "pagamento", label: "Pagamento a Associados" },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-[13px] font-bold border-b-2 transition-colors -mb-px ${activeTab === tab.id ? "border-[#111827] text-[#111827]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 px-8 py-6 max-w-[1400px] w-full mx-auto flex flex-col gap-5">

        {activeTab === "comissoes" && <>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm col-span-2 md:col-span-1">
            <Calendar size={15} className="text-gray-300 mb-2" />
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 capitalize">{rangeLabel(startDate, endDate)}</p>
            <p className="text-[20px] font-black text-[#111827] leading-none">{fmtBRL(kpis.totalVendido)}</p>
            <p className="text-[11px] text-gray-400 mt-1">{kpis.qtVendas} venda{kpis.qtVendas !== 1 ? "s" : ""} fechadas</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <TrendingUp size={15} className="text-gray-300 mb-2" />
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Comissão prevista</p>
            <p className="text-[20px] font-black text-emerald-600 leading-none">{fmtBRL(kpis.comissaoPrevistaMes)}</p>
            <p className="text-[11px] text-gray-400 mt-1">{kpis.qtParcMes} parcelas no período</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <Printer size={15} className="text-gray-300 mb-2" />
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Recebido</p>
            <p className="text-[20px] font-black text-emerald-600 leading-none">{fmtBRL(kpis.recebido)}</p>
            <p className="text-[11px] text-gray-400 mt-1">{kpis.qtPagas} parcelas pagas</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <Clock size={15} className="text-gray-300 mb-2" />
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Falta receber</p>
            <p className="text-[20px] font-black text-amber-600 leading-none">{fmtBRL(kpis.faltante)}</p>
            <p className="text-[11px] text-gray-400 mt-1">{kpis.qtPendentes} parcelas pendentes</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <AlertTriangle size={15} className="text-gray-300 mb-2" />
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Em risco</p>
            <p className={`text-[20px] font-black leading-none ${kpis.emRisco > 0 ? "text-red-600" : "text-gray-400"}`}>{fmtBRL(kpis.emRisco)}</p>
            <p className="text-[11px] text-gray-400 mt-1">{alerts.filter(a => a.type === "inadimplente").length} inadimplentes</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <Database size={15} className="text-gray-300 mb-2" />
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Comissão total</p>
            <p className="text-[20px] font-black text-[#111827] leading-none">{fmtBRL(kpis.comissaoTotal)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Repasse líquido (~3,4%)</p>
          </div>
        </div>

        {/* ── Breakdown compacto ── */}
        {(() => {
          const mesKey = startDate.substring(0, 7).replace("-", "_");
          const confirmedLiquido = confirmedAmounts[mesKey] ?? 0;
          const portoBruto = confirmedLiquido > 0 ? confirmedLiquido / (1 - 0.084 - 0.069) : kpis.breakdown.porto.bruto;
          const portoLiquido = confirmedLiquido > 0 ? confirmedLiquido : kpis.breakdown.porto.liquido;
          const e = kpis.breakdown.embracon;
          const showPorto = portoBruto > 0;
          const showEmbracon = e.bruto > 0;
          if (!showPorto && !showEmbracon) return null;
          return (
            <div className="flex items-center gap-5 flex-wrap text-[12px] text-gray-500 px-1 -mt-1">
              {showPorto && (
                <span className="flex items-center gap-2">
                  <span className="font-bold text-gray-400 text-[10px] uppercase tracking-wide">Porto</span>
                  <span className="text-gray-600">{fmtBRL(portoBruto)}</span>
                  <span className="text-gray-300">›</span>
                  <span className="text-red-400">−{fmtBRL(portoBruto * 0.084 + portoBruto * 0.069)}</span>
                  <span className="text-gray-300">›</span>
                  <span className="font-bold text-emerald-600">{fmtBRL(portoLiquido)}</span>
                  {confirmedLiquido > 0 && <span className="text-[10px] text-emerald-500">(confirmado)</span>}
                </span>
              )}
              {showPorto && showEmbracon && <span className="text-gray-200">·</span>}
              {showEmbracon && (
                <span className="flex items-center gap-2">
                  <span className="font-bold text-gray-400 text-[10px] uppercase tracking-wide">Embracon</span>
                  <span className="text-gray-600">{fmtBRL(e.bruto)}</span>
                  <span className="text-gray-300">›</span>
                  <span className="text-red-400">−{fmtBRL(e.impostos)}</span>
                  <span className="text-gray-300">›</span>
                  <span className="font-bold text-emerald-600">{fmtBRL(e.liquido)}</span>
                </span>
              )}
            </div>
          );
        })()}

        {/* ── Chart ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[14px] font-bold text-[#111827]">Projeção de Comissões</p>
            <span className="text-[10px] text-gray-400 font-medium">
              Barras = histórico recebido/confirmado · Linha pontilhada = o que os contratos devem gerar
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mb-3">Clique em um mês para ver os contratos</p>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
                  tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: '#f0fdf4', cursor: 'pointer' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(val: unknown, name: unknown) => [fmtBRL(Number(val ?? 0)), String(name)]}
                  labelStyle={{ color: '#9ca3af', marginBottom: '8px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', paddingTop: '10px' }} />
                <Bar dataKey="Confirmado"   stackId="a" fill="#059669" radius={[0, 0, 4, 4]} name="Depósito confirmado" cursor="pointer" onClick={(d: any) => setMesModal(d.sortKey)} />
                <Bar dataKey="Recebido"     stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name="Recebido"            cursor="pointer" onClick={(d: any) => setMesModal(d.sortKey)} />
                <Bar dataKey="Pendente"     stackId="a" fill="#d1d5db" radius={[0, 0, 0, 0]} name="A receber"           cursor="pointer" onClick={(d: any) => setMesModal(d.sortKey)} />
                <Bar dataKey="Inadimplente" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name="Não pago"            cursor="pointer" onClick={(d: any) => setMesModal(d.sortKey)} />
                <Line dataKey="Projecao" type="monotone" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Meta esperada" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Bulk confirm bar ── */}
        <div className="flex items-center justify-between px-1 -mt-1">
          <p className="text-[12px] text-gray-400">
            <span className="capitalize font-medium text-gray-500">{rangeLabel(startDate, endDate)}</span>
            {" · "}
            {bulkPreview.toConfirm > 0
              ? <><span className="font-bold text-gray-600">{bulkPreview.toConfirm}</span> parcelas pendentes</>
              : <span className="text-emerald-600 font-medium">Todas confirmadas ✓</span>
            }
            {bulkPreview.skipped > 0 && <span className="text-amber-500"> · {bulkPreview.skipped} puladas</span>}
          </p>
          <div className="flex items-center gap-2">
            {bulkPreview.toConfirm > 0 && (
              <button
                onClick={() => setPendentesExpanded(p => !p)}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                Ver lista <ChevronDown size={12} className={`transition-transform ${pendentesExpanded ? "rotate-180" : ""}`} />
              </button>
            )}
            {bulkPreview.toConfirm > 0 && (
              <button
                onClick={() => setBulkPreviewOpen(true)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
              >
                <Check size={11} strokeWidth={3} /> Confirmar {bulkPreview.toConfirm}
              </button>
            )}
          </div>
        </div>

        {/* Expandable pendentes list */}
        {pendentesExpanded && pendentesDoMes.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden -mt-2">
            <div className="px-5 py-3 bg-gray-50/60 border-b border-gray-100 flex items-center gap-3">
              <div className="relative flex-1 max-w-[280px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={pendentesSearch}
                  onChange={(e) => setPendentesSearch(e.target.value)}
                  placeholder="Filtrar por nome ou CPF..."
                  className="block w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[12px] text-[#111827] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"3fr 1fr 1fr 1fr 160px", gap:"1rem" }} className="px-5 py-2 bg-gray-50/60 border-b border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Cliente</span>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Parcela</span>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Vencimento</span>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Comissão</span>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider text-right">Ação</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-[350px] overflow-y-auto">
              {pendentesDoMes
                .filter(p => {
                  if (!pendentesSearch) return true;
                  const q = pendentesSearch.toLowerCase();
                  return p.sale.clientName.toLowerCase().includes(q) || (p.sale.clienteCpf || "").includes(q);
                })
                .map(({ sale, inst, commPerInst }) => (
                <div key={inst.id} style={{ display:"grid", gridTemplateColumns:"3fr 1fr 1fr 1fr 160px", gap:"1rem" }} className="items-center px-5 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#f5ebd9] flex items-center justify-center text-[10px] font-black text-[#8b5e34] shrink-0">
                      {getInitials(sale.clientName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-[#111827] truncate">{sale.clientName}</p>
                      <p className="text-[10px] text-gray-400">{sale.clienteCpf || sale.administradora}</p>
                    </div>
                  </div>
                  <span className="text-[12px] font-bold text-gray-600">P{inst.parcelaNumero}/12</span>
                  <span className="text-[12px] text-gray-500">{fmtDateBR(inst.dataVencimento)}</span>
                  <span className="text-[12px] font-bold text-emerald-700">{fmtBRL(commPerInst)}</span>
                  <div className="flex items-center gap-1.5 justify-end">
                    {isAdmin ? (
                      <>
                        <button disabled={confirmingId === inst.id} onClick={() => handleInstStatus(inst.id, "PAGO")}
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50 transition-colors">
                          <Check size={10} strokeWidth={3} /> Pago
                        </button>
                        <button disabled={confirmingId === inst.id} onClick={() => handleSkipMonth(inst.id)}
                          className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 px-2 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50 transition-colors">
                          Pular
                        </button>
                        <button disabled={confirmingId === inst.id} onClick={() => handleInstStatus(inst.id, "INADIMPLENTE")}
                          className="flex items-center gap-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-50 transition-colors">
                          Inad.
                        </button>
                      </>
                    ) : <div />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Alerts ── */}
        {alerts.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setAlertsCollapsed(c => !c)}
              className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                  <AlertTriangle size={15} className="text-red-500" />
                </div>
                <span className="text-[14px] font-black text-[#111827]">Alertas</span>
                <span className="px-2 py-0.5 bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold rounded-full">{alerts.length}</span>
              </div>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${alertsCollapsed ? "" : "rotate-180"}`} />
            </button>

            {!alertsCollapsed && (
              <div className="divide-y divide-gray-50">
                {alerts.map((a, idx) => {
                  const badgeCls = a.type === "inadimplente" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200";
                  const badgeLabel = a.type === "inadimplente" ? "Inadimplente" : `Atrasado ${Math.abs(a.diffDays)}d`;
                  return (
                    <div key={`${a.saleId}-${a.inst.id}-${idx}`} style={{ display:"grid", gridTemplateColumns:"3fr 1fr 1fr 1fr 160px", gap:"1rem" }} className="items-center px-6 py-3 hover:bg-gray-50/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-[12px] font-black text-red-700 shrink-0">
                          {getInitials(a.clientName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-[#111827] truncate">{a.clientName}</p>
                          <p className="text-[11px] text-gray-400">{a.sale.administradora} · Parcela {a.inst.parcelaNumero}/12</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[10px] font-bold ${badgeCls}`}>{badgeLabel}</span>
                      <div>
                        <p className="text-[12px] font-bold text-[#111827]">{fmtBRL(a.commPerInst)}</p>
                        <p className="text-[10px] text-gray-400">em risco</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500">Venc. {fmtDateBR(a.inst.dataVencimento)}</p>
                        <p className="text-[11px] text-gray-400">{a.assignedTo.split(" ")[0]}{a.sdrName ? ` · ${a.sdrName.split(" ")[0]}` : ""}</p>
                      </div>
                      {isAdmin ? (
                        <div className="flex items-center gap-2 justify-end">
                          {a.type === "inadimplente" ? (
                            <button disabled={confirmingId === a.inst.id} onClick={() => handleInstStatus(a.inst.id, "PAGO")}
                              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 transition-colors">
                              <Check size={12} strokeWidth={3} /> Regularizar
                            </button>
                          ) : (
                            <>
                              <button disabled={confirmingId === a.inst.id} onClick={() => handleInstStatus(a.inst.id, "PAGO")}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 transition-colors">
                                <Check size={12} strokeWidth={3} /> Pago
                              </button>
                              <button disabled={confirmingId === a.inst.id} onClick={() => handleInstStatus(a.inst.id, "INADIMPLENTE")}
                                className="flex items-center gap-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 transition-colors">
                                Inadimplente
                              </button>
                            </>
                          )}
                        </div>
                      ) : <div />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Carteira Filters ── */}
        <div className="flex flex-wrap items-center gap-3 bg-[#F8F9FA] pb-2">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[250px]">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por cliente, CPF, administradora ou clos"
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 w-full"
            />
            {search && <button onClick={() => setSearch("")}><X size={14} className="text-gray-400 hover:text-gray-600" /></button>}
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <span className="text-[12px] font-bold text-gray-500">SDR:</span>
            <select value={sdrFilter} onChange={e => setSdrFilter(e.target.value)} className="bg-transparent border-none outline-none text-[13px] font-bold text-[#111827] cursor-pointer appearance-none pr-4">
              <option value="Todos">Todos</option>
              {Object.values(teamRules).filter(u => u.role?.toLowerCase() === "sdr").map(u => <option key={u.id} value={u.nome}>{u.nome.split(" ")[0]}</option>)}
              <option value="Prospecção direta (Sem SDR)">Sem SDR</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <span className="text-[12px] font-bold text-gray-500">Closer:</span>
            <select value={closerFilter} onChange={e => setCloserFilter(e.target.value)} className="bg-transparent border-none outline-none text-[13px] font-bold text-[#111827] cursor-pointer appearance-none pr-4">
              <option value="Todos">Todos</option>
              {Object.values(teamRules).filter(u => u.role?.toLowerCase() === "closer").map(u => <option key={u.id} value={u.nome}>{u.nome.split(" ")[0]}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="text-[13px] font-bold text-[#111827] bg-transparent border-none outline-none cursor-pointer" />
            <span className="text-[12px] text-gray-400 font-medium">até</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="text-[13px] font-bold text-[#111827] bg-transparent border-none outline-none cursor-pointer" />
          </div>
        </div>

        {/* ── Carteira ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1.5fr 1.5fr 1fr 1fr 120px", gap: "1rem" }} className="px-6 py-4 bg-white border-b border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Cliente</span>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Próxima Parcela</span>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Comissão</span>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Closer / SDR</span>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Status</span>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider text-right">Ação</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[13px] font-bold text-gray-400">Carregando...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-12 text-center text-[13px] font-bold text-gray-400">Nenhum contrato ativo nos últimos 12 meses.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredGroups.map(group => {
                const allInsts = group.sales.flatMap(s => s.installments || []);
                const proxInst = allInsts.find(i => !i.pago && i.status !== "CANCELADO" && i.status !== "PAGO");
                const pagas = allInsts.filter(i => i.pago || i.status === "PAGO").length;
                const canceladas = allInsts.filter(i => i.status === "CANCELADO").length;
                const hasInadimplente = allInsts.some(i => i.status === "INADIMPLENTE");
                // Cancelado: tem parcelas canceladas E não há mais pendentes (saiu no meio)
                const isCancelado = !proxInst && canceladas > 0 && pagas < allInsts.length;
                const isExpanded = expandedGroup === group.key;

                const commPerInst = group.sales.reduce((acc, s) => {
                  const n = s.installments?.length || 1;
                  return acc + (s.value * 0.04) / n * getNetFactor(s.administradora);
                }, 0);

                // Comissão total, recebida e faltante (líquido)
                const commTotal = group.sales.reduce((acc, s) => acc + s.value * 0.04 * getNetFactor(s.administradora), 0);
                const commRecebida = pagas * commPerInst;
                const commFaltante = commTotal - commRecebida;

                let statusBadge = null;
                let statusText = "No prazo";
                let statusColor = "text-emerald-600";
                
                if (hasInadimplente) {
                  statusText = "Inadimplente";
                  statusColor = "text-red-600";
                  statusBadge = <span className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 text-[11px] font-bold rounded-lg border border-red-200"><X size={12}/> {statusText}</span>;
                } else if (isCancelado) {
                  statusText = "Cancelado";
                  statusColor = "text-gray-500";
                  statusBadge = <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] font-bold rounded-lg border border-gray-200"><Ban size={12}/> {statusText}</span>;
                } else if (!proxInst) {
                  statusText = "Quitado";
                  statusColor = "text-emerald-600";
                  statusBadge = <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-200"><Check size={12}/> {statusText}</span>;
                } else {
                  const venc = new Date(proxInst.dataVencimento); venc.setUTCHours(0,0,0,0);
                  const hoje = new Date(); hoje.setHours(0,0,0,0);
                  const diff = Math.floor((venc.getTime() - hoje.getTime()) / 86400000);
                  if (diff < 0) {
                    statusText = `Atrasado ${Math.abs(diff)}d`;
                    statusColor = "text-amber-600";
                    statusBadge = <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-[11px] font-bold rounded-lg border border-amber-200"><AlertTriangle size={12}/> {statusText}</span>;
                  } else {
                    statusBadge = <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-200"><Check size={12}/> {statusText}</span>;
                  }
                }

                return (
                  <div key={group.key} className="border-b border-gray-50 last:border-0">
                    <div style={{ display: "grid", gridTemplateColumns: "3fr 1.5fr 1.5fr 1fr 1fr 120px", gap: "1rem" }} className={`items-center px-6 py-4 hover:bg-gray-50/50 transition-colors ${hasInadimplente ? "bg-red-50/10" : ""}`}>
                      {/* CLIENTE */}
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-black shrink-0 ${hasInadimplente ? "bg-red-100 text-red-700" : "bg-[#faedda] text-[#a97545]"}`}>
                          {getInitials(group.clientName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-black text-[#111827] truncate uppercase tracking-tight">{group.clientName}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5 truncate flex items-center gap-1">
                            {group.administradora} <span className="text-gray-300">•</span> {group.produto} <span className="text-gray-300">•</span> CLOSER: {group.assignedTo.split(" ")[0]}
                          </p>
                          <p className="text-[10px] font-bold text-gray-500 mt-1 truncate">
                            {group.clienteCpf ? `CPF: ${group.clienteCpf} - ` : ""}
                            <span className="text-[#111827]">{fmtBRL(group.totalValue)}</span> - {group.sales.length} cotas
                          </p>
                        </div>
                      </div>
                      
                      {/* PRÓXIMA PARCELA */}
                      <div>
                        {proxInst ? (
                          <>
                            <p className="text-[13px] font-black text-[#111827]">{fmtDateBR(proxInst.dataVencimento)}</p>
                            <p className={`text-[11px] ${statusColor} mt-0.5`}>{statusText}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Parcela {proxInst.parcelaNumero} / 12</p>
                          </>
                        ) : (
                          <span className="text-[12px] text-emerald-600 font-bold">—</span>
                        )}
                      </div>

                      {/* COMISSÃO (PARCELA) */}
                      <div>
                        {proxInst ? (
                          <p className="text-[14px] font-black text-emerald-600">{fmtBRL(commPerInst)}</p>
                        ) : (
                          <p className="text-[14px] font-black text-gray-400">—</p>
                        )}
                      </div>

                      {/* CLOSER / SDR */}
                      <div>
                        <p className="text-[12px] font-bold text-[#111827]">{group.assignedTo.split(" ")[0]}</p>
                        {group.sdrName && group.sdrName !== "Prospecção direta (Sem SDR)" && (
                          <p className="text-[10px] text-gray-400 mt-0.5">SDR: {group.sdrName.split(" ")[0]}</p>
                        )}
                      </div>

                      {/* STATUS */}
                      <div>
                        {statusBadge}
                      </div>

                      {/* AÇÃO */}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setExpandedGroup(isExpanded ? null : group.key); setSelectedInstId(null); }}
                          className="flex items-center justify-center text-[11px] font-bold text-gray-600 hover:text-[#111827] px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors w-full max-w-[85px]"
                        >
                          {group.sales.length > 1 ? `${group.sales.length} cotas` : "Detalhes"} <ChevronRight size={12} className={`ml-1 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                        </button>
                        {isAdmin && proxInst && (
                          <button 
                            disabled={confirmingId === proxInst.id} 
                            onClick={() => handleInstStatus(proxInst.id, "PAGO")} 
                            className="w-[34px] h-[34px] flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50 shrink-0"
                            title="Confirmar pagamento desta parcela"
                          >
                            <Check size={16} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50/30 px-6 py-4">
                        {group.sales.map(sale => {
                          const insts = sale.installments || [];
                          const proxSaleInst = insts.find(i => !i.pago && i.status !== "CANCELADO" && i.status !== "PAGO");
                          const salePagas = insts.filter(i => i.pago || i.status === "PAGO").length;
                          const proposta = sale.notes?.match(/Proposta:\s*(\d+)/)?.[1];
                          const saleComm = (sale.value * 0.04) / Math.max(1, insts.length) * getNetFactor(sale.administradora);

                          return (
                            <div key={sale.id} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-b-0 border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-[12px] font-bold text-gray-700">
                                    {proposta ? `Proposta ${proposta}` : "Cota"} · {fmtBRL(sale.value)}
                                  </span>
                                  <span className="text-[11px] text-gray-400">{fmtDateBR(sale.closedAt)} · {salePagas}/{insts.length} pagas · {fmtBRL(saleComm)}/mês</span>
                                </div>
                                {isAdmin && (
                                  <button onClick={() => openEditModal(sale)} className="text-[11px] font-bold text-gray-400 hover:text-[#d97706] flex items-center gap-1">
                                    <Pencil size={11} /> Editar
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {[...insts].sort((a, b) => {
                                  const ord = (i: Installment) => { const s = i.status || (i.pago ? "PAGO" : "PENDENTE"); return s === "INADIMPLENTE" ? 0 : s === "PENDENTE" ? 1 : s === "PAGO" ? 2 : 3; };
                                  return ord(a) - ord(b);
                                }).map(inst => {
                                  const st = inst.status || (inst.pago ? "PAGO" : "PENDENTE");
                                  let cls = "bg-gray-100 text-gray-400 border-gray-200";
                                  if (st === "PAGO") cls = "bg-emerald-600 text-white border-emerald-600";
                                  else if (st === "INADIMPLENTE") cls = "bg-red-600 text-white border-red-600";
                                  else if (st === "CANCELADO") cls = "bg-gray-400 text-white border-gray-400";
                                  const isSel = selectedInstId === inst.id;
                                  return (
                                    <button
                                      key={inst.id}
                                      onClick={isAdmin ? () => setSelectedInstId(isSel ? null : inst.id) : undefined}
                                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-[9px] font-bold transition-all ${cls} ${isAdmin ? "cursor-pointer hover:opacity-75" : "cursor-default"} ${isSel ? "ring-2 ring-offset-1 ring-gray-700 scale-110" : ""}`}
                                      title={`P${inst.parcelaNumero} · ${fmtDateBR(inst.dataVencimento)} · ${st}`}
                                    >
                                      {st === "PAGO" ? <Check size={10} strokeWidth={3} /> : st === "INADIMPLENTE" ? <X size={9} /> : st === "CANCELADO" ? <Ban size={8} /> : inst.parcelaNumero}
                                    </button>
                                  );
                                })}
                              </div>
                              <InstEditPanel
                                insts={insts}
                                selectedInstId={isAdmin ? selectedInstId : null}
                                confirmingId={confirmingId}
                                onStatus={(id, st) => { handleInstStatus(id, st); setSelectedInstId(null); }}
                                onSkip={(id) => { handleSkipMonth(id); setSelectedInstId(null); }}
                                onClose={() => setSelectedInstId(null)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        </> /* fim aba comissoes */}

        {activeTab === "pagamento" && (
          <div className="flex flex-col gap-5">
            {/* Cabeçalho da aba */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-black text-[#111827]">Pagamento a Associados</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">Comissões a pagar por closer e SDR no mês</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="month" value={assocMes}
                  onChange={e => setAssocMes(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[13px] font-bold text-[#111827] outline-none"
                />
              </div>
            </div>

            {assocLoading ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-[13px] text-gray-400 font-bold">Carregando...</div>
            ) : !assocData?.data?.length ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-[13px] text-gray-400 font-bold">Nenhum dado para este mês.</div>
            ) : (
              <>
                {/* KPIs resumo */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Total a pagar</p>
                    <p className="text-[20px] font-black text-[#111827]">{fmtBRL((assocData.totalAPagar ?? 0) + (assocData.totalPendente ?? 0))}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{assocData.data.length} associados</p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Já pago</p>
                    <p className="text-[20px] font-black text-emerald-600">{fmtBRL(assocData.totalAPagar ?? 0)}</p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Pendente</p>
                    <p className="text-[20px] font-black text-amber-600">{fmtBRL(assocData.totalPendente ?? 0)}</p>
                  </div>
                </div>

                {/* Tabela de associados */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="grid grid-cols-[2fr_80px_1fr_1fr_1fr_32px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Nome</span>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Tipo</span>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider text-right">Pago</span>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider text-right">Pendente</span>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider text-right">Total</span>
                    <span />
                  </div>
                  <div className="divide-y divide-gray-50">
                    {assocData.data.map((a: any) => {
                      const key = `${a.tipo}:${a.nome}`;
                      const isOpen = assocExpanded === key;
                      const total = a.pago + a.pendente;
                      return (
                        <div key={key}>
                          <button
                            onClick={() => setAssocExpanded(isOpen ? null : key)}
                            className="w-full grid grid-cols-[2fr_80px_1fr_1fr_1fr_32px] gap-4 px-6 py-3 hover:bg-gray-50/60 transition-colors text-left items-center"
                          >
                            <span className="text-[13px] font-bold text-[#111827]">{a.nome}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded w-fit ${a.tipo === "CLOSER" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>{a.tipo}</span>
                            <span className="text-[13px] font-bold text-emerald-600 text-right">{fmtBRL(a.pago)}</span>
                            <span className="text-[13px] font-bold text-amber-600 text-right">{fmtBRL(a.pendente)}</span>
                            <span className="text-[13px] font-black text-[#111827] text-right">{fmtBRL(total)}</span>
                            <span className={`text-gray-400 text-[10px] transition-transform ${isOpen ? "rotate-180" : ""} text-center`}>▾</span>
                          </button>
                          {isOpen && a.clientes?.length > 0 && (
                            <div className="border-t border-gray-50 bg-gray-50/40">
                              <div className="grid grid-cols-[2fr_80px_1fr_1fr_1fr] gap-4 px-8 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                <span>Cliente</span><span>Parcela</span><span>Admin.</span><span>Comissão</span><span>Status</span>
                              </div>
                              {a.clientes.map((c: any, i: number) => (
                                <div key={i} className="grid grid-cols-[2fr_80px_1fr_1fr_1fr] gap-4 px-8 py-2 border-t border-gray-100 items-center">
                                  <span className="text-[12px] font-semibold text-[#111827] truncate">{c.clientName}</span>
                                  <span className="text-[11px] text-gray-500">P{c.parcelaNumero}/{c.totalParcelas}</span>
                                  <span className="text-[11px] text-gray-500 truncate">{c.administradora || '—'}</span>
                                  <span className="text-[12px] font-bold text-[#111827]">{fmtBRL(c.valorComissao)}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded w-fit ${c.status === "PAGO" ? "bg-emerald-50 text-emerald-600" : c.status === "INADIMPLENTE" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                                    {c.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </main>

      {/* ── Modal: Contratos do Mês ── */}
      {mesModal && (() => {
        const contratos: any[] = detalhesPorto[mesModal] || [];
        const [y, m] = mesModal.split("-").map(Number);
        const mesNome = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 15)));
        const totalComm = contratos.reduce((s, c) => s + c.commMensal, 0);
        const fmtBRLM = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

        // Também pega Embracon do banco para esse mês
        const monthStart = new Date(Date.UTC(y, m - 1, 1));
        const monthEnd   = new Date(Date.UTC(y, m, 0, 23, 59, 59));
        const embraconItems: { nome: string; comm: number }[] = [];
        for (const s of sales) {
          if (!(s.administradora || "").toLowerCase().includes("embracon")) continue;
          if (s.closedAt && new Date(s.closedAt).getUTCFullYear() < 2025) continue;
      if (cancelledSaleIds.has(s.id)) continue;
          const insts = s.installments || [];
          const commPerInst = (s.value * 0.04) / Math.max(1, insts.length) * 0.93;
          for (const i of insts) {
            const venc = new Date(i.dataVencimento);
            if (venc >= monthStart && venc <= monthEnd && i.status !== "CANCELADO") {
              embraconItems.push({ nome: s.clientName, comm: commPerInst });
            }
          }
        }

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMesModal(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <div>
                  <p className="text-[11px] uppercase font-bold text-gray-400 tracking-wider mb-0.5">Comissões esperadas</p>
                  <h3 className="text-[18px] font-black text-[#111827] capitalize">{mesNome}</h3>
                </div>
                <button onClick={() => setMesModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Total */}
              <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                <span className="text-[13px] font-bold text-emerald-700">Total Porto Seguro</span>
                <span className="text-[20px] font-black text-emerald-700">{fmtBRLM(totalComm)}</span>
              </div>
              {embraconItems.length > 0 && (
                <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                  <span className="text-[13px] font-bold text-blue-700">Total Embracon</span>
                  <span className="text-[16px] font-black text-blue-700">{fmtBRLM(embraconItems.reduce((s, e) => s + e.comm, 0))}</span>
                </div>
              )}

              {/* Lista contratos Porto */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {contratos.length === 0 ? (
                  <p className="text-[13px] text-gray-400 text-center py-8">Sem contratos Porto para este mês</p>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="pb-2 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Cliente</th>
                        <th className="pb-2 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-center w-16">Parcela</th>
                        <th className="pb-2 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-right">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contratos.map((c, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="py-2.5">
                            <p className="text-[13px] font-bold text-[#111827] leading-tight">{c.nome}</p>
                            <p className="text-[10px] text-gray-400">Prop. {c.proposta} · {fmtBRLM(c.premio)} carta</p>
                          </td>
                          <td className="py-2.5 text-center text-[12px] font-bold text-gray-500">{c.parcelaNum}/{c.nMeses}</td>
                          <td className="py-2.5 text-right text-[13px] font-black text-emerald-600 whitespace-nowrap">{fmtBRLM(c.commMensal)}</td>
                        </tr>
                      ))}
                      {embraconItems.map((e, i) => (
                        <tr key={`emb-${i}`} className="border-b border-gray-50 hover:bg-blue-50/30">
                          <td className="py-2.5">
                            <p className="text-[13px] font-bold text-[#111827] leading-tight">{e.nome}</p>
                            <p className="text-[10px] text-blue-400 font-bold">Embracon</p>
                          </td>
                          <td className="py-2.5 text-center text-[12px] font-bold text-gray-500">—</td>
                          <td className="py-2.5 text-right text-[13px] font-black text-blue-600 whitespace-nowrap">{fmtBRLM(e.comm)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Bulk Confirm Modal ── */}
      {bulkPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBulkPreviewOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h2 className="text-[20px] font-black text-[#111827] mb-1">Confirmar parcelas em lote</h2>
            <p className="text-[13px] text-gray-500 mb-6 capitalize">{rangeLabel(startDate, endDate)}</p>
            <div className="bg-gray-50 rounded-xl p-4 mb-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#111827]">Parcelas a confirmar</span>
                <span className="text-[18px] font-black text-emerald-600">{bulkPreview.toConfirm}</span>
              </div>
              {bulkPreview.skipped > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-amber-700">Puladas (inadimplente/cancelado)</span>
                  <span className="text-[18px] font-black text-amber-600">{bulkPreview.skipped}</span>
                </div>
              )}
            </div>
            {bulkPreview.skipped > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
                <p className="text-[12px] font-bold text-amber-700">Parcelas inadimplentes e canceladas NÃO serão alteradas.</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setBulkPreviewOpen(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-[13px] font-bold">Cancelar</button>
              <button onClick={handleBulkConfirm} disabled={isConfirming || bulkPreview.toConfirm === 0} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-[13px] font-bold disabled:opacity-50">
                {isConfirming ? "Confirmando..." : `Confirmar ${bulkPreview.toConfirm} parcelas`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New / Edit Sale Modal ── */}
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
                <div className="flex justify-end">
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

      {/* ── Modal Relatório Porto ── */}
      {portoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setPortoOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Upload size={16} className="text-orange-500" />
                <div>
                  <p className="text-[15px] font-black text-[#111827]">Relatório Porto Seguro</p>
                  <p className="text-[11px] text-gray-400">Cole as linhas do relatório mensal · mês: {startDate.substring(0, 7)}</p>
                </div>
              </div>
              <button onClick={() => setPortoOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {portoResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-[13px] font-bold text-emerald-700">
                        Base atualizada — {portoResult.processadas} apólices ({portoResult.novas} novas)
                      </p>
                      {portoReconcileCount !== null && (
                        <p className="text-[11px] text-emerald-600 mt-0.5">
                          {portoReconcileCount} parcela{portoReconcileCount !== 1 ? "s" : ""} marcada{portoReconcileCount !== 1 ? "s" : ""} como paga{portoReconcileCount !== 1 ? "s" : ""}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-500 mt-0.5">Projeções Porto atualizadas automaticamente.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setPortoResult(null); setPortoLinhas(""); setPortoPreview(null); setPortoReconcileCount(null); }}
                    className="text-[12px] text-blue-500 hover:underline"
                  >
                    Processar outro mês
                  </button>
                </div>
              ) : (
                <>
                  <textarea
                    value={portoLinhas}
                    onChange={e => { setPortoLinhas(e.target.value); setPortoPreview(null); setPortoError(""); }}
                    placeholder={"Cole aqui as linhas do relatório da Porto:\nR$ 1.757,02\t1001690553\t355.535.508-23\tDIEGO FREIRE SANTOS\nR$ 933,33\t1001649179\t..."}
                    rows={8}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-xs font-mono rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-orange-400/40 resize-y"
                    autoFocus
                  />

                  {portoError && (
                    <div className="flex items-center gap-2 text-red-600 text-[12px] bg-red-50 border border-red-200 rounded-xl p-3">
                      <AlertTriangle size={14} /> {portoError}
                    </div>
                  )}

                  {!portoPreview ? (
                    <button
                      onClick={async () => {
                        setPortoPreviewLoading(true); setPortoPreview(null); setPortoError("");
                        try {
                          const r = await fetch("/api/porto/confirmar-mes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ linhas: portoLinhas }) });
                          const d = await r.json();
                          if (!r.ok) throw new Error(d.error || "Erro ao processar");
                          setPortoPreview(d.rows);
                        } catch (e: any) { setPortoError(e.message); }
                        finally { setPortoPreviewLoading(false); }
                      }}
                      disabled={!portoLinhas.trim() || portoPreviewLoading}
                      className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-bold px-4 py-2 rounded-xl text-[12px] transition-colors"
                    >
                      {portoPreviewLoading && <Loader2 size={13} className="animate-spin" />}
                      Pré-visualizar
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] text-gray-600">
                          <span className="font-bold text-[#111827]">{portoPreview.length}</span> apólices ·{" "}
                          <span className="font-bold text-blue-600">{portoPreview.filter(r => r.nova).length} novas</span>{" "}
                          · <span className="text-gray-400">{portoPreview.filter(r => !r.nova).length} já na base</span>
                        </p>
                        <button onClick={() => setPortoPreview(null)} className="text-[11px] text-gray-400 hover:text-gray-600">Editar</button>
                      </div>
                      <div className="rounded-xl border border-gray-100 overflow-hidden max-h-[220px] overflow-y-auto">
                        <table className="w-full text-[11px]">
                          <thead className="sticky top-0 bg-gray-50">
                            <tr className="text-gray-500 text-left">
                              <th className="px-3 py-2">Apólice</th>
                              <th className="px-3 py-2">Nome</th>
                              <th className="px-3 py-2 text-right">Valor</th>
                              <th className="px-3 py-2 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {portoPreview.map((r, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="px-3 py-1.5 font-mono text-gray-600">{r.apolice}</td>
                                <td className="px-3 py-1.5 text-gray-700">{r.nome || "—"}</td>
                                <td className="px-3 py-1.5 text-right text-emerald-600 font-semibold">{r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                                <td className="px-3 py-1.5 text-center">
                                  {r.nova
                                    ? <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold">Nova</span>
                                    : <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px]">Existente</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        onClick={async () => {
                          setPortoSaveLoading(true); setPortoError("");
                          const mes = startDate.substring(0, 7);
                          try {
                            const [r1, r2] = await Promise.all([
                              fetch("/api/porto/confirmar-mes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mes, linhas: portoLinhas }) }),
                              fetch("/api/comissoes/porto-reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cpfs: parsePortoCSV(portoLinhas), mes }) }),
                            ]);
                            const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
                            if (!r1.ok) throw new Error(d1.error || "Erro ao salvar");
                            setPortoResult(d1);
                            setPortoReconcileCount(d2.updated ?? 0);
                            setPortoPreview(null);
                            fetchSales();
                          } catch (e: any) { setPortoError(e.message); }
                          finally { setPortoSaveLoading(false); }
                        }}
                        disabled={portoSaveLoading}
                        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-[12px] transition-colors"
                      >
                        {portoSaveLoading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
                        Salvar e confirmar parcelas — {startDate.substring(0, 7)}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
