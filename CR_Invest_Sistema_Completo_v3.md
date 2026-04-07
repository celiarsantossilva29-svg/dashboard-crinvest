# CR Invest — Sistema de Performance
## Documento Completo do Sistema (v3)

---

## Visão Geral

Um painel executivo de gestão comercial construído em Next.js 14 + PostgreSQL que cruza automaticamente dados de quatro plataformas (Kommo CRM, Meta Ads, GoTo e 3C Plus) para entregar uma visão única, em tempo real, de toda a operação da CR Invest — do investimento em tráfego pago até a confirmação do pagamento da parcela do cliente.

**Regra fundamental:** somente leitura nas plataformas externas. Nenhum dado é alterado no Kommo, Meta Ads, GoTo ou 3C Plus. O sistema apenas consome, cruza e exibe. As únicas escritas acontecem no banco local: vendas manuais, metas de ciclo, metas mensais do time, histórico de vendas por closer, confirmações de pagamento e usuários.

**Stack:** Next.js 14 (App Router) + Tailwind CSS + Prisma ORM + PostgreSQL

**Integrações:**
- Kommo CRM: OAuth 2.0, somente GET ✅ conectado
- Meta Ads API v18+: token de longa duração, somente GET ❌ pendente credenciais
- GoTo Connect: OAuth 2.0 Authorization Code + Call History API v1, somente GET ✅ conectado
- 3C Plus: desativado (não utilizado)

**Sincronização:** automática a cada 30 minutos via cron job. O frontend nunca trava — se o banco estiver vazio, exibe zeros e libera a tela imediatamente. Os dados reais aparecem em background quando o sync terminar.

**Identidade visual CR Invest — Elegante:**
Paleta principal: Fundo `#0A0A0A` (preto profundo) ou `#FFFFFF` (branco) conforme modo. Cards com borda `1px solid #C9A84C` (dourado) com `border-radius: 12px`. Tipografia: display em **Playfair Display** (títulos, valores grandes), corpo em **DM Sans** (labels, dados). Dourado primário `#C9A84C`, dourado claro `#E8C96B`, preto `#0A0A0A`, branco `#FAFAFA`, cinza neutro `#1C1C1C`. Labels em `10px` uppercase com espaçamento de letras. Valores em `24–28px` weight 600. Nenhum gradiente genérico — apenas transições sutis dourado→transparente. Separadores em linhas `0.5px` douradas. Sem sombras coloridas: apenas `box-shadow: 0 1px 3px rgba(201,168,76,0.12)`.

**Abas do sistema:**
1. Ciclo Comercial
2. Performance SDR
3. Performance Closer
4. Gestão de Vendas
5. Validação de Venda
6. Reunião de Performance
7. Metas & Histórico ← nova
8. Integrações ← nova
9. Configurações

---

## 1. Ciclo Comercial — a tela do chefe

### Descrição

A visão executiva completa do mês comercial em uma única página. O diretor abre essa tela e em 30 segundos sabe se a empresa vai bater a meta ou não, e por quê. Cruza dados de todas as quatro plataformas simultaneamente para mostrar o panorama completo: quanto foi investido em ads, quantos leads isso gerou, quantos viraram vendas e qual é o ritmo necessário para fechar o mês na meta.

É a "tela do chefe" — densa em dados mas limpa visualmente, com alertas automáticos que chamam atenção apenas quando algo está fora do esperado.

### KPIs — Bloco Termômetro de Meta (expandido)

O termômetro exibe o progresso financeiro e indicadores operacionais que transformam o número em guia de ação.

**Progresso financeiro:**

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Realizado no ciclo | Total de receita confirmada | Soma de todas as vendas won | Kommo + Manual |
| % da meta | Percentual atingido | Realizado / Meta × 100 | Calculado |
| Falta atingir | Valor absoluto restante | Meta − Realizado | Calculado |
| Meta do ciclo | Alvo mensal configurado | Definido em Configurações | Banco local |

**Ticket médio e vendas estimadas:**

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Ticket médio atual | Valor médio das vendas do ciclo | Receita total / vendas fechadas | Kommo + Manual |
| Ticket médio de referência | Usado quando não há vendas ainda | Média dos 3 ciclos anteriores | Banco local |
| Vendas já realizadas | Negócios fechados no ciclo | Count won | Kommo + Manual |
| Vendas necessárias total | Quantas vendas para bater a meta | Meta / ticket médio (arredondado para cima) | Calculado |
| Vendas restantes | Quantas ainda faltam fechar | Vendas necessárias − realizadas | Calculado |
| Cenário conservador | Se ticket cair 10% | Meta / (ticket × 0,9) − realizadas | Calculado |
| Cenário base | Com ticket atual | Meta / ticket − realizadas | Calculado |
| Cenário otimista | Se ticket subir 10% | Meta / (ticket × 1,1) − realizadas | Calculado |
| Fechamentos por dia necessários | Ritmo operacional | Vendas restantes / dias restantes | Calculado |

**Visualização abaixo da barra:**
```
Ticket médio atual: R$ 206.561  ·  Vendas realizadas: 2  ·  Faltam: 23 vendas
─────────────────────────────────────────────────────────────────
Conservador (ticket -10%): faltam 26 vendas
Base (ticket atual):       faltam 23 vendas  ← destacado
Otimista (ticket +10%):    faltam 21 vendas
```

### KPIs — Bloco Ritmo e Projeção

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Ritmo atual | Média diária de vendas realizada até hoje | Realizado / dias passados no ciclo | Calculado |
| Ritmo necessário | Média diária necessária para bater a meta | (Meta − Realizado) / dias restantes | Calculado |
| Projeção final | Quanto será faturado se o ritmo atual se mantiver | Ritmo atual × dias totais do ciclo | Calculado |
| Dias restantes | Dias até o fim do ciclo comercial | Data fim − hoje | Calculado |

### KPIs — Bloco Vendas

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| CAC | Custo médio para adquirir um cliente | Total investido em Ads / nº de vendas fechadas | Meta Ads + Kommo |
| Ticket médio | Valor médio por venda fechada | Receita total / quantidade de vendas won | Kommo |
| Taxa de conversão | Percentual de leads que viraram clientes | Vendas / total de leads × 100 | Kommo |
| Ciclo de vendas | Tempo médio entre entrada do lead e fechamento | Média de (closedAt − createdAt) em dias | Kommo |
| LTV | Valor projetado do cliente em 12 meses | Ticket médio × 12 | Calculado |

