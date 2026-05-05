import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v) process.env[k.trim()] = v.join('=').trim();
});
import { PrismaClient } from '@prisma/client';
import { syncLeadHistory } from './src/services/kommo';

const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: new Date("2026-04-01T00:00:00-03:00") } },
    select: { id: true }
  });

  console.log(`Verificando histórico de ${leads.length} leads de Abril...`);

  let updated = 0;
  for (const l of leads) {
    try {
      await syncLeadHistory(l.id);
      
      const lead = await prisma.lead.findUnique({ where: { id: l.id }, select: { recuperacaoAt: true } });
      if (lead && lead.recuperacaoAt) {
        updated++;
      }
    } catch(e) {
      console.log(`Erro ao syncLeadHistory ${l.id}: ${(e as any).message}`);
    }
  }

  console.log(`Feito! ${updated} leads entraram no funil de recuperação em algum momento.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
