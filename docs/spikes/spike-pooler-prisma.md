# Spike — Pooler (PgBouncer/Supavisor) + Prisma

- **Issue:** #106 · **US:** #105 · **Épico:** #4 (Fase 0)
- **Data:** 2026-05-26
- **Camada:** infra (spike) · **Módulos orientados:** `shared/lib/prisma`, todos os módulos com IO
- **Status:** Concluído

## Objetivo

Validar o comportamento do Prisma 5.x sobre um **pooler em modo `transaction`** (PgBouncer
no local; **Supavisor** na Supabase em produção): transações interativas, operações
concorrentes, _prepared statements_ e limites de conexão. A meta é fechar a configuração
recomendada de `DATABASE_URL`/`DIRECT_URL` antes de construir o domínio.

## Contexto da decisão (já tomada)

- ADR-T-0002 / `prisma/schema.prisma`: datasource _dual-URL_ — a aplicação usa o **Pooler**
  via `DATABASE_URL`; migrations usam a conexão **direta** via `DIRECT_URL`.
- Em produção (Supabase): `DATABASE_URL` → **Transaction Pooler** (porta 6543, `?pgbouncer=true`);
  `DIRECT_URL` → **Session Pooler / direct** (porta 5432, IPv4).

## O que foi testado

Reprodução local fiel ao modo de produção (transaction pooling), porque o **Supavisor do
Supabase CLI local não vem com o tenant semeado** (ver Achado 4). Montamos um **PgBouncer
`pool_mode = transaction`** na frente do Postgres 15 local (`supabase start`, porta 55322):

```
[databases] postgres = host=host.docker.internal port=55322 dbname=postgres
[pgbouncer] pool_mode = transaction ; default_pool_size = 1|5 ; max_client_conn = 100
```

Harness em Node + `@prisma/client` 5.22 exercitando 3 cenários de conexão:

| # | Conexão | Flag |
|---|---|---|
| A | Direta (55322) | — |
| B | Pooler transaction-mode (56432) | **sem** `pgbouncer=true` |
| C | Pooler transaction-mode (56432) | **com** `pgbouncer=true&connection_limit=1` |

Cargas por cenário: (1) `$transaction` interativa (create + findUnique); (2) 20 queries
concorrentes (`Promise.allSettled`); (3) 30 queries idênticas repetidas (força reuso de
_prepared statement_). Stress adicional: **60 transações concorrentes com `default_pool_size = 1`**
(pior caso — todos os clientes disputam um único backend).

## Resultados medidos

| Cenário | `$transaction` | 20 concorrentes | 30 repetidas |
|---|---|---|---|
| A. Direta | OK (992 ms¹) | 20/20 (129 ms) | 30/30 (25 ms) |
| B. Pooler tx, sem flag | OK (106 ms) | 20/20 (289 ms) | 30/30 (72 ms) |
| C. Pooler tx, `pgbouncer=true` | OK (23 ms) | 20/20 (52 ms) | 30/30 (114 ms) |

¹ Primeira transação inclui _cold start_ do query engine. Latências são ilustrativas
(localhost), não representam a rede sa-east-1.

**Stress `pool_size=1`, 60 transações concorrentes:** `60/60 OK` **tanto sem quanto com**
`pgbouncer=true`. Nenhum erro `prepared statement "s0" already exists` foi reproduzido com
Prisma 5.22 nesta configuração.

### Limites de conexão observados

- Postgres local: `max_connections = 100`, `superuser_reserved_connections = 3`.
- `connection_limit` _default_ do Prisma = `núcleos_físicos × 2 + 1` (aqui, 10 por instância
  de `PrismaClient`). Em ambiente _serverless_/multi-instância isso **multiplica** rápido.

## Achados

1. **Transações e concorrência funcionam pelo pooler transaction-mode.** Transação interativa,
   20-concorrência e 30 queries repetidas passaram em A/B/C. O `pgbouncer=true` foi o cenário
   mais rápido localmente (sem _overhead_ de cache de prepared statements).
