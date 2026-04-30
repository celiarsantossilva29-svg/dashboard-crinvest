/**
 * Reconciliação: Contratos Porto Seguro × Pagamentos Reais (Excel)
 *
 * Lê contratos-porto.txt → calcula comissão esperada por mês
 * Se Excel for fornecido → compara com o que Porto realmente pagou
 *
 * Uso:
 *   node reconcile-contratos.js                           ← só projeção esperada
 *   node reconcile-contratos.js <excel.xlsx>              ← projeção + comparação
 *   node reconcile-contratos.js <excel.xlsx> [filtro]     ← filtra por nome/proposta/CPF
 *
 * Fórmula: comissão mensal = prêmio × 4% / nMeses × 0.847
 *   onde nMeses = parcelas se parcelas ≤ 12, caso contrário 12
 *   (parcelas grandes = tamanho do grupo de consórcio, não período de comissão)
 */

const fs   = require('fs');
const path = require('path');

// XLSX é opcional (só carregado se Excel for fornecido)
let XLSX;
try { XLSX = require('xlsx'); } catch (_) {}

// ── Helpers ───────────────────────────────────────────────────────────────────

const NET_FACTOR = 1 - 0.084 - 0.069; // 0.847

function parseBRDate(str) {
  if (!str) return null;
  const parts = String(str).trim().split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function parseBRNum(str) {
  // "280.000,00" → 280000
  return parseFloat(String(str || '').replace(/\./g, '').replace(',', '.')) || 0;
}

function monthKey(date) {
  if (!date) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function addMonths(date, n) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function normalizeCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}

// ── 1. Parseia contratos-porto.txt ────────────────────────────────────────────

function loadContratos(filtro) {
  const filtroCpf  = filtro ? filtro.replace(/\D/g, '') : '';
  const filtroLow  = filtro ? filtro.toLowerCase() : '';

  const txt = fs.readFileSync(
    path.join(__dirname, 'contratos-porto.txt'), 'utf8'
  );
  const lines = txt.split('\n');
  const header = lines[0].split('\t').map(h => h.trim());

  const iCliente  = header.indexOf('CLIENTE');
  const iProposta = header.indexOf('PROPOSTA');
  const iApolice  = header.indexOf('APÓLICE');
  const iProduto  = header.indexOf('NOME ABREVIADO DO PRODUTO');
  const iInicio   = header.indexOf('INÍCIO DE VIGÊNCIA');
  const iFim      = header.indexOf('TÉRMINO DE VIGÊNCIA');
  const iParcelas = header.indexOf('QUANTIDADE DE PARCELAS');
  const iPremio   = header.indexOf('PRÊMIO');

  const contratos = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(c => c.trim());
    if (cols.length < 5) continue;

    const nome     = cols[iCliente]  || '';
    const proposta = cols[iProposta] || '';
    const apolice  = cols[iApolice]  || '';
    const produto  = cols[iProduto]  || '';
    const inicioD  = parseBRDate(cols[iInicio]);
    const fimD     = parseBRDate(cols[iFim]);
    const parcelasRaw = parseBRNum(cols[iParcelas]); // ex: 200,00 → 200
    const premio   = parseBRNum(cols[iPremio]);

    if (!inicioD || !nome || !premio) continue;

    // Filtra se filtro fornecido
    if (filtroLow) {
      const nomeMatch     = nome.toLowerCase().includes(filtroLow);
      const propostaMatch = proposta.includes(filtroLow);
      const cpfMatch      = filtroCpf.length >= 3 && apolice.includes(filtroCpf);
      if (!nomeMatch && !propostaMatch && !cpfMatch) continue;
    }

    // Período de comissão: sempre 12 meses, exceto quando parcelas ≤ 12
    const nMeses = (parcelasRaw >= 1 && parcelasRaw <= 12) ? Math.round(parcelasRaw) : 12;
    const commMensal = premio * 0.04 / nMeses * NET_FACTOR;

    contratos.push({
      nome, proposta, apolice, produto, inicioD, fimD,
      parcelasRaw, nMeses, premio, commMensal,
    });
  }

  return contratos;
}

// ── 2. Gera projeção de comissão esperada por mês ─────────────────────────────

