export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { USE_MOCK, getMockInstallments, getMockSales } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  try {
    if (USE_MOCK) {
       const installments = getMockInstallments();
       const sales = getMockSales();
       const formatted = installments.map(i => {
           const sale = sales.find(s => s.id === i.saleId) || sales[0];
           return {
               id: i.id,
               venda_id: i.saleId,
               parcela_numero: i.parcelaNumero,
               valor_parcela: i.valorParcela,
               data_vencimento: i.dataVencimento.toISOString().split('T')[0],
               pago: i.pago,
               data_pagamento: null,
               cliente_nome: sale.clientName,
               administradora: sale.administradora || "N/D",
               data_fechamento: sale.closedAt.toISOString().split('T')[0],
               closer_nome: sale.assignedTo,
               valor_venda: sale.value,
               valor_comissao_total_closer: sale.valorComissaoCloser || 0,
               valor_parcela_comissao: (sale.valorComissaoCloser || 0) / 12
           };
       });
       return NextResponse.json(formatted);
    }

    // Busca parcelas agrupadas por venda (pendentes e pagas)
    // Para simplificar, buscamos TODAS as parcelas e juntamos os dados da Venda.
    const installments = await prisma.installment.findMany({
      include: {
        sale: {
          select: {
             id: true,
             clientName: true,
             assignedTo: true,
             administradora: true,
             closedAt: true,
             value: true,
             valorComissaoCloser: true,
          }
        }
      },
      orderBy: [
        { dataVencimento: 'asc' },
        { parcelaNumero: 'asc' }
      ]
    });

    const formatted = installments.map(i => ({
       id: i.id,
       venda_id: i.saleId,
       parcela_numero: i.parcelaNumero,
       valor_parcela: i.valorParcela,
       data_vencimento: i.dataVencimento.toISOString().split('T')[0],
       pago: i.pago,
       data_pagamento: i.dataPagamento ? i.dataPagamento.toISOString().split('T')[0] : null,
       
       // Informações da venda embutidas (igual antigo BD local)
       cliente_nome: i.sale.clientName,
       administradora: i.sale.administradora || "N/D",
       data_fechamento: i.sale.closedAt.toISOString().split('T')[0],
       closer_nome: i.sale.assignedTo,
       valor_venda: i.sale.value,
       valor_comissao_total_closer: i.sale.valorComissaoCloser || 0,
       valor_parcela_comissao: (i.sale.valorComissaoCloser || 0) / 12 // Assume 12x linear
    }));

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error("Erro /api/installments:", err);
    return NextResponse.json({ error: "Erro ao buscar parcelas", details: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id || action !== "skip-month") {
      return NextResponse.json({ error: "id e action='skip-month' obrigatórios" }, { status: 400 });
    }

    if (USE_MOCK) {
      return NextResponse.json({ success: true, mocked: true });
    }

    const inst = await prisma.installment.findUnique({ where: { id } });
    if (!inst) return NextResponse.json({ error: "Parcela não encontrada" }, { status: 404 });

    const cur = inst.dataVencimento;
    const m = cur.getUTCMonth() + 1;
    const newDate = new Date(Date.UTC(
      cur.getUTCFullYear() + Math.floor(m / 12),
      ((m % 12) + 12) % 12,
      1
    ));

    const updated = await prisma.installment.update({
      where: { id },
      data: { dataVencimento: newDate },
    });

    return NextResponse.json({ data: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
     const body = await req.json();
     const { id, pago, data_pagamento } = body;
     
     if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

     if (USE_MOCK) {
        return NextResponse.json({ success: true, mocked: true });
     }

     const updated = await prisma.installment.update({
        where: { id },
        data: {
           pago: Boolean(pago),
           dataPagamento: pago && data_pagamento ? new Date(data_pagamento) : null
        }
     });

     return NextResponse.json(updated);
  } catch (err: any) {
     return NextResponse.json({ error: "Erro na atualização", details: err.message }, { status: 500 });
  }
}
