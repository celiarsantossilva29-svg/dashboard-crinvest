// GET /api/goto/callback — troca o authorization code pelo access + refresh token

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    console.error("[GoTo Callback] Erro na autorização:", error);
    return NextResponse.redirect(
      new URL("/dashboard/configuracoes?goto=error", req.url)
    );
  }

  const clientId     = process.env.GOTO_CLIENT_ID!;
  const clientSecret = process.env.GOTO_CLIENT_SECRET!;
  const redirectUri  = process.env.GOTO_REDIRECT_URI ?? "http://localhost:3001/api/goto/callback";
  const credentials  = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const res = await fetch("https://authentication.logmeininc.com/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type:   "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[GoTo Callback] Falha ao trocar código:", res.status, text);
      return NextResponse.redirect(
        new URL("/dashboard/configuracoes?goto=error", req.url)
      );
    }

    const data = await res.json();
    const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);

    // Buscar accountKey via API de identidade
    let accountKey = process.env.GOTO_ACCOUNT_ID ?? null;
    try {
      const meRes = await fetch("https://api.goto.com/identity/v1/Users/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        accountKey = me.accountKey ?? me.account_key ?? accountKey;
      }
    } catch {
      // usa GOTO_ACCOUNT_ID como fallback
    }

    // Salva token no banco
    await prisma.goToToken.deleteMany();
    await prisma.goToToken.create({
      data: {
        accessToken:  data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        accountKey:   accountKey ? String(accountKey) : null,
      },
    });

    console.log("[GoTo Callback] Conectado com sucesso. AccountKey:", accountKey);
    return NextResponse.redirect(
      new URL("/dashboard/configuracoes?goto=success", req.url)
    );
  } catch (err: any) {
    console.error("[GoTo Callback] Erro interno:", err);
    return NextResponse.redirect(
      new URL("/dashboard/configuracoes?goto=error", req.url)
    );
  }
}
