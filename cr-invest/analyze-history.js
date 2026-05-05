/**
 * Análise histórica de pagamentos Porto Seguro
 *
 * Lê todas as abas do Excel e constrói a linha do tempo de pagamentos
 * por contrato (Proposta), mostrando quando cada cliente pagou e quando faltou.
 *
 * Uso: node analyze-history.js <caminho-do-excel> [CPF-ou-nome]
 *   Ex: node analyze-history.js "~/Downloads/Controle Comissão - CR Invest.xlsx"
 *       node analyze-history.js "..." "CLEITON"           ← filtra por nome
 *       node analyze-history.js "..." "313.918.788-25"    ← filtra por CPF
 */

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const p = new PrismaClient();

function excelDate(val) {
  if (!val) return null;
  // Se for número
  if (typeof val === 'number') {
    // Serial válido do Excel (entre 1990 e 2050 aprox)
    if (val > 20000 && val < 80000) {
      return new Date((val - 25569) * 86400000);
    }
    // Se for número digitado sem barra (ex: 102026 -> 10/2026)
    const s = String(val);
    if (s.length === 6) { // MMYYYY
      const m = parseInt(s.substring(0,2));
      const y = parseInt(s.substring(2,6));
      if (m >= 1 && m <= 12 && y > 2000) return new Date(Date.UTC(y, m-1, 1));
    }
    if (s.length === 8) { // DDMMYYYY
      const d = parseInt(s.substring(0,2));
      const m = parseInt(s.substring(2,4));
      const y = parseInt(s.substring(4,8));
      if (m >= 1 && m <= 12 && y > 2000) return new Date(Date.UTC(y, m-1, d));
    }
    return null;
  }
  // Se for string ("10/2026", "01/10/2026")
  if (typeof val === 'string') {
    const p = val.trim().split(/[\/\-]/);
    if (p.length === 2) {
      const m = parseInt(p[0]);
      let y = parseInt(p[1]);
      if (y < 100) y += 2000;
      if (m >= 1 && m <= 12) return new Date(Date.UTC(y, m-1, 1));
    } else if (p.length === 3) {
      const d = parseInt(p[0]);
      const m = parseInt(p[1]);
      let y = parseInt(p[2]);
      if (y < 100) y += 2000;
      if (d > 2000) return new Date(Date.UTC(d, m-1, y < 100 ? parseInt(p[2]) : y)); // YYYY-MM-DD
      if (m >= 1 && m <= 12) return new Date(Date.UTC(y, m-1, d)); // DD/MM/YYYY
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}
function normalizeCpf(cpf) { return String(cpf || '').replace(/\D/g, ''); }
function fmtBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
function monthKey(date) {
  if (!date) return null;
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Converte nome de aba → YYYY-MM
function sheetToMonth(name) {
  const pt = { JAN:1,FEV:2,MAR:3,ABR:4,MAI:5,JUN:6,JUL:7,AGO:8,SET:9,OUT:10,NOV:11,DEZ:12 };
  const en = { JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12 };
  const m = name.toUpperCase().replace(/\s/g,'').match(/([A-Z]+)[^0-9]*(\d{2,4})/);
  if (!m) return null;
  const year = m[2].length === 2 ? 2000 + parseInt(m[2]) : parseInt(m[2]);
  const mon  = pt[m[1]] || en[m[1]];
  if (!mon) return null;
  return `${year}-${String(mon).padStart(2,'0')}`;
}

// Gera lista de meses entre dois dates (inclusive)
function monthsBetween(startDate, endDate) {
  const months = [];
  const d = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
  while (d <= end) {
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,'0')}`);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return months;
}

async function main() {
  const excelPath = process.argv[2];
  const filtro    = process.argv[3] ? process.argv[3].toLowerCase() : null;

  if (!excelPath) {
    console.error('Uso: node analyze-history.js <excel> [filtro-nome-ou-cpf]');
    process.exit(1);
  }

  console.log(`\n📄 Lendo: ${path.basename(excelPath)}`);
  if (filtro) console.log(`🔍 Filtro: "${filtro}"`);

  const wb   = XLSX.readFile(path.resolve(excelPath));
  const rows_by_month = new Map(); // mes → items[]

  // ── 1. Lê todas as abas ────────────────────────────────────────────────────
  for (const sheetName of wb.SheetNames) {
    const mes = sheetToMonth(sheetName);
    if (!mes) continue;

    const sheet  = wb.Sheets[sheetName];
    const rows   = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Encontra cabeçalho
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
    const iParcelas = col('parcelas');
    const iProposta = col('proposta');
    const iApolice  = col('apólice') !== -1 ? col('apólice') : col('apolice');
    const iInicio   = col('início') !== -1 ? col('início') : col('inicio');
    const iFim      = col('término') !== -1 ? col('término') : col('termino');

    if (iCpf === -1) continue;

    const items = [];
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

      // Início: sempre válido como serial Excel. Fim: só aceita se for serial válido (< 80000);
      // caso contrário Porto mudou o formato e colocou outro número na coluna — ignora.
      const inicioDate = iInicio !== -1 ? excelDate(r[iInicio]) : null;
      const fimRaw     = iFim    !== -1 ? r[iFim] : null;
      const fimDate    = (typeof fimRaw === 'number' && fimRaw > 20000 && fimRaw < 80000)
        ? new Date((fimRaw - 25569) * 86400000)
        : (inicioDate ? new Date(Date.UTC(inicioDate.getUTCFullYear() + 1, inicioDate.getUTCMonth(), inicioDate.getUTCDate())) : null);

      items.push({
        cpf,
        nome:      String(r[iNome]||'').trim(),
        comLiq,
        proposta:  iProposta !== -1 && r[iProposta] ? String(r[iProposta]).trim() : null,
        apolice:   iApolice  !== -1 && r[iApolice]  ? String(r[iApolice]).trim()  : null,
        parcelaDate: iParcelas !== -1 ? excelDate(r[iParcelas]) : null,
        inicio:    inicioDate,
        fim:       fimDate,
        mes,
      });
    }

    if (!rows_by_month.has(mes)) rows_by_month.set(mes, []);
    rows_by_month.get(mes).push(...items);
  }

  // ── 2. Agrupa por Proposta → histórico de pagamentos ──────────────────────
  // Mapa: proposta → { cpf, nome, inicio, fim, pagamentos: Map(mes → comLiq) }
  const contratos = new Map();

  for (const [mes, items] of rows_by_month.entries()) {
    for (const item of items) {
      const key = item.proposta || `${item.cpf}-${item.apolice}`;
      if (!contratos.has(key)) {
        contratos.set(key, {
          proposta: item.proposta,
          apolice:  item.apolice,
          cpf:      item.cpf,
          nome:     item.nome,
          inicio:   item.inicio,
          fim:      item.fim,
          pagamentos: new Map(), // mes → comLiq total
        });
      }
      const c = contratos.get(key);
      // Atualiza inicio/fim se mais preciso
      if (item.inicio && (!c.inicio || item.inicio < c.inicio)) c.inicio = item.inicio;
      if (item.fim    && (!c.fim    || item.fim    > c.fim))    c.fim    = item.fim;
      // Soma comissão do mês
      c.pagamentos.set(mes, (c.pagamentos.get(mes) || 0) + item.comLiq);
    }
  }

  // ── 3. Carrega DB para cruzamento ─────────────────────────────────────────
  const allSales = await p.sale.findMany({
    include: { installments: { orderBy: { parcelaNumero: 'asc' } } },
  });
  const saleByProposta = new Map();
  const salesByCpf     = new Map();
  for (const s of allSales) {
    const m = (s.notes||'').match(/Proposta[:\s]+(\d+)/i);
    if (m) saleByProposta.set(m[1], s);
    const cpf = normalizeCpf(s.clienteCpf);
    if (cpf) { if (!salesByCpf.has(cpf)) salesByCpf.set(cpf, []); salesByCpf.get(cpf).push(s); }
  }

  // ── 4. Gera relatório ─────────────────────────────────────────────────────
  const allMonths = [...rows_by_month.keys()].sort();
  const firstMonth = allMonths[0];
  const lastMonth  = allMonths[allMonths.length - 1];

  // Aplica filtro se houver
  const filtroCpf = filtro ? filtro.replace(/\D/g,'') : '';
  const contratosArr = [...contratos.values()].filter(c => {
    if (!filtro) return true;
    if (c.nome.toLowerCase().includes(filtro)) return true;
    if (filtroCpf.length >= 3 && c.cpf.includes(filtroCpf)) return true;
    if (c.proposta && c.proposta.includes(filtro)) return true;
    return false;
  });

  if (contratosArr.length === 0) {
    console.log('\nNenhum contrato encontrado com esse filtro.');
    return;
  }

  console.log(`\n${'═'.repeat(100)}`);
  console.log(`HISTÓRICO DE PAGAMENTOS — ${allMonths.length} meses (${firstMonth} → ${lastMonth})`);
  console.log(`Total de contratos: ${contratos.size}${filtro ? ` | Filtrados: ${contratosArr.length}` : ''}`);
  console.log('═'.repeat(100));
  console.log('\nLegenda: ✓=pago  ✗=inadimplente/faltou  ·=fora do período do contrato\n');

  // Cabeçalho de meses
  const colW = 6;
  const nomeW = 38;
  console.log(
    ' ' + 'Cliente / Proposta'.padEnd(nomeW) + ' ' +
    allMonths.map(m => m.slice(5,7)+'/'+m.slice(2,4)).map(m => m.padStart(colW)).join('')
  );
  console.log('─'.repeat(nomeW + 2 + allMonths.length * colW));

  let totalPago = 0, totalFaltou = 0, totalContratos = 0;

  for (const c of contratosArr.sort((a,b) => a.nome.localeCompare(b.nome))) {
    // Determina período do contrato
    const contratoMeses = c.inicio && c.fim ? monthsBetween(c.inicio, c.fim) : null;

    const label = `${c.nome.slice(0,32)} (${c.proposta||c.apolice||'?'})`;

    // Linha de pagamentos
    const cells = allMonths.map(mes => {
      const pago = c.pagamentos.get(mes);
      if (pago !== undefined) {
        totalPago += pago;
        return '✓'.padStart(colW);
      }
      // Verifica se o mês está dentro do período do contrato
      if (contratoMeses && !contratoMeses.includes(mes)) return '·'.padStart(colW);
      // Está no período mas não pagou
      if (mes >= firstMonth && mes <= lastMonth) {
        // Só conta como falta se o contrato já havia começado
        const mesDate = new Date(mes + '-01');
        if (c.inicio && mesDate >= c.inicio) {
          totalFaltou++;
          return '✗'.padStart(colW);
        }
      }
      return '·'.padStart(colW);
    });

    console.log(' ' + label.padEnd(nomeW) + ' ' + cells.join(''));

    // Linha de valores (opcional — mostra abaixo se houver faltas)
    const faltas = allMonths.filter(mes => {
      if (c.pagamentos.has(mes)) return false;
      if (!contratoMeses || !contratoMeses.includes(mes)) return false;
      const mesDate = new Date(mes + '-01');
      return c.inicio && mesDate >= c.inicio && mes <= lastMonth;
    });

    if (faltas.length > 0 && !filtro) {
      // resumido: só imprime os meses com falta
    }

    // Detalhe: cruzamento DB
    const dbSale = c.proposta ? saleByProposta.get(c.proposta) : null;
    const dbStatus = dbSale ? ' [DB ✓]' : ' [DB ✗ — contrato antigo]';

    if (filtro) {
      // Modo detalhado: mostra cada mês
      console.log('');
      console.log(`  CPF: ${c.cpf} | Proposta: ${c.proposta||'—'} | Apólice: ${c.apolice||'—'}${dbStatus}`);
      if (c.inicio) console.log(`  Vigência: ${monthKey(c.inicio)} → ${monthKey(c.fim)}`);
      console.log(`  Pagamentos:`);
      for (const [mes, val] of [...c.pagamentos.entries()].sort()) {
        console.log(`    ${mes}: ${fmtBRL(val)}`);
      }
      if (faltas.length > 0) {
        console.log(`  ⚠️  Meses sem pagamento: ${faltas.join(', ')}`);
      }

      // Compara com DB
      if (dbSale) {
        console.log(`  DB: ${dbSale.installments.length} parcelas | fechamento: ${dbSale.closedAt.toISOString().slice(0,10)}`);
        for (const inst of dbSale.installments) {
          const mk = monthKey(inst.dataVencimento);
          const portoVal = c.pagamentos.get(mk);
          const mark = inst.pago || inst.status==='PAGO' ? '✓' : inst.status==='INADIMPLENTE' ? '✗' : '○';
          console.log(`    P${String(inst.parcelaNumero).padStart(2)} ${mk} ${mark} ${inst.status.padEnd(14)}${portoVal ? ' ← Porto: '+fmtBRL(portoVal) : ''}`);
        }
      }
      console.log('');
    }

    totalContratos++;
  }

  // ── 5. Resumo global ──────────────────────────────────────────────────────
  if (!filtro) {
    console.log('\n' + '═'.repeat(100));
    console.log('RESUMO GLOBAL');
    console.log('═'.repeat(100));

    // Totais por mês
    console.log('\nComissão Porto recebida por mês:');
    for (const mes of allMonths) {
      const items = rows_by_month.get(mes) || [];
      const total = items.reduce((s, i) => s + i.comLiq, 0);
      const nClientes = new Set(items.map(i => i.cpf)).size;
      const bar = '█'.repeat(Math.round(total / 1000));
      console.log(`  ${mes}  ${fmtBRL(total).padStart(12)}  (${String(nClientes).padStart(2)} clientes)  ${bar}`);
    }

    // Contratos com mais faltas
    const comFaltas = contratosArr
      .map(c => {
        const contratoMeses = c.inicio && c.fim ? monthsBetween(c.inicio, c.fim) : allMonths;
        const faltas = contratoMeses.filter(mes => {
          if (c.pagamentos.has(mes)) return false;
          const mesDate = new Date(mes + '-01');
          return c.inicio && mesDate >= c.inicio && mes >= firstMonth && mes <= lastMonth;
        });
        return { c, faltas };
      })
      .filter(x => x.faltas.length > 0)
      .sort((a,b) => b.faltas.length - a.faltas.length);

    if (comFaltas.length > 0) {
      console.log(`\n⚠️  Contratos com meses em falta (${comFaltas.length} contratos):`);
      for (const { c, faltas } of comFaltas.slice(0, 30)) {
        const dbMark = saleByProposta.has(c.proposta) ? '[DB✓]' : '[DB✗]';
        console.log(`  ${c.nome.padEnd(40)} ${dbMark}  ${faltas.length}x falta: ${faltas.join(', ')}`);
      }
    }

    console.log(`\nTotal contratos analisados: ${totalContratos}`);
    console.log(`Total comissão paga (Porto): ${fmtBRL(totalPago)}`);

    // ── 6. Projeção futura ─────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(100));
    console.log('PROJEÇÃO FUTURA (baseada nos contratos ativos da planilha)');
    console.log('═'.repeat(100));
    console.log('\nMetodologia: contratos com vigência ativa + valor médio dos últimos pagamentos\n');

    // Gera próximos 8 meses após o último mês da planilha
    const futureMonths = [];
    const [lastY, lastM] = lastMonth.split('-').map(Number);
    for (let i = 1; i <= 8; i++) {
      const d = new Date(Date.UTC(lastY, lastM - 1 + i, 1));
      futureMonths.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }

    // Para cada mês futuro, soma apenas contratos realmente ativos (pagaram recentemente)
    // Critério: pagou em pelo menos 2 dos últimos 3 meses disponíveis no Excel
    const ultimos3Meses = allMonths.slice(-3);
    const projecaoMensal = new Map(); // mes → { total, contratos: [] }
    for (const mes of futureMonths) projecaoMensal.set(mes, { total: 0, contratos: [] });

    for (const c of contratos.values()) {
      if (!c.fim) continue; // sem data de fim, não projeta
      const fimKey = monthKey(c.fim);
      if (!fimKey || fimKey < lastMonth) continue; // contrato já encerrado

      // Conta quantos dos últimos 3 meses o contrato pagou
      const pagouRecente = ultimos3Meses.filter(m => c.pagamentos.has(m)).length;
      if (pagouRecente === 0) continue; // sem pagamento recente, ignora

      // Calcula valor médio dos últimos pagamentos reais (dos 3 mais recentes)
      const pagamentosOrdenados = [...c.pagamentos.entries()].sort((a,b) => a[0].localeCompare(b[0]));
      const ultimos3Pag = pagamentosOrdenados.slice(-3);
      const mediaVal = ultimos3Pag.reduce((s, [,v]) => s + v, 0) / ultimos3Pag.length;

      // Taxa de pagamento real (pagamentos / meses dentro da vigência até agora)
      const contratoMesesPassados = c.inicio ? monthsBetween(c.inicio, new Date(lastMonth + '-01')).filter(m => m >= firstMonth) : allMonths;
      const taxaPagamento = contratoMesesPassados.length > 0
        ? Math.min(1, c.pagamentos.size / contratoMesesPassados.length)
        : 1;

      // Peso: combina taxa histórica com atividade recente
      // Se pagou nos 3 últimos: peso alto; se pagou em 1: peso médio
      const pesoRecente = pagouRecente === 3 ? 1.0 : pagouRecente === 2 ? 0.75 : 0.5;
      const pesoFinal = (taxaPagamento * 0.4 + pesoRecente * 0.6);
      const valorProjetado = mediaVal * pesoFinal;

      for (const mes of futureMonths) {
        if (mes > fimKey) break; // além da vigência
        projecaoMensal.get(mes).total += valorProjetado;
        projecaoMensal.get(mes).contratos.push({ nome: c.nome, proposta: c.proposta, val: valorProjetado, fimKey, pagouRecente });
      }
    }

    // Imprime projeção
    let totalProjecao = 0;
    const recentAvg = (() => {
      const recent3 = allMonths.slice(-3);
      const vals = recent3.map(m => (rows_by_month.get(m)||[]).reduce((s,i) => s+i.comLiq, 0));
      return vals.reduce((s,v) => s+v, 0) / vals.length;
    })();

    console.log(`  Média real dos últimos 3 meses confirmados: ${fmtBRL(recentAvg)}`);
    console.log('');
    console.log(`  ${'Mês'.padEnd(10)} ${'Contratos'.padStart(10)} ${'Projeção'.padStart(14)}`);
    console.log(`  ${'─'.repeat(36)}`);
    for (const [mes, { total, contratos: lista }] of projecaoMensal.entries()) {
      const bar = '▓'.repeat(Math.min(30, Math.round(total / 2000)));
      console.log(`  ${mes}  ${String(lista.length).padStart(9)}  ${fmtBRL(total).padStart(14)}  ${bar}`);
      totalProjecao += total;
    }
    console.log(`  ${'─'.repeat(36)}`);
    console.log(`  ${'TOTAL 8 meses'.padEnd(10)}            ${fmtBRL(totalProjecao).padStart(14)}`);

    // Contratos que vencem em breve (próximos 3 meses)
    const vencendoBreve = [...contratos.values()]
      .filter(c => c.fim && monthKey(c.fim) >= futureMonths[0] && monthKey(c.fim) <= futureMonths[2])
      .sort((a,b) => monthKey(a.fim).localeCompare(monthKey(b.fim)));

    if (vencendoBreve.length > 0) {
      console.log(`\n  ⏳ Contratos que vencem nos próximos 3 meses (${vencendoBreve.length}):`);
      for (const c of vencendoBreve) {
        const ultPag = [...c.pagamentos.entries()].sort().slice(-1)[0];
        console.log(`     ${c.nome.padEnd(42)} vence: ${monthKey(c.fim)}  último pgto: ${ultPag ? ultPag[0] + ' ' + fmtBRL(ultPag[1]) : '—'}`);
      }
    }
  }
}

main().catch(console.error).finally(() => p.$disconnect());
