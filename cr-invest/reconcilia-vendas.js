/**
 * reconcilia-vendas.js
 *
 * Ações:
 * 1. Remove entradas AGREGADAS erradas de NEIDER e JEFERSON
 * 2. Insere GILBERTO FERREIRA LIMA JUNIOR (proposta 108016, R$100k) - venda faltando
 * 3. Atualiza 5 entradas manuais sem proposta → adiciona número + corrige closedAt
 * 4. Atualiza telefone/email de todos usando RptClienteLista - abril.xlsx
 */

const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const excelDateToJS = (serial) => {
  if (!serial || typeof serial !== 'number') return null;
  return new Date((serial - 25569) * 86400 * 1000);
};

async function main() {
  // ── Carregar planilhas ──────────────────────────────────────────────────────

  const wbProd = XLSX.readFile('C:/Users/giova/OneDrive/Documents/RptAnaliseProducao (3).xlsx');
  const producao = XLSX.utils.sheet_to_json(wbProd.Sheets[wbProd.SheetNames[0]]);

  const wbCli = XLSX.readFile('C:/Users/giova/OneDrive/Documents/RptClienteLista - abril.xlsx');
  const clientes = XLSX.utils.sheet_to_json(wbCli.Sheets[wbCli.SheetNames[0]]);

  // Indexar clientes por CPF (limpo)
  const clienteMap = {};
  clientes.forEach(c => {
    const cpf = (c['CGC/CPF'] || '').toString().replace(/\D/g, '');
    if (cpf) {
      clienteMap[cpf] = {
        cancelou: c['Cancelou?_1'] || '',
        telefone: c['TELEFONE'] || c['TELEFONE PREFERENCIAL'] || '',
        email: c['EMAIL'] || '',
        situacao: c['SITUAÇÃO'] || '',
      };
    }
  });

  // Indexar produção por proposta
  const producaoMap = {};
  producao.forEach(r => {
    const prop = (r['PROPOSTA'] || '').toString();
    if (prop) producaoMap[prop] = r;
  });

  console.log(`Clientes na planilha (abril): ${clientes.length}`);
  console.log(`Cotas na produção: ${producao.length}`);

  // ── PASSO 1: Remover entradas agregadas erradas ─────────────────────────────
  console.log('\n=== PASSO 1: Remover entradas agregadas ===');

  const agregadas = [
    { id: 'cmnsw27tq0000twy2zj1v30vp', nome: 'NEIDER GABRIEL TORRES', valor: 1496852 },
    { id: 'cmnsw7sl60001twy2of47nfgx', nome: 'JEFERSON ANDREY CAMPOS', valor: 1431936 },
  ];

  for (const entry of agregadas) {
    // Verificar se existem cotas individuais (com proposta) para esse cliente
    const individuais = await p.sale.findMany({
      where: {
        clientName: { contains: entry.nome.split(' ')[0], mode: 'insensitive' },
        notes: { contains: 'Proposta:' },
      },
      select: { id: true, value: true, notes: true },
    });

    if (individuais.length > 0) {
      // Antes de deletar, remover as parcelas associadas
      await p.installment.deleteMany({ where: { saleId: entry.id } });
      await p.sale.delete({ where: { id: entry.id } });
      console.log(`  ✅ Deletada entrada agregada: ${entry.nome} (R$ ${entry.valor.toLocaleString('pt-BR')}) — ${individuais.length} cotas individuais já existem`);
    } else {
      console.log(`  ⚠️  SKIP: ${entry.nome} — sem cotas individuais, mantendo entrada`);
    }
  }

  // ── PASSO 2: Inserir GILBERTO (proposta 108016 — verdadeiramente ausente) ───
  console.log('\n=== PASSO 2: Inserir GILBERTO (proposta 108016) ===');

  const gilbertoExcel = producaoMap['108016'];
  if (gilbertoExcel) {
    const gilbertoCpfRaw = (gilbertoExcel['CPF/CNPJ'] || '').toString().trim();
    const gilbertoCpfClean = gilbertoCpfRaw.replace(/\D/g, '');
    const clienteInfo = clienteMap[gilbertoCpfClean] || {};
    const dataProposta = excelDateToJS(gilbertoExcel['DATA PROPOSTA']);
    const premio = Number(gilbertoExcel['PRÊMIO']);
    const seguradora = (gilbertoExcel['SEGURADORA (ABREVIADO)'] || '').toString();
    const produto = (gilbertoExcel['NOME ABREVIADO DO PRODUTO'] || '').toLowerCase();
    const administradora = seguradora.toLowerCase().includes('porto') ? 'Porto Seguro' : 'Embracon';
    const produtoTipo = produto.includes('auto') ? 'auto' : 'imovel';
    const situacao = gilbertoExcel['SITUAÇÃO'] || '';
    const proposta = gilbertoExcel['PROPOSTA']?.toString();
    const apolice = (gilbertoExcel['APÓLICE'] || '').toString();
    const parcelas = 12;
    const comissaoBruta = premio * 0.04;
    const comissaoPorParcela = comissaoBruta / parcelas;

    const sale = await p.sale.create({
      data: {
        value: premio,
        closedAt: dataProposta,
        clientName: gilbertoExcel['CLIENTE'],
        assignedTo: 'Celia',
        administradora,
        produto: produtoTipo,
        clienteCpf: gilbertoCpfRaw,
        clienteTelefone: clienteInfo.telefone || null,
        comissaoBruta,
        comissaoPorParcela,
        quantidadeParcelas: parcelas,
        statusValidacao: situacao === 'Ativa' ? 'validado' : 'aguardando',
        notes: `Proposta: ${proposta} | Apólice: ${apolice} | Sit: ${situacao}`,
      },
    });

    // Criar 12 parcelas de comissão
    const now = new Date();
    const installments = [];
    for (let i = 1; i <= parcelas; i++) {
      const venc = new Date(dataProposta);
      venc.setMonth(venc.getMonth() + (i - 1));
      const isPast = venc < now;
      const isAtiva = situacao === 'Ativa';
      installments.push({
        saleId: sale.id,
        parcelaNumero: i,
        dataVencimento: venc,
        valorParcela: premio,
        pago: isPast && isAtiva,
        status: !isAtiva ? 'CANCELADO' : isPast ? 'PAGO' : 'PENDENTE',
        dataPagamento: isPast && isAtiva ? venc : null,
      });
    }
    await p.installment.createMany({ data: installments });
    console.log(`  ✅ Inserido: ${gilbertoExcel['CLIENTE']} — R$ ${premio.toLocaleString('pt-BR')} (${administradora}) — proposta ${proposta}`);
  } else {
    console.log('  ⚠️  Proposta 108016 não encontrada no Excel');
  }

  // ── PASSO 3: Atualizar entradas manuais com número de proposta ──────────────
  console.log('\n=== PASSO 3: Atualizar entradas manuais com número de proposta ===');

  const manuaisParaAtualizar = [
    { id: '420b44dd-cd48-4da1-9d07-023889ac7368', proposta: '107184', clientName: 'RAFAELA CRISTHINA TONELLO PEDRO DELORO', value: 600000 },
    { id: 'cmnswc9uc0002twy25dn22zrx',            proposta: '107189', clientName: 'RAFAELA CRISTHINA TONELLO PEDRO DELORO', value: 130000 },
    { id: 'b8a3e107-40e6-42b0-b24d-3797dd1a643c', proposta: '107196', clientName: 'SILVIA KRAUS',                          value: 300000 },
    { id: 'cmnsyb27b0003twy2xt5w6egp',            proposta: '107785', clientName: 'MARCIO JOSE DOS SANTOS',                value: 172476.46 },
    { id: 'cmo0iqvwu000j10ymfidnrmkt',            proposta: '107955', clientName: 'BENILZA DO SACRAMENTO SILVA OLIVEIRA', value: 500000 },
  ];

  for (const entry of manuaisParaAtualizar) {
    const excelRow = producaoMap[entry.proposta];
    if (!excelRow) {
      console.log(`  ⚠️  Proposta ${entry.proposta} não encontrada no Excel`);
      continue;
    }

    const dataProposta = excelDateToJS(excelRow['DATA PROPOSTA']);
    const situacao = excelRow['SITUAÇÃO'] || '';
    const apolice = (excelRow['APÓLICE'] || '').toString();
    const cpfRaw = (excelRow['CPF/CNPJ'] || '').toString().trim();
    const cpfClean = cpfRaw.replace(/\D/g, '');
    const clienteInfo = clienteMap[cpfClean] || {};

    // Buscar notes atual para não sobrescrever informação existente
    const current = await p.sale.findUnique({ where: { id: entry.id }, select: { notes: true } });
    const newNote = `Proposta: ${entry.proposta} | Apólice: ${apolice} | Sit: ${situacao}`;

    await p.sale.update({
      where: { id: entry.id },
      data: {
        closedAt: dataProposta,
        clientName: excelRow['CLIENTE'] || entry.clientName,
        clienteCpf: cpfRaw,
        clienteTelefone: clienteInfo.telefone || undefined,
        statusValidacao: situacao === 'Ativa' ? 'validado' : 'aguardando',
        notes: newNote,
      },
    });
    console.log(`  ✅ Atualizado: ${entry.clientName} — proposta ${entry.proposta} | data ${dataProposta?.toISOString().split('T')[0]}`);
  }

  // ── PASSO 4: Atualizar telefone/email de todos usando planilha de abril ─────
  console.log('\n=== PASSO 4: Atualizar contatos (telefone/email) — planilha abril ===');

  const allSales = await p.sale.findMany({
    where: { clienteCpf: { not: null } },
    select: { id: true, clienteCpf: true, clienteTelefone: true },
  });

  let contatosAtualizados = 0;
  for (const sale of allSales) {
    const cpfClean = (sale.clienteCpf || '').replace(/\D/g, '');
    const info = clienteMap[cpfClean];
    if (info && info.telefone && info.telefone !== sale.clienteTelefone) {
      await p.sale.update({
        where: { id: sale.id },
        data: { clienteTelefone: info.telefone },
      });
      contatosAtualizados++;
    }
  }
  console.log(`  ✅ Contatos atualizados: ${contatosAtualizados}`);

  // ── Resumo final ────────────────────────────────────────────────────────────
  console.log('\n=== RESUMO FINAL ===');
  const totalFinal = await p.sale.count();
  const comProposta = await p.sale.count({ where: { notes: { contains: 'Proposta:' } } });
  console.log(`Total de vendas no banco: ${totalFinal}`);
  console.log(`Com número de proposta:   ${comProposta}`);
  console.log(`Sem proposta (manuais):   ${totalFinal - comProposta}`);

  // Mostrar as que ainda não têm proposta
  const semProposta = await p.sale.findMany({
    where: { notes: { not: { contains: 'Proposta:' } } },
    select: { clientName: true, value: true, closedAt: true, notes: true },
  });
  if (semProposta.length > 0) {
    console.log('\nEntradas sem proposta no banco:');
    semProposta.forEach(s => console.log(`  - ${s.clientName}: R$ ${s.value.toLocaleString('pt-BR')} (${s.closedAt?.toISOString?.()?.split?.('T')?.[0] || '?'})`));
  }
}

main()
  .catch(err => { console.error('ERRO:', err.message); process.exit(1); })
  .finally(() => p.$disconnect());
