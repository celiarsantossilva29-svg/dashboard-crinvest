export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { syncKommoData, syncLeadHistory } from '@/services/kommo';
import { syncGoToData } from '@/services/goto';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log("== 1. Syncing Kommo Leads ==");
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    await syncKommoData({ since: start });
    console.log("Kommo Leads Synced.");

    console.log("== 2. Syncing Kommo Event Histories ==");
    const activeLeads = await prisma.lead.findMany({
      where: { status: { notIn: ["won", "lost"] } }
    });
    for (const lead of activeLeads) {
        await syncLeadHistory(lead.id);
        await new Promise(r => setTimeout(r, 200));
    }
    console.log("History Synced.");

    console.log("== 3. Syncing GoTo Calls ==");
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    await syncGoToData(start, end);
    console.log("GoTo Synced.");

    return NextResponse.json({ success: true, message: "Sync executado com sucesso e logs contabilizados" });
  } catch (error) {
    console.error("ERRO NO SYNC", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
