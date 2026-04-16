// GET /api/goto/auth — inicia o fluxo OAuth2 Authorization Code do GoTo Connect

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.GOTO_CLIENT_ID;
  const redirectUri = process.env.GOTO_REDIRECT_URI ?? "http://localhost:3001/api/goto/callback";

  if (!clientId) {
    return NextResponse.json({ error: "GOTO_CLIENT_ID não configurado" }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
  });

  const authUrl = `https://authentication.logmeininc.com/oauth/authorize?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
