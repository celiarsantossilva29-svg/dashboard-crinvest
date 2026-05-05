import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { cpfs, mes } = await req.json() as { cpfs: string[]; mes: string };

  if (!cpfs?.length || !mes) {
    return NextResponse.json({ error: "cpfs e mes são obrigatórios" }, { status: 400 });
  }

  const normalizedCpfs = new Set(cpfs.map((c: string) => c.replace(/\D/g, "")));

  const [year, month] = mes.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  const installments = await prisma.installment.findMany({
    where: {
      dataVencimento: { gte: from, lt: to },
      status: { notIn: ["CANCELADO", "PAGO"] },
      pago: false,
    },
    include: {
      sale: { select: { clienteCpf: true, clientName: true } },
    },
  });

  const toUpdate = installments.filter(i => {
    const cpf = (i.sale.clienteCpf || "").replace(/\D/g, "");
    return cpf.length >= 11 && normalizedCpfs.has(cpf);
  });

  if (toUpdate.length === 0) {
    return NextResponse.json({ updated: 0, clients: [] });
  }

  await prisma.installment.updateMany({
    where: { id: { in: toUpdate.map(i => i.id) } },
    data: { status: "PAGO", pago: true, dataPagamento: new Date() },
  });

  const clients = Array.from(new Set(toUpdate.map(i => i.sale.clientName)));
  return NextResponse.json({ updated: toUpdate.length, clients });
}
