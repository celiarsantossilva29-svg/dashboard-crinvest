const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function cleanup() {
  // 1. Buscar as 14 vendas originais (criadas ANTES de hoje)
  const cutoff = new Date('2026-04-27T00:00:00Z');
  
  const allSales = await p.sale.findMany({ select: { id: true, createdAt: true, clientName: true } });
  const originals = allSales.filter(s => s.createdAt < cutoff);
  const imported = allSales.filter(s => s.createdAt >= cutoff);
  
  console.log(`Vendas originais (manter): ${originals.length}`);
  console.log(`Vendas importadas hoje (deletar): ${imported.length}`);
  
  // 2. Deletar parcelas das vendas importadas
  const importedIds = imported.map(s => s.id);
  
  const deletedInstallments = await p.installment.deleteMany({
    where: { saleId: { in: importedIds } }
  });
  console.log(`Parcelas deletadas: ${deletedInstallments.count}`);
  
  // 3. Deletar as vendas importadas
  const deletedSales = await p.sale.deleteMany({
    where: { id: { in: importedIds } }
  });
  console.log(`Vendas deletadas: ${deletedSales.count}`);
  
  // 4. Confirmar o que sobrou
  const remaining = await p.sale.count();
  console.log(`\nVendas restantes no banco: ${remaining}`);
}

cleanup().catch(console.error).finally(() => p.$disconnect());
