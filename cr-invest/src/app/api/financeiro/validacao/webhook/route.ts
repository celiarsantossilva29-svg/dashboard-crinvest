import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { venda_id, validacao } = body;

    if (!venda_id || !validacao?.status) {
      return NextResponse.json({ success: false, error: "Payload inválido" }, { status: 400 });
    }

    const sale = await prisma.sale.findFirst({ where: { id: venda_id } });
    if (!sale) {
      return NextResponse.json({ success: false, error: "Venda não encontrada" }, { status: 404 });
    }

    const status = validacao.status === "aprovado" ? "validado" : "reprovado";

    const updated = await db.sale.update({
      where: { id: venda_id },
      data: {
        statusValidacao: status,
        tentativasValidacao: validacao.tentativas ?? 0,
        dataValidacao: validacao.data_validacao ? new Date(validacao.data_validacao) : new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      venda: {
        id: updated.id,
        status_validacao: updated.statusValidacao,
        comissao_liberada: status === "validado",
      },
    });
  } catch (err) {
    console.error("Webhook validação erro:", err);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}

// Endpoint manual para admin validar/reprovar diretamente
export async function PATCH(req: Request) {
  const body = await req.json();
  const { saleId, status } = body;

  if (!saleId || !status) {
    return NextResponse.json({ error: "saleId e status são obrigatórios" }, { status: 400 });
  }

  const updated = await db.sale.update({
    where: { id: saleId },
    data: {
      statusValidacao: status,
      dataValidacao: status !== "aguardando" ? new Date() : null,
    },
  });

  return NextResponse.json({ data: updated });
}