### KPIs — Bloco Prospecção

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Leads gerados | Total de leads entrados no período | Count de leads no período | Kommo + Meta Ads |
| Taxa de agendamento | Percentual de leads que avançaram para reunião | Agendados / contatados × 100 | Kommo |
| No-show | Percentual de reuniões onde o lead não compareceu | Faltas / reuniões agendadas × 100 | Kommo |
| Taxa de qualificação | Percentual de leads qualificados sobre o total | Qualificados / total × 100 | Kommo |
| Contatos por lead | Média de interações até conversão ou perda | Soma de interações / total de leads | Kommo |

### KPIs — Bloco Funil Comercial

| Etapa | Descrição | O que conta | Conversão exibida | Fonte |
|-------|-----------|------------|------------------|-------|
| Leads gerados | Topo do funil | Todos os leads do período | — | Kommo + Meta Ads |
| Contatados | Primeiro contato realizado | Leads com interação registrada | Contatados / leads | Kommo |
| Agendamentos | Reunião marcada | Leads na etapa agendado | Agendados / contatados | Kommo |
| Reuniões | Reunião efetivamente realizada | Leads com reunião confirmada | Reuniões / agendados | Kommo |
| Vendas | Negócio fechado | Leads com status won | Won / reuniões | Kommo + Manual |

### KPIs — Bloco Meta Ads

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| CPM | Custo por mil impressões | (Investimento / impressões) × 1000 | Meta Ads API |
| CTR | Taxa de cliques sobre impressões | Cliques / impressões × 100 | Meta Ads API |
| CPC | Custo médio por clique | Investimento / cliques | Meta Ads API |
| CPL | Custo médio por lead gerado | Investimento / leads gerados | Meta Ads API |
| ROAS | Retorno sobre investimento em ads | Receita fechada / investimento em ads | Meta Ads + Kommo |
| Investimento total | Total gasto em ads no período | Soma do spend | Meta Ads API |
| Total de impressões | Alcance bruto das campanhas | Soma de impressões | Meta Ads API |
| Total de cliques | Cliques totais nas campanhas | Soma de cliques | Meta Ads API |
| Leads gerados via ads | Leads vindos de Lead Ads | Count de ações lead | Meta Ads API |

### KPIs — Bloco Discadores

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Total de ligações | Ligações somando GoTo e 3C Plus | Soma total de calls | GoTo + 3C Plus |
| Tempo total falado | Soma de todo o tempo em chamada | Soma de talkTimeSecs formatado em Xh Ym | GoTo + 3C Plus |
| Média por ligação | Duração média de cada chamada | Tempo total / total de ligações | Calculado |
| Ligações por dia | Volume diário médio | Total / dias do período | Calculado |
| Ligações GoTo | Chamadas pelo discador GoTo | Count source = goto | GoTo |
| Ligações 3C Plus | Chamadas pelo discador 3C Plus | Count source = threec | 3C Plus |

### KPIs — Bloco Tabulações 3C Plus

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Volume por tabulação | Quantidade de cada resultado | Count por categoria de tabulação | 3C Plus |
| % por tabulação | Representatividade sobre o total | Volume da categoria / total × 100 | Calculado |

### KPIs — Bloco Ranking de Closers

| Coluna | Descrição | Fórmula | Fonte |
|--------|-----------|---------|-------|
| Vendas | Negócios fechados | Count won | Kommo |
| Receita | Faturamento total | Soma dealValue won | Kommo |
| Ticket médio | Valor médio por venda | Receita / vendas | Calculado |
| Taxa win | Conversão de reuniões em vendas | Won / (won + lost) × 100 | Kommo |
| Reunião/Venda | Eficiência do closer | Reuniões / vendas fechadas | Kommo |
| No-show | Reuniões perdidas | % reuniões sem presença | Kommo |

---

## 2. Performance SDR

### Descrição

Tela operacional dedicada ao SDR (atualmente Cauê). Mede o esforço de prospecção, a velocidade de resposta aos leads e a qualidade da passagem de bastão para os Closers. O principal indicador dessa tela é o Speed-to-Lead — quanto tempo o SDR leva para fazer o primeiro contato após o lead entrar pelo Meta Ads.

Também exibe o funil por etapa do Kommo por SDR, permitindo identificar onde os leads estão travando na carteira de cada vendedor. O ranking de SDRs permite comparação direta de desempenho quando a equipe crescer.

### KPIs — Bloco Esforço Operacional

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Speed-to-Lead | Tempo médio do primeiro contato após entrada do lead | Média de (primeiro contato − createdAt) em minutos | Kommo |
| Total de leads recebidos | Leads atribuídos ao SDR no período | Count leads assigned ao SDR | Kommo |
| Agendamentos gerados | Leads que avançaram para etapa agendado | Count leads em etapa agendado | Kommo |
| Taxa de agendamento | Conversão de leads em agendamentos | Agendamentos / leads recebidos × 100 | Kommo |
| Tarefas vencidas | Leads com tarefa atrasada | Count leads com nextTask < agora | Kommo |
| No-show médio | Reuniões sem comparecimento | Faltas / agendadas × 100 | Kommo |
| Tentativas por lead | Média de contatos feitos por lead | Soma de interações / total de leads | Kommo |
| Reagendamentos | Leads que precisaram remarcar reunião | Count leads em etapa reagendado | Kommo |

### KPIs — Bloco Funil por Etapa por SDR

| KPI | O que conta | Fonte |
|-----|------------|-------|
| Leads por etapa por SDR | Count por status por SDR | Kommo |
| Etapas | Novo, Contatado, Qualificado, Agendado, Reagendado, Reunião, Won, Lost | Kommo |

### KPIs — Bloco Passagem de Bastão SDR → Closer

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| SDR Score médio | Nota dada pelo Closer | Média das notas por agendamento | Kommo (campo custom) |
| Agendamentos passados | Leads entregues ao Closer | Count leads em reunião ou won | Kommo |
| Taxa de no-show | Qualidade dos agendamentos | No-show / agendamentos × 100 | Kommo |

### KPIs — Bloco Discadores por SDR

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Ligações realizadas | Calls do SDR no período | Count calls do agente | GoTo + 3C Plus |
| Tempo total falado | Soma do talk time | Soma talkTimeSecs | GoTo + 3C Plus |
| Média por ligação | Duração média | Tempo / ligações | Calculado |
| Split por discador | GoTo vs 3C Plus | Count por source | GoTo + 3C Plus |

### KPIs — Bloco Ranking de SDRs

