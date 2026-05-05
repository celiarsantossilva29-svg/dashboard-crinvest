const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

// Load env
const envContent = fs.readFileSync('.env.local', 'utf8');
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    process.env[trimmed.substring(0, eqIdx)] = trimmed.substring(eqIdx + 1);
  }
}
console.log('KOMMO_SUBDOMAIN:', process.env.KOMMO_SUBDOMAIN);

async function main() {
  const token = await p.kommoToken.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!token) { console.log('Sem token!'); return; }

  console.log('Token expires:', token.expiresAt.toISOString());

  const subdomain = process.env.KOMMO_SUBDOMAIN;
  const base = `https://${subdomain}.kommo.com/api/v4`;

  // Test: busca 1 lead qualquer
  const testUrl = `${base}/leads?limit=1`;
  console.log('Testing URL:', testUrl);

  const res = await fetch(testUrl, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  console.log('Status:', res.status);
  const contentType = res.headers.get('content-type');
  console.log('Content-Type:', contentType);

  if (!res.ok) {
    const text = await res.text();
    console.log('Error body:', text.substring(0, 200));

    // Talvez o token precise refresh
    console.log('\nTentando refresh...');
    const refreshRes = await fetch(`https://${subdomain}.kommo.com/oauth2/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.KOMMO_CLIENT_ID,
        client_secret: process.env.KOMMO_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        redirect_uri: process.env.KOMMO_REDIRECT_URI,
      })
    });
    console.log('Refresh status:', refreshRes.status);
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      const expiresAt = new Date(Date.now() + data.expires_in * 1000);
      await p.kommoToken.update({
        where: { id: token.id },
        data: { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt }
      });
      console.log('Token renovado! Novo expira:', expiresAt.toISOString());

      // Retry
      const res2 = await fetch(testUrl, {
        headers: { Authorization: `Bearer ${data.access_token}` }
      });
      console.log('Retry status:', res2.status);
      if (res2.ok) {
        const json = await res2.json();
        console.log('Leads encontrados:', json._embedded?.leads?.length ?? 0);
      }
    } else {
      const refreshText = await refreshRes.text();
      console.log('Refresh error:', refreshText.substring(0, 200));
    }
  } else {
    const json = await res.json();
    console.log('OK! Leads encontrados:', json._embedded?.leads?.length ?? 0);

    // Agora buscar eventos de 1 lead de maio
    const testLead = await p.lead.findFirst({
      where: { status: 'scheduled', createdAt: { gte: new Date('2026-05-01T00:00:00Z') } },
      select: { id: true, name: true }
    });
    if (testLead) {
      console.log(`\nBuscando eventos de: ${testLead.name} (${testLead.id})`);
      const evRes = await fetch(
        `${base}/events?filter[entity]=lead&filter[entity_id][]=${testLead.id}&limit=100`,
        { headers: { Authorization: `Bearer ${token.accessToken}` } }
      );
      console.log('Events status:', evRes.status);
      if (evRes.ok && evRes.status !== 204) {
        const evJson = await evRes.json();
        const events = evJson._embedded?.events ?? [];
        console.log(`Eventos totais: ${events.length}`);
        for (const ev of events.sort((a, b) => a.created_at - b.created_at)) {
          const ts = new Date(ev.created_at * 1000).toISOString();
          const type = ev.type;
          const afterStatusId = ev.value_after?.[0]?.lead_status?.id;
          const afterPipeline = ev.value_after?.[0]?.lead_status?.pipeline_id;
          const createdBy = ev.created_by;
          if (afterStatusId) {
            console.log(`  ${ts} | type=${type} | created_by=${createdBy} | status_id=${afterStatusId} | pipeline=${afterPipeline}`);
          }
        }
      } else {
        console.log('Sem eventos ou erro:', evRes.status);
      }
    }
  }
}

main().finally(() => p.$disconnect());
