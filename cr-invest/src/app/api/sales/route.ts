export const dynamic = 'force-dynamic';

// GET /api/sales — list sales with installments
// POST /api/sales — create a Sale

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { USE_MOCK, getMockSales, getMockInstallments } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const updatedAt = new Date().toISOString();

  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const closerParam = searchParams.get("closer");
    const noDateFilter = searchParams.get("noDateFilter") === "true";

    const now = new Date();
    const startDate = start
      ? new Date(start + "T00:00:00.000Z")
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const endDate = end
      ? new Date(end + "T23:59:59.999Z")
      : new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));

    if (USE_MOCK) {
      const allInstallments = getMockInstallments();
      let mockSales = getMockSales();
      if (!noDateFilter) mockSales = mockSales.filter(s => s.closedAt >= startDate && s.closedAt <= endDate);
      if (closerParam) mockSales = mockSales.filter(s => s.assignedTo.toLowerCase() === closerParam.toLowerCase());
      const sales = mockSales
        .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime())
        .map((s) => ({
          ...s,
          installments: allInstallments
            .filter((i) => i.saleId === s.id)
            .sort((a, b) => a.parcelaNumero - b.parcelaNumero),
        }));
      return NextResponse.json({ data: sales, updatedAt, error: null });
    }

    const where: Record<string, any> = {};
    if (!noDateFilter) where.closedAt = { gte: startDate, lte: endDate };
    if (closerParam) where.assignedTo = { equals: closerParam, mode: "insensitive" };

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { closedAt: "desc" },
      include: {
        installments: { orderBy: { parcelaNumero: "asc" } },
      },
    });

    return NextResponse.json({ data: sales, updatedAt, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const updatedAt = new Date().toISOString();

  try {
    const body = await req.json();
    const {
      value, closedAt, clientName, assignedTo,
      campaignId, notes, leadId, sdrName, administradora, clienteCpf,
      origem, closerExterno, percentualExterno, numInstallments
    } = body;

    if (!value || !closedAt || !clientName || !assignedTo) {
      return NextResponse.json(
        {
          data: null,
          updatedAt,
          error: "Campos obrigatórios: value, closedAt, clientName, assignedTo",
        },
        { status: 400 }
      );
    }

    if (USE_MOCK) {
      const mockSale = {
        id: `mock-${Date.now()}`,
        leadId: leadId ?? null,
        value: Number(value),
        closedAt: new Date(closedAt),
        clientName: String(clientName),
        assignedTo: String(assignedTo),
        sdrName: null,
        campaignId: campaignId ?? null,
        notes: notes ?? null,
        administradora: null,
        tierCloser: null,
        percentualCloser: null,
        valorComissaoCloser: null,
        percentualSdr: null,
        valorComissaoSdr: null,
        clienteCpf: null,
        createdAt: new Date(),
        installments: [],
      };
      return NextResponse.json({ data: mockSale, updatedAt, error: null }, { status: 201 });
    }

    const saleClosedAt = new Date(closedAt);
    const nParcelas = numInstallments ? Number(numInstallments) : (() => {
      const m = String(notes ?? "").match(/Parcelas comiss[aã]o:\s*(\d+)/i);
      return m ? parseInt(m[1]) : 12;
    })();
    const valorParcela = parseFloat((Number(value) / nParcelas).toFixed(2));

    // UTC-safe: always 1st of target month to avoid day-overflow (e.g. Jan31+1≠Mar3)
    const addMonths = (d: Date, n: number): Date => {
      const m = d.getUTCMonth() + n;
      return new Date(Date.UTC(
        d.getUTCFullYear() + Math.floor(m / 12),
        ((m % 12) + 12) % 12,
        1
      ));
    };

    // Porto comission schedule:
    // day ≤ 22 → P1 in next month (baseOffset=1); day > 22 → P1 in month+2 (baseOffset=2)
    // day > 14 → skip one month after P1 (assembly rule, skipOffset=1)
    const day = saleClosedAt.getUTCDate();
    const isPorto = !String(administradora ?? "").toLowerCase().includes("embracon");
    const baseOffset = isPorto && day > 22 ? 2 : 1;
    const skipOffset = isPorto && day > 14 ? 1 : 0;

    const sale = await prisma.sale.create({
      data: {
        value: Number(value),
        closedAt: saleClosedAt,
        clientName: String(clientName),
        assignedTo: String(assignedTo),
        sdrName: sdrName && sdrName !== "Prospecção direta (Sem SDR)" ? String(sdrName) : null,
        administradora: administradora ? String(administradora) : null,
        clienteCpf: clienteCpf ? String(clienteCpf) : null,
        campaignId: campaignId ?? null,
        notes: notes ?? null,
        leadId: leadId ?? null,
        origem: origem ?? null,
        closerExterno: closerExterno ?? null,
        percentualExterno: percentualExterno ? Number(percentualExterno) : null,
        installments: {
          create: Array.from({ length: nParcelas }, (_, i) => ({
            parcelaNumero: i + 1,
            dataVencimento: addMonths(saleClosedAt, i === 0 ? baseOffset : baseOffset + i + skipOffset),
            valorParcela,
            pago: false,
            status: "PENDENTE",
            dataPagamento: null,
          })),
        },
      },
      include: { installments: { orderBy: { parcelaNumero: "asc" } } },
    });

    return NextResponse.json({ data: sale, updatedAt, error: null }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const updatedAt = new Date().toISOString();

  try {
    const body = await req.json();
    const {
      id, value, closedAt, clientName, assignedTo,
      campaignId, notes, sdrName, administradora, clienteCpf,
      origem, closerExterno, percentualExterno
    } = body;

    if (!id || !value || !closedAt || !clientName || !assignedTo) {
      return NextResponse.json(
        { data: null, updatedAt, error: "Campos obrigatórios: id, value, closedAt, clientName, assignedTo" },
        { status: 400 }
      );
    }

    if (USE_MOCK) {
      return NextResponse.json({ data: { id }, updatedAt, error: null }, { status: 200 });
    }

    const sale = await prisma.sale.update({
      where: { id: String(id) },
      data: {
        value: Number(value),
        closedAt: new Date(closedAt),
        clientName: String(clientName),
        assignedTo: String(assignedTo),
        sdrName: sdrName && sdrName !== "Prospecção direta (Sem SDR)" ? String(sdrName) : null,
        administradora: administradora ? String(administradora) : null,
        clienteCpf: clienteCpf ? String(clienteCpf) : null,
        campaignId: campaignId ?? null,
        notes: notes ?? null,
        origem: origem ?? null,
        closerExterno: closerExterno ?? null,
        percentualExterno: percentualExterno ? Number(percentualExterno) : null,
      },
      include: { installments: true },
    });

    return NextResponse.json({ data: sale, updatedAt, error: null }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

