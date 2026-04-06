import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/layout/Header";
import api from "../../services/api";
import { Edit2, Trash2, Search, DollarSign, Calendar, User, Save, X, List, PlusCircle, TrendingUp, Award, Users as UsersIcon, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import NovaVendaForm from "../../components/NovaVendaForm";

function currency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString('pt-BR');
}

export default function GestaoVendas() {
  const [vendas, setVendas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingVenda, setEditingVenda] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNovaVendaOpen, setIsNovaVendaOpen] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Derived Metrics
  const metrics = useMemo(() => {
    if (!vendas.length) return { totalVendido: 0, ticketMedio: 0, count: 0, growth: 12 };
    const total = vendas.reduce((acc, v) => acc + (v.valor_venda || 0), 0);
    return {
      totalVendido: total,
      ticketMedio: total / vendas.length,
      count: vendas.length,
      growth: 12 // Mocked growth as seen in mockup
    };
  }, [vendas]);

  // Closer Ranking
  const ranking = useMemo(() => {
    const map = {};
    vendas.forEach(v => {
      if (!v.closer_id) return;
      if (!map[v.closer_id]) map[v.closer_id] = { id: v.closer_id, nome: v.closer_nome, total: 0, count: 0, role: 'Closer' };
      map[v.closer_id].total += v.valor_venda;
      map[v.closer_id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [vendas]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vendasRes, usuariosRes] = await Promise.all([
        api.get("/vendas"),
        api.get("/usuarios")
      ]);
      setVendas(vendasRes.data);
      setUsuarios(usuariosRes.data);
    } catch (error) {
      console.error("Erro ao buscar dados", error);
      // Fallback for layout preview
      setVendas([
        { id: 1, cliente_nome: "Roberto Almeida", closer_nome: "Célia Invest", valor_venda: 1250000, administradora: "Porto", data_fechamento: new Date().toISOString() },
        { id: 2, cliente_nome: "Mariana Souza", closer_nome: "Eunice Silva", valor_venda: 850000, administradora: "Embracon", data_fechamento: new Date().toISOString() },
        { id: 3, cliente_nome: "Carlos Fernandes", closer_nome: "Célia Invest", valor_venda: 2100000, administradora: "Porto", data_fechamento: new Date().toISOString() },
      ]);
      setUsuarios([
        { id: 'u1', nome: "Célia Invest", role: "CLOSER" },
        { id: 'u2', nome: "Eunice Silva", role: "CLOSER" },
        { id: 'u3', nome: "Cauê", role: "SDR" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (venda) => {
    setEditingVenda({
      ...venda,
      valor_venda: venda.valor_venda.toString(),
      data_fechamento: venda.data_fechamento ? venda.data_fechamento.split('T')[0] : "",
      cliente_telefone: venda.cliente_telefone || "",
      cliente_cnpj: venda.cliente_cnpj || "",
      cliente_localizacao: venda.cliente_localizacao || ""
    });
    setIsModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/vendas/${editingVenda.id}`, {
        ...editingVenda,
        valor_venda: parseFloat(editingVenda.valor_venda)
      });
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Erro ao salvar edição", error);
      alert("Erro ao salvar alterações.");
    }
  };

  const filtered = useMemo(() => {
    return vendas.filter(v => {
      const matchSearch = v.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
                         v.closer_nome?.toLowerCase().includes(search.toLowerCase());
      
      const saleDate = v.data_fechamento ? v.data_fechamento.split('T')[0] : null;
      const matchDate = !saleDate || (saleDate >= startDate && saleDate <= endDate);
      
      return matchSearch && matchDate;
    });
  }, [vendas, search, startDate, endDate]);

  return (
    <div className="flex h-screen bg-[#f4f7fa] overflow-hidden text-[#1d1d1f] font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto px-4 py-3 max-w-7xl">
            {/* Header Area */}
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">
                Gestão de vendas
              </h1>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsNovaVendaOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1d1d1f] text-white px-3.5 py-2 text-[11px] font-bold shadow-sm hover:bg-black transition-all hover:scale-[1.02]"
                >
                  <PlusCircle size={14} />
                  Registrar Nova Venda
                </button>
              </div>
            </div>

            {/* KPI Row and Filter Grid */}
            <div className="grid grid-cols-12 gap-2.5 mb-4">
              {/* KPI Cards */}
              <div className="col-span-12 lg:col-span-8 grid grid-cols-3 gap-2.5">
                <div className="bg-white p-3 rounded-[12px] shadow-sm border border-black/[0.03] hover:shadow-md transition-all">
                  <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-tight mb-1">Total vendido</p>
                  <div className="flex items-baseline gap-1">
                    <h3 className="text-[16px] leading-tight font-black tabular-nums">{currency(metrics.totalVendido)}</h3>
                  </div>
                  <p className="mt-0.5 text-[9px] font-bold text-emerald-500 flex items-center gap-0.5">
                    <TrendingUp size={10} /> +{metrics.growth}% <span className="text-[#86868b] font-medium ml-0.5 lowercase">vs mês</span>
                  </p>
                </div>
                <div className="bg-white p-3 rounded-[12px] shadow-sm border border-black/[0.03] hover:shadow-md transition-all">
                  <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-tight mb-1">Ticket médio</p>
                  <h3 className="text-[16px] font-black text-[#d4af37] tabular-nums">{currency(metrics.ticketMedio)}</h3>
                </div>
                <div className="bg-white p-3 rounded-[12px] shadow-sm border border-black/[0.03] hover:shadow-md transition-all">
                  <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-tight mb-1">Nº de vendas</p>
                  <h3 className="text-[16px] font-black tabular-nums">{metrics.count}</h3>
                </div>
              </div>

              {/* Advanced Filter Box */}
              <div className="col-span-12 lg:col-span-4 bg-white p-3 rounded-[12px] shadow-sm border border-black/[0.03] grid grid-cols-2 gap-2">
                <div className="col-span-2 flex items-center gap-2 bg-[#fbfbfd] border border-black/[0.04] px-2.5 py-1.5 rounded-lg">
                  <Calendar size={12} className="text-[#86868b]" />
                  <div className="text-[9px] font-bold flex flex-col">
                    <span className="text-[#86868b] text-[8px]">Período</span>
                    <div className="flex items-center gap-1.5 leading-tight">
                       <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent outline-none text-[10px]" />
                       <span className="text-gray-300">→</span>
                       <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent outline-none text-[10px]" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-[#fbfbfd] border border-black/[0.04] px-2.5 py-1.5 rounded-lg select-none">
                  <Filter size={12} className="text-[#86868b]" />
                  <span className="text-[10px] font-bold text-[#1d1d1f]">Filtros</span>
                </div>
                <div className="flex items-center gap-2 bg-[#fbfbfd] border border-black/[0.04] px-2.5 py-1.5 rounded-lg select-none">
                  <UsersIcon size={12} className="text-[#86868b]" />
                  <span className="text-[10px] font-bold text-[#1d1d1f]">Closers</span>
                </div>
              </div>
            </div>

            {/* Main 2-Column Content */}
            <div className="grid grid-cols-12 gap-3 items-start">
              {/* Left Column: Sales Table */}
              <div className="col-span-12 lg:col-span-8">
                <section className="bg-white rounded-[16px] shadow-sm border border-black/[0.03] overflow-hidden">
                  <div className="p-4 border-b border-black/[0.03] flex items-center justify-between">
                    <h2 className="text-[16px] font-bold text-[#1d1d1f]">Histórico de Vendas</h2>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f4f7fa] border border-black/[0.03]">
                      <Search size={14} className="text-[#86868b]" />
                      <input 
                        type="text"
                        placeholder="Buscar..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-transparent outline-none text-[11px] w-28 focus:w-40 transition-all font-medium"
                      />
                    </div>
                  </div>
                  
                  {loading ? (
                    <div className="py-10 text-center text-[#86868b] font-medium text-[12px]">Carregando histórico...</div>
                  ) : (
                    <div className="overflow-x-auto px-2 pb-2 mt-2">
                      <table className="min-w-full text-left">
                        <thead>
                          <tr className="text-[9px] font-bold text-[#86868b] border-b border-black/[0.01]">
                            <th className="px-3 py-2">Data</th>
                            <th className="px-3 py-2">Cliente</th>
                            <th className="px-3 py-2">Responsável</th>
                            <th className="px-3 py-2">Admin.</th>
                            <th className="px-3 py-2 text-right">Valor Venda</th>
                            <th className="px-3 py-2 text-right w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.01]">
                          {filtered.map((v) => (
                            <tr key={v.id} className="group hover:bg-[#fbfbfd] transition-all border-b border-black/[0.005]">
                              <td className="px-3 py-2 text-[11px] text-[#86868b] font-medium">{formatDate(v.data_fechamento)}</td>
                              <td className="px-3 py-2">
                                <p className="text-[12px] font-bold text-[#1d1d1f] line-clamp-1">{v.cliente_nome}</p>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2 leading-tight">
                                  {v.closer_nome?.toLowerCase().includes('célia') || v.closer_nome?.toLowerCase().includes('cauê') || v.closer_nome?.toLowerCase().includes('eunice') ? (
                                    <div className="h-7 w-7 rounded-full border border-white shadow-sm ring-1 ring-[#d4af37]/10 overflow-hidden">
                                       <img 
                                         src={
                                           v.closer_nome?.toLowerCase().includes('célia') ? "/img/celia.png" : 
                                           v.closer_nome?.toLowerCase().includes('cauê') ? "/img/caue.png" : 
                                           "/img/eunice.png"
                                         } 
                                         className="h-full w-full object-cover" 
                                       />
                                    </div>
                                  ) : (
                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#d4af37] to-[#e8c96b] flex items-center justify-center text-white font-black text-[10px] shadow-sm ring-1 ring-white">
                                       {v.closer_nome?.charAt(0) || "U"}
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-[12px] font-bold text-[#1d1d1f]">{v.closer_nome}</p>
                                    <p className="text-[8px] font-bold text-[#86868b] uppercase tracking-wider">Closer</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <span className="inline-flex px-1.5 py-0.5 rounded bg-[#f0f2f5] text-[9px] font-bold text-[#86868b] uppercase">
                                  {v.administradora}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[13px] font-bold text-[#1d1d1f] text-right tabular-nums">{currency(v.valor_venda)}</td>
                              <td className="px-3 py-2 text-right">
                                <button 
                                  onClick={() => handleEdit(v)}
                                  className="p-1.5 rounded-md bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#1d1d1f] hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Edit2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Pagination Mockup */}
                      <div className="p-4 flex items-center justify-between border-t border-black/[0.02] mt-4">
                        <span className="text-[12px] text-[#86868b] font-medium">Mostrando {filtered.length} de {vendas.length} vendas</span>
                        <div className="flex items-center gap-2">
                          <button className="p-2 rounded-lg border border-black/[0.05] text-gray-400 hover:bg-gray-50"><ChevronLeft size={16} /></button>
                          <button className="w-8 h-8 rounded-lg bg-[#1d1d1f] text-white text-[12px] font-bold">1</button>
                          <button className="w-8 h-8 rounded-lg border border-black/[0.05] text-[12px] font-bold hover:bg-gray-50">2</button>
                          <button className="p-2 rounded-lg border border-black/[0.05] hover:bg-gray-50"><ChevronRight size={16} /></button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* Right Column: Rankings */}
              <div className="col-span-12 lg:col-span-4">
                <section className="bg-white rounded-[24px] shadow-sm border border-black/[0.03] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[16px] font-bold text-[#1d1d1f]">Ranking dos Closers</h2>
                    <Award size={18} className="text-[#d4af37]" />
                  </div>

                  <div className="space-y-3">
                    {ranking.map((c, idx) => (
                      <div key={c.id} className="relative bg-[#fbfbfd] border border-black/[0.03] p-3 rounded-[16px] hover:shadow-md transition-all group overflow-hidden">
                        {idx === 0 && (
                          <div className="absolute top-0 right-0 p-2 text-[#d4af37]">
                            <Award size={14} fill="currentColor" strokeWidth={1} />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            {c.nome?.toLowerCase().includes('célia') || c.nome?.toLowerCase().includes('cauê') || c.nome?.toLowerCase().includes('eunice') ? (
                              <div className="h-8 w-8 rounded-full border border-white shadow-sm ring-1 ring-[#d4af37]/10 overflow-hidden">
                                <img 
                                  src={
                                    c.nome?.toLowerCase().includes('célia') ? "/img/celia.png" : 
                                    c.nome?.toLowerCase().includes('cauê') ? "/img/caue.png" : 
                                    "/img/eunice.png"
                                  } 
                                  className="h-full w-full object-cover" 
                                />
                              </div>
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200 border-white shadow-sm flex items-center justify-center font-black text-gray-500 overflow-hidden text-[11px]">
                                {c.nome?.charAt(0) || "U"}
                              </div>
                            )}
                            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#1d1d1f] text-white border-white flex items-center justify-center text-[8px] font-bold">
                              {idx + 1}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-[13px] font-bold text-[#1d1d1f] leading-tight">{c.nome}</h4>
                            <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider">Closer</p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-black/[0.03] pt-3">
                          <div className="col-span-2">
                            <p className="text-[9px] font-bold text-[#86868b] mb-1">Total vendido</p>
                            <p className="text-[14px] font-bold text-[#1d1d1f] tabular-nums">{currency(c.total)}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-[9px] font-bold text-[#86868b] mb-1">Vendas</p>
                             <p className="text-[14px] font-bold text-[#d4af37] tabular-nums">{c.count}</p>
                          </div>
                          <div className="col-span-3 mt-2 bg-white/50 p-2 rounded-lg border border-black/[0.02]">
                            <p className="text-[8px] font-bold text-[#86868b] mb-0.5">Ticket médio</p>
                            <p className="text-[12px] font-bold text-[#1d1d1f] tabular-nums">{currency(c.total / c.count)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* New Sale Modal/View Overlay */}
      {isNovaVendaOpen && (
        <div className="fixed inset-0 z-[100] bg-[#fbfbfd] animate-in slide-in-from-right duration-300 overflow-y-auto pt-12">
          <div className="max-w-[800px] mx-auto px-6 py-8 relative">
             <button 
                onClick={() => setIsNovaVendaOpen(false)}
                className="absolute top-0 right-6 p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="Fechar e Voltar"
             >
                <X size={24} className="text-gray-400" />
             </button>
             <div className="mt-8">
               <NovaVendaForm onSuccess={() => {
                 fetchData();
                 setIsNovaVendaOpen(false);
               }} />
             </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white rounded-[32px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[24px] font-bold text-[#1d1d1f]">Editar Registro de Venda</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-[#f5f5f7] text-[#86868b]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Nome do Cliente</label>
                  <input 
                    type="text"
                    value={editingVenda.cliente_nome}
                    onChange={e => setEditingVenda({...editingVenda, cliente_nome: e.target.value})}
                    className="w-full rounded-2xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Valor do Crédito</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868b] font-bold text-[14px]">R$</span>
                    <input 
                      type="number"
                      step="0.01"
                      value={editingVenda.valor_venda}
                      onChange={e => setEditingVenda({...editingVenda, valor_venda: e.target.value})}
                      className="w-full rounded-2xl border border-[#e5e5ea] bg-[#fbfbfd] pl-10 pr-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Data do Registro</label>
                  <input 
                    type="date"
                    value={editingVenda.data_fechamento}
                    onChange={e => setEditingVenda({...editingVenda, data_fechamento: e.target.value})}
                    className="w-full rounded-2xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Closer</label>
                  <select 
                    value={editingVenda.closer_id}
                    onChange={e => setEditingVenda({...editingVenda, closer_id: e.target.value})}
                    className="w-full rounded-2xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:outline-none transition-all"
                  >
                     {usuarios.filter(u => u.role === 'CLOSER').map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Telefone</label>
                  <input 
                    type="text"
                    value={editingVenda.cliente_telefone}
                    onChange={e => setEditingVenda({...editingVenda, cliente_telefone: e.target.value})}
                    className="w-full rounded-2xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">CNPJ</label>
                  <input 
                    type="text"
                    value={editingVenda.cliente_cnpj}
                    onChange={e => setEditingVenda({...editingVenda, cliente_cnpj: e.target.value})}
                    className="w-full rounded-2xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Cidade/Estado</label>
                  <input 
                    type="text"
                    value={editingVenda.cliente_localizacao}
                    onChange={e => setEditingVenda({...editingVenda, cliente_localizacao: e.target.value})}
                    className="w-full rounded-2xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-2xl bg-[#f5f5f7] py-4 text-[16px] font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed] transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#e8c96b] py-4 text-[16px] font-bold text-[#1d1d1f] shadow-lg hover:scale-[1.02] transition-all"
                >
                  Salvar Alterações
                </button>
              </div>

              <p className="text-center text-[12px] text-[#86868b] font-medium mt-4">
                ⚠ As parcelas pendentes serão recalculadas automaticamente para fechar com o novo valor.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
