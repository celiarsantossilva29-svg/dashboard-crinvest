export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    // Para a tela de "Validação de Venda", o padrão deve trazer Vendas com suas parcelas.
    // Pode-se filtrar os clients que possuem parcelas, ou todos que tenham installments.
    
    // We bring all sales that have at least one installment, making it possible to show the validation board
    const sales = await prisma.sale.findMany({
      where: {
        installments: {
          some: {} // traz apenas quem tem parcelas
        }
      },
      include: {
        installments: {
          orderBy: { parcelaNumero: 'asc' }
        }
      },
      orderBy: { closedAt: 'desc' },
    });

    return NextResponse.json({ data: sales });
  } catch (error: any) {
    console.error("API /validations error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
