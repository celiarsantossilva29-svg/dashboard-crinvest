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

    const now = new Date();
    const startDate = start
      ? new Date(start + "T00:00:00-03:00")
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = end
      ? new Date(end + "T23:59:59-03:00")
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    if (USE_MOCK) {
      const allInstallments = getMockInstallments();
      const sales = getMockSales()
        .filter((s) => s.closedAt >= startDate && s.closedAt <= endDate)
        .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime())
        .map((s) => ({
          ...s,
          installments: allInstallments
            .filter((i) => i.saleId === s.id)
            .sort((a, b) => a.parcelaNumero - b.parcelaNumero),
        }));
      return NextResponse.json({ data: sales, updatedAt, error: null });
    }

    const sales = await prisma.sale.findMany({
      where: { closedAt: { gte: startDate, lte: endDate } },
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
      campaignId, notes, leadId, sdrName, administradora, clienteCpf 
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

    const sale = await prisma.sale.create({
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
        leadId: leadId ?? null,
      },
      include: { installments: true },
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
      campaignId, notes, sdrName, administradora, clienteCpf 
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

