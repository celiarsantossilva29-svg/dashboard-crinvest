const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const names = [
    'ANTONIO FILLIPE ANTUNES PINTO',
    'CLAUDIO ROGERIO FERREIRA',
    'CLEITON MARQUES BATISTA',
    'DANIEL DE CASTRO RODRIGUES',
    'EVERTON GONCALVES DE ARAUJO',
    'RAPHAEL CARDOSO DA SILVA',
    'RICHARD CLAYDERMAN FARIA DE OLIVEIRA',
    'RUDNEI DIAS TAVARES',
    'SOROBAN CONTABILIDADE LTDA',
    'THAIS PEREIRA DOS SANTOS SILVA'
  ];

  for (const name of names) {
    const sale = await p.sale.findFirst({
      where: { clientName: { contains: name.split(' ')[0] } },
      include: { installments: { orderBy: { parcelaNumero: 'asc' } } }
    });
    if (sale && sale.clientName.includes(name.split(' ')[1])) {
      const pendentes = sale.installments.filter(i => i.status === 'PENDENTE' && !i.pago);
      console.log(`Found: ${sale.clientName} | Pendentes: ${pendentes.length}`);
    } else {
      console.log(`Not found exact: ${name}`);
    }
  }
}
main().finally(() => p.$disconnect());
