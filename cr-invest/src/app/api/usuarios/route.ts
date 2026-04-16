import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const vendedores = await prisma.vendedor.findMany({
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        fixoMensal: true,
      }
    });

    // O Frontend V2 espera receber um Array direto
    return NextResponse.json(vendedores);
  } catch (error: any) {
    console.error("Erro ao carregar usuários:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
