const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const excelDateToJS = (serial) => {
  if (!serial || typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000);
};

async function main() {
  // 1. Carregar dados dos Excel
  const wb1 = XLSX.readFile('C:/Users/giova/OneDrive/Documents/RptClienteLista.xlsx');
  const clientes = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);
  
  const wb2 = XLSX.readFile('C:/Users/giova/OneDrive/Documents/RptAnaliseProducao (3).xlsx');
  const producao = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);

  // Indexar clientes por CPF
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

  // 2. Buscar vendas já existentes no banco
  const existingSales = await p.sale.findMany({
    select: { clienteCpf: true, value: true, closedAt: true, clientName: true }
  });
  
  console.log(`Vendas já no banco: ${existingSales.length}`);
  
  // Criar um Set de chaves únicas para checar duplicatas (CPF + valor)
  const existingKeys = new Set();
  existingSales.forEach(s => {
    const key = `${(s.clienteCpf || '').trim()}_${s.value}`;
    existingKeys.add(key);
  });

  // 3. Preparar vendas novas
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of producao) {
    const cpf = (row['CPF/CNPJ'] || '').toString().trim();
    const nome = row['CLIENTE'] || '';
    const premio = Number(row['PRÊMIO']) || 0;
    const dataProposta = excelDateToJS(row['DATA PROPOSTA']);
    const situacao = row['SITUAÇÃO'] || '';
    const seguradora = (row['SEGURADORA (ABREVIADO)'] || row['SEGURADORA'] || '').toString();
    const produto = (row['NOME ABREVIADO DO PRODUTO'] || '').toString();
    const parcelas = Number(row['QUANTIDADE DE PARCELAS']) || 200;
    const proposta = (row['PROPOSTA'] || '').toString();
    const apolice = (row['APÓLICE'] || '').toString();
    const clienteInfo = clienteMap[cpf] || {};

    if (!premio || !nome || !dataProposta) {
      skipped++;
      continue;
    }

    // Check duplicata por CPF + valor da cota
    const key = `${cpf}_${premio}`;
    if (existingKeys.has(key)) {
      console.log(`  ⏭ SKIP (já existe): ${nome} - R$ ${premio.toLocaleString('pt-BR')}`);
      skipped++;
      continue;
    }

    // Determinar produto
    const produtoTipo = produto.toLowerCase().includes('auto') ? 'auto' : 'imovel';
    
    // Comissão bruta (4%)
    const comissaoBruta = premio * 0.04;
    // Parcela da comissão
    const parcelasComissao = 12; // comissão sempre em 12x
    const comissaoPorParcela = comissaoBruta / parcelasComissao;

    // Determinar administradora
    const isPorto = seguradora.toLowerCase().includes('porto');
    const administradora = isPorto ? 'Porto Seguro' : 'Embracon';

    try {
      // Criar Sale
      const sale = await p.sale.create({
        data: {
          value: premio,
          closedAt: dataProposta,
          clientName: nome,
          assignedTo: 'celia', // Todas da closer Célia
          administradora,
          produto: produtoTipo,
          clienteCpf: cpf,
          clienteTelefone: clienteInfo.telefone || null,
          comissaoBruta,
          comissaoPorParcela,
          quantidadeParcelas: parcelasComissao,
          statusValidacao: situacao === 'Ativa' ? 'validado' : 'aguardando',
          notes: `Proposta: ${proposta} | Apólice: ${apolice} | Sit: ${situacao} | Parcelas cota: ${parcelas}`,
        }
      });

      // Criar 12 parcelas de comissão
      const installments = [];
      for (let i = 1; i <= parcelasComissao; i++) {
        const venc = new Date(dataProposta);
        venc.setMonth(venc.getMonth() + (i - 1));
        
        // Parcelas com vencimento no passado = PAGO (se a cota estiver ativa)
        const now = new Date();
        const isPast = venc < now;
        const isAtiva = situacao === 'Ativa';
        
        installments.push({
          saleId: sale.id,
          parcelaNumero: i,
          dataVencimento: venc,
          valorParcela: premio, // valor da cota (para cálculo de comissão no KPI)
          pago: isPast && isAtiva,
          status: !isAtiva ? 'CANCELADO' : isPast ? 'PAGO' : 'PENDENTE',
          dataPagamento: isPast && isAtiva ? venc : null,
        });
      }

      await p.installment.createMany({ data: installments });
      
      existingKeys.add(key); // Evitar duplicatas dentro do próprio lote
      inserted++;
      console.log(`  ✅ ${nome} - R$ ${premio.toLocaleString('pt-BR')} (${administradora} - ${produtoTipo}) - ${installments.filter(i => i.status === 'PAGO').length} parcelas pagas`);
    } catch (err) {
      errors++;
      console.error(`  ❌ Erro em ${nome}: ${err.message}`);
    }
  }

  console.log(`\n========== RESULTADO ==========`);
  console.log(`Inseridas:  ${inserted}`);
  console.log(`Ignoradas:  ${skipped} (já existiam ou sem dados)`);
  console.log(`Erros:      ${errors}`);
  console.log(`===============================`);
}

main().catch(console.error).finally(() => p.$disconnect());
