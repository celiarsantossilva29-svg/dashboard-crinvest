"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSession } from "next-auth/react";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area
} from "recharts";
import { 
  DollarSign, ArrowDown, CalendarDays, LineChart as ChartUp, 
  Percent, Search, Download, Plus, Filter, MoreVertical, TrendingUp 
} from "lucide-react";

type Gasto = {
  id: string;
  descricao: string;
  categoria: string;
  fornecedor?: string;
  tipo: string;
  valor: number;
  dataGasto: string;
  dataVencimento?: string;
  status: string;
  dataPagamento?: string;
  recorrente: boolean;
};

const CATEGORIAS = [
  { value: "pessoas", label: "Pessoas", color: "#F59E0B" }, // Yellow
  { value: "marketing", label: "Marketing", color: "#EC4899" }, // Pink
  { value: "comissoes", label: "Comissões", color: "#8B5CF6" }, // Purple
  { value: "tecnologia", label: "Tecnologia", color: "#3B82F6" }, // Blue
  { value: "espaco", label: "Espaço Físico", color: "#F97316" }, // Orange
  { value: "impostos", label: "Impostos", color: "#EF4444" }, // Red
  { value: "royalties", label: "Royalties Franquia", color: "#D946EF" }, // Fuchsia
  { value: "outros", label: "Outros", color: "#6B7280" }, // Gray
];

const COLORS = CATEGORIAS.reduce((acc, c) => ({ ...acc, [c.value]: c.color }), {} as Record<string, string>);

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  a_pagar: { label: "A pagar", color: "#D97706", bg: "rgba(217, 119, 6, 0.1)" },
  pago: { label: "Pago", color: "#10B981", bg: "rgba(16, 185, 129, 0.1)" },
  atrasado: { label: "Atrasado", color: "#EF4444", bg: "rgba(239, 68, 68, 0.1)" },
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("pt-BR");
}

const EMPTY_FORM = {
  descricao: "",
  categoria: "pessoas",
  fornecedor: "",
  tipo: "fixo",
  valor: "",
  dataGasto: new Date().toISOString().split("T")[0],
  dataVencimento: "",
  status: "a_pagar",
  recorrente: false,
  mesesRecorrencia: "",
  observacoes: "",
};