| Coluna | Fórmula | Fonte |
|--------|---------|-------|
| Leads | Count atribuídos | Kommo |
| Speed | Média speed-to-lead minutos | Kommo |
| Tent./Lead | Interações / leads | Kommo |
| Agend. | Count agendamentos | Kommo |
| Reagend. | Count reagendamentos | Kommo |
| Vencidas | Tasks atrasadas | Kommo |
| No-show | % faltas / agendadas | Kommo |
| Score | Média das notas recebidas | Kommo |
| Maturidade | Dias médios dos leads em carteira | Kommo |
| Ligações | Count calls | GoTo + 3C Plus |

---

## 3. Performance Closer

### Descrição

Tela de acompanhamento das Closers (Eunice e Célia). Mede conversão, qualidade das reuniões e resultado financeiro individual. Responde: quem está fechando mais, quem tem melhor aproveitamento de reuniões e qual é a projeção de comissão de cada uma.

### KPIs — Bloco Visão Geral

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Ticket médio | Valor médio das vendas | Receita / won | Kommo |
| Taxa de win | Aproveitamento das oportunidades | Won / (won + lost) × 100 | Kommo |
| Vendas fechadas | Total de negócios ganhos | Count won | Kommo |
| Receita total | Faturamento do período | Soma dealValue | Kommo |
| No-show médio | Reuniões sem presença | Faltas / agendadas × 100 | Kommo |
| Reunião por venda | Eficiência de fechamento | Reuniões / vendas | Kommo |
| Comissão projetada | Estimativa de ganho | Receita × % comissão | Calculado |

### KPIs — Bloco Ranking de Closers

| Coluna | Fórmula | Fonte |
|--------|---------|-------|
| Vendas | Count won | Kommo |
| Receita | Soma dealValue | Kommo |
| Ticket médio | Receita / vendas | Calculado |
| Taxa win | Won / (won + lost) × 100 | Kommo |
| Reun./Venda | Reuniões / vendas | Kommo |
| No-show | % faltas / agendadas | Kommo |
| Comissão acumulada | Receita × % comissão | Calculado |

### KPIs — Bloco Negócios Ganhos

| Campo | Descrição | Fonte |
|-------|-----------|-------|
| Nome do cliente | Identificação | Kommo |
| Closer responsável | Quem conduziu | Kommo |
| Valor do negócio | Valor da venda | Kommo |
| Data de fechamento | Quando foi fechado | Kommo |
| Campanha de origem | Qual campanha gerou o lead | Meta Ads via Kommo |
| Administradora | Porto Seguro, Embracon etc. | Kommo (campo custom) |
| Parcelas pagas / total | Progresso do recebimento | Validação de Venda (banco local) |

### KPIs — Bloco Negócios Perdidos

| Campo | Descrição | Fonte |
|-------|-----------|-------|
| Nome do cliente | Identificação | Kommo |
| Closer responsável | Quem conduziu | Kommo |
| Valor potencial | Quanto poderia ter sido fechado | Kommo |
| Data de perda | Quando o negócio foi perdido | Kommo |
| Motivo de perda | Objeção ou razão do não fechamento | Kommo (loss_reason) |

---

## 4. Gestão de Vendas

### Descrição

O livro caixa comercial da CR Invest. Registro histórico completo e flexível de todas as vendas realizadas — tanto as vindas do Kommo quanto as registradas manualmente. Permite ao gestor buscar qualquer venda por cliente ou closer, filtrar por período e visualizar o ranking atualizado dos melhores closers do mês ao lado da tabela.

O botão Nova Venda permite registrar vendas que não passaram pelo Kommo (vendas diretas, indicações etc.), garantindo que o faturamento real esteja sempre completo no sistema.

### KPIs — Bloco Indicadores do Período

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Total de vendas | Quantidade de vendas no período | Count de vendas | Kommo + Manual |
| Receita total | Faturamento bruto | Soma dos valores | Kommo + Manual |
| Ticket médio | Valor médio por venda | Receita / vendas | Calculado |
| Variação vs mês anterior | Crescimento ou queda | (Atual − anterior) / anterior × 100 | Calculado |

### Colunas da Tabela Histórica

| Coluna | Descrição | Fonte |
|--------|-----------|-------|
| Data | Data de fechamento da venda | Kommo / Manual |
| Cliente | Nome do comprador | Kommo / Manual |
| Administradora | Porto Seguro, Embracon etc. | Kommo (campo custom) / Manual |
| Valor | Valor da venda | Kommo / Manual |
| Closer | Responsável pelo fechamento | Kommo / Manual |
| Origem | CRM (Kommo) ou Manual | Sistema |
| Campanha | Campanha que gerou o lead | Meta Ads via Kommo |

### KPIs — Bloco Ranking Lateral de Closers

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Total vendido | Faturamento individual | Soma dealValue | Kommo + Manual |
| Número de vendas | Quantidade individual | Count por closer | Kommo + Manual |
| Ticket médio individual | Valor médio por closer | Receita / vendas do closer | Calculado |

---

## 5. Validação de Venda — controle financeiro

### Descrição

O controle de caixa e liberação de comissões da CR Invest. Como consórcio é pago em parcelas mensais, cada venda gera um fluxo de recebimentos que precisa ser confirmado pelo administrador antes de liberar a comissão do vendedor.

O administrador usa essa tela para confirmar que o dinheiro de cada parcela entrou na conta da empresa. Ao confirmar, o sistema registra o pagamento e libera automaticamente a comissão daquela fração para o closer responsável. A linha do tempo visual de parcelas (quadradinhos coloridos) substitui textos como "12 parcelas pendentes" por uma visualização imediata do histórico de cada cliente.

Essa é a única tela do sistema onde o administrador executa uma ação irreversível — a confirmação de pagamento registra timestamp e usuário que confirmou.

### KPIs — Bloco Indicadores de Topo

| KPI | Descrição | O que conta | Fonte |
|-----|-----------|------------|-------|
| Total pendente | Soma de todas as parcelas não confirmadas | Soma valores pendentes | Banco local |
| Vencem hoje | Clientes com parcela vencendo hoje | Count vencimento = hoje | Banco local |
| Em atraso | Clientes com parcela vencida e não paga | Count vencimento < hoje e não pago | Banco local |
| Closers na validação | Closers com parcelas pendentes | Count closers distintos | Banco local |

### Campos dos Cards de Parcela

