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

async function run() {
  console.log('=== CRUZAMENTO DE VENDAS x LEADS ===\n');

  // 1) Vendas sem leadId
  const salesNoLead = await p.sale.findMany({
    where: { leadId: null },
    select: { id: true, clientName: true, closedAt: true, value: true }
  });
  console.log(`Vendas sem leadId: ${salesNoLead.length}`);

  // 2) Todos os leads do banco
  const allLeads = await p.lead.findMany({
    select: { id: true, name: true, createdAt: true, status: true, closedAt: true, dealValue: true }
  });
  console.log(`Leads no banco: ${allLeads.length}`);

  // 3) Leads com status "won"
  const wonLeads = allLeads.filter(l => l.status === 'won');
  console.log(`Leads com status "won": ${wonLeads.length}`);
  wonLeads.forEach(l => console.log(`  [WON] id:${l.id} | ${l.name} | criado:${l.createdAt?.toISOString().slice(0,10)} | fechou:${l.closedAt?.toISOString().slice(0,10) || 'N/A'} | R$${l.dealValue || 0}`));

  // 4) Tentar match por nome
  console.log('\n--- MATCH POR NOME ---');
  const updates = [];

  for (const sale of salesNoLead) {
    const saleNorm = normalize(sale.clientName);
    if (!saleNorm) continue;

    // Tenta match exato primeiro
    let match = allLeads.find(l => normalize(l.name) === saleNorm);

    // Se não achou, tenta match parcial (nome do lead contém o nome da venda ou vice-versa)
    if (!match) {
      const saleWords = saleNorm.split(' ');
      // Pega as duas primeiras palavras significativas (primeiro + último nome)
      const firstName = saleWords[0];
      const lastName = saleWords[saleWords.length - 1];

      match = allLeads.find(l => {
        const ln = normalize(l.name);
        if (!ln || ln.length < 3) return false;
        // Match se o lead contém o primeiro E último nome
        return ln.includes(firstName) && ln.includes(lastName);
      });
    }

    if (match) {
      console.log(`  ✅ "${sale.clientName}" → Lead ${match.id} (${match.name}) [status: ${match.status}]`);
      updates.push({ saleId: sale.id, leadId: match.id });
    } else {
      console.log(`  ❌ "${sale.clientName}" → Nenhum lead encontrado`);
    }
  }

  // 5) Aplicar updates
  if (updates.length > 0) {
    console.log(`\n--- ATUALIZANDO ${updates.length} VENDAS ---`);
    for (const u of updates) {
      await p.sale.update({ where: { id: u.saleId }, data: { leadId: u.leadId } });
      console.log(`  Venda ${u.saleId} → leadId ${u.leadId}`);
    }
    console.log('✅ Feito!');
  } else {
    console.log('\nNenhum match encontrado para atualizar.');
  }

  // 6) Verificar leads WON que NÃO têm venda associada (closer moveu no Kommo mas não registrou no sistema)
  const allSales = await p.sale.findMany({ select: { leadId: true } });
  const salesLeadIds = new Set(allSales.map(s => s.leadId).filter(Boolean));
  
  const wonSemVenda = wonLeads.filter(l => !salesLeadIds.has(l.id));
  if (wonSemVenda.length > 0) {
    console.log(`\n--- LEADS "WON" NO KOMMO SEM VENDA REGISTRADA ---`);
    wonSemVenda.forEach(l => {
      console.log(`  ⚠️  id:${l.id} | ${l.name} | fechou:${l.closedAt?.toISOString().slice(0,10) || 'N/A'} | R$${l.dealValue || 0}`);
    });
    console.log(`\n  Esses ${wonSemVenda.length} leads foram marcados como "ganhos" no Kommo mas não têm registro de venda no sistema.`);
  }

  await p.$disconnect();
}
run();
