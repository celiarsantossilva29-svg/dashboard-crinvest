const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

// Mapeamento closer_id (database.json) → nome do closer
const CLOSER_MAP = {
  '913419f3-eeeb-4676-b8cd-41f73a70ef4d': 'Eunice Dias',
  '482b4379-85cc-42df-8df6-eb645d76f23d': 'Célia',
};
const SDR_MAP = {
  'c5733cf7-b8f1-41a0-9ad4-d97ab7c04401': 'Cauê',
};

async function main() {
  const db = JSON.parse(fs.readFileSync('./src/database.json', 'utf8'));
  const vendas = db.Vendas;
  const parcelas = db.PagamentosClientes;

  console.log(`📦 Encontradas ${vendas.length} vendas e ${parcelas.length} parcelas no database.json\n`);

  await client.connect();
  console.log('✅ Conectado ao Supabase\n');

  // Check existing sales to avoid duplicates
  const existing = await client.query('SELECT id FROM "Sale"');
  const existingIds = new Set(existing.rows.map(r => r.id));

  let salesInserted = 0;
  let installmentsInserted = 0;

  for (const v of vendas) {
    if (existingIds.has(v.id)) {
      console.log(`⏭️  Venda ${v.id} (${v.cliente_nome}) já existe, pulando...`);
      continue;
    }

    const closerName = CLOSER_MAP[v.closer_id] || 'Desconhecido';
    const sdrName = v.sdr_id ? (SDR_MAP[v.sdr_id] || null) : null;

    // Insert Sale
    await client.query(`
      INSERT INTO "Sale" (
        "id", "leadId", "value", "closedAt", "clientName", "assignedTo",
        "sdrName", "campaignId", "notes", "administradora", "tierCloser",
        "percentualCloser", "valorComissaoCloser", "percentualSdr",
        "valorComissaoSdr", "clienteCpf", "createdAt"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    `, [
      v.id,
      v.lead_id || null,
      v.valor_venda,
      new Date(v.data_fechamento),
      v.cliente_nome,
      closerName,
      sdrName,
      null,              // campaignId
      null,              // notes
      v.administradora || null,
      v.tier_closer || null,
      v.percentual_closer || null,
      v.valor_comissao_total_closer || null,
      v.percentual_sdr || null,
      v.valor_comissao_total_sdr || null,
      v.cliente_cpf || null,
      new Date(v.created_at)
    ]);
    salesInserted++;
    console.log(`✅ Venda inserida: ${v.cliente_nome} - R$ ${(v.valor_venda / 100).toFixed(2)} (${closerName})`);

    // Insert installments for this sale
    const vendaParcelas = parcelas.filter(p => p.venda_id === v.id);
    for (const p of vendaParcelas) {
      await client.query(`
        INSERT INTO "Installment" (
          "id", "saleId", "parcelaNumero", "dataVencimento",
          "valorParcela", "pago", "status", "createdAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        p.id,
        v.id,
        p.parcela_numero,
        new Date(p.data_vencimento),
        p.valor_parcela,
        p.pago === 1 ? true : false,
        p.pago === 1 ? 'PAGO' : 'PENDENTE',
        new Date(p.created_at)
      ]);
      installmentsInserted++;
    }
    console.log(`   📋 ${vendaParcelas.length} parcelas inseridas`);
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🎉 Migração concluída!`);
  console.log(`   Sales inseridas: ${salesInserted}`);
  console.log(`   Installments inseridas: ${installmentsInserted}`);

  // Final count
  const salesCount = await client.query('SELECT COUNT(*) FROM "Sale"');
  const installCount = await client.query('SELECT COUNT(*) FROM "Installment"');
  console.log(`\n📊 Total no banco agora:`);
  console.log(`   Sale: ${salesCount.rows[0].count}`);
  console.log(`   Installment: ${installCount.rows[0].count}`);

  await client.end();
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  console.error(err);
  process.exit(1);
});
