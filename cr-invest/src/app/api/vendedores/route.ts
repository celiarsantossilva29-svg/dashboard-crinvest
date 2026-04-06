import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const vendedores = await prisma.vendedor.findMany({
      orderBy: { nome: "asc" },
    });
    return NextResponse.json({ data: vendedores });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      id, nome, email, role, fixoMensal, installments,
      bronzeRate, silverRate, goldRate, silverMin, goldMin,
      permissions, password 
    } = body;

    const vendedor = await (prisma.vendedor as any).upsert({
      where: { email },
      update: { 
        nome, 
        role, 
        fixoMensal: Number(fixoMensal),
        installments: Number(installments),
        bronzeRate: Number(bronzeRate),
        silverRate: Number(silverRate),
        goldRate: Number(goldRate),
        silverMin: Number(silverMin),
        goldMin: Number(goldMin),
        permissions: typeof permissions === "string" ? permissions : JSON.stringify(permissions || {}),
        password: password || undefined
      },
      create: {
        id: id || `user_${Math.random().toString(36).slice(2, 7)}`,
        nome,
        email,
        role,
        fixoMensal: Number(fixoMensal),
        installments: Number(installments),
        bronzeRate: Number(bronzeRate),
        silverRate: Number(silverRate),
        goldRate: Number(goldRate),
        silverMin: Number(silverMin),
        goldMin: Number(goldMin),
        permissions: typeof permissions === "string" ? permissions : JSON.stringify(permissions || {}),
        password: password || "mudar123"
      },
    });

    return NextResponse.json({ data: vendedor });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) throw new Error("ID não fornecido");

    await prisma.vendedor.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
