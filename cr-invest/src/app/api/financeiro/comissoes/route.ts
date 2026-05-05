import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes"); // YYYY-MM (legacy)
  const startParam = searchParams.get("startDate");
  const endParam = searchParams.get("endDate");

  let startDate: Date;
  let endDate: Date;

  if (startParam && endParam) {
    // New range mode: De [data] até [data]
    startDate = new Date(startParam + "T00:00:00");
    endDate = new Date(endParam + "T23:59:59");
  } else if (mes) {
    const [y, m] = mes.split("-").map(Number);
    startDate = new Date(y, m - 1, 1);
    endDate = new Date(y, m, 0, 23, 59, 59);
  } else {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  const sales: any[] = await db.sale.findMany({
    where: { closedAt: { gte: startDate, lte: endDate } },
    include: {
      installments: {
        orderBy: { parcelaNumero: "asc" },
      },
    },
    orderBy: { closedAt: "desc" },
  });

  // Mapear statusValidacao (pode não existir ainda no DB)
  const salesMapped = sales.map((s: any) => ({
    id: s.id,
    clientName: s.clientName,
    value: s.value,
    closedAt: s.closedAt,
    assignedTo: s.assignedTo,
    sdrName: s.sdrName,
    administradora: s.administradora,
    statusValidacao: s.statusValidacao ?? "aguardando",
    valorComissaoCloser: s.valorComissaoCloser ?? 0,
    valorComissaoSdr: s.valorComissaoSdr ?? 0,
    percentualCloser: s.percentualCloser ?? 0,
    percentualSdr: s.percentualSdr ?? 0,
    installments: s.installments ?? [],
  }));

  return NextResponse.json({ data: { sales: salesMapped } });
}
