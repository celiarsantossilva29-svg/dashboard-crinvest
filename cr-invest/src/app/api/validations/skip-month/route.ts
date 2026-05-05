export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/validations/skip-month
// Body: { saleId: string }
// Avança o dataVencimento de todas as parcelas PENDENTE da venda em +1 mês.
export async function POST(req: Request) {
  try {
    const { saleId } = await req.json();
    if (!saleId) {
      return NextResponse.json({ error: "saleId obrigatório" }, { status: 400 });
    }

    const pendentes = await prisma.installment.findMany({
      where: { saleId, status: "PENDENTE" },
      orderBy: { parcelaNumero: "asc" },
    });

    if (pendentes.length === 0) {
      return NextResponse.json({ error: "Nenhuma parcela PENDENTE para esta venda" }, { status: 400 });
    }

    // Adiciona 1 mês ao dataVencimento de cada parcela PENDENTE
    const addOneMonth = (d: Date): Date => {
      const m = d.getUTCMonth() + 1;
      return new Date(Date.UTC(
        d.getUTCFullYear() + Math.floor(m / 12),
        ((m % 12) + 12) % 12,
        1
      ));
    };

    await Promise.all(
      pendentes.map((inst) =>
        prisma.installment.update({
          where: { id: inst.id },
          data: { dataVencimento: addOneMonth(inst.dataVencimento) },
        })
      )
    );

    return NextResponse.json({
      data: { updated: pendentes.length, message: `${pendentes.length} parcelas avançadas 1 mês` },
    });
  } catch (error: any) {
    console.error("API /validations/skip-month error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
