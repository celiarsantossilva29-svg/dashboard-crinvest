export const dynamic = 'force-dynamic';

// GET /api/kommo/auth — redirects to Kommo OAuth consent screen

import { NextRequest, NextResponse } from "next/server";
import { getKommoAuthUrl } from "@/services/kommo";

export async function GET(_req: NextRequest) {
  try {
    const url = getKommoAuthUrl();
    return NextResponse.redirect(url);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to build Kommo auth URL" },
      { status: 500 }
    );
  }
}
