import React, { useState, useEffect } from "react";
import { CheckCircle2, DollarSign } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export default function NovaVendaForm({ onSuccess }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [successMsg, setSuccessMsg] = useState("");
  
  const [formData, setFormData] = useState({
    cliente_nome: "",
    cliente_cpf: "",
    valor_venda: "",
    data_fechamento: new Date().toISOString().split('T')[0],
    administradora: "Porto Seguro",
    promocao: false,
    sdr_id: "",
    closer_id: ""
  });

  useEffect(() => {
    api.get("/usuarios")
      .then(res => setUsuarios(res.data))
      .catch(console.error);
      
    setFormData(prev => ({
      ...prev,
      sdr_id: user?.role === 'SDR' ? user.id : "",
      closer_id: user?.role === 'CLOSER' ? user.id : ""
    }));
  }, [user]);

  const sdrs = usuarios.filter(u => u.role === 'SDR');
  const closers = usuarios.filter(u => u.role === 'CLOSER');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg("");
    
    try {
      const payload = {
        ...formData,
        valor_venda: parseFloat(formData.valor_venda),
      };

      await api.post("/vendas", payload);
      setSuccessMsg("Venda registrada com sucesso! A comissão foi direcionada para a esteira do Administrador.");
      
      // Clear specific fields
      setFormData(prev => ({
        ...prev,
        cliente_nome: "",
        cliente_cpf: "",
        valor_venda: "",
        promocao: false
      }));

      // Opt callback if we are inside Gestão de Vendas waiting to refresh the table
      if (onSuccess) onSuccess();

    } catch (error) {
      console.error("Erro ao registrar venda", error);
      alert("Erro ao registrar venda. Verifique se os dados estão corretos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="mb-6">
        <h1 className="text-[24px] leading-tight font-semibold tracking-tight text-[#1d1d1f]">
          Registrar Venda Oficial
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#86868b] font-medium">
          Insira os dados do contrato faturado para processamento de comissões.
        </p>
      </div>

      <section className="rounded-[16px] border border-black/[0.04] bg-white p-6 shadow-[0_8px_32px_rgb(0,0,0,0.04)] relative">
        {successMsg && (
          <div className="mb-5 rounded-xl bg-[#e6f4ea] p-4 border border-[#008f39]/20 flex items-start gap-3 transition-all">
            <div className="mt-0.5 rounded-full bg-[#008f39] text-white p-1">
              <CheckCircle2 size={16} />
            </div>
            <p className="font-semibold text-[#008f39] text-[14px]">{successMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[11px] font-bold text-[#86868b]">Cliente (Nome completo)</label>
              <input 
                required
                type="text" 
                value={formData.cliente_nome}
                onChange={e => setFormData({...formData, cliente_nome: e.target.value})}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[14px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none transition-all placeholder:text-[#86868b]/60"
                placeholder="Ex: João Silva Mendes"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#86868b]">CPF do cliente</label>
              <input 
                required
                type="text" 
                value={formData.cliente_cpf}
                onChange={e => setFormData({...formData, cliente_cpf: e.target.value})}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[14px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none transition-all placeholder:text-[#86868b]/60"
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#86868b]">Valor do crédito fechado (R$)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-[#86868b]">
                  <DollarSign size={16} />
                </div>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  min="0"
                  value={formData.valor_venda}
                  onChange={e => setFormData({...formData, valor_venda: e.target.value})}
                  className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] pl-10 pr-4 py-3 text-[14px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none transition-all placeholder:text-[#86868b]/60 tabular-nums"
                  placeholder="Ex: 500000.00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#86868b]">Data do fechamento</label>
              <input 
                required
                type="date" 
                value={formData.data_fechamento}
                onChange={e => setFormData({...formData, data_fechamento: e.target.value})}
                className="w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[14px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none transition-all text-[#86868b]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#86868b]">Administradora</label>
              <div className="relative">
                <select 
                  required
                  value={formData.administradora}
                  onChange={e => setFormData({...formData, administradora: e.target.value})}
                  className="w-full appearance-none rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[14px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none transition-all"
                >
                  <option value="Porto Seguro">Porto Seguro</option>
                  <option value="Embracon">Embracon</option>
                  <option value="Ademicon">Ademicon</option>
                  <option value="Rodobens">Rodobens</option>
                  <option value="Outra">Outra</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#86868b]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#86868b]">Venda por SDR (Opcional)</label>
              <div className="relative">
                <select 
                  value={formData.sdr_id}
                  onChange={e => setFormData({...formData, sdr_id: e.target.value})}
                  disabled={user?.role === 'SDR'}
                  className="w-full appearance-none rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[14px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Prospecção direta (Sem SDR)</option>
                  {sdrs.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#86868b]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#86868b]">Venda por Closer (Obrigatório)</label>
              <div className="relative">
                <select 
                  required
                  value={formData.closer_id}
                  onChange={e => setFormData({...formData, closer_id: e.target.value})}
                  disabled={user?.role === 'CLOSER'}
                  className="w-full appearance-none rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-3 text-[14px] font-medium text-[#1d1d1f] focus:border-[#d4af37] focus:bg-white focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Selecione o Closer</option>
                  {closers.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#86868b]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 mt-2 rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] p-4">
              <label className="flex items-center gap-3 cursor-pointer relative group">
                <div className="relative flex items-center justify-center p-0.5">
                  <input 
                    type="checkbox" 
                    checked={formData.promocao}
                    onChange={e => setFormData({...formData, promocao: e.target.checked})}
                    className="peer sr-only"
                  />
                  <div className="h-5 w-9 rounded-full bg-[#e5e5ea] transition-all peer-checked:bg-[#d4af37]"></div>
                  <div className="absolute left-1 h-3 w-3 rounded-full bg-white transition-all peer-checked:left-5 shadow-sm"></div>
                </div>
                <span className="text-[14px] font-semibold text-[#1d1d1f] select-none">
                  Venda realizada através de Campanha Promocional Especial
                </span>
              </label>
            </div>

          </div>

          <div className="pt-4 border-t border-black/[0.04] flex md:justify-end">
            <button
              type="submit"
              disabled={loading}
              className="group flex w-full md:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e8c96b] px-6 py-3 text-[14px] font-bold text-[#1d1d1f] shadow-lg transition-all hover:scale-[1.02] disabled:opacity-70"
            >
              <CheckCircle2 size={18} strokeWidth={2.5} />
              <span>{loading ? "Processando..." : "Confirmar Venda"}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
