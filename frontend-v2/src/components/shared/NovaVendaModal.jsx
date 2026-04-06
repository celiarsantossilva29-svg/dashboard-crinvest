import React, { useState, useEffect } from "react";
import { X, CheckCircle2 } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function NovaVendaModal({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  
  const [formData, setFormData] = useState({
    cliente_nome: "",
    cliente_cpf: "",
    valor_venda: "",
    data_fechamento: new Date().toISOString().split('T')[0],
    administradora: "Porto Seguro",
    promocao: false,
    sdr_id: "",
    closer_id: "",
    cliente_telefone: "",
    cliente_cnpj: "",
    cliente_localizacao: ""
  });

  useEffect(() => {
    if (isOpen) {
      api.get("/usuarios")
        .then(res => setUsuarios(res.data))
        .catch(console.error);
        
      // Reset form defaults when opened
      setFormData(prev => ({
        ...prev,
        cliente_nome: "",
        cliente_cpf: "",
        valor_venda: "",
        promocao: false,
        sdr_id: user?.role === 'SDR' ? user.id : "",
        closer_id: user?.role === 'CLOSER' ? user.id : "",
        cliente_telefone: "",
        cliente_cnpj: "",
        cliente_localizacao: ""
      }));
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const sdrs = usuarios.filter(u => u.role === 'SDR');
  const closers = usuarios.filter(u => u.role === 'CLOSER');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // payload matches backend expectations
      const payload = {
        ...formData,
        valor_venda: parseFloat(formData.valor_venda),
      };

      await api.post("/vendas", payload);
      onSuccess(); // triggers refetch in parent
      onClose();
    } catch (error) {
      console.error("Erro ao registrar venda", error);
      alert("Erro ao registrar venda. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.15)] ring-1 ring-black/[0.04]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-[#1d1d1f]">Registrar Venda</h2>
            <p className="text-[14px] text-[#86868b] font-medium mt-1">Insira os dados do contrato faturado.</p>
          </div>
          <button 
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f5f7] text-[#86868b] hover:bg-[#e5e5ea] hover:text-[#1d1d1f] transition-colors"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">Cliente (Nome Completo)</label>
              <input 
                required
                type="text" 
                value={formData.cliente_nome}
                onChange={e => setFormData({...formData, cliente_nome: e.target.value})}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d4af37]/10 transition-all"
                placeholder="Ex: João Silva Mendes"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">CPF do Cliente</label>
              <input 
                required
                type="text" 
                value={formData.cliente_cpf}
                onChange={e => setFormData({...formData, cliente_cpf: e.target.value})}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d4af37]/10 transition-all"
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">CNPJ (Opcional)</label>
              <input 
                type="text" 
                value={formData.cliente_cnpj}
                onChange={e => setFormData({...formData, cliente_cnpj: e.target.value})}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d4af37]/10 transition-all"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">Telefone</label>
              <input 
                required
                type="text" 
                value={formData.cliente_telefone}
                onChange={e => setFormData({...formData, cliente_telefone: e.target.value})}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d4af37]/10 transition-all"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">Cidade/Estado</label>
              <input 
                required
                type="text" 
                value={formData.cliente_localizacao}
                onChange={e => setFormData({...formData, cliente_localizacao: e.target.value})}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d4af37]/10 transition-all"
                placeholder="Ex: São Paulo - SP"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">Valor do Crédito (R$)</label>
              <input 
                required
                type="number" 
                step="0.01"
                min="0"
                value={formData.valor_venda}
                onChange={e => setFormData({...formData, valor_venda: e.target.value})}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d4af37]/10 transition-all"
                placeholder="Ex: 500000"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">Data do Fechamento</label>
              <input 
                required
                type="date" 
                value={formData.data_fechamento}
                onChange={e => setFormData({...formData, data_fechamento: e.target.value})}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d4af37]/10 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">Administradora</label>
              <select 
                required
                value={formData.administradora}
                onChange={e => setFormData({...formData, administradora: e.target.value})}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d4af37]/10 transition-all"
              >
                <option value="Porto Seguro">Porto Seguro</option>
                <option value="Embracon">Embracon</option>
                <option value="Ademicon">Ademicon</option>
                <option value="Rodobens">Rodobens</option>
                <option value="Outra">Outra</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">SDR Responsável</label>
              <select 
                value={formData.sdr_id}
                onChange={e => setFormData({...formData, sdr_id: e.target.value})}
                disabled={user?.role === 'SDR'}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d4af37]/10 transition-all disabled:opacity-60"
              >
                <option value="">Nenhum (Prospecção Direta)</option>
                {sdrs.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#86868b] uppercase tracking-wider">Closer Responsável</label>
              <select 
                required
                value={formData.closer_id}
                onChange={e => setFormData({...formData, closer_id: e.target.value})}
                disabled={user?.role === 'CLOSER'}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[15px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d4af37]/10 transition-all disabled:opacity-60"
              >
                <option value="">Selecione o Closer</option>
                {closers.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>

            <div className="col-span-2 flex items-center gap-3 mt-2">
              <input 
                type="checkbox" 
                id="promocao"
                checked={formData.promocao}
                onChange={e => setFormData({...formData, promocao: e.target.checked})}
                className="h-5 w-5 rounded border-[#e5e5ea] text-[#d4af37] focus:ring-[#d4af37]"
              />
              <label htmlFor="promocao" className="text-[15px] font-semibold text-[#1d1d1f] cursor-pointer">
                Venda gerada em Campanha Promocional
              </label>
            </div>

          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e8c96b] px-4 py-4 text-[16px] font-bold text-[#1d1d1f] shadow-[0_4px_14px_rgba(212,175,55,0.3)] transition-all hover:scale-[1.01] hover:shadow-[0_6px_20px_rgba(212,175,55,0.4)] disabled:opacity-70 disabled:hover:scale-100"
            >
              {loading ? "Registrando..." : (
                <>
                  <CheckCircle2 size={20} strokeWidth={2.5} />
                  <span>Salvar Venda no Pipeline</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
