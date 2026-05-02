import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { mes } = await req.json() as { mes: string };
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json({ error: "mes deve ser YYYY-MM" }, { status: 400 });
    }

    const [year, month] = mes.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const result = await prisma.installment.updateMany({
      where: {
        dataVencimento: { gte: start, lte: end },
        pago: false,
        status: "PENDENTE",
      },
      data: {
        pago: true,
        status: "PAGO",
        dataPagamento: new Date(),
        dataConfirmacao: new Date(),
      },
    });

    const skipped = await prisma.installment.count({
      where: {
        dataVencimento: { gte: start, lte: end },
        status: { in: ["INADIMPLENTE", "CANCELADO"] },
      },
    });

    const total = await prisma.installment.count({
      where: { dataVencimento: { gte: start, lte: end } },
    });

    return NextResponse.json({ confirmed: result.count, skipped, total });
  } catch (e) {
    console.error("embracon/confirmar-mes:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
