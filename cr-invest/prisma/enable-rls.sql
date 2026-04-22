-- ============================================================================
-- Enable Row-Level Security (RLS) on ALL tables
-- Since the app uses Prisma (direct PostgreSQL connection, not Supabase JS),
-- we enable RLS and add NO public policies — effectively blocking all access
-- via the Supabase REST API (PostgREST / anon key).
-- Prisma connects as the "postgres" role which BYPASSES RLS by default.
-- ============================================================================

-- Vendedor (contains passwords and sensitive user data)
ALTER TABLE "Vendedor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vendedor" FORCE ROW LEVEL SECURITY;

-- Lead
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" FORCE ROW LEVEL SECURITY;

-- Sale
ALTER TABLE "Sale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sale" FORCE ROW LEVEL SECURITY;

-- Installment
ALTER TABLE "Installment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Installment" FORCE ROW LEVEL SECURITY;

-- AdsMetrics
ALTER TABLE "AdsMetrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdsMetrics" FORCE ROW LEVEL SECURITY;

-- DialerMetrics
ALTER TABLE "DialerMetrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DialerMetrics" FORCE ROW LEVEL SECURITY;

-- Goal
ALTER TABLE "Goal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Goal" FORCE ROW LEVEL SECURITY;

-- SyncLog
ALTER TABLE "SyncLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncLog" FORCE ROW LEVEL SECURITY;

-- KommoToken (contains OAuth tokens!)
ALTER TABLE "KommoToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KommoToken" FORCE ROW LEVEL SECURITY;

-- TeamGoal
ALTER TABLE "TeamGoal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamGoal" FORCE ROW LEVEL SECURITY;

-- CloserGoal
ALTER TABLE "CloserGoal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CloserGoal" FORCE ROW LEVEL SECURITY;

-- CloserMonthlySummary
ALTER TABLE "CloserMonthlySummary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CloserMonthlySummary" FORCE ROW LEVEL SECURITY;

-- LeadCallLog
ALTER TABLE "LeadCallLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadCallLog" FORCE ROW LEVEL SECURITY;

-- GoToToken (contains OAuth tokens!)
ALTER TABLE "GoToToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GoToToken" FORCE ROW LEVEL SECURITY;

-- CommissionConfig
ALTER TABLE "CommissionConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommissionConfig" FORCE ROW LEVEL SECURITY;

-- AppSetting
ALTER TABLE "AppSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppSetting" FORCE ROW LEVEL SECURITY;

-- Prisma migrations table (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations') THEN
    EXECUTE 'ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "_prisma_migrations" FORCE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ============================================================================
-- Grant the postgres role (used by Prisma) explicit bypass
-- This is the default for superusers, but let's be explicit
-- ============================================================================
ALTER ROLE postgres BYPASSRLS;
