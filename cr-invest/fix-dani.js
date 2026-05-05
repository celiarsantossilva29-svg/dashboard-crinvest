const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const v = await p.vendedor.findMany({where:{role:'CLOSER'}, select:{id:true,nome:true,status:true}});
  console.log('Closers cadastrados:');
  for (const c of v) console.log(' ', c.id, c.nome, 'status=' + c.status);
  
  // Desativar Dani
  const dani = v.find(c => c.nome.toLowerCase().includes('dani'));
  if (dani) {
    await p.vendedor.update({ where: { id: dani.id }, data: { status: 'INATIVO' } });
    console.log('\nDani desativada:', dani.id);
  } else {
    console.log('\nDani não encontrada');
  }
})().finally(() => p.$disconnect());
