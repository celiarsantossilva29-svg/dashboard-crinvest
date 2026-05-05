const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const excelDateToJS = (serial) => {
  if (!serial || typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000);
};

async function main() {
  // ============ PASSO 1: Limpar importação errada ============
  const cutoff = new Date('2026-04-27T00:00:00Z');
  const allSales = await p.sale.findMany({ select: { id: true, createdAt: true, clientName: true, value: true } });
  const originals = allSales.filter(s => s.createdAt < cutoff);
  const imported = allSales.filter(s => s.createdAt >= cutoff);
  
  console.log(`\n=== LIMPEZA ===`);
  console.log(`Vendas originais (manter): ${originals.length}`);
  originals.forEach(s => console.log(`  📌 ${s.clientName} - R$ ${s.value.toLocaleString('pt-BR')}`));
  console.log(`Vendas importadas erradas (deletar): ${imported.length}`);
  
  if (imported.length > 0) {
    const importedIds = imported.map(s => s.id);
    await p.installment.deleteMany({ where: { saleId: { in: importedIds } } });
    await p.sale.deleteMany({ where: { id: { in: importedIds } } });
    console.log(`✅ ${imported.length} vendas erradas deletadas`);
  }

  // ============ PASSO 2: Carregar Excel ============
  const wb1 = XLSX.readFile('C:/Users/giova/OneDrive/Documents/RptClienteLista.xlsx');
  const clientes = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);
  
  const wb2 = XLSX.readFile('C:/Users/giova/OneDrive/Documents/RptAnaliseProducao (3).xlsx');
  const producao = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);

  // Indexar status do cliente por CPF (Cancelou? da RptClienteLista)
  const clienteMap = {};
  clientes.forEach(c => {
    const cpf = (c['CGC/CPF'] || '').toString().trim();
    if (cpf) {
      clienteMap[cpf] = {
        cancelou: c['Cancelou?'] || null,
        telefone: c['TELEFONE'] || '',
        email: c['EMAIL'] || '',
      };
    }
  });

  // ============ PASSO 3: Verificar vendas originais (14) ============
  // Criar set por clientName+value+closedAt para comparar com Excel
  const originalKeys = new Set();
  for (const s of originals) {
    // Normalizar: nome upper + valor + mês/ano
    const key = `${s.clientName.toUpperCase().trim()}_${s.value}_${s.createdAt.getMonth()}_${s.createdAt.getFullYear()}`;
    originalKeys.add(key);
  }

  // ============ PASSO 4: Importar TODAS as linhas do Excel ============
  console.log(`\n=== IMPORTAÇÃO ===`);
  console.log(`Linhas no Excel: ${producao.length}`);
  
  let inserted = 0;
  let skippedOriginal = 0;
  let errors = 0;
  const propostasImportadas = new Set(); // Para rastrear propostas já processadas

  for (const row of producao) {
    const proposta = (row['PROPOSTA'] || '').toString().trim();
    const cpf = (row['CPF/CNPJ'] || '').toString().trim();
    const nome = (row['CLIENTE'] || '').toString().trim();
    const premio = Number(row['PRÊMIO']) || 0;
    const dataProposta = excelDateToJS(row['DATA PROPOSTA']);
    const situacao = (row['SITUAÇÃO'] || '').toString(); // Ativa, Vencida
    const seguradora = (row['SEGURADORA (ABREVIADO)'] || row['SEGURADORA'] || '').toString();
    const produto = (row['NOME ABREVIADO DO PRODUTO'] || '').toString();
    const parcelas = Number(row['QUANTIDADE DE PARCELAS']) || 12; // Parcelas REAIS da cota
    const apolice = (row['APÓLICE'] || '').toString();
    const clienteInfo = clienteMap[cpf] || {};
    const cancelou = clienteInfo.cancelou;

    if (!premio || !nome || !dataProposta) continue;

    // Checar se essa proposta já foi processada nesse lote
    if (propostasImportadas.has(proposta)) {
      console.log(`  ⚠ Proposta ${proposta} duplicada no Excel, pulando`);
      continue;
    }

    // Checar se é uma das 14 vendas originais (por nome + valor)
    // Comparamos de forma mais flexível
    let isOriginal = false;
    for (const s of originals) {
      if (s.clientName.toUpperCase().trim() === nome.toUpperCase().trim() && Math.abs(s.value - premio) < 1) {
        isOriginal = true;
        break;
      }
    }
    
    if (isOriginal) {
      console.log(`  ⏭ ORIGINAL (já no banco): ${nome} - R$ ${premio.toLocaleString('pt-BR')} - Proposta ${proposta}`);
      skippedOriginal++;
      propostasImportadas.add(proposta);
      continue;
    }

    // Determinar produto e administradora
    const produtoTipo = produto.toLowerCase().includes('auto') ? 'auto' : 'imovel';
    const isPorto = seguradora.toLowerCase().includes('porto');
    const administradora = isPorto ? 'Porto Seguro' : 'Embracon';
    
    // Comissão: 4% do prêmio, dividido pelas parcelas de comissão (12x padrão)
    const parcelasComissao = 12;
    const comissaoBruta = premio * 0.04;
    const comissaoPorParcela = comissaoBruta / parcelasComissao;

    // O cliente está adimplente? (não cancelou na RptClienteLista)
    const adimplente = cancelou !== 'CANCELADO' && situacao === 'Ativa';

    try {
      const sale = await p.sale.create({
        data: {
          value: premio,
          closedAt: dataProposta,
          clientName: nome,
          assignedTo: 'celia',
          administradora,
          produto: produtoTipo,
          clienteCpf: cpf,
          clienteTelefone: clienteInfo.telefone || null,
          comissaoBruta,
          comissaoPorParcela,
          quantidadeParcelas: parcelasComissao,
          statusValidacao: adimplente ? 'validado' : 'aguardando',
          notes: `Proposta: ${proposta} | Apólice: ${apolice} | Sit: ${situacao} | Cancelou: ${cancelou || 'Não'} | Parcelas cota: ${parcelas}`,
        }
      });

      // Criar parcelas de comissão (12x)
      const installments = [];
      const now = new Date();
      for (let i = 1; i <= parcelasComissao; i++) {
        const venc = new Date(dataProposta);
        venc.setMonth(venc.getMonth() + (i - 1));
        const isPast = venc < now;
        
        let status;
        if (!adimplente) {
          status = 'CANCELADO'; // Cliente cancelou/venceu
        } else if (isPast) {
          status = 'PAGO'; // Já venceu e está adimplente
        } else {
          status = 'PENDENTE'; // Futuro
        }

        installments.push({
          saleId: sale.id,
          parcelaNumero: i,
          dataVencimento: venc,
          valorParcela: premio,
          pago: status === 'PAGO',
          status,
          dataPagamento: status === 'PAGO' ? venc : null,
        });
      }

      await p.installment.createMany({ data: installments });
      
      propostasImportadas.add(proposta);
      inserted++;
      
      const pagas = installments.filter(i => i.status === 'PAGO').length;
      const statusEmoji = adimplente ? '✅' : '⚠️';
      console.log(`  ${statusEmoji} ${nome} - R$ ${premio.toLocaleString('pt-BR')} (${administradora}/${produtoTipo}) - Proposta ${proposta} - ${pagas}/${parcelasComissao} pagas ${!adimplente ? '[CANCELADO/VENCIDA]' : ''}`);
    } catch (err) {
      errors++;
      console.error(`  ❌ Erro: ${nome} (Proposta ${proposta}): ${err.message}`);
    }
  }

  console.log(`\n========== RESULTADO FINAL ==========`);
  console.log(`Originais mantidas:    ${originals.length}`);
  console.log(`Novas inseridas:       ${inserted}`);
  console.log(`Puladas (originais):   ${skippedOriginal}`);
  console.log(`Erros:                 ${errors}`);
  console.log(`Total no banco agora:  ${originals.length + inserted}`);
  console.log(`=====================================`);
}

main().catch(console.error).finally(() => p.$disconnect());
