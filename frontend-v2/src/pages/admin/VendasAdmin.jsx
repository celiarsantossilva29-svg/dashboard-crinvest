import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/layout/Header";
import api from "../../services/api";
import {
  CheckCircle2, Search, DollarSign, Calendar, AlertCircle,
  Users, ChevronRight, Bell, Filter, ArrowUpDown, MoreVertical, X
} from "lucide-react";

function currency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

const StatCard = ({ title, value, subValue, icon: Icon, colorClass, subIcon: SubIcon }) => (
  <div className="bg-white rounded-[24px] p-6 border border-black/[0.04] shadow-sm flex items-center gap-5 flex-1 min-w-[240px]">
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colorClass}`}>
      <Icon size={28} className="text-white" />
    </div>
    <div className="flex flex-col">
      <span className="text-[14px] font-semibold text-[#86868b]">{title}</span>
      <span className="text-[22px] font-bold text-[#1d1d1f] tracking-tight">{value}</span>
      {subValue && (
        <div className="flex items-center gap-1.5 mt-0.5">
           {SubIcon && <SubIcon size={14} className="text-[#86868b]" />}
           <span className="text-[13px] font-medium text-[#86868b]">{subValue}</span>
        </div>
      )}
    </div>
  </div>
);

const SaleCard = ({ sale, onConfirm }) => {
  const isOverdue = sale.isOverdue;
  const isToday = sale.isToday;
  const allPaid = sale.pendingCount === 0;

  return (
    <div className="bg-white rounded-[32px] p-6 border border-black/[0.04] shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row items-center gap-8 mb-4">
      {/* Initials and Client Name */}
      <div className="flex items-center gap-5 w-72">
        <div className="w-16 h-16 rounded-full bg-[#fceceb] flex items-center justify-center text-[#e3000f] font-bold text-[20px] shrink-0">
          {sale.cliente_nome?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col overflow-hidden">
          <h3 className="text-[18px] font-bold text-[#1d1d1f] truncate leading-tight">{sale.cliente_nome}</h3>
          <span className="text-[14px] font-medium text-[#86868b]">Administradora: {sale.administradora?.toUpperCase()}</span>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
               <span className="text-[10px] font-bold text-gray-400 capitalize">{sale.closer_nome?.[0]}</span>
            </div>
            <span className="text-[13px] font-medium text-[#1d1d1f]">Closer: <span className="text-[#86868b]">{sale.closer_nome}</span></span>
          </div>
        </div>
      </div>

      {/* Payment Details */}
      <div className="flex-1 border-x border-black/[0.04] px-8 h-16 flex items-center">
        {!allPaid ? (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#fceceb] text-[#e3000f] rounded-lg">
                <span className="text-[13px] font-bold">{sale.pendingCount} parcelas pendentes</span>
                <Bell size={14} fill="currentColor" />
            </div>
            <div className="flex flex-col">
               <span className="text-[13px] font-medium text-[#86868b]">Próximo vencimento:</span>
               <span className="text-[15px] font-bold text-[#1d1d1f]">{formatDate(sale.nextDueDate)}</span>
            </div>
            <div className="flex flex-col ml-4">
               <span className="text-[13px] font-medium text-[#86868b]">Total em aberto:</span>
               <span className="text-[15px] font-bold text-[#1d1d1f]">{currency(sale.totalOpen)}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-[#008f39]">
            <CheckCircle2 size={24} />
            <div className="flex flex-col">
               <span className="text-[14px] font-bold">Pago</span>
               <span className="text-[13px] font-medium">Cliente pagou todas as parcelas</span>
            </div>
          </div>
        )}
      </div>

      {/* Logic/Actions */}
      <div className="w-64 flex flex-col items-end gap-3">
        {!allPaid ? (
          <>
            <div className="flex items-center gap-3">
               {isToday && (
                 <div className="flex items-center gap-1.5 px-3 py-1 bg-[#fff8e1] text-[#b45309] rounded-lg border border-[#fef3c7]">
                    <AlertCircle size={14} />
                    <span className="text-[12px] font-bold">Vence Hoje</span>
                 </div>
               )}
               <div className="flex flex-col items-end">
                 <div className="flex flex-wrap items-center gap-2 mt-1">
                   <span className="text-[12px] text-[#86868b] font-medium">Venda: {formatDate(sale.data_fechamento)}</span>
                   <span className="text-[12px] text-[#c7c7cc]">•</span>
                   <span className="text-[12px] text-[#86868b] font-medium uppercase tracking-tight">{sale.administradora}</span>
                 </div>
                 <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider">Parcela / Comissão</span>
                 <span className="text-[12px] font-bold bg-gray-100 text-[#1d1d1f] px-2 py-0.5 rounded">
                    {currency(sale.nextCommission)} ({sale.nextParcelaNumero}/12)
                 </span>
               </div>
            </div>
            <button 
              onClick={() => onConfirm(sale.nextPaymentId)}
              className="flex items-center justify-between w-full rounded-2xl bg-[#008263] text-white p-3.5 pl-6 font-bold text-[15px] shadow-sm hover:scale-[1.02] transition-transform active:scale-95"
            >
              <span>Confirmar pagamento</span>
              <ChevronRight size={20} />
            </button>
          </>
        ) : (
          <>
            <button className="flex items-center gap-2 text-[#86868b] border border-black/[0.08] px-4 py-2 rounded-xl text-[14px] font-bold hover:bg-black/[0.02]">
               <CheckCircle2 size={18} className="text-[#008f39]" />
               Ver comprovante
            </button>
          </>
        )}
        <button className="text-[13px] font-medium text-[#86868b] underline">Ver detalhes</button>
      </div>
    </div>
  );
};

export default function VendasAdmin() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("pendentes"); // pendentes, hoje, pagos
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [closerFilter, setCloserFilter] = useState("all");

  const fetchPagamentos = () => {
    setLoading(true);
    api.get("/pagamentos-clientes")
      .then(res => setData(res.data))
      .catch(err => {
        console.error(err);
        // Mock data for layout preview
        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
        setData([
          { id: 101, venda_id: 1, cliente_nome: "Roberto Almeida", administradora: "Porto", data_fechamento: "2024-03-10", closer_nome: "Célia Invest", valor_venda: 1250000, valor_parcela: 10416, valor_parcela_comissao: 520, parcela_numero: 1, data_vencimento: today, pago: 0 },
          { id: 102, venda_id: 2, cliente_nome: "Mariana Souza", administradora: "Embracon", data_fechamento: "2024-03-12", closer_nome: "Eunice Silva", valor_venda: 850000, valor_parcela: 7083, valor_parcela_comissao: 354, parcela_numero: 1, data_vencimento: nextWeek, pago: 0 },
          { id: 103, venda_id: 1, cliente_nome: "Roberto Almeida", administradora: "Porto", data_fechamento: "2024-03-10", closer_nome: "Célia Invest", valor_venda: 1250000, valor_parcela: 10416, valor_parcela_comissao: 520, parcela_numero: 2, data_vencimento: "2024-04-10", pago: 0 },
        ]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPagamentos();
  }, []);

  const handleValidar = async (id) => {
    try {
      if (!window.confirm("Confirmar que esta parcela foi paga e validá-la para comissões?")) return;
      await api.put(`/pagamentos-clientes/${id}`, {
        pago: 1,
        data_pagamento: new Date().toISOString().split('T')[0]
      });
      fetchPagamentos();
    } catch (e) {
      console.error(e);
      alert("Erro ao validar pagamento");
    }
  };

  const groupedSales = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const salesMap = {};

    data.forEach(p => {
      if (!salesMap[p.venda_id]) {
        salesMap[p.venda_id] = {
          venda_id: p.venda_id,
          cliente_nome: p.cliente_nome,
          administradora: p.administradora,
          data_fechamento: p.data_fechamento,
          closer_nome: p.closer_nome,
          valor_venda: p.valor_venda,
          valor_comissao_total_closer: p.valor_comissao_total_closer,
          payments: [],
          pendingCount: 0,
          totalOpen: 0,
          isOverdue: false,
          isToday: false,
          nextDueDate: null,
          nextValue: 0,
          nextCommission: 0,
          nextParcelaNumero: 0,
          nextPaymentId: null
        };
      }

      const s = salesMap[p.venda_id];
      s.payments.push(p);

      if (!p.pago) {
        s.pendingCount++;
        s.totalOpen += p.valor_parcela;
        if (!s.nextDueDate || p.data_vencimento < s.nextDueDate) {
          s.nextDueDate = p.data_vencimento;
          s.nextValue = p.valor_parcela;
          s.nextCommission = p.valor_parcela_comissao;
          s.nextParcelaNumero = p.parcela_numero;
          s.nextPaymentId = p.id;
        }
        if (p.data_vencimento < today) s.isOverdue = true;
        if (p.data_vencimento === today) s.isToday = true;
      }
    });

    return Object.values(salesMap);
  }, [data]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const pending = data.filter(p => !p.pago);

    return {
      totalPendente: pending.reduce((sum, p) => sum + p.valor_parcela, 0),
      vencemHoje: pending.filter(p => p.data_vencimento === today),
      emAtraso: pending.filter(p => p.data_vencimento < today),
      closersCount: new Set(pending.map(p => p.closer_id)).size
    };
  }, [data]);

  const filteredSales = useMemo(() => {
    return (groupedSales || []).filter(s => {
      const nameMatch = s.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
                     s.closer_nome?.toLowerCase().includes(search.toLowerCase()) ||
                     s.administradora?.toLowerCase().includes(search.toLowerCase());

      if (!nameMatch) return false;

      // Apply Sale Date Range Filter
      if (startDate && s.data_fechamento < startDate) return false;
      if (endDate && s.data_fechamento > endDate) return false;

      if (filter === "pendentes") return s.pendingCount > 0;
      if (filter === "hoje") return s.isToday;
      if (filter === "pagos") return s.pendingCount === 0;
      return true;
    });
  }, [groupedSales, search, startDate, endDate, filter]);

  const sortedSales = useMemo(() => {
    return [...filteredSales].sort((a, b) => {
      // Prioridade por Data de Venda (mais recentes primeiro)
      return new Date(b.data_fechamento) - new Date(a.data_fechamento);
    });
  }, [filteredSales]);

  return (
    <div className="flex h-screen bg-[#fbfbfd] overflow-hidden text-[#1d1d1f] font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#fbfbfd]">
          <div className="mx-auto px-8 py-10 lg:px-12 max-w-[1300px]">

            {/* Header Section */}
            <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-[40px] leading-tight font-bold tracking-tight text-[#1d1d1f]">
                  Validação de Venda
                </h1>
                <p className="mt-1 text-[17px] leading-relaxed text-[#86868b] font-medium">
                  Confirme o pagamento das parcelas pelos clientes para liberar as comissões da equipe.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-3.5 shadow-sm border border-black/[0.04] w-full lg:w-[480px]">
                <Search size={22} className="text-[#86868b]" />
                <input
                  type="text"
                  placeholder="Buscar cliente, banco ou closer..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-transparent text-[16px] outline-none placeholder-[#86868b] text-[#1d1d1f] font-medium"
                />
              </div>
            </div>

            {/* Stat Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <StatCard
                 title="Total Pendente"
                 value={currency(stats.totalPendente)}
                 icon={DollarSign}
                 colorClass="bg-[#008263]"
              />
              <StatCard
                 title="Vencem Hoje"
                 value={`${stats.vencemHoje.length} clientes`}
                 subValue={currency(stats.vencemHoje.reduce((sum, p) => sum + p.valor_parcela, 0))}
                 icon={Calendar}
                 colorClass="bg-[#f0a500]"
              />
              <StatCard
                 title="Em Atraso"
                 value={`${stats.emAtraso.length} clientes`}
                 subValue={currency(stats.emAtraso.reduce((sum, p) => sum + p.valor_parcela, 0))}
                 icon={AlertCircle}
                 colorClass="bg-[#d32f2f]"
              />
              <StatCard
                 title="Total de Closers"
                 value={stats.closersCount}
                 subValue="na validação"
                 icon={Users}
                 colorClass="bg-[#2a5bd7]"
              />
            </div>

            {/* Filters and Sorting */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
           <div className="flex flex-wrap items-center gap-4">
             <div className="flex bg-white rounded-xl shadow-sm border border-black/[0.04] p-1">
               <button
                 onClick={() => setFilter("pendentes")}
                 className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-all ${filter === 'pendentes' ? 'bg-[#e3000f] text-white shadow-md' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
               >
                 Pendentes <span className="ml-1 opacity-60 text-[11px]">{(groupedSales || []).filter(s => s.pendingCount > 0).length}</span>
               </button>
               <button
                 onClick={() => setFilter("hoje")}
                 className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-all ${filter === 'hoje' ? 'bg-[#f0a500] text-white shadow-md' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
               >
                 Vencem Hoje <span className="ml-1 opacity-60 text-[11px]">{(groupedSales || []).filter(s => s.isToday).length}</span>
               </button>
               <button
                 onClick={() => setFilter("pagos")}
                 className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-all ${filter === 'pagos' ? 'bg-[#008263] text-white shadow-md' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
               >
                 Pagos <span className="ml-1 opacity-60 text-[11px]">{(groupedSales || []).filter(s => s.pendingCount === 0).length}</span>
               </button>
             </div>

             <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm border border-black/[0.04] px-3 py-1">
               <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Venda:</span>
               <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent text-[13px] font-medium text-[#1d1d1f] outline-none"
               />
               <span className="text-[#c7c7cc]">-</span>
               <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent text-[13px] font-medium text-[#1d1d1f] outline-none"
               />
               {(startDate || endDate) && (
                 <button onClick={() => { setStartDate(""); setEndDate(""); }} className="text-[#86868b] hover:text-[#e3000f] ml-1">
                    <X size={14} />
                 </button>
               )}
             </div>
           </div>

               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-black/[0.04] shadow-sm text-[14px] font-bold text-[#1d1d1f] cursor-pointer hover:bg-black/[0.01]">
                     <span>Todos os Closers</span>
                     <ChevronRight size={16} className="rotate-90" />
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-black/[0.04] shadow-sm text-[14px] font-bold text-[#1d1d1f] cursor-pointer hover:bg-black/[0.01]">
                     <span className="text-[#86868b] font-medium">Ordernar por:</span>
                     <span>Data da Venda</span>
                     <ArrowUpDown size={16} className="text-[#86868b]" />
                  </div>
               </div>
            </div>

            {/* Cards List */}
            <div className="pb-20">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                   <div className="w-10 h-10 border-4 border-[#d4af37]/20 border-t-[#d4af37] rounded-full animate-spin" />
                   <span className="text-[#86868b] font-medium">Carregando pendências...</span>
                </div>
              ) : sortedSales.length === 0 ? (
                <div className="bg-white rounded-[32px] p-20 text-center border border-dashed border-black/[0.1]">
                   <p className="text-[#86868b] text-[18px] font-medium">Nenhum pagamento encontrado para este filtro.</p>
                </div>
              ) : (
                sortedSales.map(sale => (
                  <SaleCard key={sale.venda_id} sale={sale} onConfirm={handleValidar} />
                ))
              )}
            </div>

            {/* Pagination Footer (Mock) */}
            {!loading && sortedSales.length > 0 && (
              <div className="bg-[#f2f2f7] p-2 flex items-center justify-between rounded-full border border-black/[0.04] mt-6">
                 <span className="ml-6 text-[13px] font-medium text-[#86868b]">Exibindo {sortedSales.length} de {groupedSales.length} pendências</span>
                 <div className="flex items-center gap-1">
                    <button className="w-8 h-8 flex items-center justify-center rounded-full bg-[#008263] text-white font-bold text-[13px]">1</button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] text-[#1d1d1f] font-bold text-[13px]">2</button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] text-[#1d1d1f] font-bold text-[13px]">3</button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-full text-[#86868b] px-2 leading-none">›</button>
                 </div>
              </div>
            )}
            
          </div>
        </main>
      </div>
    </div>
  );
}