// Regra de corte Porto Seguro:
//   INÍCIO dia ≤ 21 → primeira comissão no mês seguinte (M+1)
//   INÍCIO dia ≥ 22 → pula um mês, primeira comissão em M+2
function firstCommissionDate(inicioDate) {
  const day = inicioDate.getUTCDate();
  return addMonths(inicioDate, day <= 22 ? 1 : 2);
}

function buildExpected(contratos) {
  // mes → { total, detalhes: [{nome, proposta, commMensal}] }
  const byMonth = new Map();

  for (const c of contratos) {
    const firstComm = firstCommissionDate(c.inicioD);
    if (!firstComm) continue;

    for (let i = 0; i < c.nMeses; i++) {
      const dt  = addMonths(firstComm, i);
      const mes = monthKey(dt);
      if (!byMonth.has(mes)) byMonth.set(mes, { total: 0, detalhes: [] });
      const e = byMonth.get(mes);
      e.total += c.commMensal;
      e.detalhes.push({ nome: c.nome, proposta: c.proposta, commMensal: c.commMensal });
    }
  }

  return byMonth;
}

// ── 3. Parseia Excel de pagamentos Porto Seguro ───────────────────────────────

function excelDate(val) {
  if (!val) return null;
  if (typeof val === 'number' && val > 20000 && val < 80000) {
    return new Date((val - 25569) * 86400000);
  }
  if (typeof val === 'string') {
    const p = val.trim().split(/[\/\-]/);
    if (p.length === 2) {
      const m = parseInt(p[0]); let y = parseInt(p[1]);
      if (y < 100) y += 2000;
      if (m >= 1 && m <= 12) return new Date(Date.UTC(y, m - 1, 1));
    } else if (p.length === 3) {
      const d = parseInt(p[0]), m = parseInt(p[1]); let y = parseInt(p[2]);
      if (y < 100) y += 2000;
      if (m >= 1 && m <= 12) return new Date(Date.UTC(y, m - 1, d));
    }
  }
  return null;
}

function sheetToMonth(name) {
  const pt = { JAN:1,FEV:2,MAR:3,ABR:4,MAI:5,JUN:6,JUL:7,AGO:8,SET:9,OUT:10,NOV:11,DEZ:12 };
  const en = { JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12 };
  const m = name.toUpperCase().replace(/\s/g,'').match(/([A-Z]+)[^0-9]*(\d{2,4})/);
  if (!m) return null;
  const year = m[2].length === 2 ? 2000 + parseInt(m[2]) : parseInt(m[2]);
  const mon  = pt[m[1]] || en[m[1]];
  if (!mon) return null;
  return `${year}-${String(mon).padStart(2, '0')}`;
}

function loadExcel(excelPath) {
  // mes → { total, itens: [{nome, proposta, comLiq}] }
  const byMonth = new Map();

  const wb = XLSX.readFile(path.resolve(excelPath));

  for (const sheetName of wb.SheetNames) {
    const mes = sheetToMonth(sheetName);
    if (!mes) continue;

    const sheet  = wb.Sheets[sheetName];
    const rows   = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let hi = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      if ((rows[i]||[]).some(c => String(c||'').toLowerCase().includes('cpf'))) { hi = i; break; }
    }
    if (hi === -1) continue;

    const headers = (rows[hi]||[]).map(h => String(h||'').trim());
    const col = name => headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));

    const iCpf      = col('cpf');
    const iNome     = col('cliente');
    const iComLiq   = col('comissão líquida') !== -1 ? col('comissão líquida') : col('comissão');
    const iProposta = col('proposta');

    if (iCpf === -1) continue;

    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => c == null || c === '')) continue;
      const cpf = normalizeCpf(r[iCpf]);
      if (!cpf || cpf.length < 11) continue;

      const comLiq = (() => {
        const v = r[iComLiq];
        if (typeof v === 'number') return v;
        return parseFloat(String(v||'').replace(/R\$\s*/,'').replace(/\./g,'').replace(',','.')) || 0;
      })();

      const nome     = String(r[iNome]||'').trim();
      const proposta = iProposta !== -1 && r[iProposta] ? String(r[iProposta]).trim() : null;

      if (!byMonth.has(mes)) byMonth.set(mes, { total: 0, itens: [] });
      const e = byMonth.get(mes);
      e.total   += comLiq;
      e.itens.push({ nome, proposta, comLiq });
    }
  }

  return byMonth;
}

