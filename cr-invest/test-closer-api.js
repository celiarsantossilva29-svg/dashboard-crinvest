const http = require('http');
http.get('http://localhost:3001/api/kpis/performance-closer?start=2026-05-01&end=2026-05-05', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const j = JSON.parse(data);
    const t = j.data.totals;
    console.log('Totais Closer (Mai 1-5):');
    console.log('  Vendas:', t.vendas);
    console.log('  Receita:', t.receita);
    console.log('  Ticket Médio:', t.ticketMedioGeral);
    console.log('  Win Rate:', t.taxaWinGeral + '%');
    console.log('  Reuniões:', t.totalReunioes);
    console.log('  No-Show:', t.noShowGeral + '%');
    console.log('\nPor Closer:');
    for (const a of j.data.agents) {
      console.log(`  ${a.agentName}: vendas=${a.vendas} receita=${a.receita} reuniões=${a.totalReunioes}`);
    }
    console.log('\nDeals:', j.data.deals.length);
    for (const d of j.data.deals.slice(0, 5)) {
      console.log(`  ${d.clientName} | ${d.status} | R$ ${d.value} | ${d.closedAt}`);
    }
  });
});