export default function GastosPage() {
  const { data: session } = useSession();
  
  const now = new Date();
  // Começar do dia 1 ao fim do mês atual
  const [startDate, setStartDate] = useLocalStorage("filter:gastos:start", new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useLocalStorage("filter:gastos:end", new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);
  
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState("todas");
  const [search, setSearch] = useState("");
  const [evolPeriodo, setEvolPeriodo] = useState<"passado" | "futuro">("passado");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load table data
      const resGastos = await fetch(`/api/financeiro/gastos?start=${startDate}&end=${endDate}`);
      if (resGastos.ok) {
        const json = await resGastos.json();
        // A API antiga ainda usa 'mes', então vou filtrar no client se ela não suportar start/end perfeitamente ainda
        // Mas atualizamos a kpis-gastos para usar start/end
        setGastos(json.data ?? []);
      }

      // 2. Load KPIs data
      const resKpis = await fetch(`/api/financeiro/kpis-gastos?start=${startDate}T00:00:00&end=${endDate}T23:59:59`);
      if (resKpis.ok) {
        const jsonKpis = await resKpis.json();
        setKpis(jsonKpis.data);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.descricao || !form.valor || !form.dataGasto) return;
    setSaving(true);
    const method = (form as any).id ? "PATCH" : "POST";
    await fetch("/api/financeiro/gastos", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        valor: parseFloat(form.valor as string),
        mesesRecorrencia: form.mesesRecorrencia ? parseInt(form.mesesRecorrencia as string) : undefined,
      }),
    });
    setSaving(false);
    setShowForm(false);
    setForm({ ...EMPTY_FORM });
    load();
  };

  const handleEdit = (g: any) => {
    setForm({
      ...(g as any),
      valor: String(g.valor),
      dataGasto: g.dataGasto ? new Date(g.dataGasto).toISOString().split("T")[0] : "",
      dataVencimento: g.dataVencimento ? new Date(g.dataVencimento).toISOString().split("T")[0] : "",
      mesesRecorrencia: g.mesesRecorrencia ? String(g.mesesRecorrencia) : "",
      fornecedor: g.fornecedor || "",
      tipo: g.tipo || "fixo",
      observacoes: g.observacoes || "",
    });
    setShowForm(true);
  };

  const handlePagar = async (g: Gasto) => {
    await fetch("/api/financeiro/gastos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: g.id, status: "pago", dataPagamento: new Date().toISOString() }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este gasto?")) return;
    await fetch(`/api/financeiro/gastos?id=${id}`, { method: "DELETE" });
    load();
  };

  const filtered = gastos.filter(g => {
    if (filterCat !== "todas" && g.categoria !== filterCat) return false;
    if (search && !g.descricao.toLowerCase().includes(search.toLowerCase()) && !(g.fornecedor || "").toLowerCase().includes(search.toLowerCase())) return false;
    // O filtro de data já é aplicado na tabela, mas garantimos visualmente
    return g.dataGasto >= startDate && g.dataGasto <= endDate;
  });

  const isAdmin = (session?.user as any)?.role === "admin";

  return (
    <div className="min-h-screen p-6" style={{ background: "#F8F7F4", color: "#111827", fontFamily: "'Inter', sans-serif" }}>
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Caixa & Custos</h1>
          <p className="text-sm text-gray-600 mt-1">Acompanhe seus custos, compromissos e evolução financeira.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent text-sm text-gray-700 px-2 outline-none"
            />
            <span className="text-gray-400 mx-1">→</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent text-sm text-gray-700 px-2 outline-none"
            />
          </div>
          <button className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors rounded-lg px-4 py-2 text-sm text-gray-700 font-medium">
            <Filter size={16} /> Filtros
          </button>
        </div>
      </div>

      {/* KPI CARDS - Row 1: Financeiro */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-full bg-yellow-500/10">
              <DollarSign className="text-yellow-600" size={18} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Gasto</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(kpis?.totalGasto || 0)}</p>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-full bg-red-500/10">
              <Percent className="text-red-500" size={18} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Impostos</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(kpis?.totalImpostos || 0)}</p>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-full bg-fuchsia-500/10">
              <Percent className="text-fuchsia-500" size={18} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Royalties</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(kpis?.totalRoyalties || 0)}</p>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-full bg-green-500/10">
              <ArrowDown className="text-green-600" size={18} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Pago</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(kpis?.totalPago || 0)}</p>
        </div>
      </div>

      {/* KPI CARDS - Row 2: Performance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-full bg-purple-500/10">
              <CalendarDays className="text-purple-600" size={18} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Futuro (6m)</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(kpis?.comprometidoFuturo || 0)}</p>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-full bg-green-500/10">
              <ChartUp className="text-green-600" size={18} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Lucro Mês</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(kpis?.lucroLiquido || 0)}</p>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-full bg-blue-500/10">
              <Percent className="text-blue-500" size={18} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Margem</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{(kpis?.margemLiquida || 0).toFixed(1)}%</p>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-full bg-emerald-500/10">
              <TrendingUp className="text-emerald-600" size={18} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">ROI</p>
          </div>
          <p className={`text-2xl font-bold ${(kpis?.roi || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{(kpis?.roi || 0).toFixed(1)}%</p>
        </div>
      </div>

      {/* CHARTS SECTION 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Evolução dos Custos */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">Evolução Financeira</h2>
            <select 
              value={evolPeriodo}
              onChange={e => setEvolPeriodo(e.target.value as "passado" | "futuro")}
              className="bg-gray-50 border border-gray-200 text-xs text-gray-600 rounded-lg px-3 py-1.5 outline-none cursor-pointer font-medium"
            >
              <option value="passado">Últimos 12 meses</option>
              <option value="futuro">Próximos 12 meses (Projeção)</option>
            </select>
          </div>
          {evolPeriodo === "futuro" && (
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-4 font-medium">
              ⚡ Projeção baseada na média dos últimos 3 meses de receita e custos fixos atuais
            </p>
          )}
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={evolPeriodo === "passado" ? (kpis?.evolucao || []) : (kpis?.projecao12m || [])} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="mes" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val / 1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#111827', borderRadius: '8px' }}
                  itemStyle={{ color: '#4b5563' }}
                  formatter={(value: any) => fmt(Number(value) || 0)}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#4b5563' }} />
                <Area type="monotone" dataKey="receitas" name={evolPeriodo === "futuro" ? "Receita (proj.)" : "Receita Bruta"} fill="#10B981" stroke="#10B981" fillOpacity={0.1} strokeDasharray={evolPeriodo === "futuro" ? "5 5" : undefined} />
                <Line type="monotone" dataKey="custos" name={evolPeriodo === "futuro" ? "Custos (proj.)" : "Custos Totais"} stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} strokeDasharray={evolPeriodo === "futuro" ? "5 5" : undefined} />
                <Bar dataKey="lucro" name={evolPeriodo === "futuro" ? "Lucro (proj.)" : "Lucro"} fill={evolPeriodo === "futuro" ? "#D97706" : "#F59E0B"} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Onde a empresa gasta mais */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-6">Onde a Empresa Gasta Mais</h2>
          
          {/* Donut Chart */}
          <div className="relative h-[160px] flex justify-center items-center mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={kpis?.categorias || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="valor"
                  stroke="none"
                >
                  {(kpis?.categorias || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.nome] || COLORS["outros"]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => fmt(Number(value) || 0)} contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', borderRadius: '8px', color: '#111827' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-gray-900 font-bold text-sm">{fmt(kpis?.totalGasto || 0)}</span>
              <span className="text-xs text-gray-500">Total</span>
            </div>
          </div>

          {/* Legend Items */}
          <div className="space-y-2">
            {(kpis?.categorias || []).map((cat: any) => (
              <div key={cat.nome} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[cat.nome] || COLORS["outros"] }}></div>
                  <span className="text-gray-700 capitalize">{CATEGORIAS.find(c => c.value === cat.nome)?.label || cat.nome}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-900 font-medium">{fmt(cat.valor)}</span>
                  <span className="text-gray-500 w-8 text-right">{Math.round(cat.percentual)}%</span>
                </div>
              </div>
            ))}
          </div>
          <button className="text-xs text-blue-600 mt-4 hover:underline">Ver todas as categorias</button>
        </div>
      </div>

      {/* CHARTS SECTION 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Custos: Fixos x Variáveis */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-6">Custos: Fixos x Variáveis</h2>
          <div className="relative h-[120px] mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Fixos', value: kpis?.fixosVsVariaveis?.fixos || 0 },
                    { name: 'Variáveis', value: kpis?.fixosVsVariaveis?.variaveis || 0 }
                  ]}
                  cx="50%"
                  cy="100%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill="#10B981" />
                  <Cell fill="#6B7280" />
                </Pie>
                <Tooltip formatter={(value: any) => fmt(Number(value) || 0)} contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', borderRadius: '8px', color: '#111827' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between mt-2">
            <div>
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#10B981]"></div> Fixos</div>
              <div className="text-lg font-semibold text-gray-900">{fmt(kpis?.fixosVsVariaveis?.fixos || 0)}</div>
              <div className="text-xs text-gray-400">{(kpis?.fixosVsVariaveis?.fixosPercent || 0).toFixed(1)}%</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1 flex items-center justify-end gap-1"><div className="w-2 h-2 rounded-full bg-[#6B7280]"></div> Variáveis</div>
              <div className="text-lg font-semibold text-gray-900">{fmt(kpis?.fixosVsVariaveis?.variaveis || 0)}</div>
              <div className="text-xs text-gray-400">{(kpis?.fixosVsVariaveis?.variaveisPercent || 0).toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Compromissos Futuros */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-6">Compromissos Futuros (A Pagar)</h2>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis?.compromissosFuturos || []} margin={{ top: 15, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="mes" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#111827', borderRadius: '8px' }}
                  formatter={(value: any) => fmt(Number(value) || 0)}
                />
                <Bar dataKey="valor" fill="#8B5CF6" radius={[4, 4, 0, 0]}>
                  {/* Option to map different opacities if wanted */}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-500 mt-3">Total comprometido próximos 6 meses: <span className="text-purple-600 font-semibold">{fmt(kpis?.comprometidoFuturo || 0)}</span></p>
        </div>

        {/* Receita x Custos x Lucro (Smaller version) */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-6">Receita x Custos x Lucro</h2>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpis?.evolucao || []} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="mes" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e5e7eb', color: '#111827', borderRadius: '8px' }}
                  formatter={(value: any) => fmt(Number(value) || 0)}
                />
                <Line type="monotone" dataKey="receitas" stroke="#10B981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="custos" stroke="#EF4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="lucro" stroke="#F59E0B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* TABLE SECTION */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {["todas", ...CATEGORIAS.map(c => c.value)].map(c => (
              <button key={c}
                onClick={() => setFilterCat(c)}
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                style={{
                  background: filterCat === c ? "#f3f4f6" : "transparent",
                  color: filterCat === c ? "#111827" : "#6b7280",
                  borderColor: filterCat === c ? "#d1d5db" : "#e5e7eb",
                }}>
                {c === "todas" ? "Todas" : CATEGORIAS.find(x => x.value === c)?.label ?? c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por descrição, fornecedor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-1.5 text-sm text-gray-700 w-64 outline-none focus:border-gray-400 focus:bg-white transition-colors"
              />
            </div>
            <button className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors rounded-lg px-4 py-1.5 text-sm text-gray-700 font-medium">
              <Download size={16} /> Exportar
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-sm text-gray-500">Carregando dados financeiros...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">Nenhum lançamento encontrado.</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-4 font-medium">Data</th>
                  <th className="px-5 py-4 font-medium">Descrição</th>
                  <th className="px-5 py-4 font-medium">Categoria</th>
                  <th className="px-5 py-4 font-medium">Fornecedor</th>
                  <th className="px-5 py-4 font-medium text-right">Valor</th>
                  <th className="px-5 py-4 font-medium">Vencimento</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium text-center">Tipo</th>
                  <th className="px-5 py-4 font-medium text-center">Recorrente</th>
                  {isAdmin && <th className="px-5 py-4 font-medium text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(g => {
                  const st = STATUS_LABEL[g.status] ?? { label: g.status, color: "#6b7280", bg: "#f3f4f6" };
                  const cat = CATEGORIAS.find(c => c.value === g.categoria) || { label: g.categoria, color: "#6b7280" };
                  
                  return (
                    <tr key={g.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-5 py-4 text-gray-500 whitespace-nowrap">{fmtDate(g.dataGasto)}</td>
                      <td className="px-5 py-4 text-gray-900 font-medium whitespace-nowrap">{g.descricao}</td>
                      <td className="px-5 py-4">
                        <span 
                          className="px-2 py-1 rounded text-[10px] font-bold tracking-wide uppercase whitespace-nowrap"
                          style={{ color: cat.color, border: `1px solid ${cat.color}40`, backgroundColor: `${cat.color}10` }}
                        >
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-500 whitespace-nowrap">{g.fornecedor || "-"}</td>
                      <td className="px-5 py-4 text-gray-900 font-bold text-right whitespace-nowrap">{fmt(g.valor)}</td>
                      <td className="px-5 py-4 text-gray-500 whitespace-nowrap">{g.dataVencimento ? fmtDate(g.dataVencimento) : "-"}</td>
                      <td className="px-5 py-4">
                        <span 
                          className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                          style={{ color: st.color, backgroundColor: st.bg, border: `1px solid ${st.color}30` }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center text-gray-500 whitespace-nowrap capitalize">{g.tipo || "Fixo"}</td>
                      <td className="px-5 py-4 text-center text-gray-500 whitespace-nowrap">{g.recorrente ? "Sim" : "Não"}</td>
                      {isAdmin && (
                        <td className="px-5 py-4 text-center relative">
                          <button className="text-gray-400 hover:text-gray-600 p-1">
                            <MoreVertical size={16} />
                          </button>
                          {/* Simplificação das ações no hover (apenas visual para o código) */}
                          <div className="absolute right-8 top-4 hidden group-hover:flex items-center gap-2 bg-white border border-gray-200 px-2 py-1 rounded shadow-lg z-10">
                            <button onClick={() => handleEdit(g)} className="text-xs font-medium text-blue-600 hover:text-blue-700">Editar</button>
                            {g.status !== "pago" && (
                              <button onClick={() => handlePagar(g)} className="text-xs font-medium text-green-600 hover:text-green-700">Pagar</button>
                            )}
                            <button onClick={() => handleDelete(g.id)} className="text-xs font-medium text-red-600 hover:text-red-700">Excluir</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-gray-500">
            <span>Mostrando {filtered.length} lançamentos</span>
            <div className="flex items-center gap-2">
              <select className="bg-white border border-gray-300 text-gray-700 rounded px-2 py-1 outline-none">
                <option>20 por página</option>
              </select>
            </div>
            {/* Paginação Mock */}
            <div className="flex gap-1">
              <button className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-500">&lt;</button>
              <button className="w-8 h-8 flex items-center justify-center rounded border border-yellow-500 text-yellow-600 bg-yellow-50 font-medium">1</button>
              <button className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-700">2</button>
              <button className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-500">&gt;</button>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase">Total de lançamentos</p>
              <p className="text-gray-900 font-medium">{filtered.length}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase">Valor total</p>
              <p className="text-gray-900 font-medium">{fmt(filtered.reduce((s, g) => s + g.valor, 0))}</p>
            </div>
            {isAdmin && (
              <button 
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <Plus size={16} /> Novo Gasto
              </button>
            )}
          </div>
        </div>

      </div>

      {/* MODAL NOVO GASTO */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">{(form as any).id ? "Editar Gasto" : "Novo Gasto"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1">Descrição</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors" placeholder="Ex: Meta Ads Abril" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1">Categoria</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors">
                    {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1">Valor (R$)</label>
                  <input type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors" placeholder="0.00" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1">Fornecedor</label>
                  <input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors" placeholder="Ex: Imobiliária Prime" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors">
                    <option value="fixo">Fixo</option>
                    <option value="variavel">Variável</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1">Data</label>
                  <input type="date" value={form.dataGasto} onChange={e => setForm(f => ({ ...f, dataGasto: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1">Vencimento</label>
                  <input type="date" value={form.dataVencimento} onChange={e => setForm(f => ({ ...f, dataVencimento: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors">
                    <option value="a_pagar">A pagar</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1">Recorrente</label>
                  <select value={form.recorrente ? "sim" : "nao"} onChange={e => setForm(f => ({ ...f, recorrente: e.target.value === "sim" }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors">
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </select>
                </div>
              </div>

              {form.recorrente && !(form as any).id && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1">Repetir por quantos meses</label>
                  <input type="number" value={form.mesesRecorrencia} onChange={e => setForm(f => ({ ...f, mesesRecorrencia: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors" placeholder="Ex: 12" />
                </div>
              )}
              
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500 block mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors" rows={2} />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button onClick={() => { setShowForm(false); setForm({...EMPTY_FORM}); }}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 font-medium hover:text-gray-900 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 rounded-lg text-sm text-black font-medium bg-yellow-400 hover:bg-yellow-500 transition-colors shadow-sm disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
