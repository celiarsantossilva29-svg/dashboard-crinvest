const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function check() {
  const phones = [
    '5531980154460', // Ketne
    '5511967987921', // Luis
    '5537991118730', // Danilo
    '5521975695931', // Vinicius
    '5527992233983', // Leonardo
    '5584996209753', // Hortencio
    '5547988082818', // Camila
    '5517997444399', // Sidnei
    '5521969106833', // Vanessa
    '5591981457969', // Felipe
    '5534991473943', // Pedro
  ];

  const leads = await p.lead.findMany({
    where: {
      leadPhones: { hasSome: phones }
    },
    select: { name: true, leadPhones: true, scheduledBy: true, scheduledAt: true, meetingAt: true, noShowAt: true, status: true, isReagendado: true }
  });

  console.table(leads.map(l => ({
    name: l.name,
    phone: l.leadPhones[0],
    scheduledBy: l.scheduledBy,
    scheduledAt: l.scheduledAt?.toISOString().substring(0, 10),
    meetingAt: l.meetingAt?.toISOString().substring(0, 10),
    noShowAt: l.noShowAt?.toISOString().substring(0, 10),
    status: l.status,
    isReagendado: l.isReagendado
  })));
}
check().finally(() => p.$disconnect());
