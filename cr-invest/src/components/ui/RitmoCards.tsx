"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";

interface RitmoCardsProps {
  ritmoAtual: number;
  ritmoNecessario: number;
  projecaoFinal: number;
  daysLeft: number;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: "8px",
    color: "#111827",
    fontSize: "12px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  cursor: { fill: "#F9FAFB" },
};

export default function RitmoCards({
  ritmoAtual,
  ritmoNecessario,
  projecaoFinal,
  daysLeft,
}: RitmoCardsProps) {
  const onTrack = ritmoAtual >= ritmoNecessario;
  const maxDomain = Math.max(ritmoAtual, ritmoNecessario, 1) * 1.35;

  const barData = [
    { name: "Atual", value: ritmoAtual, color: onTrack ? "#16A34A" : "#DC2626" },
    { name: "Necessário", value: ritmoNecessario, color: "#2563EB" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Ritmo Diário</h2>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            onTrack ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
          }`}
        >
          {onTrack ? "No ritmo" : "Abaixo do ritmo"}
        </span>
      </div>

      {/* Horizontal bar chart with dashed reference line */}
      <div style={{ height: 88 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={barData}
            margin={{ top: 4, right: 20, left: 4, bottom: 0 }}
            barSize={18}
            barCategoryGap="30%"
          >
            <XAxis
              type="number"
              domain={[0, maxDomain]}
              tickFormatter={fmtShort}
              tick={{ fontSize: 10, fill: "#9CA3AF" }}
              tickCount={4}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#6B7280" }}
              width={72}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: any) => [fmtBRL(v), "por dia"]}
            />
            {/* Dashed vertical line at ritmo necessário */}
            <ReferenceLine
              x={ritmoNecessario}
              stroke="#DC2626"
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary row */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div>
          <p className="text-xs text-gray-500">Projeção Final</p>
          <p className="text-lg font-bold text-gray-800">{fmtBRL(projecaoFinal)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Dias restantes</p>
          <p className="text-lg font-bold text-gray-800">{daysLeft}</p>
        </div>
      </div>
    </div>
  );
}
