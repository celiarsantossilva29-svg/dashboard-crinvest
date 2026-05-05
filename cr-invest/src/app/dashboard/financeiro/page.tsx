"use client";

import { useState, useEffect, useCallback } from "react";

type DRE = {
  receitaBruta: number;
  descontos: { royalty: number; impostos: number; total: number };
  receitaLiquida: number;
  gastos: { total: number; porCategoria: Record<string, number> };
  resultado: number;
};

type DashData = {
  periodo: { mes: number; ano: number };
  dre: DRE;
  variacoes: { receita: number; gastos: number };
  alertas: { vendasAguardando: number; inadimplentes: number; gastosAtrasados: number };
  projecao6Meses: { mes: string; previsto: number; real: number }[];
};

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const CAT_LABEL: Record<string, string> = {
  pessoas: "Pessoas",
  espaco: "Espaço Físico",
  tecnologia: "Tecnologia",
  marketing: "Marketing",
  outros: "Outros",
};

// Referência dos custos fixos esperados (do PROMPT_MASTER)
const CUSTOS_REFERENCIA: Record<string, number> = {
  pessoas: 29000,
  espaco: 2920,
  tecnologia: 2780,
  marketing: 7500,
  outros: 1200,
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function pct(v: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((v / total) * 100)}%`;
}

function VarBadge({ pct: p }: { pct: number }) {
  const up = p >= 0;
  return (
    <span className="text-xs" style={{ color: up ? "#16A34A" : "#DC2626" }}>
      {up ? "↑" : "↓"} {Math.abs(p)}% vs mês anterior
    </span>
  );
}

function DRERow({
  label, value, sub, indent = 0, bold = false, highlight, pctOfBruto,
}: {
  label: string; value: number; sub?: string; indent?: number;
  bold?: boolean; highlight?: "green" | "red" | "amber"; pctOfBruto?: number;
}) {
  const color = highlight === "green" ? "#16A34A" : highlight === "red" ? "#DC2626" : highlight === "amber" ? "#D97706" : "#111827";
  return (
    <div className="flex items-center justify-between py-2.5"
      style={{ paddingLeft: indent * 16, borderBottom: "1px solid #F3F4F6" }}>
      <div className="flex items-center gap-2">
        {indent > 0 && <span className="text-gray-300 text-xs">└</span>}
        <div>
          <span className="text-sm" style={{ color: bold ? "#111827" : "#374151", fontWeight: bold ? 600 : 400 }}>
            {label}
          </span>
          {sub && <span className="text-xs text-gray-400 ml-1.5">{sub}</span>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {pctOfBruto !== undefined && (
          <span className="text-xs text-gray-400 w-10 text-right">{pct(Math.abs(value), pctOfBruto)}</span>
        )}
        <span className="text-sm font-medium tabular-nums" style={{ color, minWidth: 110, textAlign: "right" }}>
          {value < 0 ? `− ${fmt(Math.abs(value))}` : fmt(value)}
        </span>
      </div>
    </div>
  );
}

export default function FinanceiroDashboard() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/financeiro/dashboard?month=${mes}&year=${ano}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setData(json.data);
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [mes, ano]);

  useEffect(() => { load(); }, [load]);

  const maxProj = data ? Math.max(...data.projecao6Meses.map(p => p.previsto), 1) : 1;

  return (
    <div className="min-h-screen p-6" style={{ background: "#F8F7F4" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Módulo Financeiro</p>
          <h1 className="text-[22px] font-medium text-gray-900">Dashboard Financeiro</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            className="border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700">
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            className="border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700">
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>
      ) : erro ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <p className="text-sm font-medium text-gray-700">Banco de dados temporariamente indisponível</p>
          <p className="text-xs text-gray-400 max-w-md text-center">{erro} — O circuit breaker do Supabase está ativo por excesso de tentativas de conexão. Aguarde alguns minutos e recarregue a página.</p>
          <button onClick={load} className="text-xs text-blue-600 underline mt-1">Tentar novamente</button>
        </div>
      ) : data ? (
        <div className="space-y-5">

          {/* KPIs rápidos */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">RECEITA BRUTA</p>
              <p className="text-[22px] font-medium text-gray-900">{fmt(data.dre.receitaBruta)}</p>
              <div className="mt-1"><VarBadge pct={data.variacoes.receita} /></div>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">DESCONTOS</p>
              <p className="text-[22px] font-medium" style={{ color: "#DC2626" }}>
                − {fmt(data.dre.descontos.total)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {pct(data.dre.descontos.total, data.dre.receitaBruta)} da receita bruta
              </p>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">GASTOS FIXOS</p>
              <p className="text-[22px] font-medium" style={{ color: "#D97706" }}>
                − {fmt(data.dre.gastos.total)}
              </p>
              <div className="mt-1"><VarBadge pct={data.variacoes.gastos} /></div>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">RESULTADO LÍQUIDO</p>
              <p className="text-[22px] font-medium"
                style={{ color: data.dre.resultado >= 0 ? "#16A34A" : "#DC2626" }}>
                {data.dre.resultado >= 0 ? "+" : ""}{fmt(data.dre.resultado)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: data.dre.resultado >= 0 ? "#16A34A" : "#DC2626" }}>
                {data.dre.resultado >= 0 ? "Positivo" : "Negativo"}
              </p>
            </div>
          </div>

          {/* DRE + Gastos por categoria */}
          <div className="grid grid-cols-2 gap-4">

            {/* DRE — Demonstrativo simplificado */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-4">DRE — DEMONSTRATIVO DO MÊS</p>

              <DRERow label="Receita Bruta" value={data.dre.receitaBruta} bold />

              <div className="mt-1">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 py-1.5">Descontos</p>
                <DRERow
                  label="Royalty (Porto Seguro)"
                  sub="8,4%"
                  value={-data.dre.descontos.royalty}
                  indent={1}
                  pctOfBruto={data.dre.receitaBruta}
                />
                <DRERow
                  label="Impostos"
                  sub="6,9% Porto / 7% Embracon"
                  value={-data.dre.descontos.impostos}
                  indent={1}
                  pctOfBruto={data.dre.receitaBruta}
                />
                <DRERow
                  label="Total descontos"
                  value={-data.dre.descontos.total}
                  bold
                  highlight="red"
                  pctOfBruto={data.dre.receitaBruta}
                />
              </div>

              <div className="mt-1 pt-1" style={{ borderTop: "2px solid #E5E7EB" }}>
                <DRERow
                  label="Receita Líquida"
                  value={data.dre.receitaLiquida}
                  bold
                  highlight="amber"
                />
              </div>

              <div className="mt-1">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 py-1.5">Gastos Fixos</p>
                {Object.entries(data.dre.gastos.porCategoria)
                  .filter(([, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, val]) => (
                    <DRERow
                      key={cat}
                      label={CAT_LABEL[cat] ?? cat}
                      value={-val}
                      indent={1}
                      pctOfBruto={data.dre.receitaBruta}
                    />
                  ))}
                {data.dre.gastos.total === 0 && (
                  <p className="text-xs text-gray-400 py-2 pl-4">Nenhum gasto lançado ainda</p>
                )}
                <DRERow
                  label="Total gastos"
                  value={-data.dre.gastos.total}
                  bold
                  highlight="red"
                  pctOfBruto={data.dre.receitaBruta}
                />
              </div>

              <div className="mt-1 pt-2" style={{ borderTop: "2px solid #111827" }}>
                <DRERow
                  label="Resultado Líquido"
                  value={data.dre.resultado}
                  bold
                  highlight={data.dre.resultado >= 0 ? "green" : "red"}
                  pctOfBruto={data.dre.receitaBruta}
                />
              </div>
            </div>

            {/* Gastos por categoria vs referência */}
            <div className="flex flex-col gap-4">
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-4">GASTOS POR CATEGORIA</p>
                <div className="space-y-3">
                  {Object.entries(CAT_LABEL).map(([cat, label]) => {
                    const real = data.dre.gastos.porCategoria[cat] ?? 0;
                    const ref = CUSTOS_REFERENCIA[cat] ?? 0;
                    const pctFill = ref > 0 ? Math.min((real / ref) * 100, 120) : 0;
                    const over = real > ref && ref > 0;
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600">{label}</span>
                          <div className="flex items-center gap-2">
                            {ref > 0 && (
                              <span className="text-[10px] text-gray-400">ref {fmt(ref)}</span>
                            )}
                            <span className="text-xs font-medium" style={{ color: real === 0 ? "#9CA3AF" : over ? "#DC2626" : "#111827" }}>
                              {real === 0 ? "—" : fmt(real)}
                            </span>
                          </div>
                        </div>
                        {ref > 0 && (
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pctFill}%`, background: over ? "#DC2626" : real > 0 ? "#2563EB" : "transparent" }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {data.dre.gastos.total === 0 && (
                  <p className="text-xs text-gray-400 mt-3">
                    Cadastre os gastos na página de <strong>Gastos</strong> para ver o comparativo.
                  </p>
                )}
              </div>

              {/* Alertas */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-3">ALERTAS</p>
                <div className="space-y-2">
                  {data.alertas.vendasAguardando > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-gray-700">{data.alertas.vendasAguardando} vendas aguardando validação</span>
                    </div>
                  )}
                  {data.alertas.inadimplentes > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <span className="text-gray-700">{data.alertas.inadimplentes} parcelas inadimplentes</span>
                    </div>
                  )}
                  {data.alertas.gastosAtrasados > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <span className="text-gray-700">{data.alertas.gastosAtrasados} gastos atrasados</span>
                    </div>
                  )}
                  {data.alertas.vendasAguardando === 0 && data.alertas.inadimplentes === 0 && data.alertas.gastosAtrasados === 0 && (
                    <p className="text-sm text-gray-400">Nenhum alerta no momento</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Projeção 6 meses */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">PROJEÇÃO DE ENTRADAS — PRÓXIMOS 6 MESES</p>
            <p className="text-xs text-gray-400 mb-5">Receita líquida estimada (após royalty + impostos + 70% adimplência)</p>
            <div className="flex items-end gap-4 h-36">
              {data.projecao6Meses.map((p, i) => {
                const h = maxProj > 0 ? Math.round((p.previsto / maxProj) * 120) : 4;
                const hReal = maxProj > 0 ? Math.round((p.real / maxProj) * 120) : 0;
                return (
                  <div key={p.mes} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] font-medium text-gray-700 text-center">{fmt(p.previsto)}</div>
                    <div className="w-full flex items-end justify-center gap-1" style={{ height: 120 }}>
                      <div className="w-5 rounded-t-sm"
                        style={{ height: Math.max(h, 2), background: i === 0 ? "#2563EB" : "#D1D5DB" }} />
                      {p.real > 0 && (
                        <div className="w-5 rounded-t-sm"
                          style={{ height: Math.max(hReal, 2), background: "#16A34A" }} />
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 text-center">{p.mes}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-5 mt-3 text-[10px] text-gray-400">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#2563EB" }} /> Previsto</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#16A34A" }} /> Recebido</div>
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
}
