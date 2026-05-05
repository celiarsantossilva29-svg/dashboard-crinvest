const http = require('http');
http.get('http://localhost:3001/api/kpis/performance-sdr?start=2026-05-01&end=2026-05-05', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const j = JSON.parse(data);
    const a = j.data.agendamentosPorOrigem;
    console.log('Total agendamentos:', a.total);
    console.log('IA:', a.ia.agendamentos);
    console.log('SDR:', a.sdr.agendamentos);
    console.log('Other:', a.other.agendamentos);
    console.log('\nStats por SDR:');
    for (const s of j.data.stats) {
      console.log(`  ${s.agentName}: agendamentos=${s.agendamentos} proprios=${s.agendamentosProprios} ia=${s.agendamentosIa ?? 'N/A'}`);
    }
  });
});
