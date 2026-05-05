const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
});

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getToken() {
  const t = await p.kommoToken.findFirst({ orderBy: { updatedAt: 'desc' } });
  return t.accessToken;
}

async function run() {
  const token = await getToken();
  const sub = process.env.KOMMO_SUBDOMAIN;
  const POS_VENDAS_PIPELINE = 13179240;

  // Fetch leads from PÓS-VENDAS 2.0 pipeline (with contacts)
  let allLeads = [];
  let page = 1;
  while (true) {
    const url = `https://${sub}.kommo.com/api/v4/leads?filter[pipeline_id]=${POS_VENDAS_PIPELINE}&with=contacts&limit=250&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok || res.status === 204) break;
    const json = await res.json();
    const leads = json._embedded?.leads || [];
    allLeads = allLeads.concat(leads);
    if (leads.length < 250) break;
    page++;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`Total de leads no PÓS-VENDAS 2.0: ${allLeads.length}\n`);

  // Fetch contact names for each lead
  for (const lead of allLeads) {
    const contactIds = (lead._embedded?.contacts || []).map(c => c.id);
    let contactName = null;
    if (contactIds.length > 0) {
      const cRes = await fetch(`https://${sub}.kommo.com/api/v4/contacts/${contactIds[0]}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (cRes.ok) {
        const contact = await cRes.json();
        contactName = contact.name;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    
    const created = new Date(lead.created_at * 1000);
    const closed = lead.closed_at ? new Date(lead.closed_at * 1000) : null;
    console.log(`Lead ${lead.id} | Contato: "${contactName || lead.name}" | Criado: ${created.toISOString().slice(0,10)} | Valor: R$${lead.price || 0}`);
  }

  // Now try to match with sales
  console.log('\n--- CRUZAMENTO COM VENDAS ---');
  const salesNoLead = await p.sale.findMany({
    where: { leadId: null },
    select: { id: true, clientName: true, closedAt: true, value: true }
  });

  let matched = 0;
  for (const sale of salesNoLead) {
    const saleNorm = normalize(sale.clientName);
    if (!saleNorm) continue;

    for (const lead of allLeads) {
      const contactIds = (lead._embedded?.contacts || []).map(c => c.id);
      let contactName = null;
      if (contactIds.length > 0) {
        const cRes = await fetch(`https://${sub}.kommo.com/api/v4/contacts/${contactIds[0]}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (cRes.ok) {
          const contact = await cRes.json();
          contactName = contact.name;
        }
        await new Promise(r => setTimeout(r, 200));
      }
      
      const leadNorm = normalize(contactName || lead.name);
      if (!leadNorm) continue;

      const saleWords = saleNorm.split(' ');
      const first = saleWords[0];
      const last = saleWords[saleWords.length - 1];
      
      if (leadNorm === saleNorm || (first.length >= 3 && last.length >= 3 && leadNorm.includes(first) && leadNorm.includes(last))) {
        console.log(`  ✅ "${sale.clientName}" → Lead ${lead.id} ("${contactName || lead.name}")`);
        // Update sale with leadId and lead name
        await p.sale.update({ where: { id: sale.id }, data: { leadId: String(lead.id) } });
        await p.lead.updateMany({ where: { id: String(lead.id) }, data: { name: contactName || lead.name } });
        matched++;
        break;
      }
    }
  }

  if (matched === 0) {
    // List all for manual check
    console.log('\nNenhum match automático. Vendas pendentes:');
    salesNoLead.forEach(s => console.log(`  Venda: "${s.clientName}" | ${s.closedAt?.toISOString().slice(0,10)} | R$${s.value}`));
  } else {
    console.log(`\n✅ ${matched} vendas vinculadas!`);
  }

  await p.$disconnect();
}
run();
