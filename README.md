# ASONSEG — Portal de Empregabilidade e Serviços

Portal social de empregabilidade e serviços da ONG **Ação Social Nossa Senhora de Guadalupe**.
Monolito modular fullstack em **Next.js 15** (App Router) + **TypeScript strict** + **Prisma/Postgres** +
**Supabase** (Auth/Storage). Idioma: **PT-BR**.

> Arquitetura, ADRs e PRD em [`docs/`](docs/). Padrões de desenvolvimento em [`CLAUDE.md`](CLAUDE.md)
> e [`docs/arch/project-guideline.md`](docs/arch/project-guideline.md).

## Stack

- Next.js 15 (App Router, Server Components, Server Actions) · React 19 · TypeScript 5 strict
- Prisma 5 + Postgres 15 (local via Docker; produção via Supabase Pooler)
- Zod (validação) · Tailwind 3 · pino (logs) · date-fns-tz (`America/Sao_Paulo`)
- Vitest (unit/integração) · Playwright (E2E)

## Pré-requisitos

- **Node.js 20+** e npm
- **Docker** + Docker Compose (Postgres + MailHog locais)

## From zero to running app

```bash
# 1. Subir Postgres 15 + MailHog (e-mail de dev)
docker compose up -d

# 2. Variáveis de ambiente (Next e Prisma leem .env.local)
cp .env.example .env.local
#    Os valores padrão já apontam para o Postgres/MailHog locais.
#    Preencha as chaves dos SaaS (Supabase, Resend, etc.) conforme necessário.

# 3. Dependências
npm install

# 4. Migrar o banco e popular o seed inicial
npm run db:migrate     # aplica as migrations (usa DIRECT_URL)
npm run db:seed        # seed mínimo da Fase 0

# 5. Subir a aplicação
npm run dev            # http://localhost:3000
```

Serviços locais:

| Serviço      | URL / porta                  |
| ------------ | ---------------------------- |
| App (Next)   | http://localhost:3000        |
| Postgres     | `localhost:5432` (asonseg)   |
| MailHog SMTP | `localhost:1025`             |
| MailHog UI   | http://localhost:8025        |

E-mails enviados em desenvolvimento caem na **UI do MailHog** (não saem de verdade).

## Scripts

```bash
npm run dev            # servidor de desenvolvimento
npm run build          # build de produção
npm run start          # servir o build
npm run lint           # ESLint (Next + regra de barrel)
npm run typecheck      # tsc --noEmit
npm run test           # Vitest (unit/integração)
npm run test:coverage  # cobertura (gate de CI: falha < 65%)
npm run test:e2e       # Playwright (E2E)
npm run db:migrate     # prisma migrate dev
npm run db:seed        # seed
npm run db:studio      # Prisma Studio
```

## Estrutura

```
src/
├── app/         # App Router — route groups (public) ISR, (auth)/(app) dinâmicos
├── modules/     # 11 módulos de domínio (ver src/modules/README.md)
└── shared/      # fundação: env, errors, container (DI), ui/, lib/
```

O root `src/` é **fechado**: apenas `app/`, `modules/`, `shared/`. Imports de módulo só via
barrel (`@/modules/<modulo>`) — caminhos profundos são bloqueados pelo ESLint.

## Parar o ambiente

```bash
docker compose down          # para os containers (mantém o volume do Postgres)
docker compose down -v       # remove também os dados do Postgres
```
