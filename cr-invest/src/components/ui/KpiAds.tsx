"use client";

interface AdsResult {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalLeads: number;
  cpm: number;
  ctr: number;
  cpc: number;
  cpl: number;
  roas: number;
}

interface KpiAdsProps {
  current: AdsResult;
  previous?: AdsResult;
}

const ADS_BLUE = "#185FA5";

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function variation(current: number, previous: number | undefined): number | null {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

interface AdCardProps {
  label: string;
  value: string;
  variationPct: number | null;
  lowerIsBetter?: boolean;
}

function AdCard({ label, value, variationPct, lowerIsBetter }: AdCardProps) {
  let arrow: string | null = null;
  let arrowColor = "text-gray-400";

  if (variationPct !== null) {
    const improved = lowerIsBetter ? variationPct < 0 : variationPct > 0;
    arrow = variationPct > 0 ? "▲" : "▼";
    arrowColor = improved ? "text-green-600" : "text-red-600";
  }

  return (
    <div
      className="rounded-2xl shadow p-5 text-white flex flex-col gap-2"
      style={{ backgroundColor: ADS_BLUE }}
    >
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {variationPct !== null && (
        <p className={`text-xs font-semibold ${arrowColor} bg-white bg-opacity-10 rounded px-2 py-0.5 w-fit`}>
          {arrow} {Math.abs(variationPct).toFixed(1)}% vs período anterior
        </p>
      )}
    </div>
  );
}

export default function KpiAds({ current, previous }: KpiAdsProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Meta Ads</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <AdCard
          label="CPM"
          value={formatBRL(current.cpm)}
          variationPct={variation(current.cpm, previous?.cpm)}
          lowerIsBetter
        />
        <AdCard
          label="CTR"
          value={`${current.ctr.toFixed(2)}%`}
          variationPct={variation(current.ctr, previous?.ctr)}
          lowerIsBetter={false}
        />
        <AdCard
          label="CPC"
          value={formatBRL(current.cpc)}
          variationPct={variation(current.cpc, previous?.cpc)}
          lowerIsBetter
        />
        <AdCard
          label="CPL"
          value={formatBRL(current.cpl)}
          variationPct={variation(current.cpl, previous?.cpl)}
          lowerIsBetter
        />
        <AdCard
          label="ROAS"
          value={`${current.roas.toFixed(2)}x`}
          variationPct={variation(current.roas, previous?.roas)}
          lowerIsBetter={false}
        />
      </div>

      {/* Additional totals */}
      <div className="mt-4 grid grid-cols-3 md:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Investimento</p>
          <p className="font-bold text-gray-800">{formatBRL(current.totalSpend)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Impressões</p>
          <p className="font-bold text-gray-800">
            {new Intl.NumberFormat("pt-BR").format(current.totalImpressions)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Cliques</p>
          <p className="font-bold text-gray-800">
            {new Intl.NumberFormat("pt-BR").format(current.totalClicks)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Leads</p>
          <p className="font-bold text-gray-800">
            {new Intl.NumberFormat("pt-BR").format(current.totalLeads)}
          </p>
        </div>
      </div>
    </div>
  );
}
