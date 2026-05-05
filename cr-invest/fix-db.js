const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 1. Check vendedores
  const vends = await p.vendedor.findMany({ select: { id: true, nome: true } });
  console.log("Vendedores no banco:", vends);

  const celiaCorreta = vends.find(v => v.nome === 'Célia' || v.id === 'Célia' || v.nome.toLowerCase().includes('celia'));
  const idCorreto = celiaCorreta ? celiaCorreta.id : 'celia';

  // 2. Fix assignedTo in Sales
  const updatedSales = await p.sale.updateMany({
    where: { assignedTo: 'celia' },
    data: { assignedTo: idCorreto }
  });
  console.log(`Vendas atualizadas para o closer ${idCorreto}: ${updatedSales.count}`);

  // 3. Fix valorParcela
  // Para todas as vendas, o valor da parcela de comissão deve ser `comissaoPorParcela`.
  // Se `valorParcela` for muito alto (igual ao prêmio), está errado.
  const sales = await p.sale.findMany({
    include: { installments: true }
  });

  let fixedInstallments = 0;
  for (const s of sales) {
    // comissaoPorParcela é o valor correto que a empresa vai receber em cada mês (aprox 4% / 12)
    const expectedValor = s.comissaoPorParcela || ((s.comissaoBruta || 0) / (s.quantidadeParcelas || 12));
    
    // Se o valor for muito maior que o esperado, corrigimos
    for (const inst of s.installments) {
      if (inst.valorParcela > expectedValor * 2) {
        await p.installment.update({
          where: { id: inst.id },
          data: { valorParcela: expectedValor }
        });
        fixedInstallments++;
      }
    }
  }

  console.log(`Parcelas corrigidas (valor): ${fixedInstallments}`);
}

main().catch(console.error).finally(() => p.$disconnect());
