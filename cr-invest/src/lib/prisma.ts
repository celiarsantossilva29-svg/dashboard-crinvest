import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Supabase pgbouncer usa transaction pooling — limitar conexões evita pool exhaustion
// durante syncs longos rodando em paralelo com requests do dashboard.
function buildDatasourceUrl() {
  const base = process.env.DATABASE_URL ?? "";
  if (!base) return base;
  const sep = base.includes("?") ? "&" : "?";
  let url = base;
  if (!url.includes("connection_limit=")) url += `${sep}connection_limit=5`;
  if (!url.includes("pool_timeout="))    url += "&pool_timeout=30";
  return url;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: { db: { url: buildDatasourceUrl() } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