| Campo | Descrição | Fonte |
|-------|-----------|-------|
| Nome do cliente | Identificação | Banco local |
| Administradora | Porto Seguro, Embracon etc. | Banco local |
| Closer responsável | Quem vendeu | Banco local |
| Parcelas pendentes / total | Ex: 12 pendentes de 12 | Banco local |
| Próximo vencimento | Data da próxima parcela | Banco local |
| Total em aberto | Soma das parcelas não pagas | Banco local |
| Valor unitário da parcela | Valor + fração (ex: R$ 125 — 1/12) | Banco local |
| Linha do tempo visual | Quadradinhos por parcela | Banco local |
| Status por quadradinho | Dourado = pago, cinza = futuro, vermelho = atrasado | Banco local |

### Bloco Confirmação de Pagamento

| Ação | O que registra | Destino |
|------|---------------|---------|
| Confirmar pagamento | Parcela ID, timestamp, usuário admin | Banco local |
| Liberar comissão | Valor da parcela × % comissão da closer | Banco local |

---

## 6. Reunião de Performance

### Descrição

Tela projetada exclusivamente para ser exibida em reuniões com a equipe — em TV, projetor ou tela compartilhada. Não é uma tela de análise: é uma tela de apresentação. Os dados são os mesmos do sistema, mas o layout muda para priorizar impacto visual, números grandes e leitura a distância.

Tem um botão "Modo Apresentação" que esconde sidebar e header, deixando apenas o conteúdo em tela cheia.

**Modo Visão Geral:** resultado consolidado da empresa — meta, ritmo, ranking e alertas. Ideal para abrir a reunião e contextualizar o time.

**Modo Equipe:** desempenho individual de cada membro com números grandes e comparação direta. Ideal para o momento de feedback e reconhecimento.

### KPIs — Modo Visão Geral

**Bloco Termômetro da Reunião**

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| % da meta atingida | Número grande centralizado | Realizado / meta × 100 | Calculado |
| Valor realizado | Faturamento atual | Soma vendas won | Kommo + Manual |
| Meta do ciclo | Alvo do mês | Configurado no sistema | Banco local |
| Faltam X vendas | Operacional e direto | (Meta − realizado) / ticket médio | Calculado |
| Dias restantes | Urgência temporal | Data fim − hoje | Calculado |
| Status do ritmo | Dourado se no ritmo, vermelho se abaixo | Ritmo atual vs necessário | Calculado |

**Bloco Números de Impacto**

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Total de ligações no ciclo | Esforço coletivo do time | Soma GoTo + 3C Plus | GoTo + 3C Plus |
| Leads trabalhados | Leads que receberam contato | Count leads contatados | Kommo |
| Reuniões realizadas | Compromissos honrados | Count reuniões confirmadas | Kommo |
| Vendas fechadas | O número mais importante | Count won | Kommo + Manual |
| Taxa de conversão geral | Lead para venda | Won / leads × 100 | Calculado |
| Ticket médio do ciclo | Qualidade das vendas | Receita / won | Calculado |

**Bloco Alertas e Destaques**

| Destaque | Descrição | Fonte |
|----------|-----------|-------|
| Maior venda do ciclo | Negócio de maior valor | Kommo + Manual |
| Cliente mais recente | Última venda confirmada | Kommo + Manual |
| SDR com mais agendamentos | Destaque operacional | Kommo |
| Closer com mais vendas | Destaque de fechamento | Kommo + Manual |
| Campanha com menor CPL | Melhor retorno em ads | Meta Ads API |

**Bloco Funil Visual Simplificado**

| Etapa | KPI exibido | Fonte |
|-------|------------|-------|
| Leads | Volume total | Kommo + Meta Ads |
| Contatados | Volume + % do total | Kommo |
| Agendamentos | Volume + % de conversão | Kommo |
| Reuniões | Volume + % de conversão | Kommo |
| Vendas | Volume + % de conversão | Kommo + Manual |

### KPIs — Modo Equipe

**Bloco SDR — card grande por agente**

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Nome e foto/iniciais | Identificação visual | — | Banco local |
| Ligações realizadas | Volume de prospecção | Count calls | GoTo + 3C Plus |
| Agendamentos gerados | Resultado do esforço | Count agendamentos | Kommo |
| Taxa de agendamento | Eficiência | Agendamentos / leads × 100 | Kommo |
| Speed-to-Lead médio | Velocidade de resposta | Média minutos primeiro contato | Kommo |
| No-show gerado | Qualidade dos agendamentos | % faltas / agendados | Kommo |
| Posição no ranking | Comparação entre SDRs | Ordenado por agendamentos | Calculado |

**Bloco Closer — card grande por agente**

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Nome e foto/iniciais | Identificação visual | — | Banco local |
| Vendas fechadas | O número principal | Count won | Kommo + Manual |
| Receita gerada | Faturamento individual | Soma dealValue | Kommo + Manual |
| Ticket médio | Qualidade das vendas | Receita / vendas | Calculado |
| Taxa de win | Aproveitamento de reuniões | Won / (won + lost) × 100 | Kommo |
| No-show sofrido | Reuniões perdidas por falta | % faltas / agendadas | Kommo |
| Comissão acumulada | Motivação financeira | Receita × % configurada | Calculado |
| Posição no ranking | Comparação entre closers | Ordenado por receita | Calculado |

**Bloco Comparativo da Equipe**

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Ligações totais do time | Esforço coletivo | Soma todos os agentes | GoTo + 3C Plus |
| Agendamentos totais | Resultado coletivo SDR | Soma todos SDRs | Kommo |
| Reuniões totais | Volume de oportunidades | Soma todas closers | Kommo |
| Vendas totais | Resultado coletivo | Count won geral | Kommo + Manual |
| Meta individual de vendas | Quanto cada closer precisa fechar | Meta / nº de closers | Calculado |
| % meta individual atingida | Progresso de cada closer | Vendas da closer / meta individual × 100 | Calculado |

**Bloco Reconhecimento**

| Destaque | Critério | Fonte |
|----------|---------|-------|
| MVP do ciclo | Closer com maior receita + melhor taxa win | Kommo + Manual |
| Maior evolução | Quem mais cresceu vs ciclo anterior | Calculado |
| Melhor Speed-to-Lead | SDR com menor tempo médio de primeiro contato | Kommo |
| Maior ticket | Venda de maior valor no ciclo | Kommo + Manual |

---

## 7. Metas & Histórico ← nova aba

### Descrição

Central de metas mensais do time e repositório histórico de resultados. É a memória da operação: cada meta definida fica registrada permanentemente com o resultado efetivo ao final do período, construindo um histórico que permite comparar ciclos, identificar tendências e tomar decisões baseadas em dados reais ao longo do tempo.

