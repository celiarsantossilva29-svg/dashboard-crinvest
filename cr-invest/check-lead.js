const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.lead.findUnique({where: {id: '19475435'}}).then(lead => console.log(lead)).finally(() => prisma['$disconnect']());
