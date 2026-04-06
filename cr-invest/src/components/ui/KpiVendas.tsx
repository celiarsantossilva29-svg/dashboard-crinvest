"use client";

interface CACData {
  value: number;
  adSpend: number;
  customers: number;
}
interface TicketMedioData {
  value: number;
  total: number;
  count: number;
}
interface TaxaConversaoData {
  value: number;
  won: number;
  total: number;
}
interface CicloVendasData {
  value: number;
  unit: "days";
}

interface KpiVendasProps {
  cac: CACData;
  ticketMedio: TicketMedioData;
  taxaConversao: TaxaConversaoData;
  cicloVendas: CicloVendasData;
  ltv: number;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface CardProps {
  title: string;
  value: string;
  subtitle?: string;
  fonte: string;
}

function KpiCard({ title, value, subtitle, fonte }: CardProps) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 flex flex-col justify-between min-h-[120px]">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <p className="text-xs text-gray-300 mt-2">Fonte: {fonte}</p>
    </div>
  );
}

export default function KpiVendas({
  cac,
  ticketMedio,
  taxaConversao,
  cicloVendas,
  ltv,
}: KpiVendasProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">KPIs de Vendas</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard
          title="CAC"
          value={formatBRL(cac.value)}
          subtitle={`${cac.customers} clientes · ${formatBRL(cac.adSpend)} em ads`}
          fonte="Meta Ads + Kommo"
        />
        <KpiCard
          title="Ticket Médio"
          value={formatBRL(ticketMedio.value)}
          subtitle={`${ticketMedio.count} vendas · Total ${formatBRL(ticketMedio.total)}`}
          fonte="Kommo"
        />
        <KpiCard
          title="Taxa de Conversão"
          value={`${taxaConversao.value.toFixed(1)}%`}
          subtitle={`${taxaConversao.won} ganhos de ${taxaConversao.total} leads`}
          fonte="Kommo"
        />
        <KpiCard
          title="Ciclo de Vendas"
          value={`${cicloVendas.value} dias`}
          fonte="Kommo"
        />
        <KpiCard
          title="LTV (12 meses)"
          value={formatBRL(ltv)}
          subtitle="Ticket Médio × 12"
          fonte="Calculado"
        />
      </div>
    </div>
  );
}
