import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const ROYALTY_PORTO = 0.084;
const IMPOSTOS_PORTO = 0.069;
const IMPOSTOS_EMBRACON = 0.07;

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);
  return { start, end };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? (now.getMonth() + 1));

  const { start, end } = getMonthRange(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { start: prevStart, end: prevEnd } = getMonthRange(prevYear, prevMonth);

  // ── Parcelas recebidas no mês (com info da venda para saber administradora) ──
  const parcelasRecebidas: any[] = await prisma.installment.findMany({
    where: { status: "PAGO", dataPagamento: { gte: start, lte: end } },
    include: { sale: { select: { administradora: true } } },
  });
  const parcelasPrevMes: any[] = await prisma.installment.findMany({
    where: { status: "PAGO", dataPagamento: { gte: prevStart, lte: prevEnd } },
  });

  // ── Calcular receita bruta e descontos ──
  let receitaBruta = 0;
  let totalRoyalty = 0;
  let totalImpostos = 0;

  for (const p of parcelasRecebidas) {
    const v = p.valorParcela;
    receitaBruta += v;

    const adm = (p.sale?.administradora ?? "").toLowerCase();
    const isEmbracon = adm.includes("embracon");

    if (isEmbracon) {
      totalImpostos += v * IMPOSTOS_EMBRACON;
    } else {
      // Porto Seguro (padrão)
      totalRoyalty += v * ROYALTY_PORTO;
      totalImpostos += v * IMPOSTOS_PORTO;
    }
  }

  const totalDescontos = totalRoyalty + totalImpostos;
  const receitaLiquida = receitaBruta - totalDescontos;

  // ── Gastos do mês por categoria ──
  let gastos: any[] = [];
  let gastosPrevMes: any[] = [];
  try {
    gastos = await db.gasto.findMany({ where: { dataGasto: { gte: start, lte: end } } });
    gastosPrevMes = await db.gasto.findMany({ where: { dataGasto: { gte: prevStart, lte: prevEnd } } });
  } catch {
    // tabela ainda não existe
  }

  const gastosPorCategoria: Record<string, number> = {};
  const CATEGORIAS = ["pessoas", "espaco", "tecnologia", "marketing", "outros"];
  for (const cat of CATEGORIAS) gastosPorCategoria[cat] = 0;
  for (const g of gastos) {
    const cat = g.categoria in gastosPorCategoria ? g.categoria : "outros";
    gastosPorCategoria[cat] += g.valor;
  }

  const totalGastos = gastos.reduce((s: number, g: any) => s + g.valor, 0);
  const totalGastosPrev = gastosPrevMes.reduce((s: number, g: any) => s + g.valor, 0);
  const resultado = receitaLiquida - totalGastos;

  // ── Variações mês anterior ──
  const receitaBrutaPrev = parcelasPrevMes.reduce((s: number, p: any) => s + p.valorParcela, 0);
  const varReceita = receitaBrutaPrev > 0
    ? Math.round(((receitaBruta - receitaBrutaPrev) / receitaBrutaPrev) * 100)
    : 0;
  const varGastos = totalGastosPrev > 0
    ? Math.round(((totalGastos - totalGastosPrev) / totalGastosPrev) * 100)
    : 0;

  // ── Alertas ──
  let vendasAguardando = 0;
  try {
    vendasAguardando = await db.sale.count({ where: { statusValidacao: "aguardando" } });
  } catch { /* campo novo */ }

  const parcelasInadimplentes: any[] = await prisma.installment.findMany({
    where: { status: "INADIMPLENTE" },
  });

  // ── Projeção 6 meses (parcelas previstas × 70% adimplência - royalty/impostos estimados) ──
  const projecao6Meses: { mes: string; previsto: number; real: number }[] = [];
  for (let i = 0; i < 6; i++) {
    let futM = month + i;
    let futY = year;
    if (futM > 12) { futM -= 12; futY += 1; }
    const { start: fStart, end: fEnd } = getMonthRange(futY, futM);
    const futParcelas: any[] = await prisma.installment.findMany({
      where: { dataVencimento: { gte: fStart, lte: fEnd }, status: { not: "CANCELADO" } },
    });
    const bruto = futParcelas.reduce((s: number, p: any) => s + p.valorParcela, 0);
    const pago = futParcelas.filter((p: any) => p.status === "PAGO").reduce((s: number, p: any) => s + p.valorParcela, 0);
    // Estimativa: ~85% é Porto (15.3% descontos) → desconto médio ~13%
    const estimativaLiquida = Math.round(bruto * 0.87 * 0.7); // líquido × 70% adimplência
    projecao6Meses.push({
      mes: `${String(futM).padStart(2, "0")}/${futY}`,
      previsto: estimativaLiquida,
      real: Math.round(pago),
    });
  }

  return NextResponse.json({
    data: {
      periodo: { mes: month, ano: year },
      dre: {
        receitaBruta,
        descontos: {
          royalty: totalRoyalty,
          impostos: totalImpostos,
          total: totalDescontos,
        },
        receitaLiquida,
        gastos: {
          total: totalGastos,
          porCategoria: gastosPorCategoria,
        },
        resultado,
      },
      variacoes: {
        receita: varReceita,
        gastos: varGastos,
      },
      alertas: {
        vendasAguardando,
        inadimplentes: parcelasInadimplentes.length,
        gastosAtrasados: gastos.filter((g: any) => g.status === "atrasado").length,
      },
      projecao6Meses,
    },
  });
}