Duas seções principais: **Gestão de Metas** (definir e acompanhar as metas mensais do time e de cada closer individualmente) e **Histórico de Vendas por Closer** (tabela cronológica com o desempenho de cada closer mês a mês desde o início da operação).

---

### Seção A — Gestão de Metas Mensais

#### Descrição da Seção

O administrador define no início de cada mês a meta global da operação e as metas individuais de cada closer. Ao encerrar o ciclo, o sistema registra o resultado efetivo automaticamente. O histórico de metas nunca é deletado — apenas arquivado — permitindo auditoria completa de todos os objetivos já definidos.

#### Bloco Meta do Ciclo Atual

| Campo | Tipo | Descrição | Destino |
|-------|------|-----------|---------|
| Mês / Ano de referência | Date picker (mês) | Período ao qual a meta se aplica | Banco local |
| Meta global (R$) | Input numérico | Alvo de faturamento do time completo no mês | Banco local |
| Realizado (R$) | Calculado automático | Soma de todas as vendas won no período | Kommo + Manual → Banco local |
| % atingido | Calculado | Realizado / Meta × 100 | Calculado |
| Status do ciclo | Automático | Aberto (em curso) / Encerrado (arquivado) | Banco local |
| Data de fechamento do ciclo | Date picker | Último dia do ciclo comercial | Banco local |

#### Bloco Metas Individuais por Closer

Cada closer tem uma meta mensal própria em número de vendas e em receita. Isso permite comparação justa entre closers com carteiras diferentes e acompanhamento individualizado ao longo dos meses.

| Campo | Tipo | Descrição | Destino |
|-------|------|-----------|---------|
| Closer | Seletor | Nome do closer (Eunice, Célia etc.) | Banco local |
| Mês / Ano | Referência do ciclo | Período ao qual a meta individual se aplica | Banco local |
| Meta em vendas (qtd) | Input numérico | Número de negócios que o closer deve fechar | Banco local |
| Meta em receita (R$) | Input numérico | Faturamento individual esperado | Banco local |
| Realizado em vendas | Calculado | Count won do closer no período | Kommo + Manual |
| Realizado em receita (R$) | Calculado | Soma dealValue won do closer no período | Kommo + Manual |
| % meta vendas atingida | Calculado | Realizado qtd / meta qtd × 100 | Calculado |
| % meta receita atingida | Calculado | Realizado R$ / meta R$ × 100 | Calculado |
| Status | Automático | No alvo / Abaixo do alvo / Superou | Calculado |

#### Bloco Histórico de Metas (tabela arquivada)

Tabela paginada com todos os ciclos já encerrados, do mais recente para o mais antigo. Cada linha representa um mês e é expandível para ver o detalhamento por closer.

| Coluna | Descrição | Fonte |
|--------|-----------|-------|
| Mês / Ano | Período do ciclo | Banco local |
| Meta global (R$) | Alvo definido no início do mês | Banco local |
| Realizado (R$) | Faturamento efetivo ao encerrar | Banco local |
| % atingido | Resultado final | Calculado |
| Nº de vendas | Quantidade de negócios fechados | Banco local |
| Ticket médio | Valor médio das vendas do ciclo | Calculado |
| Melhor closer | Closer com maior receita no ciclo | Banco local |
| Status final | Bateu / Não bateu / Superou (+X%) | Calculado |

Ao expandir uma linha de mês, aparecem as metas e resultados individuais de cada closer naquele período.

#### Bloco Comparativo de Ciclos

Gráfico de barras empilhadas com os últimos 12 meses exibindo meta vs realizado. Permite ao gestor visualizar rapidamente a tendência de evolução da operação.

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Evolução mês a mês | Variação de faturamento | (Atual − anterior) / anterior × 100 | Calculado |
| Média de atingimento | % médio da meta nos últimos 3/6/12 meses | Média dos % atingidos | Calculado |
| Melhor mês | Mês com maior receita realizada | Max realizado | Banco local |
| Pior mês | Mês com menor receita realizada | Min realizado | Banco local |
| Frequência de batimento | Quantos meses a meta foi batida | Count meses atingidos / total × 100 | Calculado |

---

### Seção B — Histórico de Vendas por Closer

#### Descrição da Seção

Tabela cronológica com o desempenho individual de cada closer mês a mês. Permite ao gestor e ao próprio closer acompanhar a evolução ao longo do tempo, identificar sazonalidade e comparar o desempenho histórico.

#### Filtros disponíveis

| Filtro | Tipo | Descrição |
|--------|------|-----------|
| Closer | Seletor múltiplo | Filtrar por um ou mais closers |
| Período | Intervalo de meses | De / até mês-ano |
| Visualização | Toggle | Por closer individualmente / Comparativo entre closers |

#### Tabela de Histórico por Closer (visão mensal)

Cada linha representa um mês de um closer específico.

| Coluna | Descrição | Fórmula | Fonte |
|--------|-----------|---------|-------|
| Mês / Ano | Período | — | Banco local |
| Closer | Nome do vendedor | — | Banco local |
| Vendas realizadas | Negócios fechados no mês | Count won do closer no período | Kommo + Manual |
| Meta em vendas | Alvo definido para o mês | Definido em Metas | Banco local |
| % meta vendas | Progresso vs alvo | Realizadas / meta × 100 | Calculado |
| Receita (R$) | Faturamento individual | Soma dealValue | Kommo + Manual |
| Meta em receita (R$) | Alvo financeiro do mês | Definido em Metas | Banco local |
| % meta receita | Progresso vs alvo | Realizado / meta × 100 | Calculado |
| Ticket médio | Valor médio das vendas | Receita / vendas | Calculado |
| Taxa win | Aproveitamento de reuniões | Won / (won + lost) × 100 | Kommo |
| Comissão gerada (R$) | Ganho do closer no mês | Receita × % comissão | Calculado |
| Variação vs mês anterior | Crescimento/queda individual | (Atual − anterior) / anterior × 100 | Calculado |

#### Card Resumo por Closer (ao filtrar um único closer)

Quando o filtro exibe apenas um closer, aparece um card de perfil com a síntese do histórico completo:

| KPI | Descrição | Fórmula | Fonte |
|-----|-----------|---------|-------|
| Total de vendas (histórico) | Soma de todos os meses | Count won acumulado | Banco local |
| Receita total gerada | Faturamento acumulado | Soma dealValue acumulado | Banco local |
| Ticket médio histórico | Média geral | Receita total / vendas total | Calculado |
| Melhor mês em receita | Pico de desempenho | Max receita mensal | Banco local |
| Melhor mês em vendas | Maior volume | Max vendas mensais | Banco local |
| Média mensal de vendas | Ritmo padrão | Total vendas / meses ativos | Calculado |
| Média de atingimento de meta | Consistência | Média dos % meta atingidos | Calculado |
| Meses acima da meta | Frequência de superação | Count meses atingidos | Banco local |
| Comissão total acumulada | Ganho histórico | Soma das comissões mensais | Calculado |

