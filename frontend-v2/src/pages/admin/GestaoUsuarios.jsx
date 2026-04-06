import React, { useState, useEffect } from "react";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/layout/Header";
import api from "../../services/api";
import { Edit2, Search, DollarSign, Target, UserPlus, Save, X, Mail, Shield } from "lucide-react";

function currency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function GestaoUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const res = await api.get("/usuarios");
      setUsuarios(res.data);
    } catch (error) {
      console.error("Erro ao buscar usuários", error);
      // Mock data for layout preview
      setUsuarios([
        { id: 'u1', nome: "Admin CR Invest", email: "admin@crinvest.com.br", role: "ADMIN", fixo_mensal: 0, meta_vendas: 0 },
        { id: 'u2', nome: "Célia Invest", email: "celia@crinvest.com.br", role: "CLOSER", fixo_mensal: 2500, meta_vendas: 2000000 },
        { id: 'u3', nome: "Eunice Silva", email: "eunice@crinvest.com.br", role: "CLOSER", fixo_mensal: 2500, meta_vendas: 1500000 },
        { id: 'u4', nome: "Cauê", email: "caue@crinvest.com.br", role: "SDR", fixo_mensal: 1800, meta_vendas: 0 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (u) => {
    setEditingUser({
      ...u,
      fixo_mensal: u.fixo_mensal?.toString() || "0",
      meta_vendas: u.meta_vendas?.toString() || "0"
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/usuarios/${editingUser.id}`, {
        ...editingUser,
        fixo_mensal: parseFloat(editingUser.fixo_mensal),
        meta_vendas: parseFloat(editingUser.meta_vendas)
      });
      setIsModalOpen(false);
      fetchUsuarios();
    } catch (error) {
      console.error("Erro ao salvar usuário", error);
      alert("Erro ao salvar alterações.");
    }
  };

  const filtered = usuarios.filter(u => 
    u.nome?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#fbfbfd] overflow-hidden text-[#1d1d1f] font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#fbfbfd]">
          <div className="mx-auto px-8 py-10 lg:px-12 max-w-[1200px]">
            <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-[40px] leading-tight font-bold tracking-tight text-[#1d1d1f]">
                  Configuração da Equipe
                </h1>
                <p className="mt-2 text-[17px] leading-relaxed text-[#86868b] font-medium">
                  Defina o Salário Fixo e a Meta de Venda Mensal de cada Closer e SDR.
                </p>
              </div>

              <div className="flex w-full lg:w-80 items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm border border-black/[0.04]">
                <Search size={18} className="text-[#86868b]" />
                <input 
                  type="text"
                  placeholder="Buscar colaborador..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-transparent text-[15px] outline-none placeholder-[#86868b] text-[#1d1d1f]"
                />
              </div>
            </div>

            <section className="rounded-[32px] border border-black/[0.04] bg-white p-8 shadow-[0_8px_32px_rgb(0,0,0,0.04)]">
              {loading ? (
                <div className="py-20 text-center text-[#86868b] font-medium">Carregando equipe...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="border-b border-black/[0.04]">
                        <th className="px-5 py-4 text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">Nome / Perfil</th>
                        <th className="px-5 py-4 text-[13px] font-semibold text-[#86868b] uppercase tracking-wider text-right">Salário Fixo</th>
                        <th className="px-5 py-4 text-[13px] font-semibold text-[#86868b] uppercase tracking-wider text-right">Meta de Venda</th>
                        <th className="px-5 py-4 text-[13px] font-semibold text-[#86868b] uppercase tracking-wider text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u) => (
                        <tr key={u.id} className="border-b border-black/[0.02] last:border-0 hover:bg-[#fbfbfd] transition-colors">
                          <td className="px-5 py-5">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${u.role === 'ADMIN' ? 'bg-[#1d1d1f]' : u.role === 'CLOSER' ? 'bg-[#d4af37]' : 'bg-[#0066cc]'}`}>
                                {u.nome.charAt(0)}
                              </div>
                              <div>
                                <p className="text-[15px] font-bold text-[#1d1d1f]">{u.nome}</p>
                                <p className="text-[12px] text-[#86868b] font-medium uppercase tracking-tight">{u.role}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-5 text-[15px] font-semibold text-[#1d1d1f] text-right">{currency(u.fixo_mensal || 0)}</td>
                          <td className="px-5 py-5 text-[15px] font-bold text-[#b8860b] text-right">{currency(u.meta_vendas || 0)}</td>
                          <td className="px-5 py-5 text-right flex justify-end gap-3">
                            <button 
                              onClick={() => handleEdit(u)}
                              className="p-2.5 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#d4af37] hover:text-white transition-all shadow-sm"
                            >
                              <Edit2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* Modal de Edição de Usuário */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-[32px] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[24px] font-bold text-[#1d1d1f]">Editar Perfil e Metas</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-[#f5f5f7] text-[#86868b]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#f5f5f7] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <Shield className="text-[#d4af37]" />
                  </div>
                  <div>
                    <p className="text-[16px] font-bold text-[#1d1d1f]">{editingUser.nome}</p>
                    <p className="text-[12px] text-[#86868b] uppercase tracking-widest">{editingUser.role}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Salário Fixo</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868b] font-bold text-[13px]">R$</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={editingUser.fixo_mensal}
                        onChange={e => setEditingUser({...editingUser, fixo_mensal: e.target.value})}
                        className="w-full rounded-2xl border border-[#e5e5ea] bg-[#fbfbfd] pl-10 pr-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Meta de Vendas</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868b] font-bold text-[13px]">R$</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={editingUser.meta_vendas}
                        onChange={e => setEditingUser({...editingUser, meta_vendas: e.target.value})}
                        className="w-full rounded-2xl border border-[#e5e5ea] bg-[#fbfbfd] pl-10 pr-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-2xl bg-[#f5f5f7] py-4 text-[16px] font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed] transition-all"
                >
                  Sair
                </button>
                <button 
                  type="submit"
                  className="flex-1 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#e8c96b] py-4 text-[16px] font-bold text-[#1d1d1f] shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  <span>Salvar Dados</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
