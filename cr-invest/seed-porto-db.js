/**
 * Seed único: carrega comissoes-base.json para o banco de dados (AppSetting).
 * Executar UMA VEZ após deploy inicial: node seed-porto-db.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, 'comissoes-base.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('comissoes-base.json não encontrado');
    process.exit(1);
  }

  const value = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(value);
  console.log(`Carregando ${Object.keys(data).length} apólices...`);

  await prisma.appSetting.upsert({
    where: { key: 'porto:comissoes-base' },
    create: { key: 'porto:comissoes-base', value },
    update: { value },
  });

  console.log('✅ porto:comissoes-base salvo no banco');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
