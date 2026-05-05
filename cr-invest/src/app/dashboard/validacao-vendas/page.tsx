"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Calendar, Users, Filter, Briefcase, AlertTriangle, Check, Plus, Info, ChevronRight, X, SkipForward } from "lucide-react";

interface Installment {
  id: string;
  parcelaNumero: number;
  dataVencimento: string;
  valorParcela: number;
  pago: boolean;
  status?: string;
  dataPagamento: string | null;
}

interface Sale {
  id: string;
  clientName: string;
  assignedTo: string;
  value: number;
  closedAt: string;
  administradora: string | null;
  installments: Installment[];
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtDateBR(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() + offset);
  return new Intl.DateTimeFormat("pt-BR").format(local);
}

function getInitials(name: string) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

export default function ValidacaoVendasPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [skippingId, setSkippingId] = useState<string | null>(null);

  const fetchValidations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/validations`);
      const json = await res.json();
      setSales(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchValidations();
  }, [fetchValidations]);

  const handleConfirm = async (installmentId: string) => {
    handleStatusUpdate(installmentId, "PAGO");
  };

  const handleStatusUpdate = async (installmentId: string, novoStatus: string) => {
    setConfirmingId(installmentId);
    try {
      const res = await fetch(`/api/validations/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installmentId, status: novoStatus })
      });
      const data = await res.json();
      if (data.error) {
        alert("Erro: " + data.error);
      } else {
        fetchValidations();
      }
    } catch (e) {
      alert("Erro de conexão ao alterar status");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleSkipMonth = async (saleId: string) => {
    setSkippingId(saleId);
    try {
      const res = await fetch('/api/validations/skip-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId }),
      });
      const data = await res.json();
      if (data.error) { alert('Erro: ' + data.error); } else { fetchValidations(); }
    } catch (e) { alert('Erro de conexão ao pular mês'); }
    finally { setSkippingId(null); }
  };

  // Métricas Computadas
  let totalPendente = 0;
  let vencemHoje = 0;
  let emAtraso = 0;
  let totalInadimplente = 0;
  let clientesInadimplentes = new Set<string>();
  let comissaoTravada = 0;
  let closersComPendencias = new Set<string>();
  let parcelasAguardando = 0;
  let valorConfirmado = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  sales.forEach(s => {
    let hasPending = false;
    s.installments.forEach(inst => {
      const st = inst.status || (inst.pago ? "PAGO" : "PENDENTE");

      if (st === "INADIMPLENTE") {
         totalInadimplente += inst.valorParcela;
         clientesInadimplentes.add(s.id);
         comissaoTravada += inst.valorParcela * 0.005;
         hasPending = true;
      } else if (!inst.pago) {
        totalPendente += inst.valorParcela;
        parcelasAguardando++;
        hasPending = true;

        const vDate = new Date(inst.dataVencimento);
        vDate.setUTCHours(0, 0, 0, 0);

        const isAtrasado = vDate.getTime() < today.getTime();
        const isHoje = vDate.getTime() === today.getTime();

        if (isAtrasado) emAtraso += inst.valorParcela;
        if (isHoje) vencemHoje += inst.valorParcela;
      } else {
        valorConfirmado += inst.valorParcela;
      }
    });

    if (hasPending) {
      closersComPendencias.add(s.assignedTo);
    }
  });

  const numClosers = closersComPendencias.size;
  const comissaoALiberar = totalPendente * 0.005;
  const comissaoEmRisco = emAtraso * 0.005;

  const totalCanceladosNum = sales.filter(s => s.installments.some(i => (i.status || (i.pago?"PAGO":"PENDENTE")) === "CANCELADO")).length;
  const totalVendasNum = sales.length;
  const inadimplenciasNum = clientesInadimplentes.size;

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-[#111827] flex flex-col font-sans">

      {/* Header Fixo */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4 bg-[#F8F9FB] border-b border-gray-100">
        <h1 className="text-[22px] font-black tracking-tight text-[#111827]">Validação de Venda</h1>
        <button className="flex items-center gap-2 bg-[#1d1d1f] hover:bg-black transition-colors text-white px-5 py-2 rounded-xl text-sm font-bold shadow-sm">
          <Plus size={16} /> Registrar Nova Venda
        </button>
      </header>

      <main className="flex-1 px-8 py-6 w-full mx-auto max-w-[1600px] flex flex-col gap-5">

        {/* TOP ROW: KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] uppercase font-bold text-gray-400">TOTAL PENDENTE</span>
            <p className="text-[20px] font-black text-[#111827] mt-1">{fmtBRL(totalPendente)}</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col relative overflow-hidden">
            <span className="text-[10px] uppercase font-bold text-gray-400">VENCEM HOJE</span>
            <p className="text-[20px] font-black text-[#d97706] mt-1">{fmtBRL(vencemHoje)}</p>
            <Briefcase size={16} className="text-[#d97706]/40 absolute bottom-5 right-5" />
          </div>

          <div className="bg-white border border-red-100 rounded-2xl p-5 shadow-sm flex flex-col relative overflow-hidden">
            <span className="text-[10px] uppercase font-bold text-gray-400">EM ATRASO</span>
            <p className="text-[20px] font-black text-red-700 mt-1">{fmtBRL(emAtraso)}</p>
            <AlertTriangle size={16} className="text-red-700/40 absolute bottom-5 right-5" />
          </div>

          <div className="bg-white border border-red-200 rounded-2xl p-5 shadow-sm flex flex-col relative overflow-hidden ring-1 ring-red-50">
            <span className="text-[10px] uppercase font-bold text-red-400">INADIMPLENTE</span>
            <p className="text-[20px] font-black text-[#991b1b] mt-1">{fmtBRL(totalInadimplente)}</p>
            <AlertTriangle size={16} className="text-red-900/20 absolute bottom-5 right-5" />
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col relative overflow-hidden">
            <span className="text-[10px] uppercase font-bold text-gray-400">CLOSERS</span>
            <div className="flex items-center gap-2 mt-1">
              <Users size={18} className="text-gray-300" />
              <p className="text-[20px] font-black text-[#111827]">{numClosers}</p>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">

          {/* LEFT: PARCELAS EM VALIDAÇÃO */}
          <div className="flex-[3] min-w-0 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-[#111827]">Parcelas em Validação</h2>
              <div className="flex items-center gap-2">
                 <span className="text-[11px] font-bold px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-md shadow-sm flex items-center">
                    <Briefcase className="mr-1.5 text-gray-400" size={12}/> {totalVendasNum} Vendas
                 </span>
                 <span className="text-[11px] font-bold px-2.5 py-1 bg-red-50 border border-red-200 text-[#991b1b] rounded-md shadow-sm flex items-center">
                    <AlertTriangle className="mr-1.5 text-red-500" size={12}/> {inadimplenciasNum} Inadimplências
                 </span>
                 <span className="text-[11px] font-bold px-2.5 py-1 bg-stone-100 border border-stone-200 text-stone-500 rounded-md shadow-sm flex items-center">
                    <X className="mr-1.5" size={12}/> {totalCanceladosNum} Cancelados
                 </span>
              </div>
            </div>

            {clientesInadimplentes.size > 0 && (
              <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-xl px-4 py-3 shadow-sm my-1">
                <div className="flex items-center gap-2 flex-wrap text-red-800 text-[13px] font-bold">
                  <AlertTriangle size={15} className="text-red-600 shrink-0" />
                  <span>{clientesInadimplentes.size} clientes inadimplentes</span>
                  <span className="text-red-300">•</span>
                  <span>{fmtBRL(totalInadimplente)} em risco</span>
                  <span className="text-red-300">•</span>
                  <span>{fmtBRL(comissaoTravada)} em comissão travada</span>
                </div>
              </div>
            )}

            {emAtraso > 0 && clientesInadimplentes.size === 0 && (
              <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm font-bold shadow-sm">
                <AlertTriangle size={16} /> Parcela(s) em atraso <span className="text-red-300 mx-1">|</span> {fmtBRL(emAtraso)}
              </div>
            )}

            <div className="flex flex-col gap-4 mt-2">
              {loading ? (
                <p className="text-center text-sm font-bold text-gray-400 py-10">Carregando validações...</p>
              ) : sales.length === 0 ? (
                <p className="text-center text-sm font-bold text-gray-400 py-10">Nenhuma venda pendente.</p>
              ) : (
                sales.map(sale => {
                  const parcelasPagas = sale.installments.filter(i => i.pago).length;
                  const totalParcelas = sale.installments.length;
                  const proxInst = sale.installments.find(i => !i.pago);
                  const proxVencimento = proxInst ? fmtDateBR(proxInst.dataVencimento) : '-';
                  const emAberto = sale.installments.filter(i => !i.pago).reduce((acc, i) => acc + i.valorParcela, 0);

                  const isInadimplente = sale.installments.some(i => (i.status || (i.pago?"PAGO":"PENDENTE")) === "INADIMPLENTE");

                  let diasAtraso = 0;
                  let statusText = "No prazo";
                  let statusColor = "text-emerald-600 bg-emerald-50 border-emerald-200";

                  if (proxInst) {
                    const d1 = new Date(proxInst.dataVencimento);
                    d1.setUTCHours(0, 0, 0, 0);
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    const diffTime = hoje.getTime() - d1.getTime();
                    diasAtraso = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

                    if (diasAtraso > 0) {
                      statusText = `${diasAtraso} dias em atraso`;
                      statusColor = "text-[#d97706] bg-amber-50 border-amber-200";
                    } else if (diffTime === 0) {
                      statusText = "Vence hoje";
                      statusColor = "text-blue-600 bg-blue-50 border-blue-200";
                    }
                  }

                  if (isInadimplente) {
                     statusText = "Inadimplente";
                     statusColor = "text-[#991b1b] bg-red-50 border-red-200";
                  }

                  return (
                    <div key={sale.id} className={`bg-white border rounded-xl shadow-sm flex flex-col gap-2 p-4 transition-all ${isInadimplente ? 'border-[#fca5a5] ring-1 ring-red-100' : 'border-gray-100'}`}>

                      {/* Linha 1: avatar + nome + status + info compacta */}
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#fef2f2] flex items-center justify-center font-bold text-[#dc2626] text-[13px] shrink-0 mt-0.5">
                          {getInitials(sale.clientName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-[14px] font-black text-[#111827] leading-none">{sale.clientName}</h3>
                            <span className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded text-[10px] font-bold ${statusColor}`}>
                              {statusText === "No prazo" ? <Check size={10}/> : <AlertTriangle size={10}/>}
                              {statusText}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 flex-wrap">
                            <span><span className="text-gray-400">Admin:</span> <span className="font-semibold uppercase">{sale.administradora || 'N/A'}</span></span>
                            <span className="text-gray-300">·</span>
                            <span><span className="text-gray-400">Closer:</span> <span className="font-semibold">{sale.assignedTo}</span></span>
                            <span className="text-gray-300">·</span>
                            <span className={`font-bold ${isInadimplente ? 'text-[#991b1b]' : 'text-[#111827]'}`}>{parcelasPagas}/{totalParcelas} parcelas</span>
                            {proxVencimento !== '-' && <><span className="text-gray-300">·</span><span>Próx: <span className="font-semibold text-gray-700">{proxVencimento}</span></span></>}
                          </div>
                        </div>
                      </div>

                      {/* Timeline de parcelas */}
                      <div style={{ maxWidth: `${totalParcelas * 36}px` }}>
                        <div className="flex items-center w-full justify-between relative px-1">
                          <div className={`absolute top-[8px] left-0 right-0 h-[2px] z-0 ${isInadimplente ? 'bg-red-100' : 'bg-gray-100'}`}></div>
                          <div className={`absolute top-[8px] left-0 h-[2px] z-0 transition-all duration-500 ${isInadimplente ? 'bg-[#991b1b]' : 'bg-[#d97706]'}`} style={{ width: `${(parcelasPagas / Math.max(totalParcelas - 1, 1)) * 100}%` }}></div>
                          {sale.installments.map((inst, idx) => {
                            const isPaid = inst.pago;
                            const isNext = !isPaid && sale.installments.findIndex(i => !i.pago) === idx;
                            const st = (inst as any).status || (isPaid ? "PAGO" : "PENDENTE");
                            const isInstInadimplente = st === "INADIMPLENTE";
                            let bg = isInadimplente ? "bg-white border-red-200 text-red-300" : "bg-gray-100 border-gray-200 text-gray-300";
                            let numCol = isInadimplente ? "text-red-300" : "text-gray-300";
                            let Icon = null;
                            if (isPaid) { bg = "bg-[#246A4F] border-[#246A4F] text-white"; numCol = "text-[#246A4F]"; Icon = <Check size={10} strokeWidth={3} />; }
                            else if (isInstInadimplente) { bg = "bg-[#991b1b] border-[#991b1b] text-white"; numCol = "text-[#991b1b]"; Icon = <X size={10} strokeWidth={3} />; }
                            else if (isNext) { bg = isInadimplente ? "bg-red-200 border-red-300 text-red-800" : "bg-[#d97706] border-[#d97706] text-white"; numCol = isInadimplente ? "text-red-400" : "text-[#d97706]"; }
                            return (
                              <div key={inst.id} className="flex flex-col items-center gap-1 z-10 relative">
                                <div className={`w-[16px] h-[16px] rounded-full border-2 flex items-center justify-center text-[7px] font-bold transition-colors ${bg}`}>
                                  {Icon ? Icon : idx + 1}
                                </div>
                                <span className={`text-[8px] font-bold ${numCol}`}>{idx + 1}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Botões de ação */}
                      {isInadimplente ? (
                        <div className="flex items-center gap-2 pt-1">
                          <button className="bg-[#FFFDF5] border border-amber-200 text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors">Entrar em Contato</button>
                          <button className="bg-[#fef2f2] border border-[#fca5a5] text-[#991b1b] hover:bg-red-50 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors">Negociar Parcelas</button>
                        </div>
                      ) : proxInst && (
                        <div className="flex items-center gap-2 pt-1">
                          <button disabled={confirmingId === proxInst.id} onClick={() => handleStatusUpdate(proxInst.id, "INADIMPLENTE")} className="bg-white border border-gray-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors disabled:opacity-50">
                            {confirmingId === proxInst.id ? '...' : 'Inadimplente'}
                          </button>
                          <button disabled={skippingId === sale.id} onClick={() => handleSkipMonth(sale.id)} className="bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors disabled:opacity-50 flex items-center gap-1">
                            <SkipForward size={12} />
                            {skippingId === sale.id ? "..." : "Pular Mês"}
                          </button>
                          <button disabled={confirmingId === proxInst.id} onClick={() => handleConfirm(proxInst.id)} className="bg-[#246A4F] hover:bg-[#1a4f3b] text-white px-4 py-1.5 rounded-lg text-[12px] font-bold transition-colors disabled:opacity-50">
                            {confirmingId === proxInst.id ? 'Confirmando...' : 'Confirmar Pagamento'}
                          </button>
                        </div>
                      )}

                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: FILTROS E LIBERAÇÃO DE COMISSÃO */}
          <div className="flex-[1] min-w-[280px] max-w-[340px] flex flex-col gap-6">

            {/* Filters */}
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="col-span-2 bg-white border border-gray-100 rounded-2xl px-5 py-3 shadow-sm flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-400">Período</span>
                <div className="flex items-center gap-3">
                  <Calendar size={13} className="text-gray-400" />
                  <span className="text-[12px] font-bold text-gray-600">01/04/2026 - 30/04/2026</span>
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors">
                <Filter size={14} className="text-gray-400" />
                <span className="text-[13px] font-bold">Filtros</span>
              </div>
              <div className="bg-[#FFFDF5] border border-amber-100 rounded-xl px-4 py-3 shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-amber-50 transition-colors">
                <Users size={14} className="text-amber-600" />
                <span className="text-[13px] font-bold text-amber-700">Closers</span>
              </div>
            </div>

            {/* BOX: LIBERAÇÃO DE COMISSÃO */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col overflow-hidden">
               <div className="p-5 border-b border-gray-50 flex items-center gap-2">
                  <h3 className="text-[15px] font-black text-[#111827]">Liberação de Comissão</h3>
                  <Info size={13} className="text-gray-300" />
               </div>

               <div className="p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center text-[13px]">
                     <span className="text-gray-500 font-medium">Valor Já Confirmado:</span>
                     <span className="font-black text-[#111827] text-[14px]">{fmtBRL(valorConfirmado)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px]">
                     <span className="text-gray-500 font-medium">Valor Pendente:</span>
                     <span className="font-black text-[#111827] text-[14px]">{fmtBRL(totalPendente)}</span>
                  </div>
                  <hr className="border-gray-50" />
                  <div className="flex justify-between items-center text-[13px]">
                     <span className="text-gray-500 font-medium">Comissão a Liberar:</span>
                     <span className="font-black text-[#111827] text-[14px]">{fmtBRL(comissaoALiberar)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px]">
                     <span className="text-gray-500 font-medium">Comissão em Risco:</span>
                     <span className="font-black text-red-600 text-[14px]">{fmtBRL(comissaoEmRisco)}</span>
                  </div>

                  <button className="w-full mt-4 bg-[#FFFDF5] hover:bg-amber-50 border border-amber-100 text-amber-700 py-3 rounded-xl text-[14px] font-bold shadow-sm flex items-center justify-center transition-colors">
                     Ver Resumo Financeiro <ChevronRight size={16} className="ml-1" />
                  </button>
               </div>

               <div className="bg-[#fcfdfd] border-t border-gray-50 p-5 flex flex-col gap-3">
                 <div className="flex items-center gap-2 text-[12px] font-medium text-gray-500">
                   <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center"><Calendar size={10} className="text-gray-400"/></div>
                   {parcelasAguardando} parcelas aguardando confirmação
                 </div>
                 <div className="flex items-center gap-2 text-[12px] font-medium text-gray-500">
                   <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center"><Users size={10} className="text-gray-400"/></div>
                   {numClosers} closers com valores pendentes
                 </div>
               </div>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
