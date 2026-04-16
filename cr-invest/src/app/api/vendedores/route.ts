export const dynamic = 'force-dynamic';

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

    // Se temos um ID, tentamos atualizar por ID para permitir trocar o e-mail
    if (id) {
      const updated = await prisma.vendedor.update({
        where: { id: String(id) },
        data: {
          nome,
          email,
          role,
          fixoMensal: Number(fixoMensal) || 0,
          installments: Number(installments) || 12,
          bronzeRate: Number(bronzeRate) || 0,
          silverRate: Number(silverRate) || 0,
          goldRate: Number(goldRate) || 0,
          silverMin: Number(silverMin) || 0,
          goldMin: Number(goldMin) || 0,
          permissions: typeof permissions === "string" ? permissions : JSON.stringify(permissions || {}),
          password: password || undefined
        }
      });
      return NextResponse.json({ data: updated });
    }

    // Se não temos ID, criamos um novo (ou upsert por email se preferir, mas create é mais seguro aqui)
    const newUser = await prisma.vendedor.create({
      data: {
        id: `user_${Math.random().toString(36).slice(2, 7)}`,
        nome,
        email,
        role,
        fixoMensal: Number(fixoMensal) || 0,
        installments: Number(installments) || 12,
        bronzeRate: Number(bronzeRate) || 0,
        silverRate: Number(silverRate) || 0,
        goldRate: Number(goldRate) || 0,
        silverMin: Number(silverMin) || 0,
        goldMin: Number(goldMin) || 0,
        permissions: typeof permissions === "string" ? permissions : JSON.stringify(permissions || {}),
        password: password || "mudar123"
      },
    });

    return NextResponse.json({ data: newUser });
  } catch (error: any) {
    console.error("Erro na API de vendedores:", error);
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
