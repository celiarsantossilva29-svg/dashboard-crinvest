"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface AgentDialerStats {
  agentName: string;
  totalCalls: number;
  talkTimeSecs: number;
  avgPerCall: number;
  source: string;
}

interface DialerMetricsResult {
  totalCalls: number;
  totalTalkTimeSecs: number;
  avgTalkTimePerCall: number;
  callsBySource: { goto: number; threec: number };
  callsByAgent: AgentDialerStats[];
  dailyCalls?: { date: string; goto: number; threec: number }[];
}

interface DiscadoresPanelProps {
  data: DialerMetricsResult;
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: "8px",
    color: "#111827",
    fontSize: "11px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  cursor: { fill: "#F9FAFB" },
};

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Deterministic seeded number for sparkline placeholder when no daily data */
function seeded(seed: number, min: number, max: number) {
  const x = Math.sin(seed + 1) * 10000;
  const r = x - Math.floor(x);
  return Math.round(min + r * (max - min));
}

function buildSparkline(
  daily: { date: string; goto: number; threec: number }[] | undefined,
  source: "goto" | "threec",
  total: number
): { day: string; v: number }[] {
  if (daily && daily.length >= 7) {
    return daily.slice(-7).map((d, i) => ({ day: DAY_LABELS[i], v: d[source] }));
  }
  // placeholder: distribute total across 7 days with seeded variation
  const avg = Math.round(total / 7);
  return DAY_LABELS.map((day, i) => ({
    day,
    v: seeded(i * 13 + (source === "goto" ? 7 : 3), Math.round(avg * 0.5), Math.round(avg * 1.5)),
  }));
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatAvg(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

function SourceCard({
  label,
  calls,
  talkTimeSecs,
  color,
  sparkline,
}: {
  label: string;
  calls: number;
  talkTimeSecs: number;
  color: string;
  sparkline: { day: string; v: number }[];
}) {
  return (
    <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          {new Intl.NumberFormat("pt-BR").format(calls)} lig.
        </span>
      </div>

      <div>
        <p className="text-2xl font-bold text-gray-800">
          {new Intl.NumberFormat("pt-BR").format(calls)}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Talk time: {formatTime(talkTimeSecs)}</p>
      </div>

      {/* Sparkline */}
      <div style={{ height: 72 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sparkline}
            margin={{ top: 2, right: 2, left: -30, bottom: 0 }}
            barSize={10}
          >
            <XAxis
              dataKey="day"
              tick={{ fontSize: 9, fill: "#9CA3AF" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: any) => [new Intl.NumberFormat("pt-BR").format(v), "ligações"]}
            />
            <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DiscadoresPanel({ data }: DiscadoresPanelProps) {
  const gotoAgents = data.callsByAgent.filter((a) => a.source === "goto");
  const threecAgents = data.callsByAgent.filter((a) => a.source === "threec");

  const gotoTalkTime = gotoAgents.reduce((s, a) => s + a.talkTimeSecs, 0);
  const threecTalkTime = threecAgents.reduce((s, a) => s + a.talkTimeSecs, 0);

  const gotoSpark = buildSparkline(data.dailyCalls, "goto", data.callsBySource.goto);
  const threecSpark = buildSparkline(data.dailyCalls, "threec", data.callsBySource.threec);

  const maxCalls = Math.max(...data.callsByAgent.map((a) => a.totalCalls), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Discadores</h2>
        <span className="text-xs text-gray-400">
          {new Intl.NumberFormat("pt-BR").format(data.totalCalls)} ligações ·{" "}
          {formatTime(data.totalTalkTimeSecs)} falados
        </span>
      </div>

      {/* Two source cards */}
      <div className="flex gap-4">
        <SourceCard
          label="GoTo · SDR"
          calls={data.callsBySource.goto}
          talkTimeSecs={gotoTalkTime}
          color="#2563EB"
          sparkline={gotoSpark}
        />
        <SourceCard
          label="3C Plus · Closer"
          calls={data.callsBySource.threec}
          talkTimeSecs={threecTalkTime}
          color="#16A34A"
          sparkline={threecSpark}
        />
      </div>

      {/* Agent table */}
      {data.callsByAgent.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2.5">Agente</th>
                <th className="px-4 py-2.5">Fonte</th>
                <th className="px-4 py-2.5 text-right">Ligações</th>
                <th className="px-4 py-2.5 text-right">Talk time</th>
                <th className="px-4 py-2.5 text-right">Média</th>
                <th className="px-4 py-2.5">Proporção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.callsByAgent.map((agent) => (
                <tr key={`${agent.agentName}-${agent.source}`} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800 text-xs">{agent.agentName}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: agent.source === "goto" ? "#2563EB" : "#16A34A" }}
                    >
                      {agent.source === "goto" ? "GoTo" : "3C Plus"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-700">
                    {new Intl.NumberFormat("pt-BR").format(agent.totalCalls)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">
                    {formatTime(agent.talkTimeSecs)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-600">
                    {formatAvg(agent.avgPerCall)}
                  </td>
                  <td className="px-4 py-3 w-28">
                    <div className="w-full bg-gray-100 rounded-full" style={{ height: 6 }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((agent.totalCalls / maxCalls) * 100)}%`,
                          backgroundColor: agent.source === "goto" ? "#2563EB" : "#16A34A",
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
