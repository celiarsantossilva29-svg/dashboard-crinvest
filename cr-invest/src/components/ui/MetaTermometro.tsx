"use client";

interface MetaTermometroProps {
  goal: number;
  achieved: number;
  daysLeft: number;
  totalDays: number;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const MARKERS = [25, 50, 80];

export default function MetaTermometro({ goal, achieved, daysLeft, totalDays }: MetaTermometroProps) {
  const pct = goal > 0 ? Math.min(100, (achieved / goal) * 100) : 0;
  const falta = Math.max(0, goal - achieved);
  const elapsedDays = totalDays - daysLeft;
  const ritmoAtual = elapsedDays > 0 ? achieved / elapsedDays : 0;
  const ritmoNecessario = daysLeft > 0 ? falta / daysLeft : 0;
  const ritmoInsuficiente = ritmoAtual < ritmoNecessario && falta > 0;

  const badgeClass =
    pct >= 80
      ? "bg-green-100 text-green-700"
      : pct >= 50
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Meta do Ciclo</h2>
        <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${badgeClass}`}>
          {pct.toFixed(1)}%
        </span>
      </div>

      {/* Markers above bar */}
      <div className="relative h-5 mb-1">
        {MARKERS.map((mark) => (
          <div
            key={mark}
            className="absolute bottom-0 flex flex-col items-center"
            style={{ left: `${mark}%`, transform: "translateX(-50%)" }}
          >
            <span className="text-[10px] text-gray-400 leading-none">{mark}%</span>
            <div className="w-px h-2 bg-gray-300 mt-0.5" />
          </div>
        ))}
      </div>

      {/* Bar 16px */}
      <div className="relative w-full rounded-full overflow-hidden" style={{ height: 16, backgroundColor: "#E5E7EB" }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(pct, 0.5)}%`, backgroundColor: "#2563EB" }}
        />
        {MARKERS.map((mark) => (
          <div
            key={mark}
            className="absolute top-0 h-full w-px bg-white/60"
            style={{ left: `${mark}%` }}
          />
        ))}
      </div>

      {/* Labels below bar */}
      <div className="flex justify-between mt-2">
        <p className="text-xs text-gray-500">
          Realizado <span className="font-semibold text-gray-800">{fmtBRL(achieved)}</span>
        </p>
        <p className="text-xs text-gray-500 text-right">
          Meta <span className="font-semibold text-gray-800">{fmtBRL(goal)}</span>
        </p>
      </div>

      {/* Status */}
      <div className="mt-2 flex items-center justify-between">
        {falta > 0 ? (
          <span className="text-xs text-gray-500">
            Falta <span className="font-semibold text-gray-700">{fmtBRL(falta)}</span>
          </span>
        ) : (
          <span className="text-xs font-semibold text-green-600">✓ Meta atingida!</span>
        )}
        <span className="text-xs text-gray-400">{daysLeft}d restantes</span>
      </div>

      {/* Ritmo alert */}
      {ritmoInsuficiente && (
        <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 text-xs">
          <span>⚠</span>
          <span>
            {fmtBRL(ritmoAtual)}/dia atual · {fmtBRL(ritmoNecessario)}/dia necessário
          </span>
        </div>
      )}
    </div>
  );
}
