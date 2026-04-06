/**
 * Mock data para CR Invest — Sistema de Performance
 * USE_MOCK_DATA=true usa estes dados em vez das APIs reais.
 *
 * Os dados de vendas e usuários refletem o sistema legado (database.json).
 * Os dados de leads e anúncios são determinísticos mas fictícios.
 */

export const USE_MOCK = process.env.USE_MOCK_DATA === "true";

// ─── Deterministic helpers ────────────────────────────────────────────────────

function seededNum(seed: number, min: number, max: number): number {
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;
  const val = ((a * seed + c) % m) / m;
  return Math.floor(val * (max - min + 1)) + min;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function subDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

const NOW = new Date("2026-03-27T12:00:00-03:00");

// ─── Equipe real (do sistema legado) ─────────────────────────────────────────

export const REAL_TEAM = [
  { id: "913419f3-eeeb-4676-b8cd-41f73a70ef4d", name: "Eunice Dias",  role: "CLOSER", fixoMensal: 3000 },
  { id: "482b4379-85cc-42df-8df6-eb645d76f23d", name: "Célia",        role: "CLOSER", fixoMensal: 3000 },
  { id: "c5733cf7-b8f1-41a0-9ad4-d97ab7c04401", name: "Cauê",         role: "SDR",    fixoMensal: 3000 },
];

// Para leads e outras simulações, combinamos equipe real + fictícia
const AGENTS = [
  ...REAL_TEAM.map((m) => ({ id: m.id, name: m.name })),
  { id: "agent-004", name: "Juliana Souza" },
  { id: "agent-005", name: "Bruno Almeida" },
];

const CAMPAIGNS = [
  { id: "camp-kommo-eunice", name: "Kommo - Eunice Leads" },
  { id: "camp-meta-fundo",   name: "Meta - Fundo de Investimento" },
  { id: "camp-meta-renda",   name: "Meta - Renda Fixa" },
];

const STATUS_DIST: Array<{ status: string; weight: number }> = [
  { status: "new",       weight: 15 },
  { status: "contacted", weight: 30 },
  { status: "qualified", weight: 20 },
  { status: "scheduled", weight: 15 },
  { status: "meeting",   weight: 10 },
  { status: "won",       weight:  7 },
  { status: "lost",      weight:  3 },
];

function pickStatus(index: number): string {
  const total = STATUS_DIST.reduce((s, d) => s + d.weight, 0);
  const roll = seededNum(index * 7 + 1, 1, total);
  let acc = 0;
  for (const d of STATUS_DIST) {
    acc += d.weight;
    if (roll <= acc) return d.status;
  }
  return "new";
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export interface MockLead {
  id: string;
  source: string;
  campaignId: string;
  campaignName: string;
  createdAt: Date;
  contactedAt: Date | null;
  qualifiedAt: Date | null;
  scheduledAt: Date | null;
  meetingAt: Date | null;
  closedAt: Date | null;
  status: string;
  lostReason: string | null;
  dealValue: number | null;
  assignedTo: string;
  interactionCount: number;
  syncedAt: Date;
}

export function getMockLeads(): MockLead[] {
  const leads: MockLead[] = [];

  for (let i = 0; i < 120; i++) {
    const campIdx = seededNum(i * 3, 0, 2);
    const campaign = CAMPAIGNS[campIdx];
    const agentIdx = seededNum(i * 5 + 2, 0, AGENTS.length - 1);
    const agent = AGENTS[agentIdx];
    const status = pickStatus(i);
    const daysAgo = seededNum(i * 11, 1, 90);
    const createdAt = subDays(NOW, daysAgo);

    let contactedAt: Date | null = null;
    let qualifiedAt: Date | null = null;
    let scheduledAt: Date | null = null;
    let meetingAt: Date | null = null;
    let closedAt: Date | null = null;
    let lostReason: string | null = null;
    let dealValue: number | null = null;

    if (["contacted", "qualified", "scheduled", "meeting", "won", "lost"].includes(status)) {
      contactedAt = addDays(createdAt, seededNum(i * 13, 1, 3));
    }
    if (["qualified", "scheduled", "meeting", "won", "lost"].includes(status)) {
      qualifiedAt = addDays(contactedAt!, seededNum(i * 17, 1, 5));
    }
    if (["scheduled", "meeting", "won", "lost"].includes(status)) {
      scheduledAt = addDays(qualifiedAt!, seededNum(i * 19, 1, 7));
    }
    if (["meeting", "won", "lost"].includes(status)) {
      meetingAt = addDays(scheduledAt!, seededNum(i * 23, 1, 3));
    }
    if (status === "won") {
      closedAt = addDays(meetingAt!, seededNum(i * 29, 1, 5));
      dealValue = seededNum(i * 31, 5, 200) * 1000;
    }
    if (status === "lost") {
      closedAt = addDays(meetingAt!, seededNum(i * 37, 1, 5));
      const reasons = ["Sem budget", "Concorrência", "Não tinha interesse", "Não retornou contato"];
      lostReason = reasons[seededNum(i * 41, 0, 3)];
    }

    leads.push({
      id: `lead-${String(i + 1).padStart(3, "0")}`,
      source: "kommo",
      campaignId: campaign.id,
      campaignName: campaign.name,
      createdAt,
      contactedAt,
      qualifiedAt,
      scheduledAt,
      meetingAt,
      closedAt,
      status,
      lostReason,
      dealValue,
      assignedTo: agent.name,
      interactionCount: seededNum(i * 43, 1, 12),
      syncedAt: NOW,
    });
  }

  return leads;
}

// ─── Vendas (dados reais do sistema legado) ───────────────────────────────────

export interface MockSale {
  id: string;
  leadId: string | null;
  value: number;
  closedAt: Date;
  clientName: string;
  assignedTo: string;   // Closer
  sdrName: string | null;
  campaignId: string | null;
  notes: string | null;
  administradora: string | null;
  tierCloser: string | null;
  percentualCloser: number | null;
  valorComissaoCloser: number | null;
  percentualSdr: number | null;
  valorComissaoSdr: number | null;
  clienteCpf: string | null;
  createdAt: Date;
}

export function getMockSales(): MockSale[] {
  return [
    // ── Dados reais do sistema legado ───────────────────────────────────────
    {
      id: "c3ece79a-fa38-4296-857b-c20b0cde506f",
      leadId: null,
      value: 1000000,
      closedAt: new Date("2026-03-21"),
      clientName: "Daniela Fonseca",
      assignedTo: "Eunice Dias",
      sdrName: null,
      campaignId: null,
      notes: null,
      administradora: "EMBRACON",
      tierCloser: "Prata",
      percentualCloser: 0.006,
      valorComissaoCloser: 6000,
      percentualSdr: 0.0008,
      valorComissaoSdr: 0,
      clienteCpf: null,
      createdAt: new Date("2026-03-23T19:07:14.603Z"),
    },
    {
      id: "83bf6fd1-9101-400f-836b-11a7c53d4404",
      leadId: null,
      value: 450000,
      closedAt: new Date("2026-03-02"),
      clientName: "Gislayde Ribas",
      assignedTo: "Eunice Dias",
      sdrName: null,
      campaignId: null,
      notes: null,
      administradora: "PORTO",
      tierCloser: "Bronze",
      percentualCloser: 0.005,
      valorComissaoCloser: 2250,
      percentualSdr: 0.0007,
      valorComissaoSdr: 0,
      clienteCpf: null,
      createdAt: new Date("2026-03-23T19:07:14.617Z"),
    },
    {
      id: "735e73d6-c814-440b-9ba4-98c365f7d4c3",
      leadId: null,
      value: 740000,
      closedAt: new Date("2026-03-20"),
      clientName: "Isabella Muniz",
      assignedTo: "Eunice Dias",
      sdrName: null,
      campaignId: null,
      notes: null,
      administradora: "PORTO",
      tierCloser: "Bronze",
      percentualCloser: 0.005,
      valorComissaoCloser: 3700,
      percentualSdr: 0.0007,
      valorComissaoSdr: 0,
      clienteCpf: null,
      createdAt: new Date("2026-03-23T19:07:14.632Z"),
    },
    {
      id: "420b44dd-cd48-4da1-9d07-023889ac7368",
      leadId: null,
      value: 600000,
      closedAt: new Date("2026-03-20"),
      clientName: "Rafaela Cristhina Tonello Pedro Deloro",
      assignedTo: "Célia",
      sdrName: "Cauê",
      campaignId: null,
      notes: "Promoção aplicada",
      administradora: "Porto Seguro",
      tierCloser: "Bronze",
      percentualCloser: 0.005,
      valorComissaoCloser: 3000,
      percentualSdr: 0.0007,
      valorComissaoSdr: 420,
      clienteCpf: "009.667.589-60",
      createdAt: new Date("2026-03-24T14:49:13.199Z"),
    },
    {
      id: "93b950bf-a762-437e-a2ef-fcd1f15413d6",
      leadId: null,
      value: 113122.25,
      closedAt: new Date("2026-03-24"),
      clientName: "Alessandra Bacon de Oliveira Moreira",
      assignedTo: "Célia",
      sdrName: "Cauê",
      campaignId: null,
      notes: "Promoção aplicada",
      administradora: "Porto Seguro",
      tierCloser: "Bronze",
      percentualCloser: 0.005,
      valorComissaoCloser: 565.61,
      percentualSdr: 0.0007,
      valorComissaoSdr: 79.19,
      clienteCpf: "528.193.701-44",
      createdAt: new Date("2026-03-24T19:11:52.465Z"),
    },
    {
      id: "b8a3e107-40e6-42b0-b24d-3797dd1a643c",
      leadId: null,
      value: 300000,
      closedAt: new Date("2026-03-25"),
      clientName: "Silvia Kraus",
      assignedTo: "Célia",
      sdrName: null,
      campaignId: null,
      notes: null,
      administradora: "Porto Seguro",
      tierCloser: "Bronze",
      percentualCloser: 0.005,
      valorComissaoCloser: 1500,
      percentualSdr: 0.0007,
      valorComissaoSdr: 0,
      clienteCpf: "07866789924",
      createdAt: new Date("2026-03-26T12:29:00.130Z"),
    },
  ];
}

// ─── Vendedores ───────────────────────────────────────────────────────────────

export interface MockVendedor {
  id: string;
  nome: string;
  email: string;
  role: string;
  fixoMensal: number;
}

export function getMockVendedores(): MockVendedor[] {
  return [
    {
      id: "913419f3-eeeb-4676-b8cd-41f73a70ef4d",
      nome: "Eunice Dias",
      email: "eunice.dias@crconsorcios.com",
      role: "CLOSER",
      fixoMensal: 3000,
    },
    {
      id: "482b4379-85cc-42df-8df6-eb645d76f23d",
      nome: "Célia",
      email: "celia@crinvest.com",
      role: "CLOSER",
      fixoMensal: 3000,
    },
    {
      id: "c5733cf7-b8f1-41a0-9ad4-d97ab7c04401",
      nome: "Cauê",
      email: "caue@crinvest.com",
      role: "SDR",
      fixoMensal: 3000,
    },
  ];
}

// ─── Parcelas (dados reais — todas futuras em março/2026) ─────────────────────

export interface MockInstallment {
  id: string;
  saleId: string;
  parcelaNumero: number;
  dataVencimento: Date;
  valorParcela: number;
  pago: boolean;
}

export function getMockInstallments(): MockInstallment[] {
  const installments: MockInstallment[] = [];

  // Vendas reais e seus valores de parcela (valor_venda / 12)
  const salesConfig = [
    { saleId: "c3ece79a-fa38-4296-857b-c20b0cde506f", valorParcela: 83333.33 },
    { saleId: "83bf6fd1-9101-400f-836b-11a7c53d4404", valorParcela: 37500.00 },
    { saleId: "735e73d6-c814-440b-9ba4-98c365f7d4c3", valorParcela: 61666.67 },
    { saleId: "420b44dd-cd48-4da1-9d07-023889ac7368", valorParcela: 50000.00 },
    { saleId: "93b950bf-a762-437e-a2ef-fcd1f15413d6", valorParcela: 9426.85  },
    { saleId: "b8a3e107-40e6-42b0-b24d-3797dd1a643c", valorParcela: 25000.00 },
  ];

  let idx = 0;
  for (const s of salesConfig) {
    for (let p = 1; p <= 12; p++) {
      // Vencimento: dia 14 de cada mês, começando em abril/2026
      const dataVencimento = new Date(`2026-${String(3 + p).padStart(2, "0")}-14T00:00:00-03:00`);
      installments.push({
        id: `inst-${String(idx + 1).padStart(3, "0")}`,
        saleId: s.saleId,
        parcelaNumero: p,
        dataVencimento,
        valorParcela: s.valorParcela,
        pago: false, // Todas futuras em março/2026
      });
      idx++;
    }
  }

  return installments;
}

// ─── Ads Metrics ──────────────────────────────────────────────────────────────

export interface MockAdsMetrics {
  id: string;
  date: Date;
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  cpm: number;
  ctr: number;
  cpc: number;
  cpl: number;
  syncedAt: Date;
}

export function getMockAdsMetrics(): MockAdsMetrics[] {
  const metrics: MockAdsMetrics[] = [];
  let idx = 0;

  for (let day = 29; day >= 0; day--) {
    const date = subDays(NOW, day);

    for (let c = 0; c < CAMPAIGNS.length; c++) {
      const campaign = CAMPAIGNS[c];
      const impressions = seededNum(idx * 7 + c, 2000, 8000);
      const ctr = seededNum(idx * 11 + c, 10, 30) / 10;
      const clicks = Math.floor((impressions * ctr) / 100);
      const cpm = seededNum(idx * 13 + c, 30, 50);
      const spend = parseFloat(((impressions * cpm) / 1000).toFixed(2));
      const cpc = clicks > 0 ? parseFloat((spend / clicks).toFixed(2)) : 0;
      const leads = Math.max(1, seededNum(idx * 17 + c, 1, 8));
      const cpl = leads > 0 ? parseFloat((spend / leads).toFixed(2)) : 0;

      metrics.push({
        id: `ads-${String(idx + 1).padStart(4, "0")}`,
        date,
        campaignId: campaign.id,
        campaignName: campaign.name,
        impressions,
        clicks,
        spend,
        leads,
        cpm,
        ctr,
        cpc,
        cpl,
        syncedAt: NOW,
      });

      idx++;
    }
  }

  return metrics;
}

// ─── Dialer Metrics ───────────────────────────────────────────────────────────

export interface MockDialerMetrics {
  id: string;
  date: Date;
  source: string;
  agentId: string;
  agentName: string;
  totalCalls: number;
  talkTimeSecs: number;
  syncedAt: Date;
}

export function getMockDialerMetrics(): MockDialerMetrics[] {
  const metrics: MockDialerMetrics[] = [];
  let idx = 0;

  // Equipe real: Eunice (3C Plus), Cauê (GoTo)
  const dialerAgents = [
    { id: "913419f3-eeeb-4676-b8cd-41f73a70ef4d", name: "Eunice Dias", source: "threec" },
    { id: "c5733cf7-b8f1-41a0-9ad4-d97ab7c04401", name: "Cauê",        source: "goto"   },
    { id: "482b4379-85cc-42df-8df6-eb645d76f23d", name: "Célia",       source: "threec" },
  ];

  for (let day = 29; day >= 0; day--) {
    const date = subDays(NOW, day);

    for (const agent of dialerAgents) {
      const totalCalls = seededNum(idx * 7 + 1, 15, 60);
      const avgSecs = seededNum(idx * 11 + 2, 45, 240);
      const talkTimeSecs = totalCalls * avgSecs;

      metrics.push({
        id: `dial-${String(idx + 1).padStart(4, "0")}`,
        date,
        source: agent.source,
        agentId: agent.id,
        agentName: agent.name,
        totalCalls,
        talkTimeSecs,
        syncedAt: NOW,
      });

      idx++;
    }
  }

  return metrics;
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export interface MockGoal {
  id: string;
  cycleName: string;
  startDate: Date;
  endDate: Date;
  target: number;
  createdAt: Date;
}

export function getMockGoals(): MockGoal[] {
  return [
    {
      id: "goal-mar-2026",
      cycleName: "Março 2026",
      startDate: new Date("2026-03-01T00:00:00-03:00"),
      endDate: new Date("2026-03-31T23:59:59-03:00"),
      target: 5000000, // Meta real do ciclo
      createdAt: new Date("2026-02-28T10:00:00-03:00"),
    },
    {
      id: "goal-abr-2026",
      cycleName: "Abril 2026",
      startDate: new Date("2026-04-01T00:00:00-03:00"),
      endDate: new Date("2026-04-30T23:59:59-03:00"),
      target: 6000000,
      createdAt: new Date("2026-03-25T10:00:00-03:00"),
    },
  ];
}
