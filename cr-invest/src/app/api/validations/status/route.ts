import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { installmentId, status } = body;

    if (!installmentId || !status) {
      return NextResponse.json({ error: "Missing installmentId or status" }, { status: 400 });
    }

    const validStatuses = ["PENDENTE", "PAGO", "INADIMPLENTE", "CANCELADO"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invaild status" }, { status: 400 });
    }

    // @ts-ignore - ignorando erro EPERM do prisma generate
    const updated = await prisma.installment.update({
      where: { id: installmentId },
      data: {
        status: status,
        pago: status === "PAGO",
        dataPagamento: status === "PAGO" ? new Date() : null,
      } as any
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error("API /validations/status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
