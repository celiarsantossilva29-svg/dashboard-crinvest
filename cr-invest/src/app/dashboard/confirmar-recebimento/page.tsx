"use client";

import { useState } from "react";
import { CheckCircle, AlertCircle, Loader2, Upload, Building2 } from "lucide-react";

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function currentMesKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface PortoRow { apolice: string; valor: number; nome: string; nova: boolean; }

export default function ConfirmarRecebimentoPage() {
  // ── Mês ────────────────────────────────────────────────────────────────────
  const [mes, setMes] = useState(currentMesKey);
  const [mesY, mesM] = mes.split("-").map(Number);

  // ── Embracon ───────────────────────────────────────────────────────────────
  const [embraconLoading, setEmbracronLoading] = useState(false);
  const [embraconResult, setEmbracronResult] = useState<{ confirmed: number; skipped: number; total: number } | null>(null);
  const [embraconError, setEmbracronError] = useState("");

  async function confirmarEmbracron() {
    setEmbracronLoading(true);
    setEmbracronResult(null);
    setEmbracronError("");
    try {
      const r = await fetch("/api/embracon/confirmar-mes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro desconhecido");
      setEmbracronResult(d);
    } catch (e: any) {
      setEmbracronError(e.message);
    } finally {
      setEmbracronLoading(false);
    }
  }

  // ── Porto ──────────────────────────────────────────────────────────────────
  const [portoLinhas, setPortoLinhas] = useState("");
  const [portoPreview, setPortoPreview] = useState<PortoRow[] | null>(null);
  const [portoPreviewLoading, setPortoPreviewLoading] = useState(false);
  const [portoSaveLoading, setPortoSaveLoading] = useState(false);
  const [portoResult, setPortoResult] = useState<{ processadas: number; novas: number; atualizadas: number } | null>(null);
  const [portoError, setPortoError] = useState("");

  async function previsualizarPorto() {
    setPortoPreviewLoading(true);
    setPortoPreview(null);
    setPortoError("");
    setPortoResult(null);
    try {
      const r = await fetch("/api/porto/confirmar-mes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linhas: portoLinhas }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro ao processar");
      setPortoPreview(d.rows);
    } catch (e: any) {
      setPortoError(e.message);
    } finally {
      setPortoPreviewLoading(false);
    }
  }

  async function salvarPorto() {
    setPortoSaveLoading(true);
    setPortoError("");
    try {
      const r = await fetch("/api/porto/confirmar-mes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, linhas: portoLinhas }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro ao salvar");
      setPortoResult(d);
      setPortoPreview(null);
      setPortoLinhas("");
    } catch (e: any) {
      setPortoError(e.message);
    } finally {
      setPortoSaveLoading(false);
    }
  }

  const mesLabel = `${MESES[mesM - 1]} ${mesY}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Confirmar Recebimento</h1>
        <p className="text-gray-400 text-sm mt-1">Registre os pagamentos recebidos da Porto Seguro e da Embracon.</p>
      </div>

      {/* ── Seletor de mês ── */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-300 whitespace-nowrap">Mês de referência:</label>
        <select
          value={mes}
          onChange={e => {
            setMes(e.target.value);
            setEmbracronResult(null);
            setPortoResult(null);
            setPortoPreview(null);
          }}
          className="bg-[#1a2235] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          {Array.from({ length: 18 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - 6 + i);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const key = `${y}-${String(m).padStart(2, "0")}`;
            return <option key={key} value={key}>{MESES[m - 1]} {y}</option>;
          })}
        </select>
      </div>

      {/* ══ EMBRACON ══════════════════════════════════════════════════════════ */}
      <section className="bg-[#111827] border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 size={20} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Embracon</h2>
        </div>
        <p className="text-sm text-gray-400">
          Marca como <span className="text-emerald-400 font-medium">PAGO</span> todas as parcelas com vencimento em{" "}
          <span className="text-white font-medium">{mesLabel}</span> que ainda estão como Pendente.
        </p>

        {embraconResult ? (
          <div className="flex items-start gap-3 bg-emerald-900/30 border border-emerald-800 rounded-lg p-4">
            <CheckCircle size={20} className="text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-emerald-300 font-semibold">
                {embraconResult.confirmed} parcela{embraconResult.confirmed !== 1 ? "s" : ""} confirmada{embraconResult.confirmed !== 1 ? "s" : ""}
              </p>
              <p className="text-gray-400 mt-0.5">
                {embraconResult.skipped} ignoradas (inadimplente/cancelado) · {embraconResult.total} total no mês
              </p>
            </div>
          </div>
        ) : (
          <>
            {embraconError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
                <AlertCircle size={16} /> {embraconError}
              </div>
            )}
            <button
              onClick={confirmarEmbracron}
              disabled={embraconLoading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              {embraconLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Confirmar pagamento Embracon — {mesLabel}
            </button>
          </>
        )}
      </section>

      {/* ══ PORTO SEGURO ══════════════════════════════════════════════════════ */}
      <section className="bg-[#111827] border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Upload size={20} className="text-orange-400" />
          <h2 className="text-lg font-semibold text-white">Porto Seguro</h2>
        </div>

        {portoResult ? (
          <div className="flex items-start gap-3 bg-emerald-900/30 border border-emerald-800 rounded-lg p-4">
            <CheckCircle size={20} className="text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-emerald-300 font-semibold">
                Base atualizada para {mesLabel}
              </p>
              <p className="text-gray-400 mt-0.5">
                {portoResult.processadas} apólices · {portoResult.novas} novas · {portoResult.atualizadas} já existiam
              </p>
              <button
                onClick={() => setPortoResult(null)}
                className="mt-2 text-xs text-blue-400 hover:underline"
              >
                Adicionar outro mês
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm text-gray-400">
                Cole abaixo as linhas do relatório da Porto (formato: valor · apólice · CPF · nome, separados por tab):
              </p>
              <textarea
                value={portoLinhas}
                onChange={e => { setPortoLinhas(e.target.value); setPortoPreview(null); setPortoError(""); }}
                placeholder={"R$ 1.757,02\t1001690553\t355.535.508-23\tDIEGO FREIRE SANTOS\nR$ 933,33\t1001649179\t..."}
                rows={7}
                className="w-full bg-[#0d1424] border border-gray-700 text-gray-200 text-xs font-mono rounded-lg p-3 focus:outline-none focus:border-blue-500 resize-y"
              />
            </div>

            {portoError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
                <AlertCircle size={16} /> {portoError}
              </div>
            )}

            {!portoPreview && (
              <button
                onClick={previsualizarPorto}
                disabled={!portoLinhas.trim() || portoPreviewLoading}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
              >
                {portoPreviewLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                Pré-visualizar
              </button>
            )}

            {portoPreview && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-300">
                    <span className="font-semibold text-white">{portoPreview.length}</span> apólices reconhecidas ·{" "}
                    <span className="text-emerald-400 font-semibold">{portoPreview.filter(r => r.nova).length} novas</span>{" "}
                    · <span className="text-gray-400">{portoPreview.filter(r => !r.nova).length} já na base</span>
                  </p>
                  <button onClick={() => setPortoPreview(null)} className="text-xs text-gray-500 hover:text-gray-300">
                    Editar
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-700">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-800 text-gray-400 text-left">
                        <th className="px-3 py-2">Apólice</th>
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portoPreview.map((r, i) => (
                        <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/40">
                          <td className="px-3 py-2 font-mono text-gray-300">{r.apolice}</td>
                          <td className="px-3 py-2 text-gray-200">{r.nome || "—"}</td>
                          <td className="px-3 py-2 text-right text-emerald-400">{fmtBRL(r.valor)}</td>
                          <td className="px-3 py-2 text-center">
                            {r.nova ? (
                              <span className="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded text-[11px]">Nova</span>
                            ) : (
                              <span className="bg-gray-700 text-gray-400 px-2 py-0.5 rounded text-[11px]">Existente</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={salvarPorto}
                  disabled={portoSaveLoading}
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
                >
                  {portoSaveLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Salvar — {mesLabel}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <p className="text-xs text-gray-600 text-center">
        As projeções da Porto Seguro são atualizadas automaticamente após salvar.
      </p>
    </div>
  );
}
