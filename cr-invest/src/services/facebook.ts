/**
 * Meta (Facebook) Ads integration — READ-ONLY
 * Base URL: https://graph.facebook.com/v18.0
 * Auth: Long-lived token from FB_ACCESS_TOKEN env var
 */

import { assertReadOnly } from "@/lib/readonly-guard";
import { prisma } from "@/lib/prisma";
import { getMockAdsMetrics, USE_MOCK } from "@/lib/mock-data";

const GRAPH_BASE = "https://graph.facebook.com/v18.0";
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN!;
const FB_AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID!;

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function syncFacebookAds(
  startDate: Date,
  endDate: Date
): Promise<{ synced: number }> {
  assertReadOnly("GET");

  if (USE_MOCK) {
    const metrics = getMockAdsMetrics().filter(
      (m) => m.date >= startDate && m.date <= endDate
    );

    for (const m of metrics) {
      await prisma.adsMetrics.upsert({
        where: { date_campaignId: { date: m.date, campaignId: m.campaignId } },
        update: {
          impressions: m.impressions,
          clicks: m.clicks,
          spend: m.spend,
          leads: m.leads,
          cpm: m.cpm,
          ctr: m.ctr,
          cpc: m.cpc,
          cpl: m.cpl,
          syncedAt: new Date(),
        },
        create: {
          date: m.date,
          campaignId: m.campaignId,
          campaignName: m.campaignName,
          impressions: m.impressions,
          clicks: m.clicks,
          spend: m.spend,
          leads: m.leads,
          cpm: m.cpm,
          ctr: m.ctr,
          cpc: m.cpc,
          cpl: m.cpl,
          syncedAt: new Date(),
        },
      });
    }

    await prisma.syncLog.create({
      data: {
        source: "facebook",
        status: "success",
        message: `Mock: ${metrics.length} ad metric rows upserted`,
      },
    });

    return { synced: metrics.length };
  }

  // Real Meta Graph API
  const timeRange = JSON.stringify({
    since: formatDate(startDate),
    until: formatDate(endDate),
  });

  const fields = [
    "campaign_id",
    "campaign_name",
    "impressions",
    "clicks",
    "spend",
    "actions",
    "cost_per_action_type",
    "cpm",
    "ctr",
    "cpc",
  ].join(",");

  const params = new URLSearchParams({
    fields,
    time_range: timeRange,
    level: "campaign",
    time_increment: "1",
    access_token: FB_ACCESS_TOKEN,
    limit: "500",
  });

  let nextUrl: string | null =
    `${GRAPH_BASE}/${FB_AD_ACCOUNT_ID}/insights?${params.toString()}`;
  let total = 0;

  while (nextUrl) {
    const currentUrl: string = nextUrl;
    const res = await fetch(currentUrl);

    if (!res.ok) {
      const text = await res.text();
      await prisma.syncLog.create({
        data: {
          source: "facebook",
          status: "error",
          message: `${res.status} ${text}`,
        },
      });
      throw new Error(`Facebook Ads API error: ${res.status} ${text}`);
    }

    const json = await res.json();
    const rows: any[] = json.data ?? [];

    for (const row of rows) {
      const impressions = parseInt(row.impressions ?? "0", 10);
      const clicks = parseInt(row.clicks ?? "0", 10);
      const spend = parseFloat(row.spend ?? "0");
      const cpm = parseFloat(row.cpm ?? "0");
      const ctr = parseFloat(row.ctr ?? "0");
      const cpc = parseFloat(row.cpc ?? "0");

      // Extract leads from actions
      const actions: any[] = row.actions ?? [];
      const leadAction = actions.find((a: any) => a.action_type === "lead");
      const leads = leadAction ? parseInt(leadAction.value ?? "0", 10) : 0;

      // Extract CPL from cost_per_action_type
      const costActions: any[] = row.cost_per_action_type ?? [];
      const cplEntry = costActions.find((a: any) => a.action_type === "lead");
      const cpl = cplEntry ? parseFloat(cplEntry.value ?? "0") : leads > 0 ? spend / leads : 0;

      const date = new Date(row.date_start);

      await prisma.adsMetrics.upsert({
        where: {
          date_campaignId: { date, campaignId: row.campaign_id },
        },
        update: {
          campaignName: row.campaign_name,
          impressions,
          clicks,
          spend,
          leads,
          cpm,
          ctr,
          cpc,
          cpl,
          syncedAt: new Date(),
        },
        create: {
          date,
          campaignId: row.campaign_id,
          campaignName: row.campaign_name,
          impressions,
          clicks,
          spend,
          leads,
          cpm,
          ctr,
          cpc,
          cpl,
          syncedAt: new Date(),
        },
      });

      total++;
    }

    // Pagination
    nextUrl = json.paging?.next ?? null;
  }

  await prisma.syncLog.create({
    data: {
      source: "facebook",
      status: "success",
      message: `${total} campaign-day rows synced`,
    },
  });

  return { synced: total };
}
