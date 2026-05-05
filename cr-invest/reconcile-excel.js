/**
 * Reconciliação Excel Porto Seguro (multi-abas) × banco de dados
 *
 * Uso: node reconcile-excel.js <caminho-do-excel> [aba]
 *   Ex: node reconcile-excel.js ~/Downloads/comissoes.xlsx
 *       node reconcile-excel.js ~/Downloads/comissoes.xlsx "MAR-26"
 *
 * Lê cada aba do Excel (ex: JUN-25, OUT-25, JAN-26...)
 * e faz a reconciliação mês a mês.
 */

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const readline = require('readline');

const p = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

function excelDate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  return new Date((serial - 25569) * 86400000);
}

function normalizeCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 7);
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase()); }));
}

// Converte nome da aba → YYYY-MM
// Ex: "JUN-25" → "2025-06" | "JAN-26" → "2026-01" | "APR-2026" → "2026-04"
function sheetNameToMonth(name) {
  const ptMonths = { JAN:1, FEV:2, MAR:3, ABR:4, MAI:5, JUN:6, JUL:7, AGO:8, SET:9, OUT:10, NOV:11, DEZ:12 };
  const enMonths = { JAN:1, FEB:2, MAR:3, APR:4, MAY:5, JUN:6, JUL:7, AUG:8, SEP:9, OCT:10, NOV:11, DEC:12 };

  // Ex: "OUT-25", "MAR-26", "APR-2026"
  const m = name.toUpperCase().match(/([A-Z]+)[^0-9]*(\d{2,4})/);
  if (!m) return null;

  const abbr = m[1];
  const yearRaw = m[2];
  const year = yearRaw.length === 2 ? 2000 + parseInt(yearRaw) : parseInt(yearRaw);
  const month = ptMonths[abbr] || enMonths[abbr];
  if (!month) return null;

  return `${year}-${String(month).padStart(2, '0')}`;
}

// ── Parseia uma aba do Excel ──────────────────────────────────────────────────
function parseSheet(sheetData, sheetName) {
  const rows = XLSX.utils.sheet_to_json(sheetData, { header: 1 });

  // Encontra linha de cabeçalho — procura linha com CPF ou Cliente
  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const rStr = r.map(c => String(c || '').toLowerCase());
    if (rStr.some(c => c.includes('cpf') || c.includes('cliente'))) {
      headerRow = i; break;
    }
  }
  if (headerRow === -1) return [];

  const headers = rows[headerRow].map(h => String(h || '').trim());
  const col = (name) => {
    const idx = headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
    return idx;
  };

  const iCpf      = col('cpf');
  const iNome     = col('cliente');
  const iComLiq   = col('comissão líquida') !== -1 ? col('comissão líquida') : col('comissão');
  const iParcelas = col('parcelas');
  const iProposta = col('proposta');
  const iInicio   = col('início') !== -1 ? col('início') : col('inicio');
  const iFim      = col('término') !== -1 ? col('término') : col('termino');
  const iDataRec  = col('data recebimento') !== -1 ? col('data recebimento') : col('recebimento');

  if (iCpf === -1) return [];

  const items = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(c => c == null || c === '')) continue;
    const cpf = normalizeCpf(r[iCpf]);
    if (!cpf || cpf.length < 11) continue;

    // Comissão: pode ser valor numérico ou string "R$ 1.000,00"
    let comLiq = 0;
    const comRaw = r[iComLiq];
    if (typeof comRaw === 'number') {
      comLiq = comRaw;
    } else if (typeof comRaw === 'string') {
      comLiq = parseFloat(comRaw.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    }

    items.push({
      cpf,
      nome:        String(r[iNome] || '').trim(),
      comLiq,
      parcelaDate: iParcelas !== -1 ? excelDate(r[iParcelas]) : null,
      dataRec:     iDataRec !== -1 ? excelDate(r[iDataRec]) : null,
      proposta:    iProposta !== -1 && r[iProposta] ? String(r[iProposta]).trim() : null,
      inicio:      iInicio !== -1 ? excelDate(r[iInicio]) : null,
      fim:         iFim !== -1 ? excelDate(r[iFim]) : null,
    });
  }

  return items;
}

