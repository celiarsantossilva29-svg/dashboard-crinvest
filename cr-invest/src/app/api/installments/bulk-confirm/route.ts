import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { startDate, endDate } = await req.json();
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);

  // Only update PENDENTE installments — INADIMPLENTE and CANCELADO are never touched
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
    },
  });

  const skipped = await prisma.installment.count({
    where: {
      dataVencimento: { gte: start, lte: end },
      status: { in: ["INADIMPLENTE", "CANCELADO"] },
    },
  });

  return NextResponse.json({ data: { confirmed: result.count, skipped } });
}
