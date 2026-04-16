import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      cliente_nome,
      cliente_cpf,
      valor_venda,
      data_fechamento,
      administradora,
      promocao,
      sdr_id,
      closer_id,
      cliente_telefone,
      cliente_cnpj,
      cliente_localizacao
    } = body;

    if (!valor_venda || !data_fechamento || !cliente_nome || !closer_id) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes" },
        { status: 400 }
      );
    }

    // Buscando o Vendedor (Closer) do banco de dados
    const closer = await prisma.vendedor.findUnique({ where: { id: closer_id } });
    if (!closer) {
      return NextResponse.json({ error: "Closer não encontrado" }, { status: 400 });
    }

    // Buscando o SDR (se selecionado)
    let sdr = null;
    if (sdr_id) {
      sdr = await prisma.vendedor.findUnique({ where: { id: sdr_id } });
    }

    // Cálculos legados simples para salvar métricas aproximadas
    const percentualCloser = closer.bronzeRate || 0.005; // default 0.5%
    const valorComissaoCloser = (Number(valor_venda) * percentualCloser);
    
    let percentualSdr = 0;
    let valorComissaoSdr = 0;
    if (sdr) {
      percentualSdr = 0.0007; // 0.07% baseline SDR
      valorComissaoSdr = (Number(valor_venda) * percentualSdr);
    }

    // Geração de 12 Parcelas futuras fixadas no dia 14
    const numInstallments = 12;
    const installmentValue = Number(valor_venda) / numInstallments;
    const installmentsData = [];
    const dtFechamento = new Date(data_fechamento);

    for (let i = 1; i <= numInstallments; i++) {
      const dataVenc = new Date(dtFechamento);
      dataVenc.setMonth(dataVenc.getMonth() + i);
      dataVenc.setDate(14); // Padrão dia 14
      
      installmentsData.push({
        parcelaNumero: i,
        dataVencimento: dataVenc,
        valorParcela: parseFloat(installmentValue.toFixed(2)),
        pago: false,
        status: "PENDENTE"
      });
    }

    const sale = await prisma.sale.create({
      data: {
        clientName: cliente_nome,
        clienteCpf: cliente_cpf || null,
        value: Number(valor_venda),
        closedAt: dtFechamento,
        administradora: administradora || null,
        assignedTo: closer.nome, // O Legacy DB e os KPIs agrupam por nome
        sdrName: sdr ? sdr.nome : null,
        notes: promocao ? "Promoção aplicada" : null,
        tierCloser: "Bronze",
        percentualCloser,
        valorComissaoCloser,
        percentualSdr: sdr ? percentualSdr : null,
        valorComissaoSdr: sdr ? valorComissaoSdr : null,
        // Criando as parcelas vinculadas na mesma transação
        installments: {
          create: installmentsData
        }
      },
      include: {
        installments: true
      }
    });

    return NextResponse.json({ data: sale, success: true }, { status: 201 });
  } catch (err: any) {
    console.error("Erro no POST /api/vendas:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