// ── Reconcilia um mês ─────────────────────────────────────────────────────────
async function reconcileMonth(items, refMonth, allSales, salesByCpf, saleByProposta, dryRun) {
  const [refY, refM] = refMonth.split('-').map(Number);
  const monthStart = new Date(Date.UTC(refY, refM - 1, 1));
  const monthEnd   = new Date(Date.UTC(refY, refM, 0, 23, 59, 59));

  const matched     = [];
  const notFound    = [];
  const alreadyPaid = [];

  for (const item of items) {
    // Match por Proposta primeiro
    let sale = item.proposta ? saleByProposta.get(item.proposta) : null;

    // Fallback: CPF
    if (!sale) {
      const salesForCpf = salesByCpf.get(item.cpf) || [];
      if (salesForCpf.length === 1) {
        sale = salesForCpf[0];
      } else if (salesForCpf.length > 1) {
        // Escolhe a venda com parcela mais próxima da data do Excel
        let bestDiff = Infinity;
        const refDate = item.parcelaDate || monthStart;
        for (const s of salesForCpf) {
          for (const inst of s.installments) {
            const diff = Math.abs(new Date(inst.dataVencimento) - refDate);
            if (diff < bestDiff) { bestDiff = diff; sale = s; }
          }
        }
      }
    }

    if (!sale) { notFound.push({ item }); continue; }

    // Encontra a parcela certa: mais próxima da data do Excel dentro do mês
    let inst = null;
    const refDate = item.parcelaDate || monthStart;

    // Prioridade 1: parcela com vencimento no mês
    const instsMes = sale.installments.filter(i =>
      i.status !== 'CANCELADO' &&
      new Date(i.dataVencimento) >= monthStart &&
      new Date(i.dataVencimento) <= monthEnd
    );
    if (instsMes.length === 1) {
      inst = instsMes[0];
    } else if (instsMes.length > 1) {
      // Múltiplas no mês: pega a mais próxima da data da parcela
      let best = Infinity;
      for (const i of instsMes) {
        const d = Math.abs(new Date(i.dataVencimento) - refDate);
        if (d < best) { best = d; inst = i; }
      }
    }

    // Prioridade 2: parcela PENDENTE mais próxima
    if (!inst) {
      let best = Infinity;
      for (const i of sale.installments) {
        if (i.status === 'CANCELADO') continue;
        const d = Math.abs(new Date(i.dataVencimento) - refDate);
        if (d < best) { best = d; inst = i; }
      }
    }

    if (!inst) { notFound.push({ item, sale, reason: 'sem parcela' }); continue; }

    if (inst.pago || inst.status === 'PAGO') {
      alreadyPaid.push({ item, sale, inst });
    } else {
      matched.push({ item, sale, inst });
    }
  }

  // Vendas com parcela no mês mas não no Excel (não pagaram)
  const excelCpfs      = new Set(items.map(x => x.cpf));
  const excelPropostas = new Set(items.map(x => x.proposta).filter(Boolean));
  const notPaid = [];
  for (const s of allSales) {
    const cpf   = normalizeCpf(s.clienteCpf);
    const prop  = (s.notes || '').match(/Proposta[:\s]+(\d+)/i)?.[1];
    if (excelCpfs.has(cpf) || (prop && excelPropostas.has(prop))) continue;
    const inst = (s.installments || []).find(i =>
      i.status !== 'CANCELADO' && i.status !== 'PAGO' && !i.pago &&
      new Date(i.dataVencimento) >= monthStart &&
      new Date(i.dataVencimento) <= monthEnd
    );
    if (inst) {
      const dbComLiq = (s.value * 0.04) / Math.max(1, s.installments.length) * (1 - 0.084 - 0.069);
      notPaid.push({ sale: s, inst, dbComLiq });
    }
  }

  // ── Imprime resultado do mês ────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(90)}`);
  console.log(`📅 ${refMonth}  |  Excel: ${items.length} linhas  |  ✅ ${matched.length} pagar  |  ℹ️ ${alreadyPaid.length} já pagos  |  ❓ ${notFound.length} não achados  |  ⚠️ ${notPaid.length} não pagaram`);
  console.log('═'.repeat(90));

  if (matched.length > 0) {
    console.log(`\n  ✅ PARA MARCAR COMO PAGO:`);
    let tot = 0;
    for (const { item, sale, inst } of matched) {
      const dbComLiq = (sale.value * 0.04) / Math.max(1, sale.installments.length) * (1 - 0.084 - 0.069);
      console.log(`     ${item.nome.padEnd(38)} P${inst.parcelaNumero.toString().padStart(2)} | Excel: ${fmtBRL(item.comLiq).padStart(10)} | DB: ${fmtBRL(dbComLiq).padStart(10)}`);
      tot += item.comLiq;
    }
    console.log(`     ${'─'.repeat(60)}  Total Excel: ${fmtBRL(tot)}`);
  }

  if (notFound.length > 0) {
    console.log(`\n  ❓ NÃO ENCONTRADOS NO BANCO:`);
    for (const { item, reason } of notFound) {
      console.log(`     ${item.nome.padEnd(38)} CPF: ${item.cpf} | Proposta: ${item.proposta || '—'} | ${fmtBRL(item.comLiq)}${reason ? ' ('+reason+')' : ''}`);
    }
  }

  if (notPaid.length > 0) {
    console.log(`\n  ⚠️  NO BANCO MAS NÃO PAGARAM:`);
    let tot = 0;
    for (const { sale, inst, dbComLiq } of notPaid) {
      console.log(`     ${sale.clientName.padEnd(38)} P${inst.parcelaNumero.toString().padStart(2)} | DB: ${fmtBRL(dbComLiq).padStart(10)} | Status: ${inst.status}`);
      tot += dbComLiq;
    }
    console.log(`     ${'─'.repeat(60)}  Total não pago: ${fmtBRL(tot)}`);
  }

  // ── Marca como PAGO ─────────────────────────────────────────────────────────
  if (!dryRun && matched.length > 0) {
    const ans = await ask(`\n  Marcar ${matched.length} parcelas de ${refMonth} como PAGO? (s/n): `);
    if (ans === 's' || ans === 'sim') {
      for (const { item, inst } of matched) {
        const paidAt = item.parcelaDate || monthStart;
        await p.installment.update({
          where: { id: inst.id },
          data: { pago: true, status: 'PAGO', dataPagamento: paidAt },
        });
      }
      console.log(`  ✓ ${matched.length} parcelas marcadas como PAGO.`);
      return matched.length;
    }
  }

  return 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const excelPath = process.argv[2];
  const dryRun    = process.argv.includes('--dry-run');
  const abaFiltro = process.argv.slice(3).find(a => !a.startsWith('--')) || null;

  if (!excelPath) {
    console.error('Uso: node reconcile-excel.js <caminho-do-excel> [aba] [--dry-run]');
    process.exit(1);
  }

  console.log(`\n📄 Lendo: ${path.basename(excelPath)}`);
  if (dryRun) console.log('🔍 Modo dry-run — nenhuma alteração será feita');

  const wb = XLSX.readFile(path.resolve(excelPath));
  const sheets = abaFiltro
    ? wb.SheetNames.filter(n => n.toUpperCase() === abaFiltro.toUpperCase())
    : wb.SheetNames;

  console.log(`\nAbas encontradas: ${wb.SheetNames.join(', ')}`);
  if (abaFiltro) console.log(`Processando apenas: ${abaFiltro}`);

  // Carrega todas as vendas uma vez
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

  const saleByProposta = new Map();
  for (const s of allSales) {
    const m = (s.notes || '').match(/Proposta[:\s]+(\d+)/i);
    if (m) saleByProposta.set(m[1], s);
  }

  let totalPago = 0;
  for (const sheetName of sheets) {
    const refMonth = sheetNameToMonth(sheetName);
    if (!refMonth) {
      console.log(`\nAba "${sheetName}" ignorada — não reconhecida como mês`);
      continue;
    }

    const items = parseSheet(wb.Sheets[sheetName], sheetName);
    if (items.length === 0) {
      console.log(`\nAba "${sheetName}" (${refMonth}) — sem dados`);
      continue;
    }

    totalPago += await reconcileMonth(items, refMonth, allSales, salesByCpf, saleByProposta, dryRun);
  }

  console.log(`\n${'═'.repeat(90)}`);
  console.log(`Total de parcelas marcadas como PAGO: ${totalPago}`);
}

main().catch(console.error).finally(() => p.$disconnect());
