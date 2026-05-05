import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET() {
  const hoje = new Date();
  const d5ago = new Date(hoje); d5ago.setDate(d5ago.getDate() - 5);

  // Parcelas vencidas e não pagas
  const parcelasAtrasadas: any[] = await db.installment.findMany({
    where: {
      dataVencimento: { lt: hoje },
      status: { in: ["PENDENTE", "INADIMPLENTE"] },
    },
    include: {
      sale: { select: { id: true, clientName: true, assignedTo: true, clienteTelefone: true, value: true } },
    },
    orderBy: { dataVencimento: "asc" },
  });

  // Marcar inadimplentes automaticamente (vencida há 5+ dias)
  const atualizarAtrasados = parcelasAtrasadas
    .filter(p => p.status === "PENDENTE" && new Date(p.dataVencimento) < d5ago)
    .map(p => prisma.installment.update({ where: { id: p.id }, data: { status: "INADIMPLENTE" } }));

  if (atualizarAtrasados.length > 0) {
    await Promise.allSettled(atualizarAtrasados);
  }

  // Totais para taxa de inadimplência
  const totalVencidas = await prisma.installment.count({
    where: { dataVencimento: { lt: hoje } },
  });
  const totalNaoPagas = await prisma.installment.count({
    where: { dataVencimento: { lt: hoje }, status: { in: ["PENDENTE", "INADIMPLENTE"] } },
  });

  const taxa = totalVencidas > 0 ? Math.round((totalNaoPagas / totalVencidas) * 100) : 0;

  // Contatos de cobrança registrados
  let contatos: any[] = [];
  try {
    contatos = await db.contatoCobranca.findMany({
      orderBy: { dataContato: "desc" },
      take: 200,
    });
  } catch {
    // tabela pode não existir ainda
  }

  // Agrupar por cliente (sale)
  const clienteMap = new Map<string, any>();

  for (const p of parcelasAtrasadas) {
    const key = p.sale.id;
    const dias = Math.floor((hoje.getTime() - new Date(p.dataVencimento).getTime()) / (1000 * 60 * 60 * 24));
    if (!clienteMap.has(key)) {
      clienteMap.set(key, {
        saleId: p.sale.id,
        clientName: p.sale.clientName,
        assignedTo: p.sale.assignedTo,
        telefone: p.sale.clienteTelefone ?? undefined,
        parcelas: [],
        diasMaiorAtraso: 0,
        totalAtrasado: 0,
        contatos: contatos.filter((c: any) => c.saleId === key),
      });
    }
    const item = clienteMap.get(key)!;
    item.parcelas.push(p);
    item.totalAtrasado += p.valorParcela;
    if (dias > item.diasMaiorAtraso) item.diasMaiorAtraso = dias;
  }

  return NextResponse.json({
    data: {
      taxa,
      totalVencidas,
      totalNaoPagas,
      clientes: Array.from(clienteMap.values()),
      valorTotalAtrasado: parcelasAtrasadas.reduce((s: number, p: any) => s + p.valorParcela, 0),
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { saleId, clientName, tipoContato, resultado, proximaAcao, dataProximaAcao, observacoes, responsavel } = body;

  const contato = await db.contatoCobranca.create({
    data: {
      saleId,
      clientName,
      dataContato: new Date(),
      tipoContato,
      resultado,
      proximaAcao,
      dataProximaAcao: dataProximaAcao ? new Date(dataProximaAcao) : null,
      observacoes,
      responsavel,
    },
  });

  return NextResponse.json({ data: contato });
}