2. **O erro clássico de _prepared statement_ NÃO se reproduziu** com Prisma 5.22 nem no pior
   caso (`pool_size=1`, 60 tx concorrentes). O engine Rust moderno gerencia bem os nomes de
   _statements_. **Ainda assim, manter `pgbouncer=true` em produção** é a recomendação oficial:
   desabilita o cache de prepared statements e evita falhas em condições não cobertas localmente
   (churn de conexão, múltiplos backends do Supavisor, `DEALLOCATE ALL` não suportado em tx-mode).
3. **`DIRECT_URL` é obrigatório para migrations.** `prisma migrate`/`db push` precisam de conexão
   direta (sem pooler transaction-mode), pois usam advisory locks e DDL que não sobrevivem ao
   _pooling_ por transação. Já está correto no `schema.prisma` (`directUrl`).
4. **Rough edge do ambiente local:** o Supavisor do Supabase CLI (`[db.pooler] enabled`, porta
   55329) sobe, mas rejeita conexões com `FATAL: Tenant or user not found` — o tenant `portal`
   não é semeado automaticamente nesta versão do CLI (v2.98.2). **Para dev local, usar a conexão
   direta (55322)** — que é o default do `.env.example`. A validação do pooler-real fica para o
   ambiente Supabase (cloud). Por isso o teste local usou PgBouncer standalone.

## Recomendação / Decisão

**Configuração de conexão (produção Supabase):**

```dotenv
# Aplicação (Prisma Client) — Transaction Pooler
DATABASE_URL="postgresql://postgres.<ref>:<pwd>@<host>:6543/postgres?pgbouncer=true&connection_limit=1"
# Migrations / Prisma CLI — Session Pooler (ou conexão direta), porta 5432
DIRECT_URL="postgresql://postgres.<ref>:<pwd>@<host>:5432/postgres"
```

- **`pgbouncer=true`** em `DATABASE_URL` — sempre, em qualquer pooler transaction-mode.
- **`connection_limit=1`** em runtime _serverless_ (Vercel): cada invocação de função usa 1
  conexão lógica; o pooler multiplexa. Evita esgotar o limite do plano.
- **`DIRECT_URL`** aponta para a porta 5432 (session/direct) — usado só por CLI/migrations.
- **Dev local:** `DATABASE_URL = DIRECT_URL = postgresql://postgres:postgres@127.0.0.1:55322/postgres`
  (conexão direta; Supavisor local fica desabilitado — ver Achado 4).
- **Não** instanciar múltiplos `PrismaClient`; manter o singleton de `shared/lib/prisma.ts`.

## Como reproduzir

```bash
# 1. Postgres local
supabase start                       # Postgres 15 em :55322

# 2. PgBouncer transaction-mode (Docker) na frente do Postgres
docker run -d --name spike_pgbouncer --add-host=host.docker.internal:host-gateway \
  -p 56432:6432 \
  -v $PWD/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini \
  -v $PWD/userlist.txt:/etc/pgbouncer/userlist.txt \
  edoburu/pgbouncer:latest             # pool_mode=transaction, default_pool_size=1

# 3. Harness Prisma (3 cenários A/B/C + stress 60 tx) — script descartável, não vai pro main
node test.mjs
```

> Script de teste e `pgbouncer.ini` foram **descartáveis** (não versionados), conforme o escopo
> da issue. O essencial — config recomendada e achados — está aqui.

## Referências

- Prisma docs — _Configure Prisma Client with PgBouncer_ (`pgbouncer=true`, transaction mode,
  prepared statements, workaround do Migrate via `DIRECT_URL`).
- Prisma docs — _Databases & Connections / Connection management_ (`connection_limit`).
- Supabase — _Connecting with Prisma_ (Transaction Pooler 6543 + `pgbouncer=true`; Session
  Pooler 5432 para migrations).
