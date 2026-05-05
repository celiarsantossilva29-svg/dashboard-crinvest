export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { installmentId, dataVencimento } = body;

    if (!installmentId || !dataVencimento) {
      return NextResponse.json({ error: "Missing installmentId or dataVencimento" }, { status: 400 });
    }

    // @ts-ignore
    const updated = await prisma.installment.update({
      where: { id: installmentId },
      data: {
        dataVencimento: new Date(dataVencimento)
      } as any
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error("API /validations/date error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
