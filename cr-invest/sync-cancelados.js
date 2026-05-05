const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const wb1 = XLSX.readFile('C:/Users/giova/OneDrive/Documents/RptClienteLista.xlsx');
  const clientes = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);
  
  let canceladosNoExcel = 0;
  let parcelasAtualizadas = 0;
  let vendasEncontradas = 0;

  for (const c of clientes) {
    const nome = (c['NOME'] || c['CLIENTE'] || '').toString().trim();
    const statusCota = c['SITUAÇÃO'];
    const cancelouInfo = c['Cancelou?_1']; // Aqui tem 'CANCELADO' ou 'ADIMPLENTE'
    
    if (cancelouInfo === 'CANCELADO' || statusCota === 'Cancelada') {
      canceladosNoExcel++;
      
      // Achar a venda desse cliente no banco
      const sales = await p.sale.findMany({
        where: { clientName: { equals: nome, mode: 'insensitive' } },
        include: { installments: true }
      });
      
      if (sales.length > 0) {
        vendasEncontradas++;
        for (const sale of sales) {
          // Atualizar todas as parcelas pendentes para cancelado
          const result = await p.installment.updateMany({
            where: { saleId: sale.id, status: { in: ['PENDENTE', 'INADIMPLENTE'] } },
            data: { status: 'CANCELADO' }
          });
          if (result.count > 0) {
            parcelasAtualizadas += result.count;
            console.log(`✅ ${nome}: canceladas ${result.count} parcelas`);
          }
        }
      } else {
        // console.log(`⚠️ Cliente cancelado não achado no banco: ${nome}`);
      }
    }
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`Clientes cancelados no Excel: ${canceladosNoExcel}`);
  console.log(`Desses, achados no banco: ${vendasEncontradas}`);
  console.log(`Parcelas atualizadas para CANCELADO: ${parcelasAtualizadas}`);
}

main().catch(console.error).finally(() => p.$disconnect());
