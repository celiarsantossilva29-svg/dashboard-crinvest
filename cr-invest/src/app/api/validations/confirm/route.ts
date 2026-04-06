import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { installmentId } = body;

    if (!installmentId) {
      return NextResponse.json({ error: "Missing installmentId" }, { status: 400 });
    }

    // Primeiro encontramos a parcela
    const installment = await prisma.installment.findUnique({
      where: { id: installmentId },
    });

    if (!installment) {
      return NextResponse.json({ error: "Installment not found" }, { status: 404 });
    }

    if (installment.pago) {
      return NextResponse.json({ error: "Installment is already paid" }, { status: 400 });
    }

    // Atualiza para pago
    const updated = await prisma.installment.update({
      where: { id: installmentId },
      data: {
        pago: true,
        dataPagamento: new Date(),
      }
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error("API /validations/confirm error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
