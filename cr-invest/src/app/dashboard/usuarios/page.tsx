"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

interface KommoStatus {
  connected: boolean;
  expiresAt: string | null;
  lastSync: string | null;
  mock: boolean;
}

interface SyncState {
  loading: boolean;
  result: string | null;
  error: string | null;
}

interface SyncProgressState {
  running: boolean;
  source: string;
  phase: string;
  processed: number;
  total: number;
  pages: number;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
}

interface SyncHistoryEntry {
  id: string;
  source: string;
  status: string;
  message: string;
  syncedAt: string;
}

function fmtDateTimeBR(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function SyncButton({
  label,
  endpoint,
  variant = "default",
}: {
  label: string;
  endpoint: string;
  variant?: "default" | "primary";
}) {
  const [state, setState] = useState<SyncState>({ loading: false, result: null, error: null });

  async function run() {
    setState({ loading: true, result: null, error: null });
    try {
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      // Servidor retorna imediatamente — sync roda em background no servidor
      const msg = json.data?.started === false
        ? json.data?.reason ?? "já em andamento"
        : "iniciado — pode navegar livremente";
      setState({ loading: false, result: msg, error: null });
    } catch (e: any) {
      setState({ loading: false, result: null, error: e.message });
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={run}
        disabled={state.loading}
        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
          variant === "primary"
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "border border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
      >
        {state.loading ? "Disparando..." : label}
      </button>
      {state.result && (
        <p className="text-[10px] text-green-600 text-center">✓ {state.result}</p>
      )}
      {state.error && (
        <p className="text-[10px] text-red-500 text-center truncate" title={state.error}>
          ✗ {state.error.slice(0, 60)}
        </p>
      )}
    </div>
  );
}

function KommoSyncButton({ running, lastFinished }: { running: boolean; lastFinished: string | null }) {
  const [triggered, setTriggered] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevRunning = useRef(false);

  // Detecta transição running → false após o botão ter sido clicado
  useEffect(() => {
    if (prevRunning.current && !running && triggered) {
      setTriggered(false);
      setDone(true);
    }
    prevRunning.current = running;
  }, [running, triggered]);

  async function handleClick() {
    setTriggered(true);
    setDone(false);
    setError(null);
    try {
      const res = await fetch("/api/sync/kommo?mode=full");
      const json = await res.json();
      if (json.error) setError(json.error);
    } catch (e: any) {
      setError(e.message);
      setTriggered(false);
    }
  }

  const isRunning = running || triggered;

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={isRunning}
        className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700"
      >
        {isRunning ? "Sincronizando..." : "Sincronizar Kommo"}
      </button>
      {done && !error && (
        <p className="text-[10px] text-green-600 text-center font-medium">
          ✓ Concluído {lastFinished ? `às ${lastFinished}` : ""}
        </p>
      )}
      {error && (
        <p className="text-[10px] text-red-500 text-center truncate" title={error}>
          ✗ {error.slice(0, 60)}
        </p>
      )}
    </div>
  );
}

export default function UsuariosPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"integracoes" | "equipe" | "comissao">("integracoes");

  // State for Kommo/Integracoes
  const [oauthResult, setOauthResult] = useState<"idle" | "success" | "error">("idle");
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [kommo, setKommo] = useState<KommoStatus | null>(null);
  const [kommoLoading, setKommoLoading] = useState(true);
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [syncStatus, setSyncStatus] = useState<{ progress: SyncProgressState; history: SyncHistoryEntry[] } | null>(null);

  // State for Equipe (Users)
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [vendedoresLoading, setVendedoresLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({ 
    nome: "", 
    email: "", 
    role: "CLOSER", 
    fixo: 3000, 
    installments: 12,
    bronzeRate: 0.5,
    silverRate: 0.6,
    goldRate: 0.7,
    silverMin: 1000000,
    goldMin: 3000000,
    password: "",
    permissions: {
      VISAO_EXECUTIVA: { enabled: true, scope: "all" },
      FINANCEIRO_DASH: { enabled: true, scope: "all" },
      FINANCEIRO_GASTOS: { enabled: true, scope: "all" },
      VENDAS: { enabled: true, scope: "all" },
      PERF_SDR: { enabled: true, scope: "all" },
      PERF_CLOSER: { enabled: true, scope: "all" },
      GESTAO_VENDAS: { enabled: true, scope: "all" },
      TENTATIVAS: { enabled: true, scope: "all" },
      VALIDACAO_VENDA: { enabled: true, scope: "all" },
      CONFIGURACAO: { enabled: true, scope: "all" },
    }
  });

  // State for Comissão (Rules)
  const [comissaoConfig, setComissaoConfig] = useState({ fixedSalary: 3000, percentage: 0.5, installments: 12 });
  const [comissaoLoading, setComissaoLoading] = useState(false);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const fetchKommoStatus = useCallback(async () => {
    setKommoLoading(true);
    try {
      const res = await fetch("/api/kommo/status");
      const json = await res.json();
      setKommo(json.data);
    } catch {
      setKommo(null);
    } finally {
      setKommoLoading(false);
    }
  }, []);

  const fetchVendedores = useCallback(async () => {
    setVendedoresLoading(true);
    try {
      const res = await fetch("/api/vendedores");
      const json = await res.json();
      setVendedores(json.data || []);
    } finally {
      setVendedoresLoading(false);
    }
  }, []);

  const fetchComissaoConfig = useCallback(async () => {
    setComissaoLoading(true);
    try {
      const res = await fetch("/api/config/commission");
      const json = await res.json();
      if (json.data) {
        const d = json.data;
        setComissaoConfig({ fixedSalary: d.fixedSalary, percentage: d.percentage, installments: d.installments });
        // Somente se não estiver editando
        if (!editingId) {
          setNewUser(prev => ({
            ...prev,
            fixo: d.fixedSalary,
            bronzeRate: d.percentage,
            silverRate: d.percentage + 0.1,
            goldRate: d.percentage + 0.2,
            installments: d.installments
          }));
        }
      }
    } finally {
      setComissaoLoading(false);
    }
  }, [editingId]);

  useEffect(() => {
    fetchKommoStatus();
    fetchVendedores();
    fetchComissaoConfig();
  }, [fetchKommoStatus, fetchVendedores, fetchComissaoConfig]);

  useEffect(() => {
    const status = searchParams.get("kommo");
    if (status === "success") {
      setOauthResult("success");
      setActiveTab("integracoes");
    }
    if (status === "error") {
      setOauthResult("error");
      setOauthError(searchParams.get("reason") ?? "Erro desconhecido");
      setActiveTab("integracoes");
    }
  }, [searchParams]);

  // Poll sync status every 2s while on the integracoes tab
  useEffect(() => {
    if (activeTab !== "integracoes") return;
    const poll = async () => {
      try {
        const res = await fetch("/api/sync/status");
        const json = await res.json();
        if (json.progress !== undefined && json.history !== undefined) {
          setSyncStatus({ progress: json.progress, history: json.history });
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [activeTab]);

  // Actions
  async function handleAddUser(e: any) {
    e.preventDefault();
    try {
      const res = await fetch("/api/vendedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...newUser, 
          id: editingId,
          fixoMensal: newUser.fixo,
          permissions: JSON.stringify(newUser.permissions)
        }),
      });
      if (res.ok) {
        alert(editingId ? "Usuário atualizado!" : "Usuário cadastrado!");
        fetchVendedores();
        handleCancelEdit();
      } else {
        const err = await res.json();
        alert("Erro ao salvar: " + (err.error || "Erro desconhecido"));
      }
    } catch (e: any) {
      console.error(e);
      alert("Erro ao salvar: " + e.message);
    }
  }

  function handleEditUser(v: any) {
    setEditingId(v.id);
    let perms: Record<string, { enabled: boolean; scope: string }> = {
      VISAO_EXECUTIVA: { enabled: true, scope: "all" },
      FINANCEIRO_DASH: { enabled: true, scope: "all" },
      FINANCEIRO_GASTOS: { enabled: true, scope: "all" },
      VENDAS: { enabled: true, scope: "all" },
      PERF_SDR: { enabled: true, scope: "all" },
      PERF_CLOSER: { enabled: true, scope: "all" },
      GESTAO_VENDAS: { enabled: true, scope: "all" },
      TENTATIVAS: { enabled: true, scope: "all" },
      VALIDACAO_VENDA: { enabled: true, scope: "all" },
      CONFIGURACAO: { enabled: true, scope: "all" },
    };
    // Backward compat: migrate old DASHBOARD key or grouped keys
    try {
      if (v.permissions) {
        const parsed = JSON.parse(v.permissions);
        if (parsed.DASHBOARD && !parsed.VISAO_EXECUTIVA) {
          parsed.VISAO_EXECUTIVA = parsed.DASHBOARD;
          parsed.PERF_SDR = parsed.PERF_SDR || parsed.DASHBOARD;
          parsed.PERF_CLOSER = parsed.PERF_CLOSER || parsed.DASHBOARD;
          delete parsed.DASHBOARD;
        }
        // Migrate grouped keys to new distinct ones if not set
        if (parsed.FINANCEIRO) {
          if (!parsed.FINANCEIRO_DASH) parsed.FINANCEIRO_DASH = parsed.FINANCEIRO;
          if (!parsed.FINANCEIRO_GASTOS) parsed.FINANCEIRO_GASTOS = parsed.FINANCEIRO;
        }
        if (parsed.GESTAO_VENDAS && !parsed.VENDAS) {
          parsed.VENDAS = parsed.GESTAO_VENDAS;
        }
        if (parsed.PERF_SDR && !parsed.TENTATIVAS) {
          parsed.TENTATIVAS = parsed.PERF_SDR;
        }
        perms = { ...perms, ...parsed };
      }
    } catch(e) {}
    // perms already parsed above

    setNewUser({
      nome: v.nome || "",
      email: v.email || "",
      role: v.role || "CLOSER",
      fixo: v.fixoMensal ?? 0,
      installments: v.installments ?? 12,
      bronzeRate: v.bronzeRate ?? 0,
      silverRate: v.silverRate ?? 0,
      goldRate: v.goldRate ?? 0,
      silverMin: v.silverMin ?? 0,
      goldMin: v.goldMin ?? 0,
      password: v.password || "",
      permissions: perms as any
    });
    setActiveTab("equipe");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setNewUser({ 
      nome: "", 
      email: "", 
      role: "CLOSER", 
      fixo: comissaoConfig.fixedSalary, 
      installments: comissaoConfig.installments,
      bronzeRate: comissaoConfig.percentage,
      silverRate: comissaoConfig.percentage + 0.1,
      goldRate: comissaoConfig.percentage + 0.2,
      silverMin: 1000000,
      goldMin: 3000000,
      password: "",
      permissions: {
        VISAO_EXECUTIVA: { enabled: true, scope: "all" },
        FINANCEIRO_DASH: { enabled: true, scope: "all" },
        FINANCEIRO_GASTOS: { enabled: true, scope: "all" },
        VENDAS: { enabled: true, scope: "all" },
        PERF_SDR: { enabled: true, scope: "all" },
        PERF_CLOSER: { enabled: true, scope: "all" },
        GESTAO_VENDAS: { enabled: true, scope: "all" },
        TENTATIVAS: { enabled: true, scope: "all" },
        VALIDACAO_VENDA: { enabled: true, scope: "all" },
        CONFIGURACAO: { enabled: true, scope: "all" },
      }
    });
  }

  async function handleDeleteUser(id: string) {
    if (!confirm("Tem certeza que deseja remover este vendedor?")) return;
    try {
      await fetch(`/api/vendedores?id=${id}`, { method: "DELETE" });
      fetchVendedores();
    } catch (e) {
      console.error(e);
    }
  }

  const togglePermission = (key: string) => {
    setNewUser(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: { ...prev.permissions[key as keyof typeof prev.permissions], enabled: !prev.permissions[key as keyof typeof prev.permissions].enabled }
      }
    }));
  };

  const setScope = (key: string, scope: string) => {
    setNewUser(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: { ...prev.permissions[key as keyof typeof prev.permissions], scope }
      }
    }));
  };

  async function handleUpdateCommission(e: any) {
    e.preventDefault();
    try {
      const res = await fetch("/api/config/commission", {
        method: "POST",
        body: JSON.stringify(comissaoConfig),
      });
      if (res.ok) alert("Configurações padrão salvas com sucesso!");
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between" style={{ background: "rgba(248,247,244,0.94)", backdropFilter: "blur(12px)", borderBottom: "0.5px solid #E5E7EB", padding: "10px 24px" }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Configurações</p>
          <p style={{ fontSize: 11, color: "#9CA3AF" }}>
            {activeTab === "integracoes" && "Integrações · Sincronização"}
            {activeTab === "equipe" && (editingId ? "Editando Usuário" : "Gestão de Equipe · Vendedores")}
            {activeTab === "comissao" && "Modelo de Comissionamento · Padrões"}
          </p>
        </div>
      </header>

      {/* TABS NAVIGATION */}
      <div className="px-6 pt-4 flex gap-2 border-b border-gray-200 bg-[#F8F7F4]">
        {[
          { id: "integracoes", label: "Integrações" },
          { id: "equipe", label: "Gestão de Equipe" },
          { id: "comissao", label: "Padrões (Seed)" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-bold transition-all border-b-2 ${
              activeTab === tab.id
                ? "border-[#1d1d1f] text-[#1d1d1f]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <main className="flex-1 p-6 space-y-6 max-w-5xl" style={{ background: "#F8F7F4" }}>

        {activeTab === "integracoes" && (
          <div className="space-y-6">
            <div style={{ background: "white", border: "0.5px solid #E5E7EB", borderRadius: 12, padding: "20px 24px" }}>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Sessão Ativa</h2>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                  {session?.user?.name?.charAt(0)?.toUpperCase() ?? "A"}
                </div>
                <div>
                  <p className="font-medium text-gray-800">{session?.user?.name ?? "Administrador"}</p>
                  <p className="text-sm text-gray-500">{session?.user?.email ?? "—"}</p>
                  <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {(session?.user as any)?.role ?? "admin"}
                  </span>
                </div>
                <div className="ml-auto">
                  <button onClick={() => signOut({ callbackUrl: "/login" })} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Sair</button>
                </div>
              </div>
            </div>

            <div style={{ background: "white", border: "0.5px solid #E5E7EB", borderRadius: 12, padding: "20px 24px" }}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-gray-700">Kommo CRM</h2>
                {!kommoLoading && kommo && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${kommo.connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {kommo.mock ? "Mock ativo" : kommo.connected ? "Conectado" : "Não conectado"}
                  </span>
                )}
              </div>
              {oauthResult === "success" && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">Conectado com sucesso!</div>}
              <div className="flex gap-3 flex-wrap items-center">
                <button onClick={() => { window.location.href = "/api/kommo/auth"; }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Conectar Kommo</button>
                <KommoSyncButton
                  running={syncStatus?.progress?.running ?? false}
                  lastFinished={syncStatus?.progress?.finishedAt ? fmtDateTimeBR(syncStatus.progress.finishedAt) : null}
                />
              </div>

              {/* Sync progress bar */}
              {syncStatus?.progress?.running && syncStatus.progress.source === "kommo" && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-blue-700 font-medium truncate pr-2">{syncStatus.progress.phase}</span>
                    <span className="text-xs text-blue-500 shrink-0">
                      {syncStatus.progress.total > 0
                        ? `${Math.round((syncStatus.progress.processed / syncStatus.progress.total) * 100)}%`
                        : `pág. ${syncStatus.progress.pages}`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{
                        width: syncStatus.progress.total > 0
                          ? `${Math.min(100, (syncStatus.progress.processed / syncStatus.progress.total) * 100)}%`
                          : "60%",
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-blue-400 mt-1">
                    {syncStatus.progress.startedAt ? `Iniciado às ${fmtDateTimeBR(syncStatus.progress.startedAt)}` : ""}
                  </p>
                </div>
              )}
              {!syncStatus?.progress?.running && syncStatus?.progress?.lastError && (
                <div className="mt-3 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                  Erro: {syncStatus.progress.lastError.slice(0, 120)}
                </div>
              )}
            </div>

            <div style={{ background: "white", border: "0.5px solid #E5E7EB", borderRadius: 12, padding: "20px 24px" }}>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Outras Plataformas</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-gray-500 w-20">GoTo Connect</span>
                  <button
                    onClick={() => { window.location.href = "/api/goto/auth"; }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Reconectar GoTo
                  </button>
                  <SyncButton label="Sincronizar GoTo" endpoint="/api/sync/goto" />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-gray-500 w-20">Meta Ads</span>
                  <SyncButton label="Sincronizar Meta Ads" endpoint="/api/sync/facebook" />
                </div>
              </div>
            </div>

            <div style={{ background: "white", border: "0.5px solid #E5E7EB", borderRadius: 12, padding: "20px 24px" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Histórico de Sincronização</h2>
                <span className="text-[10px] text-gray-400">Últimas 15 execuções</span>
              </div>
              {!syncStatus ? (
                <p className="text-xs text-gray-400 py-2">Carregando...</p>
              ) : syncStatus.history.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Nenhum registro encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pb-2 text-gray-400 font-medium pr-4 w-20">Fonte</th>
                        <th className="text-left py-2 pb-2 text-gray-400 font-medium pr-4 w-20">Status</th>
                        <th className="text-left py-2 pb-2 text-gray-400 font-medium pr-4">Mensagem</th>
                        <th className="text-right py-2 pb-2 text-gray-400 font-medium w-36">Data/Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncStatus.history.map((h) => (
                        <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-1.5 pr-4 text-gray-600 capitalize">{h.source}</td>
                          <td className="py-1.5 pr-4">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              h.status === "success"
                                ? "bg-green-100 text-green-700"
                                : h.status === "error"
                                ? "bg-red-100 text-red-600"
                                : "bg-gray-100 text-gray-500"
                            }`}>{h.status}</span>
                          </td>
                          <td className="py-1.5 pr-4 text-gray-500 max-w-xs truncate" title={h.message}>{h.message}</td>
                          <td className="py-1.5 text-right text-gray-400 whitespace-nowrap">{fmtDateTimeBR(h.syncedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "equipe" && (
          <div className="space-y-6">
            <div style={{ background: "white", border: "0.5px solid #E5E7EB", borderRadius: 12, padding: "20px 24px" }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-gray-800">{editingId ? "Editar Funcionário" : "Adicionar Membro"}</h2>
                {editingId && <button onClick={handleCancelEdit} className="text-xs text-blue-600 font-bold hover:underline">Cancelar Edição</button>}
              </div>

              <form onSubmit={handleAddUser} className="space-y-8">
                {/* IDENTIFICAÇÃO */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-gray-400">NOME COMPLETO</label>
                    <input type="text" value={newUser.nome} onChange={e=>setNewUser({...newUser, nome: e.target.value})} className="border border-gray-200 rounded-lg p-2 text-sm" placeholder="Ex: Célia Mendes" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-gray-400">E-MAIL</label>
                    <input type="email" value={newUser.email} onChange={e=>setNewUser({...newUser, email: e.target.value})} className="border border-gray-200 rounded-lg p-2 text-sm" placeholder="celia@example.com" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-gray-400">SENHA DE ACESSO</label>
                    <input type="text" value={(newUser as any).password || "mudar123"} onChange={e=>setNewUser({...newUser, password: e.target.value} as any)} className="border border-gray-200 rounded-lg p-2 text-sm" placeholder="Senha" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-gray-400">FUNÇÃO</label>
                    <select value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value})} className="border border-gray-200 rounded-lg p-2 text-sm">
                      <option value="CLOSER">Closer (Vendedor)</option>
                      <option value="SDR">SDR (Pré-venda)</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </div>
                </div>

                {/* FINANCEIRO BASE */}
                <div className="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-gray-400">SALÁRIO FIXO MENSAL (R$)</label>
                    <input type="number" value={newUser.fixo} onChange={e=>setNewUser({...newUser, fixo: Number(e.target.value)})} className="border border-gray-200 rounded-lg p-2 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-gray-400">Nº PARCELAS COMISSÃO</label>
                    <select value={newUser.installments} onChange={e=>setNewUser({...newUser, installments: Number(e.target.value)})} className="border border-gray-200 rounded-lg p-2 text-sm">
                      <option value={1}>À vista</option>
                      <option value={6}>6 vezes</option>
                      <option value={12}>12 vezes</option>
                      <option value={24}>24 vezes</option>
                    </select>
                  </div>
                </div>

                {/* COMISSIONAMENTO POR FAIXAS */}
                <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-[11px] font-bold text-gray-800 mb-4 uppercase tracking-widest">Comissionamento por Faixas (Closer)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {/* BRONZE */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                        <span className="text-xs font-bold text-gray-600">BRONZE (Base)</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400 font-bold uppercase">TAXA (%)</label>
                        <input type="number" step="0.01" value={newUser.bronzeRate} onChange={e=>setNewUser({...newUser, bronzeRate: Number(e.target.value)})} className="border border-gray-200 rounded-lg p-2 text-sm bg-white" />
                      </div>
                    </div>
                    {/* SILVER */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                        <span className="text-xs font-bold text-gray-600">PRATA</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 font-bold uppercase"> TAXA (%)</label>
                          <input type="number" step="0.01" value={newUser.silverRate} onChange={e=>setNewUser({...newUser, silverRate: Number(e.target.value)})} className="border border-gray-200 rounded-lg p-2 text-sm bg-white" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 font-bold uppercase"> MÍNIMO (R$)</label>
                          <input type="number" value={newUser.silverMin} onChange={e=>setNewUser({...newUser, silverMin: Number(e.target.value)})} className="border border-gray-200 rounded-lg p-2 text-sm bg-white" />
                        </div>
                      </div>
                    </div>
                    {/* GOLD */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        <span className="text-xs font-bold text-gray-600">OURO</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 font-bold uppercase"> TAXA (%)</label>
                          <input type="number" step="0.01" value={newUser.goldRate} onChange={e=>setNewUser({...newUser, goldRate: Number(e.target.value)})} className="border border-gray-200 rounded-lg p-2 text-sm bg-white" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 font-bold uppercase"> MÍNIMO (R$)</label>
                          <input type="number" value={newUser.goldMin} onChange={e=>setNewUser({...newUser, goldMin: Number(e.target.value)})} className="border border-gray-200 rounded-lg p-2 text-sm bg-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PERMISSÕES E ACESSOS */}
                <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-[11px] font-bold text-gray-800 mb-4 uppercase tracking-widest">Acessos e Permissões por Aba</h3>
                  <div className="space-y-2">
                    {[
                      { id: "VISAO_EXECUTIVA", label: "Visão Executiva (Dashboard Central)" },
                      { id: "FINANCEIRO_DASH", label: "Dashboard Financeiro" },
                      { id: "FINANCEIRO_GASTOS", label: "Gastos" },
                      { id: "VENDAS", label: "Vendas (Lista)" },
                      { id: "PERF_SDR", label: "Performance SDR" },
                      { id: "PERF_CLOSER", label: "Performance Closer" },
                      { id: "GESTAO_VENDAS", label: "Gestão de Vendas (Admin)" },
                      { id: "TENTATIVAS", label: "Tentativas Contato" },
                      { id: "VALIDACAO_VENDA", label: "Validação de Venda" },
                      { id: "CONFIGURACAO", label: "Configurações" },
                    ].map(perm => (
                      <div key={perm.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={newUser.permissions[perm.id as keyof typeof newUser.permissions]?.enabled}
                            onChange={() => togglePermission(perm.id)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" 
                          />
                          <span className="text-sm font-medium text-gray-700">{perm.label}</span>
                        </div>
                        {newUser.permissions[perm.id as keyof typeof newUser.permissions]?.enabled && (
                          <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
                            <button 
                              type="button"
                              onClick={() => setScope(perm.id, "own")}
                              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${newUser.permissions[perm.id as keyof typeof newUser.permissions]?.scope === "own" ? "bg-blue-600 text-white" : "text-gray-400"}`}
                            >
                              SÓ O DELE
                            </button>
                            <button 
                              type="button"
                              onClick={() => setScope(perm.id, "all")}
                              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${newUser.permissions[perm.id as keyof typeof newUser.permissions]?.scope === "all" ? "bg-blue-600 text-white" : "text-gray-400"}`}
                            >
                              GERAL
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full bg-[#1d1d1f] text-white py-3 rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg active:scale-[0.99]">
                    {editingId ? "Salvar Alterações" : "Cadastrar Usuário na Equipe"}
                  </button>
                </div>
              </form>
            </div>

            <div style={{ background: "white", border: "0.5px solid #E5E7EB", borderRadius: 12, padding: "20px 24px" }}>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Equipe Atual</h2>
              {vendedoresLoading ? <p className="text-sm text-gray-400 text-center animate-pulse py-8">Sincronizando equipe...</p> : (
                <div className="space-y-3">
                  {vendedores.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group transition-all hover:bg-white hover:shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-gray-500 text-sm">
                          {v.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{v.nome}</p>
                          <p className="text-[11px] text-gray-400 font-medium">
                            {v.role} · {v.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Comissão</p>
                          <p className="text-xs font-bold text-gray-700">{v.bronzeRate}% - {v.goldRate}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Fixo</p>
                          <p className="text-xs font-bold text-gray-700">R$ {v.fixoMensal.toLocaleString("pt-BR")}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEditUser(v)} className="p-2 text-gray-300 hover:text-blue-600 transition-colors">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => handleDeleteUser(v.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {vendedores.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Nenhum membro cadastrado.</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "comissao" && (
          <div className="space-y-6">
            <div style={{ background: "white", border: "0.5px solid #E5E7EB", borderRadius: 12, padding: "20px 24px" }}>
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Padrões do Sistema (Auto-preenchimento)</h2>
              <p className="text-xs text-gray-400 mb-6">Estes valores serão sugeridos ao cadastrar novos funcionários.</p>
              
              <form onSubmit={handleUpdateCommission} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Salário Fixo Padrão (R$)</label>
                    <input 
                      type="number" 
                      value={comissaoConfig.fixedSalary} 
                      onChange={e=>setComissaoConfig({...comissaoConfig, fixedSalary: Number(e.target.value)})}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-100 transition-all outline-none" 
                    />
                    <p className="text-[10px] text-gray-400 italic">Média paga à equipe como base fixa.</p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Porcentagem de Comissão (%)</label>
                    <input 
                      type="number" step="0.01" 
                      value={comissaoConfig.percentage} 
                      onChange={e=>setComissaoConfig({...comissaoConfig, percentage: Number(e.target.value)})}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-100 transition-all outline-none" 
                    />
                    <p className="text-[10px] text-gray-400 italic">Taxa de comissão aplicada sobre o valor bruto da venda.</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nº de Parcelas de Pagamento</label>
                    <select 
                      value={comissaoConfig.installments} 
                      onChange={e=>setComissaoConfig({...comissaoConfig, installments: Number(e.target.value)})}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-100 transition-all outline-none bg-white"
                    >
                      <option value={1}>À vista</option>
                      <option value={6}>6 vezes</option>
                      <option value={12}>12 vezes</option>
                      <option value={24}>24 vezes</option>
                    </select>
                    <p className="text-[10px] text-gray-400 italic">Em quantas vezes a comissão é dividida para o Closer.</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button type="submit" disabled={comissaoLoading} className="px-8 py-3 bg-[#1d1d1f] text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-md active:scale-[0.98]">
                    {comissaoLoading ? "Salvando..." : "Salvar Configurações"}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
              <h3 className="text-amber-800 text-sm font-bold mb-2 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Importante
              </h3>
              <p className="text-amber-700 text-xs leading-relaxed">
                As alterações nestas regras afetarão apenas a **PROJEÇÃO** do Dashboard e os cálculos matemáticos da tela de Gestão de Vendas. Vendas e parcelas já criadas individualmente com valores específicos não serão alteradas retroativamente no banco de dados.
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

