const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// ---- 1. Ler os dois arquivos ----
const wb1 = XLSX.readFile('C:/Users/giova/OneDrive/Documents/RptClienteLista.xlsx');
const clientes = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);

const wb2 = XLSX.readFile('C:/Users/giova/OneDrive/Documents/RptAnaliseProducao (3).xlsx');
const producao = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);

// ---- 2. Indexar clientes por CPF/CNPJ ----
const clienteMap = {};
clientes.forEach(c => {
  const cpf = (c['CGC/CPF'] || '').toString().trim();
  if (cpf) {
    clienteMap[cpf] = {
      nome: c['NOME'],
      cancelou: c['Cancelou?'] || null,
      tipo: c['TIPO'],
      clienteDesde: c['CLIENTE DESDE'],
      tipoPessoa: c['TIPO PESSOA'],
      situacao: c['SITUAÇÃO'],
      telefone: c['TELEFONE'],
      email: c['EMAIL'],
      cidade: c['CIDADE'],
      estado: c['ESTADO'],
    };
  }
});

console.log(`Clientes indexados: ${Object.keys(clienteMap).length}`);
console.log(`Produções encontradas: ${producao.length}`);

// ---- 3. Cruzar dados e preparar vendas ----
const excelDateToJS = (serial) => {
  if (!serial || typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000);
};

const vendas = [];
producao.forEach(p => {
  const cpf = (p['CPF/CNPJ'] || '').toString().trim();
  const nomeProducao = p['CLIENTE'] || '';
  const premio = Number(p['PRÊMIO']) || 0;
  const dataProposta = excelDateToJS(p['DATA PROPOSTA']);
  const situacao = p['SITUAÇÃO'] || '';
  const seguradora = p['SEGURADORA (ABREVIADO)'] || p['SEGURADORA'] || '';
  const produto = p['NOME ABREVIADO DO PRODUTO'] || p['NOME COMPLETO DO PRODUTO'] || '';
  const parcelas = Number(p['QUANTIDADE DE PARCELAS']) || 0;
  const comissaoPerc = Number(p['PORCENTAGEM']) || Number(p['% COM. BASE']) || 4;
  const proposta = p['PROPOSTA'] || '';
  const apolice = p['APÓLICE'] || '';

  // Busca dados do cliente no RptClienteLista
  const clienteInfo = clienteMap[cpf] || null;
  const cancelou = clienteInfo?.cancelou || null;

  // Calcular comissão bruta (4% da cota)
  const comissaoBruta = premio * 0.04;
  
  // Descontos Porto Seguro
  const isPorto = seguradora.toLowerCase().includes('porto');
  const royalties = isPorto ? comissaoBruta * 0.084 : 0;
  const impostos = isPorto ? comissaoBruta * 0.069 : comissaoBruta * 0.07;
  const comissaoLiquida = comissaoBruta - royalties - impostos;

  vendas.push({
    cpf,
    nome: nomeProducao || clienteInfo?.nome || 'Desconhecido',
    premio,
    dataProposta,
    situacao,
    cancelou,
    seguradora,
    produto,
    parcelas,
    proposta,
    apolice,
    comissaoBruta,
    royalties,
    impostos,
    comissaoLiquida,
    telefone: clienteInfo?.telefone || '',
    email: clienteInfo?.email || '',
    cidade: clienteInfo?.cidade || '',
    estado: clienteInfo?.estado || '',
    tipoPessoa: clienteInfo?.tipoPessoa || '',
  });
});

console.log(`\nTotal de vendas/cotas cruzadas: ${vendas.length}`);

// ---- 4. Resumo ----
const totalPremio = vendas.reduce((s, v) => s + v.premio, 0);
const totalComBruta = vendas.reduce((s, v) => s + v.comissaoBruta, 0);
const totalRoyalties = vendas.reduce((s, v) => s + v.royalties, 0);
const totalImpostos = vendas.reduce((s, v) => s + v.impostos, 0);
const totalComLiq = vendas.reduce((s, v) => s + v.comissaoLiquida, 0);

