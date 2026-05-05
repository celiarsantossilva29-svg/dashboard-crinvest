const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const startDate = new Date('2026-05-01T00:00:00.000Z');
  const endDate = new Date('2026-05-05T23:59:59.999Z');

  // All leads with scheduledAt in May
  const scheduledLeads = await p.lead.findMany({
    where: {
      OR: [
        { scheduledAt: { gte: startDate, lte: endDate } },
        { meetingAt: { gte: startDate, lte: endDate } },
        { createdAt: { gte: startDate, lte: endDate } },
      ]
    },
    select: {
      id: true,
      name: true,
      assignedTo: true,
      scheduledBy: true,
      status: true,
      createdAt: true,
      scheduledAt: true,
      meetingAt: true,
      noShowAt: true,
      reagendadoAt: true,
      syncedAt: true,
    },
  });

  console.log(`\nTotal leads encontrados (criados ou agendados em mai/2026): ${scheduledLeads.length}\n`);

  // Show those with scheduledAt or status scheduled/meeting
  const agendados = scheduledLeads.filter(l => {
    const at = l.scheduledAt || l.meetingAt || (['scheduled', 'meeting', 'won'].includes(l.status) ? l.createdAt : null);
    return at != null && at >= startDate && at <= endDate;
  });

  console.log(`Leads com agendamento no período: ${agendados.length}\n`);
  console.log('Detalhes:');
  for (const l of agendados) {
    console.log(`  ${l.name || '(sem nome)'} | status=${l.status} | scheduledBy=${l.scheduledBy || 'null'} | scheduledAt=${l.scheduledAt?.toISOString() || 'null'} | meetingAt=${l.meetingAt?.toISOString() || 'null'} | createdAt=${l.createdAt.toISOString()}`);
  }

  // Check all statuses in the period
  const statusCounts = {};
  for (const l of scheduledLeads) {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
  }
  console.log('\nDistribuição de status:');
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count}`);
  }

  // Check scheduledBy values
  const scheduledByValues = {};
  for (const l of scheduledLeads.filter(l => l.scheduledAt || ['scheduled', 'meeting'].includes(l.status))) {
    const by = l.scheduledBy || '(null)';
    scheduledByValues[by] = (scheduledByValues[by] || 0) + 1;
  }
  console.log('\nScheduledBy (agendados):');
  for (const [by, count] of Object.entries(scheduledByValues)) {
    console.log(`  ${by}: ${count}`);
  }
}

check().finally(() => p.$disconnect());
