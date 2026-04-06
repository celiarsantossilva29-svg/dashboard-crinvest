"use client";

import React, { useState, useEffect, useCallback } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getMonthRange(): { start: string; end: string } {
  const now = new Date();
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: fmtDate(s), end: fmtDate(e) };
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtPct(v: number, decimals = 1): string {
  return `${v.toFixed(decimals)}%`;
}

function fmtSecs(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function mesLabel(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
      new Date(isoDate + "T12:00:00")
    );
  } catch {
    return "";
  }
}

async function apiFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    const json = await res.json();
    return (json.data as T) ?? null;
  } catch {
    return null;
  }
}

// ─── design tokens ──────────────────────────────────────────────────────────

const LBL_STYLE: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#9CA3AF",
  fontWeight: 600,
  marginBottom: 3,
};

// ─── page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { start: ds, end: de } = getMonthRange();
  const [start, setStart] = useState(ds);
  const [end, setEnd] = useState(de);

  const [meta, setMeta] = useState<any>(null);
  const [funil, setFunil] = useState<any>(null);
  const [vendas, setVendas] = useState<any>(null);
  const [prospeccao, setProspeccao] = useState<any>(null);
  const [ads, setAds] = useState<any>(null);
  const [discadores, setDiscadores] = useState<any>(null);
  const [closers, setClosers] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    const [m, f, v, p, a, d, c, s] = await Promise.all([
      apiFetch<any>("/api/kpis/meta"),
      apiFetch<any>(`/api/kpis/funil?start=${start}&end=${end}`),
      apiFetch<any>(`/api/kpis/vendas?start=${start}&end=${end}`),
      apiFetch<any>(`/api/kpis/prospeccao?start=${start}&end=${end}`),
      apiFetch<any>(`/api/kpis/ads?start=${start}&end=${end}`),
      apiFetch<any>(`/api/kpis/discadores?start=${start}&end=${end}`),
      apiFetch<any>(`/api/kpis/performance-closer?start=${start}&end=${end}`),
      apiFetch<any>("/api/sync/status"),
    ]);
    setMeta(m); setFunil(f); setVendas(v); setProspeccao(p);
    setAds(a); setDiscadores(d); setClosers(c); setSyncStatus(s);
  }, [start, end]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── derived values ─────────────────────────────────────────────────────────

  const lastSync = syncStatus
    ? (Object.values(syncStatus).filter(Boolean) as any[])
        .map((s: any) => new Date(s.syncedAt).getTime())
        .sort((a, b) => b - a)[0]
    : null;
  const syncLabel = lastSync
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(lastSync))
    : "—";

  const pct = meta?.percentage ?? 0;
  const metaTarget = meta?.goal?.target ?? 0;
  const achieved = meta?.achieved ?? 0;
  const ritmoAtual = meta?.ritmoAtual ?? 0;
  const ritmoNecessario = meta?.ritmoNecessario ?? 0;
  const daysLeft = meta?.daysLeft ?? 0;
  const projecao = meta?.projection ?? 0;
  const projPct = metaTarget > 0 ? (projecao / metaTarget) * 100 : 0;

  // funnel stages
  const maxFunil = Math.max(funil?.leadsGerados ?? 1, 1);

  // dialer
  const totalCalls = discadores?.totalCalls ?? 0;
  const totalTalk = discadores?.totalTalkTimeSecs ?? 0;
  const avgCall = discadores?.avgTalkTimePerCall ?? 0;
  const periodDays = Math.max(1, Math.ceil(
    (new Date(end + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime()) / 86_400_000
  ));
  const agentRows: any[] = (discadores?.callsByAgent ?? [])
    .slice()
    .sort((a: any, b: any) => b.totalCalls - a.totalCalls);

  // 3C Plus breakdown
  const threecAgents: any[] = agentRows.filter((a: any) => a.source === "threec");
  const totalThreec = threecAgents.reduce((s: number, a: any) => s + a.totalCalls, 0);

  // closer ranking
  const sortedClosers: any[] = [...(closers?.agents ?? [])].sort(
    (a, b) => (b.receita ?? 0) - (a.receita ?? 0)
  );

  const qtVendas = vendas?.ticketMedio?.value > 0 ? vendas.ticketMedio.value : 1;
  const faltamVendas = Math.ceil(Math.max(0, metaTarget - achieved) / qtVendas);

  return (
    <>
      <header
        className="sticky top-0 z-30"
        style={{
          background: "rgba(248,247,244,0.94)",
          backdropFilter: "blur(12px)",
          borderBottom: "0.5px solid #E5E7EB",
          padding: "10px 24px",
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>
              CR Invest — Sistema de Performance
            </p>
            <p style={{ fontSize: 11, color: "#9CA3AF" }}>
              Ciclo comercial · {mesLabel(start)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label style={{ fontSize: 11, color: "#9CA3AF" }}>De</label>
            <input
              type="date" value={start}
              onChange={(e) => setStart(e.target.value)}
              style={{
                border: "0.5px solid #E5E7EB", borderRadius: 6,
                padding: "4px 8px", fontSize: 12, color: "#374151", background: "white",
              }}
            />
            <label style={{ fontSize: 11, color: "#9CA3AF" }}>até</label>
            <input
              type="date" value={end}
              onChange={(e) => setEnd(e.target.value)}
              style={{
                border: "0.5px solid #E5E7EB", borderRadius: 6,
                padding: "4px 8px", fontSize: 12, color: "#374151", background: "white",
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <span style={LBL_STYLE}>Sync {syncLabel}</span>
            <button
              onClick={fetchAll}
              style={{
                fontSize: 11, fontWeight: 600, padding: "5px 14px", borderRadius: 6,
                background: "#F3F4F6", color: "#374151", border: "0.5px solid #E5E7EB",
                cursor: "pointer",
              }}
            >
              Atualizar
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden overflow-y-auto w-full pt-8 pb-16 bg-[#f7f8f9] text-[#1d1d1f] font-sans selection:bg-[#c89f3c] selection:text-white">
        <div className="mx-auto w-full max-w-[1240px] px-6">
          
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            
            {/* LADO ESQUERDO */}
            <div className="flex-1 w-full min-w-0 flex flex-col gap-6">
              
              {/* Progresso do Ciclo */}
              <div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6 pb-4">
                <div className="grid grid-cols-4 gap-6 text-center divide-x divide-[#f0f0f5]">
                  <div className="px-2">
                    <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Progresso do Ciclo</p>
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-[16px] font-bold text-[#1d1d1f]">R$</span>
                      <span className="text-[36px] font-black text-[#1d1d1f] tracking-tight leading-none">{fmtBRL(achieved).replace('R$', '').trim()}</span>
                    </div>
                  </div>
                  <div className="px-2">
                    <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">% da Meta</p>
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-[28px] font-bold text-[#1d1d1f] tracking-tight leading-none">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="px-2">
                    <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Atingido</p>
                    <div className="flex items-baseline justify-center">
                      <span className="text-[28px] font-bold text-[#1d1d1f] tracking-tight leading-none">0%</span>
                    </div>
                  </div>
                  <div className="px-2">
                    <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Faltam</p>
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-[14px] font-bold text-[#86868b]">R$</span>
                      <span className="text-[28px] font-bold text-[#1d1d1f] tracking-tight leading-none">{fmtBRL(Math.max(0, metaTarget - achieved)).replace('R$', '').trim()}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full h-3 bg-[#e5e5ea] rounded-full mt-6 mb-5 relative overflow-hidden shadow-inner">
                  <div className="absolute top-0 left-0 h-full bg-[#b22222] rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}></div>
                </div>

                <div className="flex items-center justify-between border-t border-[#f0f0f5] pt-4 pb-2">
                  <div className="flex items-center gap-8 text-[13px]">
                    <p className="text-[#1d1d1f]">Ticket médio: <span className="font-bold">{fmtBRL(vendas?.ticketMedio?.value ?? 0)}</span></p>
                    <div className="w-px h-4 bg-[#e5e5ea]"></div>
                    <p className="text-[#1d1d1f]">Vendas realizadas: <span className="font-bold">{vendas?.taxaConversao?.won ?? 0}</span></p>
                    <div className="w-px h-4 bg-[#e5e5ea]"></div>
                    <p className="text-[#1d1d1f]">Faltam: <span className="font-bold">{faltamVendas} vendas</span></p>
                  </div>
                </div>

                <div className="border-t border-[#f0f0f5] mt-1 pt-3 flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2 text-[12px] font-medium text-[#86868b]">
                    <span>Conservador: faltam {Math.floor(faltamVendas * 1.2)} vendas</span>
                    <div className="bg-[#b49136] text-white px-3 py-1 text-[11px] font-bold relative" style={{ clipPath: 'polygon(0 0, 95% 0, 100% 50%, 95% 100%, 0 100%)' }}>
                      Base: faltam {faltamVendas} vendas
                    </div>
                    <span>Otimista: faltam {Math.floor(faltamVendas * 0.9)} vendas</span>
                  </div>
                </div>
              </div>

              {/* Ação Recomendada */}
              <div className="bg-[#fdfaec] border border-[#f5ebc4] rounded-lg p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <span className="text-[#b49136] font-bold text-[16px]">Ação Recomendada:</span>
                  <div className="bg-[#f5e6b7] text-[#8c671b] px-4 py-1.5 rounded-full text-[13px] font-bold flex items-center gap-2 cursor-pointer hover:bg-[#ebd596] transition-colors">
                    Aumentar volume de ligações SDR
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  </div>
                </div>
                <div className="text-[11px] text-[#b49136]/50 italic text-right">
                  Última sincronização apurada: {syncLabel}
                </div>
              </div>

              {/* Funil Comercial */}
              <div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
                <h3 className="font-bold text-[14px] mb-4 text-[#1d1d1f]">Funil Comercial</h3>
                
                <div className="flex mb-2 px-1">
                  <div className="flex-1 text-center">
                    <p className="text-[13px] font-bold text-[#1d1d1f]">Leads &nbsp;<span className="font-black text-[15px]">{maxFunil}</span></p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[13px] font-bold text-[#1d1d1f]">{funil?.contatados ?? 0} Contatados</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[13px] font-bold text-[#1d1d1f]">{funil?.agendamentos ?? 0} Agendamentos</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[13px] font-bold text-[#1d1d1f]">{funil?.reunioes ?? 0} Reuniões</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[14px] font-black text-[#1d1d1f]">{funil?.vendas ?? 0} Vendas</p>
                  </div>
                </div>

                <div className="flex h-[36px] w-full items-stretch">
                  <div className="flex-1 bg-[#f0f0f2]" style={{ clipPath: 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%)' }}></div>
                  
                  <div className="flex-1 bg-[#e0e1e2] flex items-center justify-center -ml-4" style={{ clipPath: 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%, 10% 50%)', paddingLeft: '8%' }}>
                    <div className="flex items-center gap-1.5 text-[#1d1d1f] font-bold text-[12px]">
                      {fmtPct(funil?.conversions?.contactRate ?? 0, 0)}
                    </div>
                  </div>

                  <div className="flex-1 bg-[#e0e1e2] flex items-center justify-center -ml-4" style={{ clipPath: 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%, 10% 50%)', paddingLeft: '8%' }}>
                    <div className="flex items-center gap-1.5 text-[#1d1d1f] font-bold text-[12px]">
                      {fmtPct(funil?.conversions?.scheduleRate ?? 0, 0)}
                    </div>
                  </div>

                  <div className="flex-1 bg-[#e0e1e2] flex items-center justify-center -ml-4" style={{ clipPath: 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%, 10% 50%)', paddingLeft: '8%' }}>
                    <div className="flex items-center gap-1.5 text-[#1d1d1f] font-bold text-[12px]">
                      {fmtPct(funil?.conversions?.meetingRate ?? 0, 0)}
                    </div>
                  </div>

                  <div className="flex-1 bg-[#f9fafb] flex items-center justify-center -ml-4 text-[11px] text-[#9ca3af] italic" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 10% 50%)', paddingLeft: '8%' }}>
                    Sem vendas<br/>no período
                  </div>
                </div>

                <div className="text-center mt-5 text-[12px] font-medium text-[#b22222]">
                  <span className="mr-1">•</span> Gargalo principal: SDR <span className="text-[#d46565]">({(prospeccao?.taxaAgendamento?.value ?? 0) < 15 ? 'baixa taxa de agendamento' : 'boa taxa de agendamento'})</span> <span className="ml-1">•</span>
                </div>
              </div>

              {/* Performance SDR (Mockado) */}
              <div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
                <h3 className="font-bold text-[14px] mb-4 text-[#1d1d1f]">Performance SDR</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card Cauê */}
                  <div className="border border-[#f0f0f5] rounded-lg p-4 bg-[#fafafa]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center font-bold text-[14px]">C</div>
                        <span className="font-bold text-[#1d1d1f] text-[15px]">Cauê</span>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#d1d5db]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#d1d5db]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#b49136]"></div>
                      </div>
                    </div>
                    
                    <div className="text-[12px] text-[#374151] mb-2">
                      Hoje: <span className="font-bold">0 / 3</span> <span className="text-[#9ca3af] mx-1">•</span> Mês: <span className="font-bold">33 / 60</span>
                    </div>

                    <div className="flex h-4 bg-[#e5e5ea] rounded overflow-hidden mb-5">
                       <div className="bg-[#dc2626] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D1</div>
                       <div className="bg-[#ef4444] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D2</div>
                       <div className="bg-[#ef4444] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D2</div>
                       <div className="bg-[#16a34a] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D6</div>
                       <div className="bg-[#22c55e] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D6</div>
                       <div className="bg-[#22c55e] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D7</div>
                       <div className="bg-[#eab308] flex items-center justify-center w-[12.5%] border-r border-white/20">
                         <div className="w-1.5 h-1.5 rounded-full bg-white/60"></div>
                       </div>
                       <div className="bg-[#eab308] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%]">B</div>
                    </div>

                    <ul className="space-y-2 text-[13px]">
                      <li className="flex justify-between"><span className="text-[#86868b]">• Ligações</span><span className="font-bold">12</span></li>
                      <li className="flex justify-between"><span className="text-[#86868b]">• Speed-to-Lead</span><span className="font-bold">5 min</span></li>
                      <li className="flex justify-between"><span className="text-[#86868b]">• Taxa Agendamento</span><span className="font-bold">13%</span></li>
                      <li className="flex justify-between"><span className="text-[#86868b]">• No-Show gerado</span><span className="font-bold">18%</span></li>
                    </ul>
                  </div>

                  {/* Card Laura */}
                  <div className="border border-[#f0f0f5] rounded-lg p-4 bg-[#fafafa]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center font-bold text-[14px]">L</div>
                        <span className="font-bold text-[#1d1d1f] text-[15px]">Laura</span>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></div>
                      </div>
                    </div>
                    
                    <div className="text-[12px] text-[#374151] mb-2">
                      Hoje: <span className="font-bold">2 / 3</span> <span className="text-[#9ca3af] mx-1">•</span> Mês: <span className="font-bold">46 / 60</span>
                    </div>

                    <div className="flex h-4 bg-[#e5e5ea] rounded overflow-hidden mb-5">
                       <div className="bg-[#dc2626] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D1</div>
                       <div className="bg-[#dc2626] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D2</div>
                       <div className="bg-[#16a34a] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D9</div>
                       <div className="bg-[#22c55e] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D6</div>
                       <div className="bg-[#22c55e] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D6</div>
                       <div className="bg-[#15803d] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D9</div>
                       <div className="bg-[#eab308] flex items-center justify-center w-[12.5%] border-r border-white/20">
                         <div className="w-1.5 h-1.5 rounded-full bg-white/60"></div>
                       </div>
                       <div className="bg-[#9ca3af] w-[12.5%]"></div>
                    </div>

                    <ul className="space-y-2 text-[13px]">
                      <li className="flex justify-between"><span className="text-[#86868b]">• Ligações</span><span className="font-bold">19</span></li>
                      <li className="flex justify-between"><span className="text-[#86868b]">• Speed-to-Lead</span><span className="font-bold">2 min</span></li>
                      <li className="flex justify-between"><span className="text-[#86868b]">• Taxa Agendamento</span><span className="font-bold">30%</span></li>
                      <li className="flex justify-between"><span className="text-[#86868b]">• No-Show gerado</span><span className="font-bold">15%</span></li>
                    </ul>
                  </div>

                  {/* Card Pedro */}
                  <div className="border border-[#f0f0f5] rounded-lg p-4 bg-[#fafafa]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1d1d1f] text-white flex items-center justify-center font-bold text-[14px]">P</div>
                        <span className="font-bold text-[#1d1d1f] text-[15px]">Pedro</span>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#d1d5db]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#facc15]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#facc15]"></div>
                      </div>
                    </div>
                    
                    <div className="text-[12px] text-[#374151] mb-2">
                      Hoje: <span className="font-bold">3 / 3</span> <span className="text-[#9ca3af] mx-1">•</span> Mês: <span className="font-bold">56 / 50</span>
                    </div>

                    <div className="flex h-4 bg-[#e5e5ea] rounded overflow-hidden mb-5">
                       <div className="bg-[#b22222] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D1</div>
                       <div className="bg-[#dc2626] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D4</div>
                       <div className="bg-[#22c55e] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D2</div>
                       <div className="bg-[#22c55e] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D6</div>
                       <div className="bg-[#16a34a] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D8</div>
                       <div className="bg-[#15803d] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%] border-r border-white/20">D9</div>
                       <div className="bg-[#eab308] flex items-center justify-center w-[12.5%] border-r border-white/20">
                         <div className="w-1.5 h-1.5 rounded-full bg-white/60"></div>
                       </div>
                       <div className="bg-[#eab308] text-[8px] font-bold text-white flex items-center justify-center w-[12.5%]"></div>
                    </div>

                    <ul className="space-y-2 text-[13px]">
                      <li className="flex justify-between"><span className="text-[#86868b]">• Ligações</span><span className="font-bold">15</span></li>
                      <li className="flex justify-between"><span className="text-[#86868b]">• Speed-to-Lead</span><span className="font-bold">4 min</span></li>
                      <li className="flex justify-between"><span className="text-[#86868b]">• Taxa Agendamento</span><span className="font-bold">22%</span></li>
                      <li className="flex justify-between"><span className="text-[#86868b]">• Leads Via Ads</span><span className="font-bold">400</span></li>
                    </ul>
                  </div>
                </div>
              </div>
              
            </div>

            {/* LADO DIREITO (WIDGETS LATERALES) */}
            <div className="w-full lg:w-[320px] flex flex-col gap-6 flex-shrink-0">
              
              {/* Ritmo e Projeção (Novo Branco) */}
              <div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
                <h3 className="font-bold text-[14px] mb-4 text-[#1d1d1f]">Ritmo e Projeção</h3>
                
                <div className="grid grid-cols-2 gap-y-5 gap-x-2">
                  <div>
                    <p className="text-[11px] font-medium text-[#86868b] mb-0.5">Ritmo atual</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[11px] font-bold text-[#1d1d1f]">R$</span>
                      <span className="text-[19px] font-black text-[#1d1d1f] tracking-tight leading-none">{fmtBRL(ritmoAtual).replace('R$', '').trim()}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#86868b] mb-0.5">Ritmo necessário</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[11px] font-bold text-[#1d1d1f]">R$</span>
                      <span className="text-[19px] font-black text-[#1d1d1f] tracking-tight leading-none">{fmtBRL(ritmoNecessario).replace('R$', '').trim()}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#86868b] mb-0.5">Projeção final</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[11px] font-bold text-[#1d1d1f]">R$</span>
                      <span className="text-[19px] font-black text-[#1d1d1f] tracking-tight leading-none">{fmtBRL(projecao).replace('R$', '').trim()}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#86868b] mb-0.5">Dias restantes</p>
                    <div className="text-[19px] font-black text-[#1d1d1f] tracking-tight leading-none">{daysLeft}</div>
                  </div>
                </div>
              </div>



              {/* Discadores */}
              <div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
                <h3 className="font-bold text-[14px] mb-4 text-[#1d1d1f]">Discadores</h3>
                <ul className="space-y-4">
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-medium">Ligações Totais</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">{totalCalls}</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-medium">Tempo Falado</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">{fmtSecs(totalTalk)}</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#1d1d1f] font-medium">Média/Ligação</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">{fmtSecs(avgCall)}</span>
                  </li>
                  <li className="flex justify-between items-center text-[13px] pt-4 border-t border-[#f0f0f5]">
                    <span className="text-[#86868b] font-medium">GoTo</span>
                    <div className="flex gap-4">
                       <span className="font-bold text-[#1d1d1f]">{agentRows.filter(a => a.source === 'goto').reduce((s,a)=>s+a.totalCalls, 0)}</span>
                    </div>
                  </li>
                  <li className="flex justify-between items-center text-[13px]">
                    <span className="text-[#86868b] font-medium">3C Plus</span>
                    <div className="flex gap-4">
                       <span className="font-bold text-[#1d1d1f]">{totalThreec}</span>
                    </div>
                  </li>
                </ul>
              </div>

            </div>

          </div>
          
          <hr className="my-10 border-[#e5e5ea]" />
          <div className="mb-4">
            <h2 className="text-[18px] font-serif font-bold text-[#1d1d1f]">Dados Suplementares (Análise Completa)</h2>
          </div>

          {/* Metrics Grids (Row 1) */}
          <div className="grid grid-cols-12 gap-5 mb-5">
            {/* Prospecção (7 cols) */}
            <div className="col-span-12 md:col-span-7 bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
              <h3 className="font-bold text-[14px] mb-5 text-[#1d1d1f] border-b border-[#f0f0f5] pb-3">Prospecção Geral</h3>
              <div className="grid grid-cols-2 gap-x-10 relative">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#f0f0f5] -ml-px"></div>
                
                <ul className="space-y-4">
                  <li className="flex justify-between text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Leads gerados</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">{maxFunil}</span>
                  </li>
                  <li className="flex justify-between text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">No-show</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">{fmtPct(prospeccao?.noShow?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Qualificação</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">{fmtPct(prospeccao?.taxaQualificacao?.value ?? 0)}</span>
                  </li>
                </ul>

                <ul className="space-y-4">
                  <li className="flex justify-between text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Taxa Agendamento</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">{fmtPct(prospeccao?.taxaAgendamento?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Qualificação</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">{fmtPct(prospeccao?.taxaQualificacao?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between text-[13px]">
                    <span className="text-[#1d1d1f] font-semibold">Contatos por Lead</span>
                    <span className="font-bold text-[#1d1d1f] tabular-nums">{prospeccao?.contatosPorLead ?? 0}</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Performance de Vendas (5 cols) */}
            <div className="col-span-12 md:col-span-5 bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
              <h3 className="font-bold text-[14px] mb-5 text-[#1d1d1f] border-b border-[#f0f0f5] pb-3">Performance de Vendas Geral</h3>
              <ul className="space-y-4">
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">CAC</span>
                  <span className="font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>{fmtBRL(vendas?.cac?.value ?? 0).replace('R$', '').trim()}</span>
                </li>
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">Ticket Médio</span>
                  <span className="font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>{fmtBRL(vendas?.ticketMedio?.value ?? 0).replace('R$', '').trim()}</span>
                </li>
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">Conversão Geral</span>
                  <span className="font-bold text-[#1d1d1f] tabular-nums">{fmtPct(vendas?.taxaConversao?.value ?? 0)}</span>
                </li>
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">Ciclo de Vendas</span>
                  <span className="font-bold text-[#1d1d1f] tabular-nums">{vendas?.cicloVendas?.value ?? 0} dias</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Metrics Grids (Row 2) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            {/* Tráfego Meta Ads */}
            <div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
              <h3 className="font-bold text-[14px] mb-5 text-[#1d1d1f] border-b border-[#f0f0f5] pb-3">Tráfego Meta Ads</h3>
              <ul className="space-y-4">
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">Investimento Total</span>
                  <span className="font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>{fmtBRL(ads?.totalSpend ?? 0).replace('R$', '').trim()}</span>
                </li>
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">CPL</span>
                  <span className="font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>{fmtBRL(ads?.cpl ?? 0).replace('R$', '').trim()}</span>
                </li>
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">CPC</span>
                  <span className="font-bold text-[#1d1d1f] tabular-nums"><span className="text-[10px] text-[#86868b] mr-1 font-normal">R$</span>{fmtBRL(ads?.cpc ?? 0).replace('R$', '').trim()}</span>
                </li>
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">CTR</span>
                  <span className="font-bold text-[#1d1d1f] tabular-nums">{fmtPct(ads?.ctr ?? 0, 1)}</span>
                </li>
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">ROAS</span>
                  <span className="font-bold text-[#1d1d1f] tabular-nums">{(ads?.roas ?? 0).toFixed(2)}x</span>
                </li>
              </ul>
            </div>

            {/* Tabulações 3C Plus */}
            <div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] p-6">
              <h3 className="font-bold text-[14px] mb-5 text-[#1d1d1f] border-b border-[#f0f0f5] pb-3">Tabulações 3C Plus</h3>
              <ul className="space-y-4">
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">Sem Interesse</span>
                  <span className="font-bold text-[#b49136] tabular-nums">38%</span>
                </li>
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">Não Atendeu</span>
                  <span className="font-bold text-[#b49136] tabular-nums">22%</span>
                </li>
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">Retornar</span>
                  <span className="font-bold text-[#b49136] tabular-nums">12%</span>
                </li>
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">Negociação</span>
                  <span className="font-bold text-[#b49136] tabular-nums">8%</span>
                </li>
                <li className="flex justify-between items-center text-[13px]">
                  <span className="text-[#1d1d1f] font-semibold">Fechamento</span>
                  <span className="font-bold text-[#b49136] tabular-nums">5%</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Table: Ranking de Closers */}
          <div className="bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#e5e5ea] rounded-t-[12px] overflow-hidden mb-8">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f7f8f9] border-b border-[#e5e5ea]">
                  <th className="px-6 py-3 text-[12px] font-bold text-[#1d1d1f] w-1/3">Ranking de Closers</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-[#86868b] text-center">Receita</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-[#86868b] text-center">Vendas</th>
                  <th className="px-4 py-3 text-[12px] font-medium text-[#86868b] text-center">Ticket</th>
                  <th className="px-6 py-3 text-[12px] font-medium text-[#86868b] text-center">Win</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f5]">
                {sortedClosers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[13px] text-[#86868b]">
                      Sem dados apurados.
                    </td>
                  </tr>
                ) : (
                  sortedClosers.map((c: any, i: number) => {
                    const isFirst = i === 0;
                    const bgClass = isFirst ? 'bg-[#b49136] text-white' : (i % 2 === 0 ? 'bg-white' : 'bg-[#fbfbfc]');
                    const textClass = isFirst ? 'text-white' : 'text-[#1d1d1f]';
                    const textSecClass = isFirst ? 'text-white/80' : 'text-[#86868b]';
                    
                    return (
                      <tr key={c.agentName} className={bgClass}>
                        <td className={`px-6 py-3 text-[14px] font-bold ${isFirst ? '' : 'pl-[38px]'} ${textClass}`}>
                          {isFirst ? (
                            <div className="flex items-center gap-2">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white/90">
                                <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>
                              </svg>
                              <span>{c.agentName}</span>
                            </div>
                          ) : (
                            c.agentName
                          )}
                        </td>
                        <td className={`px-4 py-3 text-center text-[14px] font-bold ${textClass} tabular-nums`}>
                          <span className={`text-[10px] ${textSecClass} mr-1 font-normal`}>R$</span>
                          {fmtBRL(c.receita).replace('R$', '').trim()}
                        </td>
                        <td className={`px-4 py-3 text-center text-[14px] font-bold ${textClass} tabular-nums`}>
                          {c.vendas}
                        </td>
                        <td className={`px-4 py-3 text-center text-[14px] font-bold ${textClass} tabular-nums`}>
                          <span className={`text-[10px] ${textSecClass} mr-1 font-normal`}>R$</span>
                          {fmtBRL(c.ticketMedio).replace('R$', '').trim()}
                        </td>
                        <td className={`px-6 py-3 text-center text-[14px] font-bold ${textClass} tabular-nums`}>
                          {fmtPct(c.taxaWin ?? 0)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="text-center text-[10px] text-[#9ca3af] mb-4 tracking-wider">Última atualização: {syncLabel}</p>

        </div>
      </main>
    </>
  );
}