console.log(`\n========== RESUMO FINANCEIRO ==========`);
console.log(`Total em Cotas (Prêmio):    R$ ${totalPremio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
console.log(`Comissão Bruta (4%):        R$ ${totalComBruta.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
console.log(`(-) Royalties (8.4%):       R$ ${totalRoyalties.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
console.log(`(-) Impostos (6.9%/7%):     R$ ${totalImpostos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
console.log(`= Comissão Líquida:         R$ ${totalComLiq.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
console.log(`=======================================`);

// Status breakdown
const statusCount = {};
vendas.forEach(v => {
  const s = v.situacao || 'Sem status';
  statusCount[s] = (statusCount[s] || 0) + 1;
});
console.log(`\nVendas por Situação:`);
Object.entries(statusCount).sort((a,b) => b[1] - a[1]).forEach(([s, c]) => {
  console.log(`  ${s}: ${c}`);
});

// Cancelamentos
const cancelados = vendas.filter(v => v.cancelou === 'CANCELADO');
console.log(`\nCotas com cliente CANCELADO: ${cancelados.length} (${cancelados.reduce((s,v) => s + v.premio, 0).toLocaleString('pt-BR')} em prêmios)`);

// Clientes com múltiplas cotas
const porCliente = {};
vendas.forEach(v => {
  porCliente[v.nome] = (porCliente[v.nome] || 0) + 1;
});
const multiCotas = Object.entries(porCliente).filter(([,c]) => c > 1).sort((a,b) => b[1] - a[1]);
console.log(`\nClientes com múltiplas cotas: ${multiCotas.length}`);
multiCotas.slice(0, 10).forEach(([nome, qtd]) => {
  const total = vendas.filter(v => v.nome === nome).reduce((s,v) => s + v.premio, 0);
  console.log(`  ${nome}: ${qtd} cotas (R$ ${total.toLocaleString('pt-BR')})`);
});

// ---- 5. Exportar para Excel ----
const exportData = vendas.map(v => ({
  'Nome': v.nome,
  'CPF/CNPJ': v.cpf,
  'Valor Cota (Prêmio)': v.premio,
  'Data Proposta': v.dataProposta ? v.dataProposta.toLocaleDateString('pt-BR') : '',
  'Situação': v.situacao,
  'Cancelou?': v.cancelou || '',
  'Seguradora': v.seguradora,
  'Produto': v.produto,
  'Parcelas': v.parcelas,
  'Proposta': v.proposta,
  'Apólice': v.apolice,
  'Comissão Bruta (4%)': Math.round(v.comissaoBruta * 100) / 100,
  'Royalties (8.4%)': Math.round(v.royalties * 100) / 100,
  'Impostos (6.9%)': Math.round(v.impostos * 100) / 100,
  'Comissão Líquida': Math.round(v.comissaoLiquida * 100) / 100,
  'Telefone': v.telefone,
  'Email': v.email,
  'Cidade': v.cidade,
  'Estado': v.estado,
  'Tipo Pessoa': v.tipoPessoa,
}));

const wbOut = XLSX.utils.book_new();
const wsOut = XLSX.utils.json_to_sheet(exportData);

// Formatar largura das colunas
wsOut['!cols'] = [
  {wch: 35}, {wch: 20}, {wch: 18}, {wch: 14}, {wch: 12},
  {wch: 12}, {wch: 20}, {wch: 20}, {wch: 10}, {wch: 10},
  {wch: 15}, {wch: 16}, {wch: 15}, {wch: 15}, {wch: 16},
  {wch: 18}, {wch: 30}, {wch: 20}, {wch: 8}, {wch: 12}
];

XLSX.utils.book_append_sheet(wbOut, wsOut, 'Vendas CR Invest');
const outputPath = 'C:/Users/giova/OneDrive/Documents/CR_Invest_Vendas_Cruzamento.xlsx';
XLSX.writeFile(wbOut, outputPath);
console.log(`\n✅ Arquivo exportado: ${outputPath}`);

p.$disconnect();
