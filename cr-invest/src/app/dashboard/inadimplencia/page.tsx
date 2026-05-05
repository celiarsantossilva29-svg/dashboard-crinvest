"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type ParcelaItem = {
  id: string;
  parcelaNumero: number;
  valorParcela: number;
  dataVencimento: string;
  status: string;
};

type ContatoItem = {
  id: string;
  dataContato: string;
  tipoContato: string;
  resultado: string;
  observacoes?: string;
  proximaAcao?: string;
  dataProximaAcao?: string;
  responsavel?: string;
};

type ClienteInadimplente = {
  saleId: string;
  clientName: string;
  assignedTo: string;
  telefone?: string;
  parcelas: ParcelaItem[];
  diasMaiorAtraso: number;
  totalAtrasado: number;
  contatos: ContatoItem[];
};

type DadosInadimplencia = {
  taxa: number;
  totalVencidas: number;
  totalNaoPagas: number;
  clientes: ClienteInadimplente[];
  valorTotalAtrasado: number;
};

const TIPO_CONTATO_LABEL: Record<string, string> = {
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  email: "E-mail",
  presencial: "Presencial",
};
const RESULTADO_LABEL: Record<string, string> = {
  atendeu: "Atendeu",
  nao_atendeu: "Não atendeu",
  prometeu_pagar: "Prometeu pagar",
  recusou: "Recusou",
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("pt-BR");
}

const EMPTY_CONTATO = {
  tipoContato: "telefone",
  resultado: "atendeu",
  proximaAcao: "",
  dataProximaAcao: "",
  observacoes: "",
};

