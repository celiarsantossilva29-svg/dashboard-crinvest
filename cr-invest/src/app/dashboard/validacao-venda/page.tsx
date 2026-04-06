"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getMonthRange() {
  const now = new Date();
  return {
    start: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtDateBR(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG_PAGE = "#F8F7F4";
const CARD: React.CSSProperties = {
  background: "white",
  border: "0.5px solid #E5E7EB",
  borderRadius: 12,
  overflow: "hidden",
};
const MET: React.CSSProperties = { background: "#F3F4F6", borderRadius: 8, padding: "12px 14px" };
const LBL: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#9CA3AF",
  fontWeight: 600,
  marginBottom: 3,
};
const VAL: React.CSSProperties = { fontSize: 20, fontWeight: 500, color: "#111827" };
const TH: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#9CA3AF",
  fontWeight: 600,
  textAlign: "left",
  background: "#F9FAFB",
  borderBottom: "0.5px solid #E5E7EB",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Installment {
  parcelaNumero: number;
  dataVencimento: string;
  valorParcela: number;
  pago: boolean;
}

interface Sale {
  id: string;
  clientName: string;
  assignedTo: string;
  sdrName?: string | null;
  value: number;
  closedAt: string;
  campaignId: string | null;
  notes: string | null;
  leadId: string | null;
  administradora?: string | null;
  tierCloser?: string | null;
  valorComissaoCloser?: number | null;
  valorComissaoSdr?: number | null;
  installments?: Installment[];
}

type Tab = "pendente" | "validado";

// ─── Installment Timeline ─────────────────────────────────────────────────────

function InstallmentTimeline({
  installments,
}: {
  installments?: { parcelaNumero: number; pago: boolean; dataVencimento: string }[];
  closedAt: string;
}) {
  const now = new Date();
  const hasParcelas = installments && installments.length > 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
      {Array.from({ length: 12 }).map((_, i) => {
        const parcela = hasParcelas ? installments![i] : null;
        const isVencida = parcela
          ? !parcela.pago && new Date(parcela.dataVencimento) < now
          : false;
        const isPago = parcela ? parcela.pago : false;

        return (
          <div
            key={i}
            style={{
              width: 13,
              height: 7,
              borderRadius: 2,
              backgroundColor: isPago ? "#16A34A" : isVencida ? "#DC2626" : "#E5E7EB",
            }}
            title={`Parcela ${i + 1}: ${isPago ? "paga" : isVencida ? "vencida" : "futura"}`}
          />
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

import React from "react";

export default function ValidacaoVendaPage() {
  const { start: defaultStart, end: defaultEnd } = getMonthRange();
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [sales, setSales] = useState<Sale[]>([]);
  const [tab, setTab] = useState<Tab>("pendente");

  const fetchSales = useCallback(async () => {
    try {
      const res = await fetch(`/api/sales?start=${start}&end=${end}`);
      const json = await res.json();
      setSales(json.data ?? []);
    } catch {}
  }, [start, end]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const pending = sales.filter((s) => !s.leadId);
  const validated = sales.filter((s) => !!s.leadId);
  const displayed = tab === "pendente" ? pending : validated;

  const inputStyle: React.CSSProperties = {
    border: "0.5px solid #E5E7EB",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 12,
    color: "#374151",
    background: "white",
  };

  return (
    <>
      <header
        className="sticky top-0 z-30 flex flex-wrap items-center gap-3 justify-between"
        style={{
          background: "rgba(248,247,244,0.94)",
          backdropFilter: "blur(12px)",
          borderBottom: "0.5px solid #E5E7EB",
          padding: "10px 24px",
        }}
      >
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Validação de Vendas</p>
          <p style={{ fontSize: 11, color: "#9CA3AF" }}>Manual vs CRM · Parcelas</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 11, color: "#9CA3AF" }}>De</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={inputStyle}
          />
          <label style={{ fontSize: 11, color: "#9CA3AF" }}>até</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={fetchSales}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 14px",
              borderRadius: 6,
              background: "#F3F4F6",
              color: "#374151",
              border: "0.5px solid #E5E7EB",
              cursor: "pointer",
            }}
          >
            Atualizar
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: "8px 24px 24px", background: BG_PAGE }}>
        {/* Stats */}
        <p style={{ ...LBL, marginTop: 8, marginBottom: 4 }}>Resumo do Período</p>
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          style={{ marginBottom: 16 }}
        >
          <div style={MET}>
            <p style={LBL}>Total no Período</p>
            <p style={VAL}>{sales.length}</p>
          </div>
          <div style={MET}>
            <p style={LBL}>Validadas (CRM)</p>
            <p style={{ ...VAL, color: "#16A34A" }}>{validated.length}</p>
          </div>
          <div style={MET}>
            <p style={LBL}>Pendentes (Manual)</p>
            <p style={{ ...VAL, color: "#D97706" }}>{pending.length}</p>
          </div>
          <div style={MET}>
            <p style={LBL}>Taxa de Validação</p>
            <p style={{ ...VAL, color: "#2563EB" }}>
              {sales.length > 0 ? Math.round((validated.length / sales.length) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* Tabs + Table */}
        <div style={CARD}>
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: "12px 16px 0",
              borderBottom: "0.5px solid #E5E7EB",
            }}
          >
            <button
              onClick={() => setTab("pendente")}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: "6px 6px 0 0",
                border: "none",
                cursor: "pointer",
                background: tab === "pendente" ? "#FEF9C3" : "transparent",
                color: tab === "pendente" ? "#92400E" : "#9CA3AF",
                borderBottom: tab === "pendente" ? "2px solid #D97706" : "2px solid transparent",
              }}
            >
              Pendentes ({pending.length})
            </button>
            <button
              onClick={() => setTab("validado")}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: "6px 6px 0 0",
                border: "none",
                cursor: "pointer",
                background: tab === "validado" ? "#F0FDF4" : "transparent",
                color: tab === "validado" ? "#166534" : "#9CA3AF",
                borderBottom: tab === "validado" ? "2px solid #16A34A" : "2px solid transparent",
              }}
            >
              Validadas ({validated.length})
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={TH}>Cliente</th>
                  <th style={TH}>Responsável</th>
                  <th style={{ ...TH, textAlign: "right" }}>Valor</th>
                  <th style={TH}>Data</th>
                  <th style={TH}>SDR</th>
                  <th style={TH}>Administradora</th>
                  <th style={{ ...TH, textAlign: "right" }}>Comissão Closer</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Parcelas (12×)</th>
                  <th style={TH}>Notas</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((s, idx) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: "0.5px solid #F3F4F6",
                      background: idx % 2 === 0 ? "white" : "#FAFAFA",
                    }}
                  >
                    <td style={{ padding: "10px 16px", fontWeight: 500, color: "#111827" }}>
                      {s.clientName}
                    </td>
                    <td style={{ padding: "10px 16px", color: "#6B7280" }}>{s.assignedTo}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 500, color: "#16A34A" }}>
                      {fmtBRL(s.value)}
                    </td>
                    <td style={{ padding: "10px 16px", color: "#6B7280" }}>{fmtDateBR(s.closedAt)}</td>
                    <td style={{ padding: "10px 16px", color: "#9CA3AF" }}>{s.sdrName ?? "—"}</td>
                    <td style={{ padding: "10px 16px", color: "#9CA3AF" }}>{s.administradora ?? "—"}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 500, color: "#2563EB" }}>
                      {s.valorComissaoCloser != null ? fmtBRL(s.valorComissaoCloser) : "—"}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {s.leadId ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 500,
                            background: "#DCFCE7",
                            color: "#166534",
                          }}
                        >
                          <span
                            style={{ width: 6, height: 6, borderRadius: "50%", background: "#16A34A", display: "inline-block" }}
                          />
                          Validada
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 500,
                            background: "#FEF9C3",
                            color: "#92400E",
                          }}
                        >
                          <span
                            style={{ width: 6, height: 6, borderRadius: "50%", background: "#D97706", display: "inline-block" }}
                          />
                          Pendente
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <InstallmentTimeline installments={s.installments} closedAt={s.closedAt} />
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        color: "#9CA3AF",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {displayed.length === 0 && (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  fontSize: 13,
                  color: "#9CA3AF",
                }}
              >
                {tab === "pendente"
                  ? "Nenhuma venda pendente de validação."
                  : "Nenhuma venda validada no período."}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div
          style={{
            marginTop: 16,
            background: "white",
            border: "0.5px solid #E5E7EB",
            borderRadius: 12,
            padding: "14px 18px",
            fontSize: 12,
            color: "#374151",
          }}
        >
          <strong>Como funciona a validação:</strong> Vendas importadas do Kommo CRM são
          automaticamente validadas (possuem Lead ID). Vendas cadastradas manualmente ficam como
          pendentes até serem associadas a um lead do CRM. As parcelas mostram meses pagos desde o
          fechamento (contrato 12×).
        </div>
      </main>
    </>
  );
}
