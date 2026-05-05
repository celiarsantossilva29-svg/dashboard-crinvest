const http = require('http');
http.get('http://localhost:3001/api/debug/events', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const j = JSON.parse(data);
    for (const lead of j.leads) {
      const hasScheduleEvent = lead.status_changes.some(e => e.mapped === 'scheduled');
      console.log(`\n${lead.name} (${lead.id}) | DB: status=${lead.status} | scheduledAt=${lead.scheduledAt || 'NULL'} | scheduledBy=${lead.scheduledBy || 'NULL'}`);
      console.log(`  assignedTo=${lead.assignedTo} | createdAt=${lead.createdAt}`);
      if (lead.status_changes.length === 0) {
        console.log('  ⚠️ SEM EVENTOS DE STATUS');
      } else {
        for (const ev of lead.status_changes) {
          const marker = ev.mapped === 'scheduled' ? ' ◄◄◄ AGENDAMENTO' : '';
          console.log(`  ${ev.ts} | by=${ev.created_by} | "${ev.stage_name}" → ${ev.mapped}${marker}`);
        }
        if (!hasScheduleEvent) {
          console.log('  ⚠️ NENHUM EVENTO DE AGENDAMENTO ENCONTRADO');
        }
      }
    }
  });
});