export default function InadimplenciaPage() {
  const { data: session } = useSession();
  const [dados, setDados] = useState<DadosInadimplencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [showContatoModal, setShowContatoModal] = useState<ClienteInadimplente | null>(null);
  const [formContato, setFormContato] = useState({ ...EMPTY_CONTATO });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/financeiro/inadimplencia");
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setDados(json.data);
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSalvarContato = async () => {
    if (!showContatoModal) return;
    setSaving(true);
    await fetch("/api/financeiro/inadimplencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saleId: showContatoModal.saleId,
        clientName: showContatoModal.clientName,
        responsavel: (session?.user as any)?.name ?? "",
        ...formContato,
      }),
    });
    setSaving(false);
    setShowContatoModal(null);
    setFormContato({ ...EMPTY_CONTATO });
    load();
  };

  const taxaMeta = 20;

  return (
    <div className="min-h-screen p-6" style={{ background: "#F8F7F4" }}>
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Módulo Financeiro</p>
        <h1 className="text-[22px] font-medium text-gray-900">Inadimplência</h1>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
      ) : erro ? (
        <div className="flex flex-col items-center justify-center h-64 gap-2">
          <p className="text-sm text-gray-600">Banco temporariamente indisponível</p>
          <button onClick={load} className="text-xs text-blue-600 underline">Tentar novamente</button>
        </div>
      ) : dados ? (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">TAXA INADIMPLÊNCIA</p>
              <p className="text-[22px] font-medium" style={{ color: dados.taxa > taxaMeta ? "#DC2626" : "#16A34A" }}>
                {dados.taxa}%
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Meta: {taxaMeta}%</p>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                <div className="h-full rounded-full" style={{
                  width: `${Math.min(dados.taxa, 100)}%`,
                  background: dados.taxa > taxaMeta ? "#DC2626" : "#16A34A",
                }} />
              </div>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">CLIENTES EM ATRASO</p>
              <p className="text-[22px] font-medium text-gray-900">{dados.clientes.length}</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">PARCELAS ATRASADAS</p>
              <p className="text-[22px] font-medium text-gray-900">{dados.totalNaoPagas}</p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">VALOR ATRASADO</p>
              <p className="text-[22px] font-medium" style={{ color: "#DC2626" }}>{fmt(dados.valorTotalAtrasado)}</p>
            </div>
          </div>

          {/* Lista de clientes */}
          {dados.clientes.length === 0 ? (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-8 text-center text-sm text-gray-400">
              Nenhum cliente inadimplente
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wide text-gray-500 font-medium">Cliente</th>
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-gray-500 font-medium">Vendedor</th>
                    <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wide text-gray-500 font-medium">Parcelas</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wide text-gray-500 font-medium">Valor Atrasado</th>
                    <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wide text-gray-500 font-medium">Dias</th>
                    <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wide text-gray-500 font-medium">Contatos</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {dados.clientes.map((c, i) => (
                    <>
                      <tr key={c.saleId}
                        style={{ borderBottom: "1px solid #F3F4F6", cursor: "pointer" }}
                        onClick={() => setExpandedCliente(prev => prev === c.saleId ? null : c.saleId)}>
                        <td className="px-5 py-3 text-gray-900 font-medium">{c.clientName}</td>
                        <td className="px-4 py-3 text-gray-600">{c.assignedTo}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{c.parcelas.length}</td>
                        <td className="px-4 py-3 text-right font-medium" style={{ color: "#DC2626" }}>{fmt(c.totalAtrasado)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ background: c.diasMaiorAtraso >= 30 ? "#FEE2E2" : "#FEF3C7", color: c.diasMaiorAtraso >= 30 ? "#DC2626" : "#D97706" }}>
                            {c.diasMaiorAtraso}d
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">{c.contatos.length}</td>
                        <td className="px-5 py-3">
                          <button onClick={e => { e.stopPropagation(); setShowContatoModal(c); setFormContato({ ...EMPTY_CONTATO }); }}
                            className="text-xs border border-[#E5E7EB] px-3 py-1 rounded-lg text-gray-600 hover:bg-gray-50">
                            + Contato
                          </button>
                        </td>
                      </tr>
                      {expandedCliente === c.saleId && (
                        <tr key={`${c.saleId}-detail`}>
                          <td colSpan={7} style={{ padding: 0, borderBottom: "1px solid #E5E7EB" }}>
                            <div className="px-5 py-3 grid grid-cols-2 gap-4" style={{ background: "#F9FAFB" }}>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">Parcelas Atrasadas</p>
                                <div className="space-y-1">
                                  {c.parcelas.map(p => (
                                    <div key={p.id} className="flex items-center justify-between text-xs text-gray-700">
                                      <span>Parcela {p.parcelaNumero}</span>
                                      <span className="text-gray-500">Venc: {fmtDate(p.dataVencimento)}</span>
                                      <span className="font-medium">{fmt(p.valorParcela)}</span>
                                      <span className="text-red-500">{p.status}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">Histórico de Contatos</p>
                                {c.contatos.length === 0 ? (
                                  <p className="text-xs text-gray-400">Nenhum contato registrado</p>
                                ) : (
                                  <div className="space-y-1">
                                    {c.contatos.slice(0, 5).map(ct => (
                                      <div key={ct.id} className="text-xs text-gray-700">
                                        <span className="text-gray-500">{fmtDate(ct.dataContato)}</span>
                                        {" — "}
                                        <span>{TIPO_CONTATO_LABEL[ct.tipoContato] ?? ct.tipoContato}</span>
                                        {": "}
                                        <span className="font-medium">{RESULTADO_LABEL[ct.resultado] ?? ct.resultado}</span>
                                        {ct.observacoes && <span className="text-gray-500"> · {ct.observacoes}</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* Modal Registrar Contato */}
      {showContatoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" style={{ border: "1px solid #E5E7EB" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-medium text-gray-900">Registrar Contato</h2>
              <button onClick={() => setShowContatoModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">{showContatoModal.clientName}</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-500 block mb-1">Tipo</label>
                  <select value={formContato.tipoContato} onChange={e => setFormContato(f => ({ ...f, tipoContato: e.target.value }))}
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-gray-900">
                    <option value="telefone">Telefone</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="presencial">Presencial</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-500 block mb-1">Resultado</label>
                  <select value={formContato.resultado} onChange={e => setFormContato(f => ({ ...f, resultado: e.target.value }))}
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-gray-900">
                    <option value="atendeu">Atendeu</option>
                    <option value="nao_atendeu">Não atendeu</option>
                    <option value="prometeu_pagar">Prometeu pagar</option>
                    <option value="recusou">Recusou</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-gray-500 block mb-1">Próxima ação</label>
                <input value={formContato.proximaAcao} onChange={e => setFormContato(f => ({ ...f, proximaAcao: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-gray-900" placeholder="Ex: Ligar dia 25/04" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-gray-500 block mb-1">Data próxima ação</label>
                <input type="date" value={formContato.dataProximaAcao} onChange={e => setFormContato(f => ({ ...f, dataProximaAcao: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-gray-900" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-gray-500 block mb-1">Observações</label>
                <textarea value={formContato.observacoes} onChange={e => setFormContato(f => ({ ...f, observacoes: e.target.value }))}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-gray-900" rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowContatoModal(null)}
                className="px-4 py-2 rounded-lg text-sm border border-[#E5E7EB] text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSalvarContato} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm text-white font-medium"
                style={{ background: "#2563EB", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
