const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const matchEnv = envFile.match(/KOMMO_SUBDOMAIN=(.*)/);
const subdomain = matchEnv ? matchEnv[1].trim() : '';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Corrige scheduledAt para leads que foram movidos para "1° Reunião Confirmada" 
// nos dias 22-24 de abril, usando o timestamp REAL do evento do Kommo

const FIXES = [
  // Apr 22
  { id: "19870687", scheduledAt: "2026-04-22T13:52:13.000Z" },
  { id: "19876547", scheduledAt: "2026-04-22T18:39:47.000Z" },
  { id: "19884047", scheduledAt: "2026-04-22T19:09:03.000Z" },
  { id: "19856639", scheduledAt: "2026-04-22T20:25:19.000Z" },
  { id: "19751588", scheduledAt: "2026-04-22T21:34:11.000Z" },
  { id: "19876743", scheduledAt: "2026-04-22T21:57:59.000Z" },
  // Apr 23  
  { id: "19920453", scheduledAt: "2026-04-23T12:30:51.000Z" },
  { id: "19614539", scheduledAt: "2026-04-23T17:39:11.000Z" },
  { id: "19910153", scheduledAt: "2026-04-23T19:44:10.000Z" },
  // Note: 19884047 had a SECOND event on 23rd (reagendamento) - keep first (22nd)
  // Apr 24
  { id: "19947691", scheduledAt: "2026-04-24T13:12:09.000Z" },
];

async function main() {
  for (const fix of FIXES) {
    await prisma.lead.update({
      where: { id: fix.id },
      data: { scheduledAt: new Date(fix.scheduledAt) }
    });
    console.log(`Fixed lead ${fix.id} → scheduledAt = ${fix.scheduledAt}`);
  }
  console.log(`\nDone! Fixed ${FIXES.length} leads.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
