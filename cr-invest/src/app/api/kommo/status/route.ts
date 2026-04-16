export const dynamic = 'force-dynamic';

// GET /api/kommo/status — retorna se o CRM está conectado e quando foi o último sync

import { NextResponse } from "next/server";
import { getKommoConnectionStatus } from "@/services/kommo";
import { USE_MOCK } from "@/lib/mock-data";

export async function GET() {
  if (USE_MOCK) {
    return NextResponse.json({
      data: { connected: false, expiresAt: null, lastSync: null, mock: true },
      error: null,
    });
  }

  try {
    const status = await getKommoConnectionStatus();
    return NextResponse.json({ data: { ...status, mock: false }, error: null });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, error: err?.message ?? "Erro ao verificar status" },
      { status: 500 }
    );
  }
}