#### Visualização Comparativa entre Closers

Quando múltiplos closers são selecionados, a tela exibe um gráfico de linhas com a evolução da receita de cada closer mês a mês, usando cores distintas para cada agente. Permite identificar quem está acelerando e quem está estagnado.

| Elemento | Descrição |
|----------|-----------|
| Eixo X | Meses (formato Mmm/AA) |
| Eixo Y | Receita em R$ |
| Linha por closer | Cor única por agente |
| Tooltip ao hover | Mês, closer, receita, vendas, % meta |
| Toggle | Alternar entre receita e número de vendas |

---

## 8. Configurações

### Descrição

Painel de administração do sistema. Centraliza todas as configurações operacionais: definição da meta do ciclo, status das integrações, gestão de usuários, configuração de comissões e gerenciamento do histórico de metas. O log de sincronizações permite ao administrador identificar se alguma integração está falhando antes que isso impacte os dados exibidos.

### Configurações Disponíveis

| Configuração | Tipo | Descrição | Destino |
|-------------|------|-----------|---------|
| Meta do ciclo (R$) | Input numérico | Valor alvo do mês comercial atual | Banco local |
| Data início do ciclo | Date picker | Primeiro dia do ciclo | Banco local |
| Data fim do ciclo | Date picker | Último dia do ciclo | Banco local |
| Metas mensais por closer | Input por closer por mês | Qtd de vendas + R$ alvo individual | Banco local |
| % comissão por closer | Input por closer | Percentual sobre receita confirmada | Banco local |
| Fechar ciclo manualmente | Botão admin | Arquiva o ciclo atual e salva resultado final | Banco local |
| Kommo OAuth | Status + reconectar | Autenticação OAuth2 com o CRM | Banco local |
| Meta Ads token | Status + Ad Account ID | Token de acesso à API | Banco local |
| GoTo API key | Status | Chave de acesso ao discador | Banco local |
| 3C Plus API key | Status | Chave de acesso ao discador | Banco local |
| Sync manual | Botão trigger | Força sincronização imediata | Cron job |
| Log de syncs | Tabela últimas 20 | Status e erros por fonte | Banco local |
| Cadastro de usuários | Formulário | Admin ou Viewer | Banco local |

### Perfis de Acesso

| Perfil | Permissões |
|--------|-----------|
| Admin | Acesso total: visualizar tudo, registrar vendas manuais, definir metas mensais (time e individuais), confirmar pagamentos, fechar ciclos, gerenciar usuários e comissões |
| Viewer | Somente visualização de todas as telas do dashboard, sem acesso a configurações nem ações de escrita |

---

## Modelo de Dados — Tabelas Novas (v3)

### Tabela `team_goals` — Metas mensais do time

```sql
CREATE TABLE team_goals (
  id           SERIAL PRIMARY KEY,
  month        DATE NOT NULL,             -- Primeiro dia do mês (ex: 2025-06-01)
  goal_amount  NUMERIC(15,2) NOT NULL,    -- Meta global em R$
  realized     NUMERIC(15,2) DEFAULT 0,  -- Realizado (calculado ao fechar)
  cycle_start  DATE NOT NULL,            -- Início do ciclo
  cycle_end    DATE NOT NULL,            -- Fim do ciclo
  status       TEXT DEFAULT 'open',      -- 'open' | 'closed'
  closed_at    TIMESTAMPTZ,              -- Quando o ciclo foi encerrado
  closed_by    INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month)
);
```

### Tabela `closer_goals` — Metas mensais individuais por closer

```sql
CREATE TABLE closer_goals (
  id              SERIAL PRIMARY KEY,
  month           DATE NOT NULL,             -- Primeiro dia do mês
  closer_id       INTEGER NOT NULL,          -- Referência ao usuário/closer
  closer_name     TEXT NOT NULL,             -- Nome para exibição
  goal_deals      INTEGER NOT NULL,          -- Meta em número de vendas
  goal_amount     NUMERIC(15,2) NOT NULL,    -- Meta em receita R$
  realized_deals  INTEGER DEFAULT 0,         -- Realizado em vendas (calculado)
  realized_amount NUMERIC(15,2) DEFAULT 0,  -- Realizado em R$ (calculado)
  commission_pct  NUMERIC(5,2) DEFAULT 0,   -- % de comissão do mês
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, closer_id)
);
```

### Tabela `closer_monthly_summary` — Histórico calculado por closer/mês

```sql
CREATE TABLE closer_monthly_summary (
  id              SERIAL PRIMARY KEY,
  month           DATE NOT NULL,
  closer_id       INTEGER NOT NULL,
  closer_name     TEXT NOT NULL,
  total_deals     INTEGER DEFAULT 0,
  total_revenue   NUMERIC(15,2) DEFAULT 0,
  avg_ticket      NUMERIC(15,2) DEFAULT 0,
  win_rate        NUMERIC(5,2) DEFAULT 0,
  commission_earned NUMERIC(15,2) DEFAULT 0,
  goal_deals      INTEGER,                   -- Snapshot da meta do mês
  goal_amount     NUMERIC(15,2),             -- Snapshot da meta do mês
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, closer_id)
);
```

---

## Princípios Técnicos

| Princípio | Descrição |
|-----------|-----------|
| Somente leitura externa | Nenhuma escrita em Kommo, Meta Ads, GoTo ou 3C Plus |
| Carregamento instantâneo | Frontend nunca trava — zeros se não houver dados |
| Persistência local | Frontend lê sempre do banco local (última sync bem-sucedida) |
| Sync automático | Cron job a cada 30 minutos em background |
| Snapshot de metas | Ao fechar o ciclo, os resultados são copiados para `closer_monthly_summary` e não dependem mais de sincronização |
| Histórico imutável | Ciclos encerrados não podem ser editados — apenas auditados |
| Fonte explícita | Cada card exibe de onde o dado vem |
| Timezone | America/Sao_Paulo em todas as datas |
| Formatação | Intl.NumberFormat pt-BR em todos os valores monetários |
| Última atualização | Rodapé discreto com data/hora do último sync |

---

## Identidade Visual CR Invest — Especificações Completas

### Paleta de Cores

