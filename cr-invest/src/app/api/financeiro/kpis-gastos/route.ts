import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (!startParam || !endParam) {
      return NextResponse.json({ error: "Missing start or end date" }, { status: 400 });
    }

    const startDate = new Date(startParam);
    const endDate = new Date(endParam);
    const now = new Date();

    // 12 meses atrás para a evolução
    const twelveMonthsAgo = new Date(endDate);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    // 6 meses no futuro para compromissos
    const sixMonthsFuture = new Date(endDate);
    sixMonthsFuture.setMonth(sixMonthsFuture.getMonth() + 6);
    sixMonthsFuture.setHours(23, 59, 59, 999);

    // Mês anterior para comparação de margem e lucro
    const prevStartDate = new Date(startDate);
    prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    const prevEndDate = new Date(endDate);
    prevEndDate.setMonth(prevEndDate.getMonth() - 1);

    // --- Buscas no DB ---
    const allGastos = await db.gasto.findMany({
      where: { dataGasto: { gte: twelveMonthsAgo, lte: sixMonthsFuture } }
    });

    const allInstallments = await db.installment.findMany({
      where: {
        status: "PAGO",
        OR: [
          { dataPagamento: { gte: twelveMonthsAgo, lte: endDate } },
          { dataPagamento: null, dataVencimento: { gte: twelveMonthsAgo, lte: endDate } }
        ]
      },
      include: { sale: { select: { administradora: true } } }
    });

    // Funções auxiliares para calcular Receita Bruta, Impostos e Royalties
    const getComissaoBruta = (inst: any) => inst.valorParcela;
    
    const getRoyalties = (inst: any) => {
      const adm = (inst.sale?.administradora || "").toLowerCase();
      if (adm.includes("porto")) return getComissaoBruta(inst) * 0.084;
      return 0; // Embracon não tem
    };

    const getImpostos = (inst: any) => {
      const adm = (inst.sale?.administradora || "").toLowerCase();
      if (adm.includes("porto")) return getComissaoBruta(inst) * 0.069;
      if (adm.includes("embracon")) return getComissaoBruta(inst) * 0.07;
      return 0;
    };

    // --- Filtros de tempo ---
    const gastosMes = allGastos.filter((g: any) => g.dataGasto >= startDate && g.dataGasto <= endDate);
    const gastosPrev = allGastos.filter((g: any) => g.dataGasto >= prevStartDate && g.dataGasto <= prevEndDate);
    const gastosFuturo = allGastos.filter((g: any) => g.dataGasto > endDate && g.dataGasto <= sixMonthsFuture);

    const instMes = allInstallments.filter((i: any) => {
      const d = i.dataPagamento || i.dataVencimento;
      return d >= startDate && d <= endDate;
    });
    const instPrev = allInstallments.filter((i: any) => {
      const d = i.dataPagamento || i.dataVencimento;
      return d >= prevStartDate && d <= prevEndDate;
    });

    // Totais de Impostos e Royalties gerados dinamicamente
    const totalImpostos = instMes.reduce((s: number, i: any) => s + getImpostos(i), 0);
    const totalRoyalties = instMes.reduce((s: number, i: any) => s + getRoyalties(i), 0);
    const totalTaxasPrev = instPrev.reduce((s: number, i: any) => s + getImpostos(i) + getRoyalties(i), 0);

    // --- Cálculos KPI Topo ---
    const gastosManuaisMes = gastosMes.reduce((s: number, g: any) => s + g.valor, 0);
    const totalGasto = gastosManuaisMes + totalImpostos + totalRoyalties; // Custo Total inclui as taxas
    const totalPago = gastosMes.filter((g: any) => g.status === "pago").reduce((s: number, g: any) => s + g.valor, 0) + totalImpostos + totalRoyalties; // Assume taxas pagas no ato
    const totalAPagar = gastosMes.filter((g: any) => g.status !== "pago").reduce((s: number, g: any) => s + g.valor, 0);
    const comprometidoFuturo = gastosFuturo.reduce((s: number, g: any) => s + g.valor, 0);

    const receitaMesBruta = instMes.reduce((s: number, i: any) => s + getComissaoBruta(i), 0);
    const receitaPrevBruta = instPrev.reduce((s: number, i: any) => s + getComissaoBruta(i), 0);

    const lucroLiquido = receitaMesBruta - totalGasto;
    const margemLiquida = receitaMesBruta > 0 ? (lucroLiquido / receitaMesBruta) * 100 : 0;
    const roi = totalGasto > 0 ? (lucroLiquido / totalGasto) * 100 : 0;

    const totalGastoPrev = gastosPrev.reduce((s: number, g: any) => s + g.valor, 0) + totalTaxasPrev;
    const lucroPrev = receitaPrevBruta - totalGastoPrev;
    const margemPrev = receitaPrevBruta > 0 ? (lucroPrev / receitaPrevBruta) * 100 : 0;
    const roiPrev = totalGastoPrev > 0 ? (lucroPrev / totalGastoPrev) * 100 : 0;

    const varLucro = lucroPrev !== 0 ? ((lucroLiquido - lucroPrev) / Math.abs(lucroPrev)) * 100 : 0;
    const varMargem = margemLiquida - margemPrev;
    const varRoi = roi - roiPrev;

    // --- Onde a Empresa Gasta Mais (Categorias) ---
    const categoriasMap: Record<string, number> = {};
    gastosMes.forEach((g: any) => {
      const cat = g.categoria || "outros";
      categoriasMap[cat] = (categoriasMap[cat] || 0) + g.valor;
    });
    // Adiciona categorias virtuais
    if (totalImpostos > 0) categoriasMap["impostos"] = totalImpostos;
    if (totalRoyalties > 0) categoriasMap["royalties"] = totalRoyalties;

    const categorias = Object.entries(categoriasMap)
      .map(([nome, valor]) => ({
        nome,
        valor,
        percentual: totalGasto > 0 ? (valor / totalGasto) * 100 : 0
      }))
      .sort((a, b) => b.valor - a.valor);

    // --- Custos: Fixos x Variáveis ---
    let fixos = 0;
    let variaveis = totalImpostos + totalRoyalties; // Taxas são variáveis
    gastosMes.forEach((g: any) => {
      if ((g.tipo || "").toLowerCase() === "variavel" || (g.tipo || "").toLowerCase() === "variável") {
        variaveis += g.valor;
      } else {
        fixos += g.valor;
      }
    });
    const fixosVsVariaveis = {
      fixos,
      variaveis,
      fixosPercent: totalGasto > 0 ? (fixos / totalGasto) * 100 : 0,
      variaveisPercent: totalGasto > 0 ? (variaveis / totalGasto) * 100 : 0
    };

    // --- Evolução 12 Meses ---
    const evolucaoMap = new Map<string, { receitas: number; custos: number; lucro: number }>();
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    // Inicializar os últimos 12 meses
    for (let i = 0; i < 12; i++) {
      const d = new Date(twelveMonthsAgo);
      d.setMonth(d.getMonth() + i);
      const k = `${monthNames[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`;
      evolucaoMap.set(k, { receitas: 0, custos: 0, lucro: 0 });
    }

    // Preencher custos operacionais
    allGastos.filter((g: any) => g.dataGasto >= twelveMonthsAgo && g.dataGasto <= endDate).forEach((g: any) => {
      const k = `${monthNames[g.dataGasto.getMonth()]}/${g.dataGasto.getFullYear().toString().slice(-2)}`;
      if (evolucaoMap.has(k)) {
        evolucaoMap.get(k)!.custos += g.valor;
      }
    });

    // Preencher receitas e custos (taxas) das parcelas
    allInstallments.filter((i: any) => {
      const d = i.dataPagamento || i.dataVencimento;
      return d >= twelveMonthsAgo && d <= endDate;
    }).forEach((i: any) => {
      const d = i.dataPagamento || i.dataVencimento;
      const k = `${monthNames[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`;
      if (evolucaoMap.has(k)) {
        evolucaoMap.get(k)!.receitas += getComissaoBruta(i);
        evolucaoMap.get(k)!.custos += getImpostos(i) + getRoyalties(i);
      }
    });

    const evolucao = Array.from(evolucaoMap.entries()).map(([mes, data]) => ({
      mes,
      receitas: data.receitas,
      custos: data.custos,
      lucro: data.receitas - data.custos
    }));

    // --- Gastos Recorrentes (base para projeções) ---
    const gastosRecorrentes = gastosMes.filter((g: any) => g.recorrente === true || (g.tipo || '').toLowerCase() === 'fixo');
    const recorrenteTotal = gastosRecorrentes.reduce((s: number, g: any) => s + g.valor, 0);

    // --- Projeção 12 Meses para Frente ---
    // Usa média dos últimos 3 meses como base de receita e projeta custos fixos/recorrentes
    const last3 = evolucao.slice(-3);
    const avgReceita = last3.length > 0 ? last3.reduce((s, e) => s + e.receitas, 0) / last3.length : 0;
    // Custo fixo mensal projetado = gastos recorrentes/fixos do mês atual + taxas médias
    const custoFixoMensal = recorrenteTotal + (totalImpostos + totalRoyalties);

    const projecao12m = [];
    for (let i = 1; i <= 12; i++) {
      const d = new Date(endDate);
      d.setMonth(d.getMonth() + i);
      const k = `${monthNames[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`;
      
      // Busca gastos já cadastrados nesse mês futuro
      const gastosExistentes = allGastos.filter((g: any) => {
        return g.dataGasto.getMonth() === d.getMonth() && g.dataGasto.getFullYear() === d.getFullYear();
      }).reduce((s: number, g: any) => s + g.valor, 0);

      const custosProj = gastosExistentes > 0 ? gastosExistentes + (totalImpostos + totalRoyalties) : custoFixoMensal;
      const receitaProj = avgReceita;
      
      projecao12m.push({
        mes: k,
        receitas: Math.round(receitaProj * 100) / 100,
        custos: Math.round(custosProj * 100) / 100,
        lucro: Math.round((receitaProj - custosProj) * 100) / 100,
        projetado: true
      });
    }

    // --- Compromissos Futuros (6 meses) ---
    // Inclui gastos já cadastrados no futuro + projeção de gastos recorrentes/fixos do mês atual
    const compromissosMap = new Map<string, number>();
    for (let i = 1; i <= 6; i++) {
      const d = new Date(endDate);
      d.setMonth(d.getMonth() + i);
      const k = `${monthNames[d.getMonth()]}/${d.getFullYear().toString().slice(-2)}`;
      compromissosMap.set(k, 0);
    }

    // Gastos já cadastrados no futuro
    gastosFuturo.forEach((g: any) => {
      const k = `${monthNames[g.dataGasto.getMonth()]}/${g.dataGasto.getFullYear().toString().slice(-2)}`;
      if (compromissosMap.has(k)) {
        compromissosMap.set(k, compromissosMap.get(k)! + g.valor);
      }
    });

    // Projetar gastos recorrentes/fixos do mês atual para os próximos 6 meses
    for (const [mes] of Array.from(compromissosMap)) {
      // Só adiciona projeção se não há gastos já cadastrados naquele mês
      const current = compromissosMap.get(mes) || 0;
      if (current === 0) {
        compromissosMap.set(mes, recorrenteTotal);
      }
    }
    
    const compromissosFuturos = Array.from(compromissosMap.entries()).map(([mes, valor]) => ({
      mes,
      valor
    }));

    const comprometidoFuturoTotal = compromissosFuturos.reduce((s, c) => s + c.valor, 0);

    return NextResponse.json({
      data: {
        totalGasto,
        totalPago,
        totalAPagar,
        comprometidoFuturo: comprometidoFuturoTotal,
        lucroLiquido,
        margemLiquida,
        roi,
        varLucro,
        varMargem,
        varRoi,
        categorias,
        fixosVsVariaveis,
        evolucao,
        projecao12m,
        compromissosFuturos,
        totalImpostos,
        totalRoyalties
      }
    });
  } catch (error: any) {
    console.error("[kpis-gastos] Erro:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
