export const dynamic = 'force-dynamic';

// GET /api/auth/kommo/callback — OAuth 2.0 callback handler

import { NextRequest, NextResponse } from "next/server";
import { exchangeKommoCode } from "@/services/kommo";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/usuarios?kommo=error&reason=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard/usuarios?kommo=error&reason=missing_code", req.url)
    );
  }

  try {
    await exchangeKommoCode(code);
    return NextResponse.redirect(new URL("/dashboard/usuarios?kommo=success", req.url));
  } catch (err: any) {
    const msg = encodeURIComponent(err?.message ?? "Unknown error");
    return NextResponse.redirect(
      new URL(`/dashboard/usuarios?kommo=error&reason=${msg}`, req.url)
    );
  }
}
