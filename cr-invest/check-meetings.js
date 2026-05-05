const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const start = new Date("2026-04-18T00:00:00-03:00");
  const leads = await prisma.lead.findMany({
    where: { scheduledAt: { gte: start } },
    select: { id: true, status: true, meetingAt: true }
  });
  
  let countRealizada = 0;
  let countMeetingAtNull = 0;
  for (const l of leads) {
    const isRealizada = ["meeting", "won", "lost"].includes(l.status);
    if (isRealizada) {
      countRealizada++;
      if (!l.meetingAt) countMeetingAtNull++;
    }
  }
  
  console.log(`Leads agendados desde 18/04 que estão em meeting/won/lost: ${countRealizada}`);
  console.log(`Desses, quantos estão com meetingAt = null: ${countMeetingAtNull}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
