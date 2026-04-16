// GET /api/kpis/funil?start=YYYY-MM-DD&end=YYYY-MM-DD

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockLeads, USE_MOCK } from "@/lib/mock-data";

export const dynamic = 'force-dynamic';

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

    let leads: any[];

    if (USE_MOCK) {
      leads = getMockLeads()
        .filter((l) => l.createdAt >= startDate && l.createdAt <= endDate)
        .map((l) => ({
          status: l.status,
          contactedAt: null, qualifiedAt: null, scheduledAt: null, meetingAt: null, closedAt: null,
          noShow: false, noShowAt: null,
        })) as any;
    } else {
      leads = await prisma.lead.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        select: {
          status: true,
          contactedAt: true, qualifiedAt: true, scheduledAt: true, scheduledBy: true,
          meetingAt: true, closedAt: true,
          noShow: true, noShowAt: true,
        },
      });
    }

    const leadsGerados = leads.length;
    const contatados  = leads.filter((l) => l.contactedAt != null || l.qualifiedAt != null || l.scheduledAt != null || l.meetingAt != null || l.status === "won" || ["contacted", "qualified", "scheduled", "meeting"].includes(l.status)).length;
    const qualificados = leads.filter((l) => l.qualifiedAt != null || l.scheduledAt != null || l.meetingAt != null || l.status === "won" || ["qualified", "scheduled", "meeting"].includes(l.status)).length;
    const agendamentos = leads.filter((l) => l.scheduledAt != null || l.meetingAt != null || l.status === "won" || ["scheduled", "meeting"].includes(l.status)).length;
    const reunioes     = leads.filter((l) => l.meetingAt != null || l.status === "won" || l.status === "meeting").length;

    // Vendas: fonte de verdade é a tabela Sale (vendas validadas pelo time).
    // Lead.status === "won" não é confiável pois depende do sync do Kommo e
    // pode não refletir todas as vendas registradas manualmente.
    const vendasCount = USE_MOCK
      ? leads.filter((l) => l.status === "won").length
      : await prisma.sale.count({ where: { closedAt: { gte: startDate, lte: endDate } } });
    const vendas = vendasCount;

    // No-show = leads com evento concreto de no-show vindo do Kommo (etapa "Reagendamento").
    // Não usa aritmética (agend - reuniões) porque meetingAt só é preenchido via GoTo Connect,
    // não pelo avanço de etapa no Kommo — o que causaria falsos positivos.
    const noShows = leads.filter((l) => l.noShowAt != null).length;

    // Breakdown IA vs SDR para agendamentos e no-show.
    // IA = created_by:0 no Kommo (automação/chatbot) → gravado como "IA".
    // SDR = humanos com role SDR (Cauê Perpétuo, Eunice Dias, etc.).
    // Outros (Célia Santos, Sellmap, user-xxx) ficam fora de ambas as categorias.
    // IA = created_by:0 no Kommo (automação/chatbot) → "IA"; também inclui "Sellmap"
    // SDR = humanos com role SDR cadastrados
    // Outros = Célia Santos (closer que agendava diretamente) + user-XXXXX (ex-funcionários deletados)
    const IA_NAMES = new Set(["IA", "Sellmap"]);
    const SDR_NAMES = new Set(["Cauê Perpétuo", "Eunice Dias", "Cauê"]);

    const isOther = (sb: string | null) =>
      sb != null && !IA_NAMES.has(sb) && !SDR_NAMES.has(sb);

    const agendIA    = leads.filter((l) => IA_NAMES.has(l.scheduledBy ?? "") && l.scheduledAt != null).length;
    const agendSDR   = leads.filter((l) => SDR_NAMES.has(l.scheduledBy ?? "") && l.scheduledAt != null).length;
    const agendOther = leads.filter((l) => isOther(l.scheduledBy) && l.scheduledAt != null).length;
    const noShowIA    = leads.filter((l) => IA_NAMES.has(l.scheduledBy ?? "") && l.noShowAt != null).length;
    const noShowSDR   = leads.filter((l) => SDR_NAMES.has(l.scheduledBy ?? "") && l.noShowAt != null).length;
    const noShowOther = leads.filter((l) => isOther(l.scheduledBy) && l.noShowAt != null).length;

    const agendamentosPorOrigem = {
      ia:    { agendamentos: agendIA,    noShows: noShowIA,    taxaNoShow: agendIA    > 0 ? parseFloat(((noShowIA    / agendIA)    * 100).toFixed(1)) : 0 },
      sdr:   { agendamentos: agendSDR,   noShows: noShowSDR,   taxaNoShow: agendSDR   > 0 ? parseFloat(((noShowSDR   / agendSDR)   * 100).toFixed(1)) : 0 },
      other: { agendamentos: agendOther, noShows: noShowOther, taxaNoShow: agendOther > 0 ? parseFloat(((noShowOther / agendOther) * 100).toFixed(1)) : 0 },
    };

    const conversions = {
      contactRate:  leadsGerados  > 0 ? parseFloat(((contatados  / leadsGerados)  * 100).toFixed(1)) : 0,
      qualRate:     contatados    > 0 ? parseFloat(((qualificados / contatados)    * 100).toFixed(1)) : 0,
      scheduleRate: contatados    > 0 ? parseFloat(((agendamentos / contatados)    * 100).toFixed(1)) : 0,
      meetingRate:  agendamentos  > 0 ? parseFloat(((reunioes     / agendamentos)  * 100).toFixed(1)) : 0,
      closeRate:    reunioes      > 0 ? parseFloat(((vendas       / reunioes)      * 100).toFixed(1)) : 0,
      noShowRate:   agendamentos  > 0 ? parseFloat(((noShows      / agendamentos)  * 100).toFixed(2)) : 0,
    };

    return NextResponse.json({
      data: { leadsGerados, contatados, qualificados, agendamentos, reunioes, vendas, conversions, agendamentosPorOrigem },
      updatedAt,
      error: null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { data: null, updatedAt, error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
