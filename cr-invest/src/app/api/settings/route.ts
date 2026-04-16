export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (!key) return NextResponse.json({ error: "Key required" }, { status: 400 });

    const setting = await prisma.appSetting.findUnique({
      where: { key }
    });
    return NextResponse.json({ data: setting?.value ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { key, value } = await req.json();
    if (!key || typeof value !== 'string') {
       return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const updated = await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