| Token | Valor | Uso |
|-------|-------|-----|
| `--cr-black` | `#0A0A0A` | Fundo principal (modo escuro), textos primários |
| `--cr-surface` | `#141414` | Cards e painéis (modo escuro) |
| `--cr-surface-2` | `#1C1C1C` | Fundo de inputs e tabelas |
| `--cr-white` | `#FAFAFA` | Fundo principal (modo claro), textos em dark |
| `--cr-gold` | `#C9A84C` | Cor primária de destaque: bordas, ícones ativos, valores-chave |
| `--cr-gold-light` | `#E8C96B` | Hover states, shimmer, progress bars |
| `--cr-gold-muted` | `#8A6E30` | Estados desabilitados em contexto dourado |
| `--cr-text-primary` | `#FAFAFA` (dark) / `#0A0A0A` (light) | Textos principais |
| `--cr-text-secondary` | `#9A9A9A` | Labels, metadados, datas |
| `--cr-text-gold` | `#C9A84C` | Valores financeiros destacados |
| `--cr-success` | `#22C55E` | Meta batida, pagamento confirmado |
| `--cr-danger` | `#EF4444` | Abaixo da meta, atraso, alerta |
| `--cr-border` | `rgba(201,168,76,0.25)` | Bordas de cards em repouso |
| `--cr-border-active` | `rgba(201,168,76,0.7)` | Bordas de cards em hover/ativo |

### Tipografia

| Aplicação | Fonte | Peso | Tamanho | Uso |
|-----------|-------|------|---------|-----|
| Display / KPI grande | Playfair Display | 600 | 32–48px | Valores financeiros, % da meta |
| Título de seção | Playfair Display | 500 | 20–24px | Cabeçalhos de bloco |
| Corpo / dado | DM Sans | 400–500 | 14–16px | Conteúdo geral, tabelas |
| Label / tag | DM Sans | 500 | 10–11px | Uppercase, letter-spacing 0.08em |
| Número médio | DM Sans | 600 | 20–22px | KPIs secundários |

### Componentes

| Componente | Especificação |
|------------|---------------|
| Card | `background: var(--cr-surface)`, `border: 1px solid var(--cr-border)`, `border-radius: 12px`, `padding: 24px` |
| Card hover | `border-color: var(--cr-border-active)`, `box-shadow: 0 0 0 1px rgba(201,168,76,0.2)` |
| Barra de progresso | Track cinza `#2A2A2A`, fill gradiente `#C9A84C → #E8C96B`, `border-radius: 4px`, `height: 6px` |
| Badge "No alvo" | Fundo `rgba(34,197,94,0.12)`, texto `#22C55E`, borda `1px solid rgba(34,197,94,0.3)` |
| Badge "Abaixo" | Fundo `rgba(239,68,68,0.12)`, texto `#EF4444`, borda `1px solid rgba(239,68,68,0.3)` |
| Badge "Superou" | Fundo `rgba(201,168,76,0.12)`, texto `#C9A84C`, borda `1px solid rgba(201,168,76,0.3)` |
| Separador | `border-top: 0.5px solid rgba(201,168,76,0.15)` |
| Input | `background: var(--cr-surface-2)`, `border: 1px solid var(--cr-border)`, `border-radius: 8px`, `color: var(--cr-text-primary)` |
| Botão primário | `background: #C9A84C`, `color: #0A0A0A`, `border-radius: 8px`, `font-weight: 600` |
| Botão secundário | `background: transparent`, `border: 1px solid #C9A84C`, `color: #C9A84C` |
| Sidebar | `background: #0A0A0A`, `border-right: 1px solid rgba(201,168,76,0.15)` |
| Aba ativa | Label dourado + `border-bottom: 2px solid #C9A84C` |
| Aba inativa | Label cinza, sem borda |
| Tabela header | `background: #141414`, texto `#9A9A9A` uppercase 10px |
| Tabela row hover | `background: rgba(201,168,76,0.04)` |
| Quadradinhos de parcela | Pago: `#C9A84C`, Futuro: `#2A2A2A`, Atrasado: `#EF4444` |

---

## Status das Integrações — Abril/2026

### Kommo CRM ✅

**Estado:** Conectado e sincronizando.

- OAuth2 Authorization Code implementado e token salvo no banco (`KommoToken`)
- Sync completo: 7.208 leads importados (histórico completo)
- Sync incremental: busca apenas leads atualizados nas últimas 2h
- Mapeamento de etapas → status interno funcionando corretamente
- **Observação:** 5.637 leads estão na etapa "BASE Antiga" (banco de leads históricos da Célia para reativação) — esses aparecem como `status = new` corretamente, pois não são leads ativos do funil SDR

**Pipelines mapeados:**
| Pipeline | Etapas principais |
|----------|------------------|
| PRÉ-VENDAS | Etapa de leads de entrada, dia 1–10, 1° Reunião Confirmada, Reagendamento R1 |
| VENDAS | 1° Reunião Realizada, 2° Reunião AGENDADA, Reagendamento R2, Negociação |
| PÓS VENDAS | Acompanhamento trimestral |
| Campanha \| Nutrição | BASE Antiga, Leads, Cancelados, Cliente Detrator/Promotor, Campanha 1/2 |
| PRÉ-VENDAS 2.0 | NOVO, ABERTURA, CONEXÃO, QUALIFICADOS, AGENDADOS, rEUNIÃO REALIZADATEMOS |
| RECUPERAÇÃO | Contato inicial, 1ª/2ª/3ª Tentativa, Oferta feita |

**Webhook:** não configurado ainda — precisa de URL permanente (deploy Vercel).

---

### GoTo Connect ✅ (parcial)

**Estado:** Conectado via OAuth2. Dados da Celia aparecem no painel Discadores.

**Decisão técnica importante (abril/2026):**
A GoTo Analytics API (`api.jive.com/contact-center-reports/v1`) retorna erro 403 para apps OAuth de terceiros pois exige o scope `ccanalytics.v1.read`, que não está disponível via Marketplace. A solução foi usar a **Call History API** (`api.goto.com/call-history/v1/calls`), que funciona com o scope `cr.v1.read` — disponível para todos os apps OAuth.

**Endpoint em uso:**
```
GET https://api.goto.com/call-history/v1/calls
  ?accountKey=5629857328715948344
  &startTime=<ISO>
  &endTime=<ISO>
  &limit=500
```

**Formato da resposta:**
- `caller.number` = ramal interno (1000, 1001, 1002)
- `caller.name` = nome do agente
- `duration` = milissegundos (converter ÷ 1000 para segundos)
- `answerTime` = null se a chamada não foi atendida
- Paginação via campo `nextPageToken`

