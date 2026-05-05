/**
 * Reconciliação por colagem no terminal
 *
 * Uso:
 *   node reconcile-paste.js 2026-04
 *   (cole os dados, pressione Enter + Ctrl+D para finalizar)
 *
 * Formato aceito (separado por tabs ou múltiplos espaços):
 *   Apólice    CPF/CNPJ    Cliente    Prêmio
 *   999815960  008.642.030/0001-03  AL&DD...  83333
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
const p = new PrismaClient();

function normalizeCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function parseBRL(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/R\$\s*/,'').replace(/\./g,'').replace(',','.')) || 0;
}

function parseLine(line) {
  // Divide por tab ou 2+ espaços
  const parts = line.trim().split(/\t|  +/).map(s => s.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  // Detecta qual coluna é o CPF (tem . e - ou / seguido de dígitos)
  let cpfIdx = parts.findIndex(p => /\d{3}[.\-\/]\d{3}/.test(p));
  if (cpfIdx === -1) return null;

  const cpf    = normalizeCpf(parts[cpfIdx]);
  const nome   = parts[cpfIdx + 1] || '';
  const premio = parseBRL(parts[cpfIdx + 2]);

  // Comissão Porto: coluna antes do Apólice (cpfIdx-2) ou cpfIdx-1 se for R$
  let comissaoPorto = 0;
  for (let i = 0; i < cpfIdx; i++) {
    if (/R\$/.test(parts[i]) || /^\d{1,3}(\.\d{3})*,\d{2}$/.test(parts[i])) {
      comissaoPorto = parseBRL(parts[i]);
    }
  }

  return { cpf, nome, premio, comissaoPorto };
}

async function main() {
  const refMonth = process.argv[2];
  if (!refMonth || !/^\d{4}-\d{2}$/.test(refMonth)) {
    console.error('Uso: node reconcile-paste.js YYYY-MM');
    console.error('Ex:  node reconcile-paste.js 2026-04');
    process.exit(1);
  }

  console.log(`\n📅 Mês: ${refMonth} — Cole os dados e pressione Ctrl+D para processar\n`);

  // Lê stdin
  const rl = readline.createInterface({ input: process.stdin });
  const lines = [];
  for await (const line of rl) lines.push(line);

  // Parseia linhas (ignora cabeçalho e vazias)
  const excelItems = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (/apólice|apolice|cpf/i.test(line)) continue; // cabeçalho
    const item = parseLine(line);
    if (item && item.cpf.length >= 11) excelItems.push(item);
  }

  if (excelItems.length === 0) {
    console.error('Nenhuma linha válida encontrada.');
    process.exit(1);
  }

  // Agrupa por CPF (cliente pode ter múltiplas apólices)
  const byCpf = new Map();
  for (const item of excelItems) {
    if (!byCpf.has(item.cpf)) {
      byCpf.set(item.cpf, { nome: item.nome, totalPremio: 0, totalComPorto: 0, linhas: 0 });
    }
    const e = byCpf.get(item.cpf);
    e.totalPremio    += item.premio;
    e.totalComPorto  += item.comissaoPorto;
    e.linhas++;
  }

  console.log(`\n✅ ${excelItems.length} linhas lidas | ${byCpf.size} CPFs únicos`);

  // Carrega vendas do banco
  const [refY, refM] = refMonth.split('-').map(Number);
  const monthStart = new Date(Date.UTC(refY, refM - 1, 1));
  const monthEnd   = new Date(Date.UTC(refY, refM, 0, 23, 59, 59));

  const allSales = await p.sale.findMany({
    include: { installments: { orderBy: { parcelaNumero: 'asc' } } },
  });

  const salesByCpf = new Map();
  for (const s of allSales) {
    const cpf = normalizeCpf(s.clienteCpf);
    if (!cpf) continue;
    if (!salesByCpf.has(cpf)) salesByCpf.set(cpf, []);
    salesByCpf.get(cpf).push(s);
  }

  // ── Cruzamento ──────────────────────────────────────────────────────────────
  const found      = []; // no Excel E no banco
  const notFound   = []; // no Excel mas não no banco (contrato antigo)
  const notPaid    = []; // no banco com parcela no mês mas NÃO no Excel

  for (const [cpf, entry] of byCpf.entries()) {
    const sales = salesByCpf.get(cpf) || [];

    if (sales.length === 0) {
      notFound.push({ cpf, ...entry });
      continue;
    }

    for (const sale of sales) {
      // Parcela no mês de referência
      const inst = (sale.installments || []).find(i =>
        i.status !== 'CANCELADO' &&
        new Date(i.dataVencimento) >= monthStart &&
        new Date(i.dataVencimento) <= monthEnd
      ) || (sale.installments || []).find(i =>
        !i.pago && i.status !== 'CANCELADO'
      );

      if (!inst) continue;

      const dbComLiq = (sale.value * 0.04) / Math.max(1, sale.installments.length) * (1 - 0.084 - 0.069);

      found.push({
        cpf, nome: entry.nome, totalPremio: entry.totalPremio,
        totalComPorto: entry.totalComPorto,
        sale, inst, dbComLiq,
        pago: inst.pago || inst.status === 'PAGO',
      });
    }
  }

  // Quem está no banco com parcela no mês mas não apareceu no Excel
  const excelCpfs = new Set(byCpf.keys());
  for (const s of allSales) {
    const cpf = normalizeCpf(s.clienteCpf);
    if (!cpf || excelCpfs.has(cpf)) continue;
    const inst = (s.installments || []).find(i =>
      (i.status === 'PENDENTE' || i.status === 'INADIMPLENTE') &&
      new Date(i.dataVencimento) >= monthStart &&
      new Date(i.dataVencimento) <= monthEnd
    );
    if (inst) {
      const dbComLiq = (s.value * 0.04) / Math.max(1, s.installments.length) * (1 - 0.084 - 0.069);
      notPaid.push({ sale: s, inst, dbComLiq });
    }
  }

  // ── Relatório ────────────────────────────────────────────────────────────────
  const sep = '─'.repeat(88);

  // Encontrados
  console.log(`\n${'═'.repeat(88)}`);
  console.log(`✅  NO EXCEL E NO BANCO — ${found.length} contratos`);
  console.log('═'.repeat(88));
  console.log(`  ${'Cliente'.padEnd(38)} P#  Status          Porto (real)   DB (calculado)`);
  console.log(`  ${sep}`);
  let totalPorto = 0, totalComDb = 0;
  for (const f of found) {
    const status = f.pago ? '✓ PAGO' : `⚠ ${f.inst.status}`;
    const portoStr = f.totalComPorto > 0 ? fmtBRL(f.totalComPorto) : '—';
    const diff = f.totalComPorto > 0 && Math.abs(f.totalComPorto - f.dbComLiq) > 5
      ? ` ← Δ ${fmtBRL(f.totalComPorto - f.dbComLiq)}` : '';
    console.log(
      `  ${f.nome.padEnd(38)} P${String(f.inst.parcelaNumero).padStart(2)}  ${status.padEnd(15)} ${portoStr.padStart(12)}  ${fmtBRL(f.dbComLiq).padStart(12)}${diff}`
    );
    totalPorto += f.totalComPorto;
    totalComDb += f.dbComLiq;
  }
  console.log(`  ${sep}`);
  console.log(`  ${'TOTAL'.padEnd(38)}      ${''.padEnd(15)} ${fmtBRL(totalPorto).padStart(12)}  ${fmtBRL(totalComDb).padStart(12)}`);

  // Não pagaram (no banco mas fora do Excel)
  if (notPaid.length > 0) {
    console.log(`\n${'═'.repeat(88)}`);
    console.log(`⚠️  NO BANCO (parcela em ${refMonth}) MAS NÃO PAGARAM — ${notPaid.length} contratos`);
    console.log('═'.repeat(88));
    let totalNP = 0;
    for (const { sale, inst, dbComLiq } of notPaid) {
      console.log(`  ${sale.clientName.padEnd(40)} P${String(inst.parcelaNumero).padStart(2)}   ${inst.status.padEnd(14)} ${''.padStart(13)}  ${fmtBRL(dbComLiq).padStart(11)}`);
      totalNP += dbComLiq;
    }
    console.log(`  ${sep}`);
    console.log(`  ${'TOTAL NÃO RECEBIDO'.padEnd(40)}${' '.repeat(33)}${fmtBRL(totalNP).padStart(11)}`);
  }

  // Não no banco (contratos antigos deletados)
  if (notFound.length > 0) {
    console.log(`\n${'═'.repeat(88)}`);
    console.log(`❓  NO EXCEL MAS NÃO NO BANCO (${notFound.length} CPFs — contratos antigos)`);
    console.log('═'.repeat(88));
    for (const nf of notFound) {
      console.log(`  ${nf.nome.padEnd(40)} CPF: ${nf.cpf} | ${nf.linhas} apólice(s) | Prêmio: ${fmtBRL(nf.totalPremio)}`);
    }
  }

  console.log(`\n`);
}

main().catch(console.error).finally(() => p.$disconnect());
