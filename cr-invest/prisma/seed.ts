/**
 * Seed / Migração do sistema legado → Supabase
 *
 * Lê os arquivos JSON do backend antigo e popula o banco via Prisma.
 *
 * Como executar:
 *   1. npm install -D tsx          (ou ts-node)
 *   2. npx prisma db push          (aplicar o schema atualizado)
 *   3. npx tsx prisma/seed.ts      (rodar este script)
 *
 * É idempotente: usa upsert, pode ser re-executado sem duplicar dados.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// ─── Caminhos para os arquivos legados ────────────────────────────────────────

const LEGACY_DB_PATH = path.join(__dirname, "../../backend/src/database.json");
const CACHE_3C_PATH = path.join(
  __dirname,
  "../../backend/src/database_3c_cache.json"
);

// ─── Tipos do sistema legado ───────────────────────────────────────────────────

interface LegacyUser {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
  role: "ADMIN" | "CLOSER" | "SDR";
  fixo_mensal: number;
  created_at: string;
}

interface LegacyVenda {
  id: string;
  lead_id: string | null;
  data_fechamento: string;
  cliente_nome: string;
  cliente_cpf?: string;
  closer_id: string;
  sdr_id: string | null;
  valor_venda: number;
  administradora: string;
  tier_closer: string;
  percentual_closer: number;
  valor_comissao_total_closer: number;
  percentual_sdr: number;
  valor_comissao_total_sdr: number;
  created_at: string;
}

interface LegacyParcela {
  id: string;
  venda_id: string;
  parcela_numero: number;
  data_vencimento: string;
  valor_parcela: number;
  pago: 0 | 1;
  created_at: string;
}

interface LegacyDB {
  Usuarios: LegacyUser[];
  Vendas: LegacyVenda[];
  PagamentosClientes: LegacyParcela[];
}

interface ThreeCCall {
  id: string;
  call_date: string;
  has_agent: boolean;
  agent: string;
  agent_id: number;
  speaking_time: string; // "HH:MM:SS"
  campaign: string;
}

type ThreeCCache = Record<string, ThreeCCall[]>;

// ─── Utils ────────────────────────────────────────────────────────────────────

function parseSpeakingTime(t: string): number {
  const parts = t.split(":").map(Number);
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

// ─── Seed principal ───────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Iniciando migração do sistema legado...\n");

  // ── 1. Carregar JSONs ──────────────────────────────────────────────────────

  if (!fs.existsSync(LEGACY_DB_PATH)) {
    throw new Error(`Arquivo não encontrado: ${LEGACY_DB_PATH}`);
  }
  if (!fs.existsSync(CACHE_3C_PATH)) {
    throw new Error(`Arquivo não encontrado: ${CACHE_3C_PATH}`);
  }

  const legacyDB: LegacyDB = JSON.parse(
    fs.readFileSync(LEGACY_DB_PATH, "utf-8")
  );
  const threeCCache: ThreeCCache = JSON.parse(
    fs.readFileSync(CACHE_3C_PATH, "utf-8")
  );

  console.log(`📄 Usuários: ${legacyDB.Usuarios.length}`);
  console.log(`📄 Vendas: ${legacyDB.Vendas.length}`);
  console.log(`📄 Parcelas: ${legacyDB.PagamentosClientes.length}`);
  const totalCalls = Object.values(threeCCache).flat().length;
  console.log(`📄 Chamadas 3C (total): ${totalCalls}\n`);

  // ── 2. Vendedores ──────────────────────────────────────────────────────────

  console.log("👥 Migrando Vendedores...");
  for (const u of legacyDB.Usuarios) {
    await prisma.vendedor.upsert({
      where: { id: u.id },
      update: {
        nome: u.nome,
        email: u.email,
        role: u.role,
        fixoMensal: u.fixo_mensal,
      },
      create: {
        id: u.id,
        nome: u.nome,
        email: u.email,
        role: u.role,
        fixoMensal: u.fixo_mensal,
        createdAt: new Date(u.created_at),
      },
    });
  }
  console.log(`   ✓ ${legacyDB.Usuarios.length} vendedores\n`);

  // ── 3. Vendas + Mapa de IDs de usuário ────────────────────────────────────

  console.log("💰 Migrando Vendas...");

  // Monta lookup: id → nome
  const userMap: Record<string, string> = {};
  for (const u of legacyDB.Usuarios) {
    userMap[u.id] = u.nome;
  }

  for (const v of legacyDB.Vendas) {
    const closerName = userMap[v.closer_id] ?? v.closer_id;
    const sdrName = v.sdr_id ? (userMap[v.sdr_id] ?? v.sdr_id) : null;

    await prisma.sale.upsert({
      where: { id: v.id },
      update: {
        value: v.valor_venda,
        closedAt: new Date(v.data_fechamento),
        clientName: v.cliente_nome,
        assignedTo: closerName,
        sdrName,
        administradora: v.administradora,
        tierCloser: v.tier_closer,
        percentualCloser: v.percentual_closer,
        valorComissaoCloser: v.valor_comissao_total_closer,
        percentualSdr: v.percentual_sdr,
        valorComissaoSdr: v.valor_comissao_total_sdr,
        clienteCpf: v.cliente_cpf ?? null,
        leadId: v.lead_id,
      },
      create: {
        id: v.id,
        value: v.valor_venda,
        closedAt: new Date(v.data_fechamento),
        clientName: v.cliente_nome,
        assignedTo: closerName,
        sdrName,
        administradora: v.administradora,
        tierCloser: v.tier_closer,
        percentualCloser: v.percentual_closer,
        valorComissaoCloser: v.valor_comissao_total_closer,
        percentualSdr: v.percentual_sdr,
        valorComissaoSdr: v.valor_comissao_total_sdr,
        clienteCpf: v.cliente_cpf ?? null,
        leadId: v.lead_id,
        createdAt: new Date(v.created_at),
      },
    });
  }
  console.log(`   ✓ ${legacyDB.Vendas.length} vendas\n`);

  // ── 4. Parcelas (Installments) ────────────────────────────────────────────

  console.log("📅 Migrando Parcelas...");
  let parcelaCount = 0;

  for (const p of legacyDB.PagamentosClientes) {
    await prisma.installment.upsert({
      where: {
        saleId_parcelaNumero: {
          saleId: p.venda_id,
          parcelaNumero: p.parcela_numero,
        },
      },
      update: {
        dataVencimento: new Date(p.data_vencimento),
        valorParcela: p.valor_parcela,
        pago: p.pago === 1,
      },
      create: {
        id: p.id,
        saleId: p.venda_id,
        parcelaNumero: p.parcela_numero,
        dataVencimento: new Date(p.data_vencimento),
        valorParcela: p.valor_parcela,
        pago: p.pago === 1,
        createdAt: new Date(p.created_at),
      },
    });
    parcelaCount++;
  }
  console.log(`   ✓ ${parcelaCount} parcelas\n`);

  // ── 5. DialerMetrics do 3C Plus ───────────────────────────────────────────

  console.log("📞 Migrando DialerMetrics (3C Plus)...");

  // Agrupa por data + agente
  type DayAgentKey = string;
  const aggregated: Record<
    DayAgentKey,
    { agentId: string; agentName: string; calls: number; talkSecs: number; date: string }
  > = {};

  for (const [dateKey, calls] of Object.entries(threeCCache)) {
    for (const call of calls) {
      if (!call.has_agent || call.agent === "-" || !call.agent) continue;

      const key = `${dateKey}::${call.agent}`;
      if (!aggregated[key]) {
        aggregated[key] = {
          agentId: String(call.agent_id || call.agent.replace(/\s/g, "_").toLowerCase()),
          agentName: call.agent,
          calls: 0,
          talkSecs: 0,
          date: dateKey,
        };
      }
      aggregated[key].calls += 1;
      aggregated[key].talkSecs += parseSpeakingTime(call.speaking_time);
    }
  }

  let dialerCount = 0;
  for (const entry of Object.values(aggregated)) {
    const date = new Date(`${entry.date}T00:00:00-03:00`);
    await prisma.dialerMetrics.upsert({
      where: {
        date_source_agentId: {
          date,
          source: "threec",
          agentId: entry.agentId,
        },
      },
      update: {
        totalCalls: entry.calls,
        talkTimeSecs: entry.talkSecs,
      },
      create: {
        date,
        source: "threec",
        agentId: entry.agentId,
        agentName: entry.agentName,
        totalCalls: entry.calls,
        talkTimeSecs: entry.talkSecs,
      },
    });
    dialerCount++;
  }
  console.log(`   ✓ ${dialerCount} entradas de DialerMetrics (${Object.keys(aggregated).length} combinações data×agente)\n`);

  // ── 6. Meta do ciclo atual ────────────────────────────────────────────────

  console.log("🎯 Inserindo Meta de Março 2026...");
  await prisma.goal.upsert({
    where: { id: "goal-mar-2026" },
    update: { target: 5000000 },
    create: {
      id: "goal-mar-2026",
      cycleName: "Março 2026",
      startDate: new Date("2026-03-01T00:00:00-03:00"),
      endDate: new Date("2026-03-31T23:59:59-03:00"),
      target: 5000000,
    },
  });
  console.log("   ✓ Meta inserida\n");

  // ── Resumo ────────────────────────────────────────────────────────────────

  console.log("✅ Migração concluída!");
  console.log(`   Vendedores : ${legacyDB.Usuarios.length}`);
  console.log(`   Vendas     : ${legacyDB.Vendas.length}`);
  console.log(`   Parcelas   : ${parcelaCount}`);
  console.log(`   Discador   : ${dialerCount} registros diários`);
}

main()
  .catch((e) => {
    console.error("❌ Erro na migração:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
