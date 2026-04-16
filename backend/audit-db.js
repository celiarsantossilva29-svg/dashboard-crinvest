const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  
  const report = {};

  // Get all tables
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' ORDER BY table_name
  `);

  for (const { table_name } of tables.rows) {
    const countRes = await client.query(`SELECT COUNT(*) as total FROM "${table_name}"`);
    const total = parseInt(countRes.rows[0].total);

    // Get columns
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table_name]);

    const fields = [];
    for (const col of cols.rows) {
      let filledCount = 0;
      let nullCount = 0;
      let emptyCount = 0;
      let sampleValues = [];

      if (total > 0) {
        // Count non-null
        const filled = await client.query(`SELECT COUNT(*) as c FROM "${table_name}" WHERE "${col.column_name}" IS NOT NULL`);
        filledCount = parseInt(filled.rows[0].c);
        nullCount = total - filledCount;

        // Count empty strings (for text fields)
        if (col.data_type.includes('character') || col.data_type === 'text') {
          const empty = await client.query(`SELECT COUNT(*) as c FROM "${table_name}" WHERE "${col.column_name}" = ''`);
          emptyCount = parseInt(empty.rows[0].c);
        }

        // Get sample values (up to 3 distinct)
        try {
          const samples = await client.query(`
            SELECT DISTINCT "${col.column_name}" as val FROM "${table_name}" 
            WHERE "${col.column_name}" IS NOT NULL 
            LIMIT 3
          `);
          sampleValues = samples.rows.map(r => {
            const v = r.val;
            if (v === null) return 'NULL';
            if (typeof v === 'string' && v.length > 80) return v.substring(0, 80) + '...';
            if (v instanceof Date) return v.toISOString();
            return String(v);
          });
        } catch(e) { sampleValues = ['[erro ao ler]']; }
      }

      let status;
      if (total === 0) {
        status = 'TABELA_VAZIA';
      } else if (filledCount === 0) {
        status = 'SEM_DADOS';
      } else if (nullCount === 0 && emptyCount === 0) {
        status = 'COMPLETO';
      } else if (filledCount > 0 && (nullCount > 0 || emptyCount > 0)) {
        status = 'PARCIAL';
      } else {
        status = 'COMPLETO';
      }

      fields.push({
        column: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable,
        default: col.column_default ? String(col.column_default).substring(0, 40) : null,
        total,
        filled: filledCount,
        nulls: nullCount,
        empties: emptyCount,
        status,
        samples: sampleValues
      });
    }

    report[table_name] = { total, fields };
  }

  fs.writeFileSync('audit-result.json', JSON.stringify(report, null, 2), 'utf8');
  console.log('Done');
  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
