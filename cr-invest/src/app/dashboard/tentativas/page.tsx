"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Phone, PhoneOff, PhoneMissed, Users, TrendingUp, AlertCircle } from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

function getMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  const dd = String(last).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${dd}` };
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new:       { label: "Novo",       color: "#6b7280" },
  contacted: { label: "Contatado",  color: "#3b82f6" },
  qualified: { label: "Qualificado",color: "#8b5cf6" },
  scheduled: { label: "Agendado",   color: "#f59e0b" },
  meeting:   { label: "Reunião",    color: "#10b981" },
  won:       { label: "Ganho",      color: "#059669" },
  lost:      { label: "Perdido",    color: "#ef4444" },
};

// ─── types ────────────────────────────────────────────────────────────────────

interface LeadRow {
  id: string;
  assignedTo: string;
  status: string;
  campaignName: string;
  createdAt: string;
  contactAttempts: number;
  goToCalls: number;
  totalAttempts: number;
  hasPhone: boolean;
  firstCallAt: string | null;
  contactedAt: string | null;
  scheduledAt: string | null;
}

interface BySdr {
  sdr: string;
  totalLeads: number;
  avgAttempts: number;
  kommoTotal: number;
  gotoTotal: number;
  semTentativas: number;
  semTelefone: number;
}

interface Summary {
  totalLeads: number;
  comTentativas: number;
  semTentativas: number;
  semTelefone: number;
  avgAttempts: number;
  distribuicao: { faixa: string; count: number }[];
  bySdr: BySdr[];
}

interface ApiData {
  leads: LeadRow[];
  summary: Summary;
}

// ─── Card component ───────────────────────────────────────────────────────────

function Card({ title, value, sub, icon, color }: {
  title: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", border: "1px solid #f0f0f5", display: "flex", alignItems: "flex-start", gap: 14 }}>
      <div style={{ background: color + "18", borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>{title}</p>
        <p style={{ fontSize: 24, fontWeight: 700, color: "#1d1d1f", margin: "2px 0 0" }}>{value}</p>
        {sub && <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TentativasPage() {
  const { data: session } = useSession();
  const [range, setRange] = useState(getMonthRange);
  const [sdrFilter, setSdrFilter] = useState("");
  const [searchId, setSearchId] = useState("");
  const [sortCol, setSortCol] = useState<"total" | "goto" | "kommo" | "date">("total");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const load = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ start: range.start, end: range.end });
    if (sdrFilter) params.set("sdr", sdrFilter);
    fetch(`/api/kpis/tentativas?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setError(json.error); setData(null); }
        else setData(json.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [range.start, range.end, sdrFilter]);

  const sdrs = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.leads.map((l) => l.assignedTo).filter((s) => s !== "—"))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.leads;
    if (searchId) rows = rows.filter((l) => l.id.includes(searchId) || l.campaignName.toLowerCase().includes(searchId.toLowerCase()));
    return [...rows].sort((a, b) => {
      let diff = 0;
      if (sortCol === "total")  diff = a.totalAttempts - b.totalAttempts;
      if (sortCol === "goto")   diff = a.goToCalls - b.goToCalls;
      if (sortCol === "kommo")  diff = a.contactAttempts - b.contactAttempts;
      if (sortCol === "date")   diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "desc" ? -diff : diff;
    });
  }, [data, searchId, sortCol, sortDir]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  const thStyle = (col: typeof sortCol): React.CSSProperties => ({
    padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#6b7280",
    textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer",
    whiteSpace: "nowrap", background: sortCol === col ? "#f5f5fa" : "transparent",
    userSelect: "none",
  });

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1d1d1f", margin: 0 }}>Tentativas de Contato</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
          Combinação de tentativas do Kommo (campo customizado) e ligações do GoTo Connect por lead.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="date" value={range.start}
          onChange={(e) => { setRange((r) => ({ ...r, start: e.target.value })); setPage(1); }}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, color: "#1d1d1f" }}
        />
        <span style={{ color: "#9ca3af" }}>até</span>
        <input
          type="date" value={range.end}
          onChange={(e) => { setRange((r) => ({ ...r, end: e.target.value })); setPage(1); }}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, color: "#1d1d1f" }}
        />
        <select
          value={sdrFilter}
          onChange={(e) => { setSdrFilter(e.target.value); setPage(1); }}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, color: "#1d1d1f" }}
        >
          <option value="">Todos os SDRs</option>
          {sdrs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          type="text" placeholder="Buscar por lead ID ou campanha…" value={searchId}
          onChange={(e) => { setSearchId(e.target.value); setPage(1); }}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, color: "#1d1d1f", minWidth: 220 }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: 16, marginBottom: 20, color: "#b91c1c", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Summary cards */}
      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
            <Card title="Total de Leads" value={data.summary.totalLeads} icon={<Users size={18} />} color="#3b82f6" />
            <Card title="Média de Tentativas" value={data.summary.avgAttempts} sub="por lead" icon={<TrendingUp size={18} />} color="#8b5cf6" />
            <Card title="Com Tentativas" value={data.summary.comTentativas}
              sub={`${Math.round((data.summary.comTentativas / Math.max(data.summary.totalLeads, 1)) * 100)}% do total`}
              icon={<Phone size={18} />} color="#10b981"
            />
            <Card title="Sem Tentativas" value={data.summary.semTentativas}
              sub={`${Math.round((data.summary.semTentativas / Math.max(data.summary.totalLeads, 1)) * 100)}% do total`}
              icon={<PhoneOff size={18} />} color="#f59e0b"
            />
            <Card title="Sem Telefone" value={data.summary.semTelefone}
              sub="GoTo não consegue mapear"
              icon={<PhoneMissed size={18} />} color="#ef4444"
            />
          </div>

          {/* Distribuição + Por SDR */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            {/* Distribuição */}
            <div style={{ background: "#fff", border: "1px solid #f0f0f5", borderRadius: 12, padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f", margin: "0 0 14px" }}>Distribuição por faixa de tentativas</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.summary.distribuicao.map(({ faixa, count }) => {
                  const pct = data.summary.totalLeads > 0 ? (count / data.summary.totalLeads) * 100 : 0;
                  const barColor = faixa === "0" ? "#ef4444" : faixa === "1–3" ? "#f59e0b" : faixa === ">10" ? "#8b5cf6" : "#10b981";
                  return (
                    <div key={faixa} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#6b7280", width: 36, textAlign: "right", flexShrink: 0 }}>{faixa}</span>
                      <div style={{ flex: 1, background: "#f5f5fa", borderRadius: 4, height: 16, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 4, transition: "width 0.4s ease" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#6b7280", width: 38, flexShrink: 0 }}>{count} ({Math.round(pct)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Por SDR */}
            <div style={{ background: "#fff", border: "1px solid #f0f0f5", borderRadius: 12, padding: 20, overflowX: "auto" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#1d1d1f", margin: "0 0 14px" }}>Resumo por SDR</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f9f9fb" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", color: "#6b7280", fontWeight: 600, fontSize: 11 }}>SDR</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280", fontWeight: 600, fontSize: 11 }}>Leads</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280", fontWeight: 600, fontSize: 11 }}>Média</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280", fontWeight: 600, fontSize: 11 }}>Kommo</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280", fontWeight: 600, fontSize: 11 }}>GoTo</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", color: "#ef4444", fontWeight: 600, fontSize: 11 }}>Sem tent.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summary.bySdr.map((row) => (
                    <tr key={row.sdr} style={{ borderTop: "1px solid #f0f0f5" }}>
                      <td style={{ padding: "8px 10px", color: "#1d1d1f", fontWeight: 500 }}>{row.sdr}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280" }}>{row.totalLeads}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: row.avgAttempts >= 3 ? "#10b981" : row.avgAttempts >= 1 ? "#f59e0b" : "#ef4444" }}>{row.avgAttempts}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280" }}>{row.kommoTotal}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280" }}>{row.gotoTotal}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: row.semTentativas > 0 ? "#ef4444" : "#10b981", fontWeight: 600 }}>{row.semTentativas}</td>
                    </tr>
                  ))}
                  {data.summary.bySdr.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: "#9ca3af" }}>Sem dados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Tabela de leads */}
      <div style={{ background: "#fff", border: "1px solid #f0f0f5", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1d1d1f" }}>
            Leads {loading ? "(carregando…)" : `(${filtered.length})`}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
            Página {page} de {totalPages || 1}
          </p>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9f9fb" }}>
                <th style={thStyle("date")} onClick={() => toggleSort("date")}>
                  Lead ID {sortCol === "date" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "left" }}>SDR</th>
                <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "left" }}>Status</th>
                <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "left" }}>Campanha</th>
                <th style={thStyle("kommo")} onClick={() => toggleSort("kommo")}>
                  Kommo {sortCol === "kommo" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th style={thStyle("goto")} onClick={() => toggleSort("goto")}>
                  GoTo {sortCol === "goto" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th style={thStyle("total")} onClick={() => toggleSort("total")}>
                  Total {sortCol === "total" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
                <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "left" }}>1ª Ligação</th>
                <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "left" }}>Entrada</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>Carregando…</td></tr>
              )}
              {!loading && paged.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>Nenhum lead encontrado.</td></tr>
              )}
              {!loading && paged.map((l) => {
                const st = STATUS_LABEL[l.status] ?? { label: l.status, color: "#6b7280" };
                const isZero = l.totalAttempts === 0;
                return (
                  <tr key={l.id} style={{ borderTop: "1px solid #f5f5fa" }}>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{l.id}</td>
                    <td style={{ padding: "10px 12px", color: "#1d1d1f" }}>{l.assignedTo}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                        background: st.color + "18", color: st.color,
                      }}>{st.label}</span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#6b7280", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.campaignName}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: l.contactAttempts > 0 ? "#1d1d1f" : "#d1d5db", fontWeight: l.contactAttempts > 0 ? 600 : 400 }}>
                      {l.contactAttempts > 0 ? l.contactAttempts : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: l.goToCalls > 0 ? "#1d1d1f" : "#d1d5db", fontWeight: l.goToCalls > 0 ? 600 : 400 }}>
                      {l.goToCalls > 0 ? l.goToCalls : (l.hasPhone ? "0" : <span title="Sem telefone" style={{ color: "#ef4444" }}>!</span>)}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700,
                      color: isZero ? "#ef4444" : l.totalAttempts >= 5 ? "#10b981" : "#f59e0b",
                    }}>
                      {l.totalAttempts}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>{fmtDate(l.firstCallAt)}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12 }}>{fmtDate(l.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid #f0f0f5", display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", color: "#1d1d1f", fontSize: 13, opacity: page === 1 ? 0.4 : 1 }}
            >← Ant</button>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: page === totalPages ? "not-allowed" : "pointer", color: "#1d1d1f", fontSize: 13, opacity: page === totalPages ? 0.4 : 1 }}
            >Próx →</button>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div style={{ marginTop: 16, display: "flex", gap: 20, flexWrap: "wrap" }}>
        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
          <strong>Kommo</strong> — tentativas registradas no campo customizado do CRM (preenchidas pelo SDR)
        </p>
        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
          <strong>GoTo</strong> — ligações realizadas pelo discador e mapeadas ao lead pelo telefone
        </p>
        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
          <strong>Total</strong> — maior valor entre as duas fontes (conservador, evita dupla contagem)
        </p>
        <p style={{ fontSize: 11, color: "#ef4444", margin: 0 }}>
          <strong>!</strong> — lead sem telefone cadastrado no Kommo (GoTo não consegue mapear ligações)
        </p>
      </div>
    </div>
  );
}
