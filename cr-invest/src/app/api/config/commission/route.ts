export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const config = await prisma.commissionConfig.findUnique({
      where: { id: "global" },
    });

    if (!config) {
      // Cria a configuração inicial se não existir
      const newConfig = await prisma.commissionConfig.create({
        data: { id: "global" },
      });
      return NextResponse.json({ data: newConfig });
    }

    return NextResponse.json({ data: config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fixedSalary, percentage, installments } = body;

    const config = await prisma.commissionConfig.upsert({
      where: { id: "global" },
      update: {
        fixedSalary: Number(fixedSalary),
        percentage: Number(percentage),
        installments: Number(installments),
      },
      create: {
        id: "global",
        fixedSalary: Number(fixedSalary),
        percentage: Number(percentage),
        installments: Number(installments),
      },
    });

    return NextResponse.json({ data: config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
