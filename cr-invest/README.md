# CR Invest — Sistema de Performance

Dashboard de performance comercial integrando Kommo CRM, Meta Ads, GoTo e 3C Plus.

## Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Prisma ORM** + **PostgreSQL**
- **NextAuth.js** (autenticação)

## Setup Rápido

```bash
cp .env.example .env
# edite .env com suas credenciais
npm install
npx prisma migrate dev --name init
npm run dev
```

## Variáveis de Ambiente

### DATABASE_URL
String de conexão PostgreSQL.
```
postgresql://USUARIO:SENHA@HOST:5432/cr_invest
```
Para desenvolvimento local com Docker:
```bash
docker run -d --name cr-invest-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=cr_invest \
  -p 5432:5432 postgres:15
```

### Kommo CRM
1. Acesse **Kommo > Configurações > Integrações > API**
2. Crie um novo aplicativo OAuth 2.0
3. Copie `Client ID` e `Client Secret`
4. Configure `Redirect URI` para `http://seu-dominio/api/auth/kommo/callback`
5. `KOMMO_SUBDOMAIN` é o prefixo da sua URL (ex: `minhaempresa` em `minhaempresa.kommo.com`)

### Meta Ads API
1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. Crie um App do tipo **Business**
3. Adicione o produto **Marketing API**
4. Em **Configurações > Básico**: copie `App ID` e `App Secret`
5. Gere um **Token de Acesso de Longa Duração** via Graph API Explorer com permissões `ads_read` e `read_insights`
6. `FB_AD_ACCOUNT_ID` no formato `act_XXXXXXXXXX` (encontrado no Gerenciador de Anúncios)

### GoTo (Discador)
1. Acesse [developer.goto.com](https://developer.goto.com)
2. Crie uma conta de desenvolvedor e gere uma API Key
3. `GOTO_ACCOUNT_ID` é o identificador da sua conta empresarial

### 3C Plus (Discador)
1. Acesse seu painel 3C Plus
2. Vá em **Configurações > Integrações > API**
3. Gere uma `API Key`
4. `THREEC_ACCOUNT_ID` é o ID da conta (disponível no painel)

### NextAuth
- `NEXTAUTH_SECRET`: execute `openssl rand -base64 32` para gerar
- `NEXTAUTH_URL`: URL base da aplicação (ex: `https://dashboard.crinvest.com.br`)

### Credenciais Admin
- `ADMIN_EMAIL` e `ADMIN_PASSWORD`: credenciais do usuário administrador inicial

## Modo Mock

Com `USE_MOCK_DATA=true` (padrão), o sistema usa dados fictícios realistas sem necessidade de conexão com APIs externas. Ideal para desenvolvimento e demonstração.

## Perfis de Acesso

| Perfil | Permissões |
|--------|-----------|
| `admin` | Visualiza dashboard, registra vendas manuais, define metas |
| `viewer` | Somente visualização do dashboard |

## Segurança

**IMPORTANTE:** Este sistema é somente leitura em relação a APIs externas.
Nenhuma escrita, edição ou exclusão é realizada no Kommo, Meta Ads, GoTo ou 3C Plus.
Apenas dados locais (metas, vendas manuais, cache) são persistidos no PostgreSQL.
