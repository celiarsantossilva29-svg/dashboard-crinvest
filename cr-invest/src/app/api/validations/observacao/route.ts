export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { installmentId, observacoes, novaDataVencimento } = body;

    if (!installmentId) {
      return NextResponse.json({ error: "Missing installmentId" }, { status: 400 });
    }

    const data: any = { observacoes: observacoes ?? null };
    if (novaDataVencimento) {
      data.dataVencimento = new Date(novaDataVencimento + "T12:00:00Z");
    }

    const updated = await prisma.installment.update({
      where: { id: installmentId },
      data,
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error("API /validations/observacao error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
