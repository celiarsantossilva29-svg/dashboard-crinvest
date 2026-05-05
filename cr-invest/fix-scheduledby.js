const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function fix() {
  // Reverter o fix anterior: limpar scheduledBy dos leads que foram marcados
  // incorretamente como IA. Vamos deixar null e esperar o sync correto.
  const result = await p.lead.updateMany({
    where: {
      scheduledBy: 'IA',
      scheduledAt: null, // Somente os que não foram preenchidos pelo evento real
      createdAt: { gte: new Date('2026-05-01T00:00:00Z'), lte: new Date('2026-05-05T23:59:59Z') }
    },
    data: {
      scheduledBy: null
    }
  });
  console.log(`Revertidos ${result.count} leads (scheduledBy=IA → null) para re-sincronizar`);

  // Verificar status do token
  const token = await p.kommoToken.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (token) {
    const expired = token.expiresAt < new Date();
    console.log(`\nToken Kommo: expira em ${token.expiresAt.toISOString()} | ${expired ? '❌ EXPIRADO' : '✅ Válido'}`);
    if (expired) {
      console.log('→ O token precisa ser renovado! Acesse Configurações → Conectar Kommo no dashboard.');
    }
  } else {
    console.log('Sem token Kommo!');
  }
}
fix().finally(() => p.$disconnect());
