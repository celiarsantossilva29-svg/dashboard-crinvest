export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const whereDate = start && end ? {
      closedAt: {
        gte: new Date(start + "T00:00:00-03:00"),
        lte: new Date(end + "T23:59:59-03:00"),
      }
    } : {};

    const allSales = await prisma.sale.findMany({
      where: { ...whereDate },
      include: {
        installments: {
          orderBy: { parcelaNumero: 'asc' }
        }
      },
      orderBy: { closedAt: 'desc' },
    });

    // Oculta vendas encerradas: 100% canceladas, 100% pagas, ou 100% finalizadas (legado 2023/2024)
    const sales = allSales.filter(s => {
      if (s.installments.length === 0) return true;
      if (s.installments.every(i => i.status === "CANCELADO")) return false;
      if (s.installments.every(i => i.status === "FINALIZADO")) return false;
      if (s.installments.every(i => i.pago || i.status === "PAGO")) return false;
      return true;
    });

    return NextResponse.json({ data: sales });
  } catch (error: any) {
    console.error("API /validations error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