// ── 4. Main ───────────────────────────────────────────────────────────────────

function main() {
  const excelPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  const filtro    = process.argv[3] ? process.argv[3] : null;
  const hoje      = new Date();

  console.log('\n📋 Carregando contratos de contratos-porto.txt...');
  const contratos = loadContratos(filtro);
  console.log(`   ${contratos.length} contratos${filtro ? ` (filtro: "${filtro}")` : ''}`);

  const expected = buildExpected(contratos);

  // Carrega Excel se fornecido
  let actual = null;
  if (excelPath) {
    if (!XLSX) { console.error('❌ xlsx não instalado. Execute: npm install xlsx'); process.exit(1); }
    console.log(`\n📄 Lendo Excel: ${path.basename(excelPath)}`);
    actual = loadExcel(excelPath);
    console.log(`   ${actual.size} meses encontrados no Excel`);
  }

  // Todos os meses relevantes (união de expected + actual)
  const allMonths = new Set([...expected.keys()]);
  if (actual) actual.forEach((_, m) => allMonths.add(m));
  const sortedMonths = [...allMonths].sort();

  // Determina janela: passado (temos Excel) vs futuro (só projeção)
  const now = monthKey(hoje);

  // ── Relatório ──────────────────────────────────────────────────────────────
  const sep = '─'.repeat(90);

  if (actual) {
    // Modo comparação: esperado × real
    console.log(`\n${'═'.repeat(90)}`);
    console.log(`  📊 ESPERADO (contratos-porto.txt) × REAL (Excel Porto Seguro)`);
    console.log(`  Fórmula: prêmio × 4% / nMeses × 0.847`);
    console.log('═'.repeat(90));
    console.log(`  ${'Mês'.padEnd(10)} ${'Esperado'.padStart(14)} ${'Real'.padStart(14)} ${'Δ'.padStart(14)} ${'Δ%'.padStart(7)}  Status`);
    console.log(`  ${sep}`);

    let totalEsp = 0, totalReal = 0;
    for (const mes of sortedMonths) {
      const esp  = expected.get(mes)?.total || 0;
      const real = actual.get(mes)?.total   || 0;
      const diff = real - esp;
      const pct  = esp > 0 ? ((diff / esp) * 100).toFixed(1) : '—';
      const flag = Math.abs(diff) < esp * 0.05 ? '✅' :
                   diff < 0 ? '⚠️ ' : '✓+ ';

      console.log(`  ${mes.padEnd(10)} ${fmtBRL(esp).padStart(14)} ${fmtBRL(real).padStart(14)} ${fmtBRL(diff).padStart(14)} ${String(pct+'%').padStart(7)}  ${flag}`);
      totalEsp  += esp;
      totalReal += real;
    }

    console.log(`  ${sep}`);
    const totalDiff = totalReal - totalEsp;
    console.log(`  ${'TOTAL'.padEnd(10)} ${fmtBRL(totalEsp).padStart(14)} ${fmtBRL(totalReal).padStart(14)} ${fmtBRL(totalDiff).padStart(14)}`);

    // Detalhe por mês com maior divergência
    console.log(`\n${'═'.repeat(90)}`);
    console.log(`  🔍 MESES COM MAIOR DIVERGÊNCIA (|Δ| > 5% do esperado)`);
    console.log('═'.repeat(90));

    for (const mes of sortedMonths) {
      const esp  = expected.get(mes)?.total || 0;
      const real = actual.get(mes)?.total   || 0;
      const diff = Math.abs(real - esp);
      if (esp === 0 && real === 0) continue;
      if (esp > 0 && diff / esp <= 0.05) continue;
      if (esp === 0 && real === 0) continue;

      console.log(`\n  ── ${mes}  |  Esperado: ${fmtBRL(esp)}  |  Real: ${fmtBRL(real)}  |  Δ: ${fmtBRL(real - esp)}`);

      // Contratos esperados nesse mês
      const espItens = expected.get(mes)?.detalhes || [];
      if (espItens.length > 0) {
        console.log(`     ESPERADO (${espItens.length} contratos):`);
        espItens.forEach(it => console.log(`       ${it.nome.padEnd(42)} Prop: ${(it.proposta||'—').padEnd(8)} ${fmtBRL(it.commMensal)}`));
      }

      // Contratos reais nesse mês
      const realItens = actual.get(mes)?.itens || [];
      if (realItens.length > 0) {
        console.log(`     REAL (${realItens.length} itens):`);
        realItens.forEach(it => console.log(`       ${it.nome.padEnd(42)} Prop: ${(it.proposta||'—').padEnd(8)} ${fmtBRL(it.comLiq)}`));
      }

      // No esperado mas não no real
      const realPropostas = new Set(realItens.map(r => r.proposta).filter(Boolean));
      const realNomes     = new Set(realItens.map(r => r.nome.toLowerCase()));
      const ausentes = espItens.filter(it =>
        it.proposta ? !realPropostas.has(it.proposta) : !realNomes.has(it.nome.toLowerCase())
      );
      if (ausentes.length > 0) {
        console.log(`     ❓ NO ESPERADO MAS NÃO NO REAL (${ausentes.length}):`);
        ausentes.forEach(it => console.log(`       ${it.nome.padEnd(42)} Prop: ${(it.proposta||'—').padEnd(8)} ${fmtBRL(it.commMensal)}`));
      }
    }

  } else {
    // Modo projeção: só esperado
    console.log(`\n${'═'.repeat(90)}`);
    console.log(`  📅 PROJEÇÃO DE COMISSÃO ESPERADA — ${contratos.length} contratos`);
    console.log(`  Fórmula: prêmio × 4% / nMeses × 0.847`);
    console.log(`  (sem Excel: apenas projeção esperada dos contratos)`);
    console.log('═'.repeat(90));
    console.log(`  ${'Mês'.padEnd(10)} ${'N Contratos'.padStart(12)} ${'Comissão'.padStart(14)}`);
    console.log(`  ${sep}`);

    let grand = 0;
    for (const mes of sortedMonths) {
      if (mes < now) continue; // só meses a partir de hoje
      const e = expected.get(mes);
      const mark = mes === now ? '← hoje' : '';
      console.log(`  ${mes.padEnd(10)} ${String(e.detalhes.length).padStart(12)} ${fmtBRL(e.total).padStart(14)}  ${mark}`);
      grand += e.total;
    }

    console.log(`  ${sep}`);
    console.log(`  ${'TOTAL GERAL'.padEnd(10)} ${''.padStart(12)} ${fmtBRL(grand).padStart(14)}`);
  }

  // ── Tabela de contratos com detalhes ────────────────────────────────────────
  console.log(`\n${'═'.repeat(90)}`);
  console.log(`  📝 DETALHES DOS CONTRATOS (${contratos.length})`);
  console.log('═'.repeat(90));
  console.log(`  ${'Cliente'.padEnd(40)} ${'Prop'.padEnd(8)} ${'Início'.padEnd(12)} ${'nM'.padEnd(5)} ${'Prêmio'.padStart(14)} ${'Com/Mês'.padStart(12)}`);
  console.log(`  ${sep}`);

  // Ordena por início
  contratos.sort((a, b) => a.inicioD - b.inicioD);
  for (const c of contratos) {
    const inicioStr = c.inicioD ? c.inicioD.toISOString().slice(0, 7) : '—';
    console.log(
      `  ${c.nome.padEnd(40)} ${c.proposta.padEnd(8)} ${inicioStr.padEnd(12)} ` +
      `${String(c.nMeses).padEnd(5)} ${fmtBRL(c.premio).padStart(14)} ${fmtBRL(c.commMensal).padStart(12)}`
    );
  }

  // ── Resumo total esperado de comissão ────────────────────────────────────────
  const totalComm = contratos.reduce((s, c) => s + c.commMensal * c.nMeses, 0);
  const totalPremio = contratos.reduce((s, c) => s + c.premio, 0);
  console.log(`\n  Total prêmio (cartas): ${fmtBRL(totalPremio)}`);
  console.log(`  Total comissão esperada (todos os meses): ${fmtBRL(totalComm)}`);
  console.log(`  Comissão por mês (média, contratos ativos): verificar tabela acima\n`);
}

main();
