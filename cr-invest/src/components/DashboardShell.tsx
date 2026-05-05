"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

type SyncProgress = {
  running: boolean;
  phase: string;
  processed: number;
  total: number;
  source: string;
};

function useSyncStatus() {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/sync/status");
        const json = await res.json();
        if (json.progress) setProgress(json.progress as SyncProgress);
        else setProgress(null);
      } catch {
        setProgress(null);
      }
    };

    poll();
    // Poll a cada 3s — custo mínimo (só 1 DB query leve), persiste em qualquer aba
    timerRef.current = setInterval(poll, 3000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return progress;
}

const NAV_ITEMS = [
  {
    label: "Visão Executiva",
    permissionKey: "VISAO_EXECUTIVA",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    href: "/dashboard",
  },
  { type: "divider" as const, label: "FINANCEIRO" },
  {
    label: "Dashboard Financeiro",
    permissionKey: "FINANCEIRO_DASH",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    href: "/dashboard/financeiro",
  },
  {
    label: "Gastos",
    permissionKey: "FINANCEIRO_GASTOS",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
    ),
    href: "/dashboard/gastos",
  },
  {
    label: "Vendas",
    permissionKey: "VENDAS",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
    href: "/dashboard/vendas",
  },
  { type: "divider" as const, label: "COMERCIAL" },
  {
    label: "Performance SDR",
    permissionKey: "PERF_SDR",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.57 3.27 2 2 0 0 1 3.56 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.55 6.55l.9-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
    href: "/dashboard/performance-sdr",
  },
  {
    label: "Performance Closer",
    permissionKey: "PERF_CLOSER",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    href: "/dashboard/performance-closer",
  },
  {
    label: "Gestão de Vendas",
    permissionKey: "GESTAO_VENDAS",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
    href: "/dashboard/gestao-vendas",
  },
  {
    label: "Tentativas Contato",
    permissionKey: "TENTATIVAS",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.57 3.27 2 2 0 0 1 3.56 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.55 6.55l.9-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    ),
    href: "/dashboard/tentativas",
  },
  {
    label: "Configurações",
    permissionKey: "CONFIGURACAO",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    href: "/dashboard/usuarios",
  },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const sidebarWidth = collapsed ? 64 : 240;
  const syncStatus = useSyncStatus();

  const visibleItems = NAV_ITEMS.filter(item => {
    if ((item as any).type === "divider") return true;

    if ((session?.user as any)?.role === "admin") return true;

    if ((item as any).adminOnly) return false;

    const permsRaw = (session?.user as any)?.permissions;
    if (!permsRaw) return false;

    try {
      const perms = typeof permsRaw === "string" ? JSON.parse(permsRaw) : permsRaw;
      const permKey = (item as any).permissionKey as string;

      const config = perms[permKey];
      if (config?.enabled === true) return true;

      const legacyDashboard = perms["DASHBOARD"];
      if (legacyDashboard?.enabled === true && ["VISAO_EXECUTIVA", "PERF_SDR", "PERF_CLOSER"].includes(permKey)) {
        return true;
      }

      return false;
    } catch(e) {
      return false;
    }
  });

  const filteredNavItems = visibleItems.filter((item, index, array) => {
    if ((item as any).type === "divider") {
      // A divider is only kept if there is at least one non-divider item following it,
      // before the end of the array or the next divider.
      for (let i = index + 1; i < array.length; i++) {
        if ((array[i] as any).type !== "divider") return true;
        if ((array[i] as any).type === "divider") return false;
      }
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <aside
        className="fixed top-0 left-0 h-full flex flex-col z-40 transition-all duration-300"
        style={{
          width: sidebarWidth,
          background: "#000000",
          borderRight: "1px solid #1a1a1a",
        }}
      >
        <div
          className="flex items-center justify-between px-4 shrink-0"
          style={{
            height: 64,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: "#000000",
            backdropFilter: "none",
          }}
        >
          {!collapsed && (
            <div className="flex items-center gap-3 min-w-0 py-1">
              <Image
                src="/logo2.png"
                alt="CR Invest"
                width={42}
                height={42}
                className="object-contain shrink-0"
                priority
              />
              <span
                className="font-bold tracking-tight truncate"
                style={{ fontSize: 16, color: "#ffffff", marginTop: 2 }}
              >
                CR INVEST
              </span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="shrink-0 rounded-lg p-1.5 transition-colors ml-auto"
            style={{ color: "#a1a1aa" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#27272a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            aria-label="Toggle sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? (
                <polyline points="9 18 15 12 9 6"/>
              ) : (
                <polyline points="15 18 9 12 15 6"/>
              )}
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
          {filteredNavItems.map((item, idx) => {
            if ((item as any).type === "divider") {
              if (collapsed) return null;
              return (
                <div key={`div-${idx}`} className="pt-4 pb-1 px-1">
                  <p style={{ fontSize: 9, letterSpacing: "0.1em", color: "#4a4a4a", fontWeight: 600, textTransform: "uppercase" }}>
                    {item.label}
                  </p>
                </div>
              );
            }
            const href = (item as any).href as string;
            const isActive =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? item.label : undefined}
                className="flex items-center gap-3 rounded-2xl transition-all duration-200 relative overflow-hidden focus:outline-none"
                style={{
                  padding: collapsed ? "10px 12px" : "10px 14px",
                  background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                  color: isActive ? "#ffffff" : "#a1a1aa",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-2 bottom-2 rounded-r-full"
                    style={{
                      width: 3,
                      background: "linear-gradient(to bottom, #D4AF37, #e8c96b)",
                    }}
                  />
                )}
                <span
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    color: isActive ? "var(--cr-gold)" : "#a1a1aa",
                    width: 20,
                  }}
                >
                  {(item as any).icon}
                </span>
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div
        className="flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        {syncStatus?.running && (
          <div className="sticky top-0 z-30 flex items-center gap-3 px-5 py-2 text-xs font-medium text-white"
            style={{ background: "#1a1a2e", borderBottom: "1px solid #2d2d4e" }}>
            <span className="inline-flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            <span className="text-amber-300 font-semibold">Sincronizando{syncStatus.source ? ` ${syncStatus.source}` : ""}...</span>
            <span className="text-gray-400 truncate max-w-md">{syncStatus.phase}</span>
            {syncStatus.total > 0 && (
              <span className="ml-auto shrink-0 text-gray-400">
                {syncStatus.processed}/{syncStatus.total}
              </span>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
