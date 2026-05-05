const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const gastos = [
  // Pessoas
  { descricao: "Pró-labore Célia", valor: 20000, categoria: "pessoas", fornecedor: "Célia (Sócia)", tipo: "fixo", recorrente: true, status: "pago" },
  { descricao: "Pró-labore Giovanna", valor: 5000, categoria: "pessoas", fornecedor: "Giovanna (PJ)", tipo: "fixo", recorrente: true, status: "pago" },
  
  // Espaço Físico
  { descricao: "Aluguel", valor: 1600, categoria: "espaco", fornecedor: "Imobiliária", tipo: "fixo", recorrente: true, status: "pago" },
  { descricao: "Condomínio", valor: 600, categoria: "espaco", fornecedor: "Administradora", tipo: "fixo", recorrente: true, status: "pago" },
  { descricao: "IPTU", valor: 120, categoria: "espaco", fornecedor: "Prefeitura", tipo: "fixo", recorrente: true, status: "pago" },
  { descricao: "Energia elétrica", valor: 300, categoria: "espaco", fornecedor: "Enel", tipo: "fixo", recorrente: true, status: "pago" },
  { descricao: "Internet/Telefone", valor: 150, categoria: "espaco", fornecedor: "Operadora", tipo: "fixo", recorrente: true, status: "pago" },
  { descricao: "Limpeza/Manutenção", valor: 150, categoria: "espaco", fornecedor: "-", tipo: "fixo", recorrente: true, status: "pago" },
  
  // Tecnologia
  { descricao: "Kommo CRM", valor: 840, categoria: "tecnologia", fornecedor: "Kommo", tipo: "fixo", recorrente: true, status: "pago" },
  { descricao: "IA (Ferramentas)", valor: 300, categoria: "tecnologia", fornecedor: "OpenAI/Outros", tipo: "fixo", recorrente: true, status: "pago" },
  { descricao: "Meta Verified", valor: 174, categoria: "tecnologia", fornecedor: "Meta", tipo: "fixo", recorrente: true, status: "pago" },
  
  // Marketing
  { descricao: "Meta Ads", valor: 6000, categoria: "marketing", fornecedor: "Meta", tipo: "variavel", recorrente: false, status: "pago" },
  { descricao: "Gestor de tráfego", valor: 1500, categoria: "marketing", fornecedor: "Gestor", tipo: "fixo", recorrente: true, status: "pago" },
  { descricao: "Marketing Instagram", valor: 1000, categoria: "marketing", fornecedor: "Agência/Freelancer", tipo: "fixo", recorrente: true, status: "pago" },
  
  // Outros
  { descricao: "Contabilidade", valor: 1200, categoria: "outros", fornecedor: "Contador", tipo: "fixo", recorrente: true, status: "pago" },
];

async function seed() {
  const currentMonth = new Date('2026-04-05T12:00:00Z');
  
  for (const g of gastos) {
    await p.gasto.create({
      data: {
        ...g,
        dataGasto: currentMonth,
      }
    });
    console.log(`Inserido: ${g.descricao}`);
  }
}

seed().catch(console.error).finally(() => p.$disconnect());
