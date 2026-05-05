import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes"); // YYYY-MM

  let startDate: Date | undefined;
  let endDate: Date | undefined;
  if (mes) {
    const [y, m] = mes.split("-").map(Number);
    startDate = new Date(y, m - 1, 1);
    endDate = new Date(y, m, 0, 23, 59, 59);
  }

  const gastos = await db.gasto.findMany({
    where: startDate ? { dataGasto: { gte: startDate, lte: endDate } } : undefined,
    orderBy: { dataGasto: "desc" },
  });

  return NextResponse.json({ data: gastos });
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    descricao, categoria, subcategoria, fornecedor, tipo, valor, dataGasto,
    dataVencimento, status, recorrente, mesesRecorrencia, observacoes,
  } = body;

  const gasto = await db.gasto.create({
    data: {
      descricao,
      categoria,
      subcategoria,
      fornecedor,
      tipo: tipo || "fixo",
      valor: Number(valor),
      dataGasto: new Date(dataGasto),
      dataVencimento: dataVencimento ? new Date(dataVencimento) : null,
      status: status ?? "a_pagar",
      recorrente: Boolean(recorrente),
      mesesRecorrencia: mesesRecorrencia ? Number(mesesRecorrencia) : null,
      observacoes,
    },
  });

  // Se recorrente, cria os próximos meses automaticamente
  if (recorrente && mesesRecorrencia && mesesRecorrencia > 1) {
    const extras = [];
    const baseDate = new Date(dataGasto);
    for (let i = 1; i < mesesRecorrencia; i++) {
      const nextDate = new Date(baseDate);
      nextDate.setMonth(nextDate.getMonth() + i);
      const nextVenc = dataVencimento ? new Date(dataVencimento) : null;
      if (nextVenc) nextVenc.setMonth(nextVenc.getMonth() + i);
      extras.push({
        descricao,
        categoria,
        subcategoria,
        fornecedor,
        tipo: tipo || "fixo",
        valor: Number(valor),
        dataGasto: nextDate,
        dataVencimento: nextVenc,
        status: "a_pagar" as string,
        recorrente: true,
        mesesRecorrencia: Number(mesesRecorrencia),
        observacoes,
      });
    }
    if (extras.length > 0) {
      await db.gasto.createMany({ data: extras });
    }
  }

  return NextResponse.json({ data: gasto });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, ...updates } = body;

  if (updates.dataPagamento) updates.dataPagamento = new Date(updates.dataPagamento);
  if (updates.dataGasto) updates.dataGasto = new Date(updates.dataGasto);
  if (updates.dataVencimento) updates.dataVencimento = new Date(updates.dataVencimento);
  if (updates.valor) updates.valor = Number(updates.valor);

  const gasto = await db.gasto.update({ where: { id }, data: updates });
  return NextResponse.json({ data: gasto });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.gasto.delete({ where: { id } });
  return NextResponse.json({ data: { deleted: true } });
}
