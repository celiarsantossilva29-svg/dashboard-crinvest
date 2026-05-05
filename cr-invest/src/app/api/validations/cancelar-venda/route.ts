export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { saleId } = await req.json();
    if (!saleId) return NextResponse.json({ error: "saleId obrigatório" }, { status: 400 });

    const { count } = await prisma.installment.updateMany({
      where: { saleId, status: { not: "PAGO" } },
      data: { status: "CANCELADO", pago: false, dataPagamento: null },
    });

    return NextResponse.json({ data: { updated: count } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
