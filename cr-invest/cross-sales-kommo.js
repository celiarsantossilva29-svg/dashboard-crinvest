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

async function fetchLeadName(token, leadId) {
  const sub = process.env.KOMMO_SUBDOMAIN;
  // Fetch lead with contacts
  const res = await fetch(`https://${sub}.kommo.com/api/v4/leads/${leadId}?with=contacts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const lead = await res.json();
  
  // Try contact name first
  const contactIds = (lead._embedded?.contacts || []).map(c => c.id);
  if (contactIds.length > 0) {
    const cRes = await fetch(`https://${sub}.kommo.com/api/v4/contacts/${contactIds[0]}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (cRes.ok) {
      const contact = await cRes.json();
      if (contact.name && !contact.name.includes('Facebook') && !contact.name.includes('Autolead')) {
        return contact.name;
      }
    }
  }
  
  // Fallback to lead name
  if (lead.name && !lead.name.includes('Facebook') && !lead.name.includes('Autolead')) {
    return lead.name;
  }
  return null;
}

async function run() {
  const token = await getToken();
  
  // 1) Pega leads won que foram fechados em abril
  const wonLeads = await p.lead.findMany({
    where: {
      status: 'won',
      closedAt: { gte: new Date('2026-04-01'), lte: new Date('2026-04-30T23:59:59Z') }
    },
    select: { id: true, name: true, closedAt: true, dealValue: true }
  });
  
  console.log(`Leads WON em abril: ${wonLeads.length}`);
  
  // 2) Busca nomes reais do Kommo
  const leadNames = {};
  for (const l of wonLeads) {
    const name = await fetchLeadName(token, l.id);
    leadNames[l.id] = name;
    console.log(`  Lead ${l.id}: "${name}" | fechou: ${l.closedAt?.toISOString().slice(0,10)} | R$${l.dealValue || 0}`);
    // Update lead name in DB if we found one
    if (name) {
      await p.lead.update({ where: { id: l.id }, data: { name } });
    }
    await new Promise(r => setTimeout(r, 250)); // rate limit
  }

  // 3) Agora tenta match com vendas sem leadId
  const salesNoLead = await p.sale.findMany({
    where: { leadId: null },
    select: { id: true, clientName: true, closedAt: true, value: true }
  });

  console.log(`\n--- MATCHING VENDAS x LEADS WON (com nomes do Kommo) ---`);
  
  const allLeads = await p.lead.findMany({
    where: { status: 'won' },
    select: { id: true, name: true, closedAt: true, dealValue: true }
  });

  let matched = 0;
  for (const sale of salesNoLead) {
    const saleNorm = normalize(sale.clientName);
    if (!saleNorm) continue;

    let match = null;

    // Match exato
    match = allLeads.find(l => normalize(l.name) === saleNorm);

    // Match parcial (primeiro + último nome)
    if (!match) {
      const saleWords = saleNorm.split(' ');
      if (saleWords.length >= 2) {
        const first = saleWords[0];
        const last = saleWords[saleWords.length - 1];
        match = allLeads.find(l => {
          const ln = normalize(l.name);
          return ln && ln.includes(first) && ln.includes(last);
        });
      }
    }
    
    // Match só primeiro nome (se único)
    if (!match) {
      const saleWords = saleNorm.split(' ');
      const first = saleWords[0];
      if (first.length >= 4) {
        const candidates = allLeads.filter(l => normalize(l.name).includes(first));
        if (candidates.length === 1) match = candidates[0];
      }
    }

    if (match) {
      console.log(`  ✅ Venda "${sale.clientName}" → Lead ${match.id} (${match.name})`);
      await p.sale.update({ where: { id: sale.id }, data: { leadId: match.id } });
      matched++;
    } else {
      console.log(`  ❌ Venda "${sale.clientName}" → Sem match`);
    }
  }

  console.log(`\n✅ ${matched} vendas vinculadas a leads!`);
  await p.$disconnect();
}
run();
