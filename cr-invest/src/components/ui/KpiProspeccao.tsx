"use client";

interface TaxaAgendamentoData {
  value: number;
  scheduled: number;
  contacted: number;
}
interface NoShowData {
  value: number;
  missed: number;
  scheduled: number;
}
interface TaxaQualificacaoData {
  value: number;
  qualified: number;
  total: number;
}

interface KpiProspeccaoProps {
  leadsGerados: number;
  taxaAgendamento: TaxaAgendamentoData;
  noShow: NoShowData;
  taxaQualificacao: TaxaQualificacaoData;
  contatosPorLead: number;
}

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

export default function KpiProspeccao({
  leadsGerados,
  taxaAgendamento,
  noShow,
  taxaQualificacao,
  contatosPorLead,
}: KpiProspeccaoProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">KPIs de Prospecção</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard
          title="Leads Gerados"
          value={new Intl.NumberFormat("pt-BR").format(leadsGerados)}
          fonte="Kommo + Meta Ads"
        />
        <KpiCard
          title="Taxa de Agendamento"
          value={`${taxaAgendamento.value.toFixed(1)}%`}
          subtitle={`${taxaAgendamento.scheduled} agendados de ${taxaAgendamento.contacted} contatados`}
          fonte="Kommo"
        />
        <KpiCard
          title="No-Show"
          value={`${noShow.value.toFixed(1)}%`}
          subtitle={`${noShow.missed} faltas de ${noShow.scheduled} agendados`}
          fonte="Kommo"
        />
        <KpiCard
          title="Taxa de Qualificação"
          value={`${taxaQualificacao.value.toFixed(1)}%`}
          subtitle={`${taxaQualificacao.qualified} qualificados de ${taxaQualificacao.total} leads`}
          fonte="Kommo"
        />
        <KpiCard
          title="Contatos por Lead"
          value={`${contatosPorLead}x`}
          subtitle="Média de interações"
          fonte="Kommo"
        />
      </div>
    </div>
  );
}
