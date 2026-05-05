const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const p = new PrismaClient();

// Utilitário para datas do Excel
function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    if (val > 20000 && val < 80000) return new Date((val - 25569) * 86400000);
    const s = String(val);
    if (s.length === 6) {
      const m = parseInt(s.substring(0, 2));
      const y = parseInt(s.substring(2, 6));
      if (m >= 1 && m <= 12 && y > 2000) return new Date(Date.UTC(y, m - 1, 1));
    }
    if (s.length === 8) {
      const d = parseInt(s.substring(0, 2));
      const m = parseInt(s.substring(2, 4));
      const y = parseInt(s.substring(4, 8));
      if (m >= 1 && m <= 12 && y > 2000) return new Date(Date.UTC(y, m - 1, d));
    }
    return null;
  }
  if (typeof val === 'string') {
    const p = val.trim().split(/[\/\-]/);
    if (p.length === 2) {
      const m = parseInt(p[0]);
      let y = parseInt(p[1]);
      if (y < 100) y += 2000;
      if (m >= 1 && m <= 12) return new Date(Date.UTC(y, m - 1, 1));
    } else if (p.length === 3) {
      const d = parseInt(p[0]);
      const m = parseInt(p[1]);
      let y = parseInt(p[2]);
      if (y < 100) y += 2000;
      if (d > 2000) return new Date(Date.UTC(d, m - 1, y < 100 ? parseInt(p[2]) : y));
      if (m >= 1 && m <= 12) return new Date(Date.UTC(y, m - 1, d));
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function normalizeCpf(cpf) { return String(cpf || '').replace(/\D/g, ''); }

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function importSales() {
  const filePath = 'C:/Users/giova/Downloads/RptAnaliseProducao (3).XLS';
  console.log(`Lendo arquivo: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let headerRowIdx = rows.findIndex(r => r && r.length > 10 && r.some(c => typeof c === 'string' && c.toLowerCase().includes('cpf')));
  if (headerRowIdx === -1) headerRowIdx = 0;
  
  const headers = rows[headerRowIdx].map(h => String(h || '').trim().toLowerCase());
  
  const idx = {
    cliente: headers.findIndex(h => h.includes('cliente') && !h.includes('desde')),
    cpf: headers.findIndex(h => h.includes('cpf') || h.includes('cnpj')),
    proposta: headers.findIndex(h => h === 'proposta' || h === 'nº proposta cia'),
    apolice: headers.findIndex(h => h.includes('apólice') || h.includes('apolice')),
    inicio: headers.findIndex(h => h.includes('início') || h.includes('inicio')),
    fim: headers.findIndex(h => h.includes('término') || h.includes('termino')),
    premio: headers.findIndex(h => h === 'prêmio' || h === 'premio' || h.includes('prêmio total')),
    parcelas: headers.findIndex(h => h.includes('quantidade de parcelas')),
    produto: headers.findIndex(h => h.includes('nome abreviado do produto') || h.includes('produto')),
    atendimento: headers.findIndex(h => h.includes('atendimento'))
  };

  const salesToImport = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[idx.cliente]) continue;

    const inicioDate = parseExcelDate(r[idx.inicio]);
    if (!inicioDate) continue;
    
    const year = inicioDate.getUTCFullYear();
    if (year !== 2023 && year !== 2024) continue; // Filtra apenas 2023 e 2024

    const clienteName = String(r[idx.cliente]).trim();
    const cpfRaw = r[idx.cpf];
    const cpf = normalizeCpf(cpfRaw);
    const proposta = String(r[idx.proposta] || '').trim();
    const apolice = String(r[idx.apolice] || '').trim();
    const premioRaw = parseFloat(r[idx.premio]);
    const premio = isNaN(premioRaw) ? 0 : premioRaw;
    const parcelas = parseInt(r[idx.parcelas]) || 12; // default 12 se não achar
    const produtoRaw = String(r[idx.produto] || '').toLowerCase();
    const produto = produtoRaw.includes('auto') ? 'auto' : 'imovel';
    const atendimento = String(r[idx.atendimento] || '').trim();

    // Lógica para achar a vendedora Celia
    let closerName = 'closer-002'; // ID da Célia no banco
    if (atendimento && atendimento.toLowerCase().includes('celia')) {
      closerName = 'closer-002';
    }

    salesToImport.push({
      clienteName,
      cpf,
      proposta,
      apolice,
      inicioDate,
      premio,
      parcelas,
      produto,
      closerName
    });
  }

  console.log(`\nEncontrados ${salesToImport.length} contratos de 2023/2024.`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const s of salesToImport) {
    // Verifica se já existe no banco (busca por proposta)
    const existing = await p.sale.findFirst({
      where: {
        notes: { contains: s.proposta }
      }
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    // Calcula a comissão aproximada que era praticada (como no analyze-history)
    // 4% do valor total, deduzido impostos (8.4% + 6.9% = 15.3%) => comLiq = premio * 0.04 * (1 - 0.153)
    const comissaoBruta = (s.premio * 0.04) * (1 - 0.084 - 0.069);
    const comissaoPorParcela = comissaoBruta / Math.max(1, s.parcelas);

    const saleData = {
      clientName: s.clienteName,
      clienteCpf: s.cpf,
      value: s.premio,
      closedAt: s.inicioDate,
      assignedTo: s.closerName,
      administradora: 'Porto Seguro',
      produto: s.produto,
      statusValidacao: 'validado',
      comissaoBruta,
      comissaoPorParcela,
      quantidadeParcelas: s.parcelas,
      notes: `Importação Histórica | Proposta: ${s.proposta} | Apólice: ${s.apolice}`
    };

    if (isDryRun) {
      console.log(`[DRY-RUN] Criaria Venda: ${s.clienteName} (Prop: ${s.proposta}) - Prêmio: R$ ${s.premio}`);
      createdCount++;
    } else {
      const newSale = await p.sale.create({
        data: saleData
      });

      // Criar as parcelas (Installments)
      const installmentsData = [];
      const dataVencimentoBase = new Date(s.inicioDate);
      
      for (let parcelNum = 1; parcelNum <= s.parcelas; parcelNum++) {
        // Incrementa o mês
        const dataVencimento = new Date(Date.UTC(dataVencimentoBase.getUTCFullYear(), dataVencimentoBase.getUTCMonth() + (parcelNum - 1), 15)); // Dia 15 como base
        installmentsData.push({
          saleId: newSale.id,
          parcelaNumero: parcelNum,
          dataVencimento: dataVencimento,
          valorParcela: comissaoPorParcela,
          pago: false,
          status: 'PENDENTE'
        });
      }

      await p.installment.createMany({
        data: installmentsData
      });

      console.log(`Criada Venda e ${s.parcelas} parcelas: ${s.clienteName} (Prop: ${s.proposta})`);
      createdCount++;
    }
  }

  console.log(`\nResumo:`);
  console.log(`- Contratos existentes (ignorados): ${skippedCount}`);
  console.log(`- Novos contratos ${isDryRun ? 'que seriam criados' : 'criados'}: ${createdCount}`);

  if (isDryRun) {
    console.log(`\nRode sem --dry-run para efetivar no banco.`);
  } else {
    console.log(`\nImportação concluída! Agora você pode rodar o 'reconcile-excel.js' para baixar as parcelas pagas!`);
  }
}

importSales()
  .catch(e => console.error('Erro na importação:', e))
  .finally(() => p.$disconnect());
