export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const [sales, vendedores] = await Promise.all([
      prisma.sale.findMany({
        where: { closerExterno: null },
        select: { id: true, value: true, closedAt: true, assignedTo: true },
      }),
      prisma.vendedor.findMany({
        select: { nome: true, bronzeRate: true, silverRate: true, goldRate: true, silverMin: true, goldMin: true },
      }),
    ]);

    const vMap: Record<string, typeof vendedores[0]> = {};
    vendedores.forEach(v => { vMap[v.nome.toLowerCase()] = v; });

    const findV = (name: string) => {
      const n = (name || "").toLowerCase();
      return vMap[n] ?? Object.values(vMap).find(v =>
        n.includes(v.nome.toLowerCase().split(" ")[0]) ||
        v.nome.toLowerCase().includes(n.split(" ")[0])
      );
    };

    // Soma receita por closer+mês para determinar faixa
    const monthTotals: Record<string, number> = {};
    sales.forEach(s => {
      const d = new Date(s.closedAt);
      const key = `${s.assignedTo}|${d.getFullYear()}-${d.getMonth()}`;
      monthTotals[key] = (monthTotals[key] ?? 0) + s.value;
    });

    let updated = 0, skipped = 0;
    for (const s of sales) {
      const v = findV(s.assignedTo);
      if (!v) { skipped++; continue; }

      const d = new Date(s.closedAt);
      const key = `${s.assignedTo}|${d.getFullYear()}-${d.getMonth()}`;
      const monthTotal = monthTotals[key];

      const rate = monthTotal >= v.goldMin ? v.goldRate
        : monthTotal >= v.silverMin ? v.silverRate
        : v.bronzeRate;

      await prisma.sale.update({
        where: { id: s.id },
        data: {
          percentualCloser: parseFloat((rate / 100).toFixed(6)),
          valorComissaoCloser: parseFloat((s.value * rate / 100).toFixed(2)),
        },
      });
      updated++;
    }

    return NextResponse.json({ data: { updated, skipped } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
