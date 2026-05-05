const http = require('http');
http.get('http://localhost:3001/api/kpis/funil?start=2026-05-01&end=2026-05-05', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const j = JSON.parse(data);
    console.log('Totais Funil (Mai 1-5):');
    console.log('  Agendamentos:', j.data.agendamentos);
    console.log('  Origens:', j.data.agendamentosPorOrigem);
  });
});
