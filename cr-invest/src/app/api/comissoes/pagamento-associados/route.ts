import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes") ?? new Date().toISOString().substring(0, 7);
  const [year, month] = mes.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  const [installments, vendedores] = await Promise.all([
    prisma.installment.findMany({
      where: {
        dataVencimento: { gte: from, lt: to },
        status: { notIn: ["CANCELADO"] },
        sale: { statusValidacao: { in: ["validado", "aguardando"] } },
      },
      include: {
        sale: {
          select: {
            id: true,
            clientName: true,
            clienteCpf: true,
            assignedTo: true,
            sdrName: true,
            administradora: true,
            value: true,
            valorComissaoCloser: true,
            valorComissaoSdr: true,
            comissaoPorParcela: true,
            quantidadeParcelas: true,
          },
        },
      },
      orderBy: { dataVencimento: "asc" },
    }),
    prisma.vendedor.findMany(),
  ]);

  // Build rules lookup for SDR commission calculation
  const rulesMap: Record<string, any> = {};
  vendedores.forEach(v => { rulesMap[v.nome.toLowerCase()] = v; });

  function findRule(name: string | null | undefined) {
    if (!name) return null;
    const n = name.toLowerCase();
    const key = Object.keys(rulesMap).find(k => k.startsWith(n) || n.startsWith(k.split(" ")[0]));
    return key ? rulesMap[key] : null;
  }

  type AssocEntry = {
    nome: string;
    tipo: "CLOSER" | "SDR";
    pago: number;
    pendente: number;
    perdido: number;
    clientes: {
      saleId: string;
      clientName: string;
      administradora: string | null;
      parcelaNumero: number;
      totalParcelas: number;
      valorComissao: number;
      status: string;
      dataVencimento: string;
    }[];
  };

  const map: Record<string, AssocEntry> = {};

  const upsert = (key: string, nome: string, tipo: "CLOSER" | "SDR"): AssocEntry => {
    if (!map[key]) map[key] = { nome, tipo, pago: 0, pendente: 0, perdido: 0, clientes: [] };
    return map[key];
  };

  const sdrDone = new Set<string>();

  for (const inst of installments) {
    const sale = inst.sale;
    const status = inst.status || (inst.pago ? "PAGO" : "PENDENTE");
    const totalParcelas = sale.quantidadeParcelas || 12;

    // Closer commission per installment
    const closerComm =
      sale.comissaoPorParcela && sale.comissaoPorParcela > 0
        ? sale.comissaoPorParcela
        : sale.valorComissaoCloser && sale.valorComissaoCloser > 0
          ? sale.valorComissaoCloser / totalParcelas
          : 0;

    if (sale.assignedTo && closerComm > 0) {
      const a = upsert(`CLOSER:${sale.assignedTo}`, sale.assignedTo, "CLOSER");
      a.clientes.push({
        saleId: sale.id,
        clientName: sale.clientName,
        administradora: sale.administradora,
        parcelaNumero: inst.parcelaNumero,
        totalParcelas,
        valorComissao: closerComm,
        status,
        dataVencimento: inst.dataVencimento.toISOString(),
      });
      if (status === "PAGO") a.pago += closerComm;
      else if (status === "INADIMPLENTE") a.perdido += closerComm;
      else a.pendente += closerComm;
    }

    // SDR commission:
    // - If comissaoPorParcela > 0 AND valorComissaoSdr > 0: per-installment (co-closer style)
    // - Otherwise: one-time on P1 only
    if (sale.sdrName) {
      const isPerInstallment = (sale.comissaoPorParcela ?? 0) > 0 && (sale.valorComissaoSdr ?? 0) > 0;

      if (isPerInstallment) {
        const sdrComm = sale.valorComissaoSdr!;
        const a = upsert(`SDR:${sale.sdrName}`, sale.sdrName, "SDR");
        a.clientes.push({
          saleId: sale.id,
          clientName: sale.clientName,
          administradora: sale.administradora,
          parcelaNumero: inst.parcelaNumero,
          totalParcelas,
          valorComissao: sdrComm,
          status,
          dataVencimento: inst.dataVencimento.toISOString(),
        });
        if (status === "PAGO") a.pago += sdrComm;
        else if (status === "INADIMPLENTE") a.perdido += sdrComm;
        else a.pendente += sdrComm;
      } else if (inst.parcelaNumero === 1 && !sdrDone.has(sale.id)) {
        sdrDone.add(sale.id);

        // Use stored total; if null/0, calculate from vendedor rule
        let sdrComm = sale.valorComissaoSdr ?? 0;
        if (sdrComm <= 0) {
          const rule = findRule(sale.sdrName);
          if (rule?.bronzeRate > 0) sdrComm = sale.value * (rule.bronzeRate / 100);
        }

        if (sdrComm > 0) {
          const a = upsert(`SDR:${sale.sdrName}`, sale.sdrName, "SDR");
          a.clientes.push({
            saleId: sale.id,
            clientName: sale.clientName,
            administradora: sale.administradora,
            parcelaNumero: 1,
            totalParcelas,
            valorComissao: sdrComm,
            status,
            dataVencimento: inst.dataVencimento.toISOString(),
          });
          if (status === "PAGO") a.pago += sdrComm;
          else if (status === "INADIMPLENTE") a.perdido += sdrComm;
          else a.pendente += sdrComm;
        }
      }
    }
  }

  const data = Object.values(map).sort((a, b) => (b.pago + b.pendente) - (a.pago + a.pendente));
  const totalAPagar = data.reduce((s, a) => s + a.pago, 0);
  const totalPendente = data.reduce((s, a) => s + a.pendente, 0);

  return NextResponse.json({ data, totalAPagar, totalPendente, mes });
}
