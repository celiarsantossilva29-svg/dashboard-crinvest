const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.sale.findFirst({where:{id:'c3ece79a-fa38-4296-857b-c20b0cde506f'}}).then(console.log).finally(() => p.$disconnect());
