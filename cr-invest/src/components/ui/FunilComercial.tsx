"use client";

interface FunilComercialProps {
  leadsGerados: number;
  contatados: number;
  qualificados: number;
  agendamentos: number;
  reunioes: number;
  vendas: number;
}

const STAGES = [
  { key: "leadsGerados", label: "Leads gerados",         color: "#1E40AF" },
  { key: "contatados",   label: "Contatados",            color: "#2563EB" },
  { key: "qualificados", label: "Qualificados",          color: "#3B82F6" },
  { key: "agendamentos", label: "Agendamentos",          color: "#60A5FA" },
  { key: "reunioes",     label: "1ª Reunião Realizada",  color: "#93C5FD" },
  { key: "vendas",       label: "Vendas",                color: "#BFDBFE" },
] as const;

function dropPct(num: number, den: number): string {
  if (den === 0) return "—";
  const lost = den - num;
  return ((lost / den) * 100).toFixed(1) + "%";
}

function convPct(num: number, den: number): string {
  if (den === 0) return "—";
  return ((num / den) * 100).toFixed(1) + "%";
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

export default function FunilComercial({
  leadsGerados,
  contatados,
  qualificados,
  agendamentos,
  reunioes,
  vendas,
}: FunilComercialProps) {
  const values: Record<string, number> = {
    leadsGerados,
    contatados,
    qualificados,
    agendamentos,
    reunioes,
    vendas,
  };

  const max = Math.max(leadsGerados, 1);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-5">Funil Comercial</h2>

      <div className="flex flex-col gap-0">
        {STAGES.map((stage, i) => {
          const value = values[stage.key];
          const widthPct = Math.max(8, Math.round((value / max) * 100));
          const prevValue = i > 0 ? values[STAGES[i - 1].key] : null;
          const drop = prevValue !== null ? dropPct(value, prevValue) : null;
          const conv = prevValue !== null ? convPct(value, prevValue) : null;

          return (
            <div key={stage.key}>
              {/* Drop indicator between stages */}
              {drop !== null && (
                <div className="flex items-center gap-2 py-1 pl-1">
                  <span className="text-red-500 text-xs font-medium leading-none">▼ {drop}</span>
                  <span className="text-gray-300 text-xs">·</span>
                  <span className="text-gray-400 text-xs">{conv} convertido</span>
                </div>
              )}

              {/* Bar row */}
              <div className="flex items-center gap-3">
                {/* Bar */}
                <div className="flex-1 relative" style={{ height: 32 }}>
                  <div
                    className="absolute left-0 top-0 h-full rounded-r-md flex items-center px-3 transition-all duration-700"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: stage.color,
                      minWidth: 48,
                    }}
                  >
                    <span className="text-white text-xs font-bold truncate">
                      {fmt(value)}
                    </span>
                  </div>
                </div>

                {/* Label */}
                <span className="text-xs text-gray-500 w-24 flex-shrink-0 text-right">
                  {stage.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div className="mt-5 pt-4 border-t border-gray-50 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs text-center text-gray-500">
        <div>
          <p className="text-gray-400">Contato</p>
          <p className="font-semibold text-gray-700">{convPct(contatados, leadsGerados)}</p>
        </div>
        <div>
          <p className="text-gray-400">Qualificação</p>
          <p className="font-semibold text-gray-700">{convPct(qualificados, contatados)}</p>
        </div>
        <div>
          <p className="text-gray-400">Agendamento</p>
          <p className="font-semibold text-gray-700">{convPct(agendamentos, qualificados)}</p>
        </div>
        <div>
          <p className="text-gray-400">Reunião realizada</p>
          <p className="font-semibold text-gray-700">{convPct(reunioes, agendamentos)}</p>
        </div>
        <div>
          <p className="text-gray-400">Fechamento</p>
          <p className="font-semibold text-gray-700">{convPct(vendas, reunioes)}</p>
        </div>
      </div>
    </div>
  );
}
