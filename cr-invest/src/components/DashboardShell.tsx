"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const NAV_ITEMS = [
  {
    label: "Visão Executiva",
    permissionKey: "DASHBOARD",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    href: "/dashboard",
  },
  {
    label: "Performance SDR",
    permissionKey: "DASHBOARD",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.57 3.27 2 2 0 0 1 3.56 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6.55 6.55l.9-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
    href: "/dashboard/performance-sdr",
  },
  {
    label: "Performance Closer",
    permissionKey: "DASHBOARD",
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
    label: "Validação Venda",
    permissionKey: "VALIDACAO_VENDA",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 14l2 2 4-4"/>
      </svg>
    ),
    href: "/dashboard/validacao-vendas",
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

  const filteredNavItems = NAV_ITEMS.filter(item => {
    if ((session?.user as any)?.role === "admin") return true;

    const permsRaw = (session?.user as any)?.permissions;
    if (!permsRaw) return false;

    try {
      const perms = typeof permsRaw === "string" ? JSON.parse(permsRaw) : permsRaw;
      const config = perms[item.permissionKey];
      return config?.enabled === true;
    } catch(e) {
      return false;
    }
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <aside
        className="fixed top-0 left-0 h-full flex flex-col z-40 transition-all duration-300"
        style={{
          width: sidebarWidth,
          background: "var(--cr-sidebar)",
          borderRight: "1px solid var(--cr-sidebar-border)",
        }}
      >
        <div
          className="flex items-center justify-between px-4 shrink-0"
          style={{
            height: 64,
            borderBottom: "1px solid rgba(0,0,0,0.04)",
            background: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(12px)",
          }}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <Image
                src="/logo.jpg"
                alt="CR Invest"
                width={36}
                height={36}
                className="rounded-lg object-cover shrink-0"
                priority
              />
              <span
                className="font-bold tracking-tight truncate"
                style={{ fontSize: 16, color: "var(--cr-text)" }}
              >
                CR INVEST
              </span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="shrink-0 rounded-lg p-1.5 transition-colors ml-auto"
            style={{ color: "var(--cr-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f5")}
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
          {filteredNavItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className="flex items-center gap-3 rounded-2xl transition-all duration-200 relative overflow-hidden focus:outline-none"
                style={{
                  padding: collapsed ? "10px 12px" : "10px 14px",
                  background: isActive ? "#f9f9fb" : "transparent",
                  color: isActive ? "var(--cr-text)" : "var(--cr-muted)",
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
                    color: isActive ? "var(--cr-gold)" : "var(--cr-muted)",
                    width: 20,
                  }}
                >
                  {item.icon}
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
        {children}
      </div>
    </div>
  );
}
