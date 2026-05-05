// GET /api/kpis/leads-recentes?since=YYYY-MM-DD&agent=NomeSDR
//
// Funil dos leads que CHEGARAM desde `since`:
//   Chegaram → Ligação → Agendados → Reunião → No-Show
// Agrupado por administradora (tag do Kommo).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sinceParam = searchParams.get("since");
    const untilParam = searchParams.get("until");
    const agentParam = searchParams.get("agent");

    const sinceDate = sinceParam
      ? new Date(sinceParam + "T00:00:00.000Z")
      : new Date("2026-04-18T00:00:00.000Z");

    const untilDate = untilParam
      ? new Date(untilParam + "T23:59:59.999Z")
      : undefined;

    // Usa o primeiro nome para match parcial — ex: "Cauê" encontra "Cauê Perpétuo"
    const agentWhere = agentParam
      ? { assignedTo: { startsWith: agentParam.split(" ")[0], mode: "insensitive" as const } }
      : {};

    const dateFilter: any = { gte: sinceDate };
    if (untilDate) dateFilter.lte = untilDate;

    // Base: todos os leads que chegaram (createdAt >= since)
    const leads = await prisma.lead.findMany({
      where: {
        createdAt: dateFilter,
        ...agentWhere,
      },
      select: {
        id: true,
        name: true,
        leadPhones: true,
        assignedTo: true,
        scheduledBy: true,
        status: true,
        createdAt: true,
        scheduledAt: true,
        meetingAt: true,
        closedAt: true,
        noShow: true,
        noShowAt: true,
        tags: true,
        goToCalls: true,
        firstCallAt: true,
        contactedAt: true,
        contactAttempts: true,
        lostReason: true,
        recuperacaoAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Busca vendas reais (tabela Sale) fechadas no período filtrado
    const salesDateFilter: any = { gte: sinceDate };
    if (untilDate) salesDateFilter.lte = untilDate;
    const salesInPeriod = await prisma.sale.findMany({
      where: { closedAt: salesDateFilter },
      select: { id: true, leadId: true, clientName: true, administradora: true },
    });
    const soldLeadIds = new Set(salesInPeriod.map(s => s.leadId).filter(Boolean));

    const leadIdsWithSales = salesInPeriod.map(s => s.leadId).filter(Boolean) as string[];
    const leadsForSales = await prisma.lead.findMany({
      where: { id: { in: leadIdsWithSales } },
      select: { id: true, tags: true }
    });
    const tagsByLeadId = new Map(leadsForSales.map(l => [l.id, l.tags]));

    const SEM_TAG = "Sem administradora";

    type TagBucket = {
      chegaram: number;
      comLigacao: number;
      agendados: number;
      reuniao: number;
      noShows: number;
      recuperacao: number;
      perdidos: number;
      vendas: number;
    };

    const byTag: Record<string, TagBucket> = {};

    let totalComLigacao = 0;
    let totalAgendados = 0;
    let totalReuniao = 0;
    let totalNoShows = 0;
    let totalRecuperacao = 0;
    let totalPerdidos = 0;
    const totalVendas = salesInPeriod.length;

    for (const l of leads) {
      const comLigacao =
        (l.goToCalls ?? 0) > 0 ||
        l.firstCallAt != null ||
        (l.contactAttempts ?? 0) > 0 ||
        l.contactedAt != null;

      // Reunião: meetingAt preenchido OU status "meeting" (sync nem sempre preenche meetingAt)
      const reuniao = l.meetingAt != null || l.status === "meeting";

      // No-Show: marcado como no-show E NÃO TEVE REUNIÃO DEPOIS
      const noShow = (l.noShow || l.noShowAt != null) && !reuniao;

      // Agendado: scheduledAt, ou teve reunião/no-show, ou status indica que foi agendado
      const agendado = l.scheduledAt != null || reuniao || noShow || l.status === "scheduled";

      const recuperacao = l.recuperacaoAt != null;
      const perdido = l.status === "lost" && !l.lostReason;
      const venda = soldLeadIds.has(l.id);

      if (comLigacao) totalComLigacao++;
      if (agendado) totalAgendados++;
      if (reuniao) totalReuniao++;
      if (noShow) totalNoShows++;
      if (recuperacao) totalRecuperacao++;
      if (perdido) totalPerdidos++;

      let admTag = SEM_TAG;
      if (l.tags.length > 0) {
        const knownAdms = ["embracon", "porto", "bancorbras", "rodobens", "itaú", "santander", "caixa", "bradesco", "hs consórcios"];
        const foundKnown = l.tags.find(t => knownAdms.some(k => t.toLowerCase().includes(k)));
        
        if (foundKnown) {
          admTag = foundKnown;
        } else {
          // Fallback: pick the first tag that doesn't look like a source/campaign
          const fallback = l.tags.find(t => {
            const tl = t.toLowerCase();
            return !tl.includes("meta") && !tl.startsWith("fb") && !tl.startsWith("ig") && !tl.includes("google") && !tl.includes("ads") && !tl.includes("lead");
          });
          if (fallback) admTag = fallback;
        }
      }

      if (!byTag[admTag]) {
        byTag[admTag] = { chegaram: 0, comLigacao: 0, agendados: 0, reuniao: 0, noShows: 0, recuperacao: 0, perdidos: 0, vendas: 0 };
      }
      byTag[admTag].chegaram++;
      if (comLigacao) byTag[admTag].comLigacao++;
      if (agendado) byTag[admTag].agendados++;
      if (reuniao) byTag[admTag].reuniao++;
      if (noShow) byTag[admTag].noShows++;
      if (recuperacao) byTag[admTag].recuperacao++;
      if (perdido) byTag[admTag].perdidos++;
    }

    // Processa as vendas do período (independentes da data de criação do lead)
    for (const s of salesInPeriod) {
      let admTag = SEM_TAG;
      let tags: string[] = [];
      if (s.leadId && tagsByLeadId.has(s.leadId)) {
        tags = tagsByLeadId.get(s.leadId) || [];
      }

      const knownAdms = ["embracon", "porto", "bancorbras", "rodobens", "itaú", "santander", "caixa", "bradesco", "hs consórcios"];
      let foundKnown = tags.find(t => knownAdms.some(k => t.toLowerCase().includes(k)));
      
      if (!foundKnown && s.administradora) {
        // tenta achar a adm a partir do campo texto da venda
        const admLower = s.administradora.toLowerCase();
        foundKnown = knownAdms.find(k => admLower.includes(k));
        // Mapeia para a tag com a mesma capitalização se possível, senão o nome da adm
        if (foundKnown) foundKnown = foundKnown.toUpperCase() === "PORTO" ? "PORTO" : foundKnown;
      }

      if (foundKnown) {
        admTag = foundKnown.toUpperCase() === "PORTO" ? "PORTO" : foundKnown; 
      } else if (tags.length > 0) {
        const fallback = tags.find(t => {
          const tl = t.toLowerCase();
          return !tl.includes("meta") && !tl.startsWith("fb") && !tl.startsWith("ig") && !tl.includes("google") && !tl.includes("ads") && !tl.includes("lead");
        });
        if (fallback) admTag = fallback;
      } else if (s.administradora) {
        admTag = s.administradora;
      }

      // Normaliza "Porto Seguro" para "PORTO"
      if (admTag.toLowerCase() === "porto seguro") admTag = "PORTO";
      if (admTag.toLowerCase() === "porto") admTag = "PORTO";
      if (admTag.toLowerCase() === "embracon") admTag = "EMBRACON";

      if (!byTag[admTag]) {
        byTag[admTag] = { chegaram: 0, comLigacao: 0, agendados: 0, reuniao: 0, noShows: 0, recuperacao: 0, perdidos: 0, vendas: 0 };
      }
      byTag[admTag].vendas++;
    }

    // Ordena: mais leads primeiro, "Sem administradora" no final
    const byTagSorted = Object.entries(byTag)
      .sort(([aKey, aVal], [bKey, bVal]) => {
        if (aKey === SEM_TAG) return 1;
        if (bKey === SEM_TAG) return -1;
        return bVal.chegaram - aVal.chegaram;
      })
      .reduce<typeof byTag>((acc, [k, v]) => {
        acc[k] = v;
        return acc;
      }, {});

    const mappedLeads = leads.map(l => {
      let admTag = SEM_TAG;
      if (l.tags.length > 0) {
        const knownAdms = ["embracon", "porto", "bancorbras", "rodobens", "itaú", "santander", "caixa", "bradesco", "hs consórcios"];
        const foundKnown = l.tags.find(t => knownAdms.some(k => t.toLowerCase().includes(k)));
        
        if (foundKnown) {
          admTag = foundKnown;
        } else {
          const fallback = l.tags.find(t => {
            const tl = t.toLowerCase();
            return !tl.includes("meta") && !tl.startsWith("fb") && !tl.startsWith("ig") && !tl.includes("google") && !tl.includes("ads") && !tl.includes("lead");
          });
          if (fallback) admTag = fallback;
        }
      }

      const isRecuperacao = l.recuperacaoAt != null;
      const isPerdido = l.status === "lost" && !l.lostReason;
      const isVenda = soldLeadIds.has(l.id);
      const isReuniao = l.meetingAt != null || l.status === "meeting";
      const isNoShow = (l.noShow || l.noShowAt != null) && !isReuniao;

      return {
        id: l.id,
        name: l.name,
        phone: l.leadPhones?.[0] || "",
        createdAt: l.createdAt,
        status: l.status,
        noShow: isNoShow,
        isReuniao: isReuniao,
        isRecuperacao,
        isPerdido,
        isVenda,
        admTag
      };
    });

    return NextResponse.json({
      data: {
        since: sinceDate.toISOString(),
        total: leads.length,        // chegaram
        comLigacao: totalComLigacao,
        agendados: totalAgendados,
        reuniao: totalReuniao,
        noShows: totalNoShows,
        recuperacao: totalRecuperacao,
        perdidos: totalPerdidos,
        vendas: totalVendas,
        byTag: byTagSorted,
        leads: mappedLeads,
      },
      error: null,
    });
  } catch (err: any) {
    console.error("[leads-recentes]", err?.message ?? err);
    return NextResponse.json({ data: null, error: err?.message ?? "Internal error" }, { status: 500 });
  }
}