**Agentes por ramal:**
| Ramal | Nome | Função |
|-------|------|--------|
| 1000 | Celia Rodrigues Santos Silva | Admin / Closer |
| 1001 | Eunice Dias | Closer |
| 1002 | Cauê Perpétuo | SDR |

**Dados no banco (abril/2026):**
- 6/abr: Celia — 74 chamadas, ~24min de conversa
- 2/abr: Celia — 15 chamadas, ~3min de conversa
- Eunice e Cauê: sem chamadas no período sincronizado

**Para acessar AGENT_PRODUCTIVITY no futuro:** solicitar ao suporte GoTo aprovação do scope `ccanalytics.v1.read` para o app OAuth registrado.

---

### Meta Ads ❌

**Estado:** Não conectado. Aguardando credenciais do Meta Business Manager.

**O que precisar para conectar:**
1. Acessar business.facebook.com → Configurações do Negócio → Usuários do Sistema
2. Criar um Usuário do Sistema com permissão nas contas de anúncio
3. Gerar token de longa duração com os escopos: `ads_read`, `ads_management`
4. Copiar: App ID, App Secret, Access Token e Ad Account ID

---

### 3C Plus ❌ (desativado)

**Estado:** Integração desativada. Não é utilizada na operação atual.

---

## Credenciais e Acessos do Sistema

> ⚠️ **CONFIDENCIAL** — não compartilhar este documento externamente.

### Dashboard CR Invest (sistema)

| Campo | Valor |
|-------|-------|
| URL local | http://localhost:3001 |
| Email admin | celiarsantossilva@yahoo.com.br |
| Senha admin | CrInvest2026! |

### Banco de Dados — Supabase / PostgreSQL

| Campo | Valor |
|-------|-------|
| Projeto | Supabase (aws-0-us-west-2) |
| Database URL (pooler) | `postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| Direct URL (migrations) | `postgresql://postgres.sthgbknylraiegbblppu:kk1juJkwwCAABjUq@aws-0-us-west-2.pooler.supabase.com:5432/postgres` |

### Kommo CRM

| Campo | Valor |
|-------|-------|
| Subdomínio | celiarsantossilva |
| URL do CRM | https://celiarsantossilva.kommo.com |
| Client ID | `5f7c7429-b82b-4ecc-88d0-ba3c503dd925` |
| Client Secret | `fRkuhslrnPXqz9YrTBJXY9QRTTLkTfFS38RGk5u6BDK5pcxMcgvyorBzV1Ij4UFC` |
| Redirect URI (dev) | http://localhost:3000/api/auth/kommo/callback |
| Redirect URI (prod) | https://\<seu-dominio\>/api/auth/kommo/callback |
| Webhook secret | `crinvest-kommo-2026` |

### GoTo Connect

| Campo | Valor |
|-------|-------|
| App OAuth | developer.logmeininc.com → apps |
| Client ID | `4702716e-b4c3-408c-81dd-69e27a12773a` |
| Client Secret | `3ibvbhv2M5lFAv6XvXHCaucN` |
| Account ID (accountKey) | `5629857328715948344` |
| Org ID (pbxId) | `f271a2e2-6f5a-4814-8e1e-73549364872f` |
| Redirect URI (dev) | http://localhost:3001/api/goto/callback |
| Scope em uso | `cr.v1.read` |

### NextAuth

| Campo | Valor |
|-------|-------|
| NEXTAUTH_SECRET | `fFZQv93Twa9qrYIfxR9GWkgl/INEfHr0SwKTT1NXz6s=` |

---

## O Que Falta Fazer

### Prioridade Alta

| # | Tarefa | Detalhe |
|---|--------|---------|
| 1 | **Deploy no Vercel** | Necessário para URL permanente, webhook do Kommo e acesso externo. Instalar Vercel CLI: `npm i -g vercel` → `vercel login` → `vercel --prod` |
| 2 | **Configurar webhook Kommo** | Após deploy: acessar https://celiarsantossilva.kommo.com/settings/api/tab/webhooks/ e cadastrar a URL `https://<dominio-vercel>/api/webhooks/kommo` para sync em tempo real |
| 3 | **Credenciais Meta Ads** | Obter App ID, App Secret, Access Token e Ad Account ID no Meta Business Manager |
| 4 | **Página Configurações** | Implementar `/dashboard/configuracoes` com: botão "Conectar GoTo" (para quando o token expirar), botão "Conectar Kommo", status das integrações e log de syncs |

### Prioridade Média

| # | Tarefa | Detalhe |
|---|--------|---------|
| 5 | **Página Reunião de Performance** | Tela de apresentação em TV/projetor — layout especial fullscreen |
| 6 | **Página Metas & Histórico** | Gestão de metas mensais por closer e histórico comparativo |
| 7 | **Sync GoTo para SDRs** | Eunice (ramal 1001) e Cauê (ramal 1002) não têm dados ainda — pode ser que não usaram o GoTo no período. Verificar com a Célia |
| 8 | **Cron job automático** | Configurar sync automático a cada 30 minutos via `vercel.json` crons após deploy |

### Prioridade Baixa / Futuro

| # | Tarefa | Detalhe |
|---|--------|---------|
| 9 | **GoTo Analytics API** | Para métricas mais detalhadas (AGENT_PRODUCTIVITY), solicitar ao suporte GoTo aprovação do scope `ccanalytics.v1.read` para o app OAuth |
| 10 | **Speed-to-Lead** | Implementar cálculo via `GET /leads/{id}/events` do Kommo (endpoint já existe: `syncLeadHistory`) |
| 11 | **Timestamps de etapa** | `contactedAt`, `qualifiedAt`, `scheduledAt`, `meetingAt` ficam `null` — preencher via eventos do Kommo (mesmo endpoint acima) |
| 12 | **Modo Apresentação** | Botão fullscreen na Reunião de Performance que esconde sidebar/header |

---

## Histórico de Versões

| Versão | Data | Mudanças |
|--------|------|----------|
| v1 | 2025 | Estrutura inicial do sistema |
| v2 | 2025 | Adição de equipes, permissões e comissões |
| v3 | 2026-03 | Refatoração completa: Next.js 14 + Prisma + Supabase |
| v3.1 | 2026-04-07 | GoTo: migrado de Analytics API para Call History API (OAuth2). Kommo: sync completo de 7.208 leads. Status dos leads de Abril corrigidos (todos estavam "new", agora mapeados corretamente). 3C Plus desativado. |
