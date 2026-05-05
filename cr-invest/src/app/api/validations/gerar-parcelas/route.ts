export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// UTC-safe: always 1st of target month to avoid day-overflow (e.g. Jan31+1≠Mar3)
function addMonths(date: Date, months: number): Date {
  const m = date.getUTCMonth() + months;
  return new Date(Date.UTC(
    date.getUTCFullYear() + Math.floor(m / 12),
    ((m % 12) + 12) % 12,
    1
  ));
}

export async function POST(req: Request) {
  try {
    const { saleId, numInstallments } = await req.json();

    if (!saleId || !numInstallments || numInstallments < 1) {
      return NextResponse.json({ error: "saleId e numInstallments são obrigatórios" }, { status: 400 });
    }

    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });

    // Remove parcelas existentes antes de re-gerar
    await prisma.installment.deleteMany({ where: { saleId } });

    const valorParcela = sale.value / numInstallments;
    const closedAt = new Date(sale.closedAt);

    const installments = Array.from({ length: numInstallments }, (_, i) => ({
      saleId,
      parcelaNumero: i + 1,
      dataVencimento: addMonths(closedAt, i),
      valorParcela: parseFloat(valorParcela.toFixed(2)),
      // Parcela 1 já paga (cliente paga na assinatura)
      pago: i === 0,
      status: i === 0 ? "PAGO" : "PENDENTE",
      dataPagamento: i === 0 ? closedAt : null,
    }));

    await prisma.installment.createMany({ data: installments });

    const updated = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { installments: { orderBy: { parcelaNumero: "asc" } } },
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
