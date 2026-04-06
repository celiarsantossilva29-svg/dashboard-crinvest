# CR Invest — Sistema de Performance
## Instruções para Claude Code

Você é um engenheiro full-stack sênior. Sua tarefa é construir do zero um sistema de dashboard de performance comercial chamado "CR Invest — Sistema de Performance".

### REGRA ABSOLUTA DE SEGURANÇA
Este sistema é SOMENTE LEITURA em relação a sistemas externos. O dashboard nunca deve escrever, editar ou deletar dados no Kommo CRM, Meta Ads, GoTo ou 3C Plus. Todas as integrações externas usam exclusivamente métodos GET. Os únicos dados que o sistema escreve são no PostgreSQL local (cache interno) e nas entidades próprias do dashboard como metas, vendas manuais e usuários.

### STACK
Next.js 14 com App Router, Tailwind CSS, Prisma ORM e PostgreSQL. Se houver razão técnica para outra escolha, justifique antes de começar.

### ETAPA 0 — SETUP INICIAL
1. Inicialize o projeto com a stack acima
2. Configure o Prisma com PostgreSQL
3. Crie o arquivo .env.example com as seguintes variáveis:
   DATABASE_URL=
   KOMMO_CLIENT_ID=
   KOMMO_CLIENT_SECRET=
   KOMMO_REDIRECT_URI=
   KOMMO_SUBDOMAIN=
   FB_APP_ID=
   FB_APP_SECRET=
   FB_ACCESS_TOKEN=
   FB_AD_ACCOUNT_ID=
   GOTO_API_KEY=
   GOTO_ACCOUNT_ID=
   THREEC_API_KEY=
   THREEC_ACCOUNT_ID=
   NEXTAUTH_SECRET=
   NEXTAUTH_URL=
   USE_MOCK_DATA=true
4. Crie README.md com instruções de como obter cada credencial
5. Crie src/lib/readonly-guard.ts que exporta uma função assertReadOnly(method: string) que lança erro se method !== "GET".

### ETAPA 1 — BANCO DE DADOS
Crie o schema.prisma com os modelos: Lead, Sale, AdsMetrics, DialerMetrics, Goal e SyncLog conforme detalhado no prompt original.

### ETAPA 2 — INTEGRAÇÕES SOMENTE LEITURA
Implemente os serviços para:
- **Kommo CRM**: OAuth 2.0, sync de leads e status.
- **Meta Ads API**: Busca de insights de campanhas (CPM, CTR, CPC, CPL).
- **GoTo e 3C Plus**: Consolidado de ligações e tempo falado por agente.

### ETAPA 3 — CÁLCULOS DE KPI
Implemente as funções de cálculo para CAC, Ticket Médio, Taxa de Conversão, Ciclo de Vendas, LTV, Prospecção e Métricas de Ads.

### ETAPA 4 — API ROUTES & FRONTEND
- Crie os endpoints de API para alimentar o dashboard.
- Desenvolva o Dashboard com: MetaTermometro, RitmoCards, FunilComercial, KpiVendas, KpiProspeccao, KpiAds e DiscadoresPanel.

### ORDEM DE EXECUÇÃO
Execute etapa por etapa, confirmando cada uma antes de prosseguir. Comece pelo Setup e Prisma.
