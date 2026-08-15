# Infra — Supabase (Postgres + Auth + Storage)

> **Task:** #97 · **US:** #95 (Provisionamento de ambientes) · **Épico:** #4 (Fase 0)
> **ADRs relacionados:** [ADR-0002](../arch/0002-vercel-supabase-plataforma.md) (plataforma), [ADR-0003](../arch/0003-supabase-auth-rbac-identidade-publica.md) (Auth/RBAC), [ADR-0005](../arch/0005-storage-arquivos-sensiveis.md) (Storage), [ADR-0016](../arch/0016-ambiente-local-supabase-cli.md) (ambiente local)
> **Status do provisionamento:** ✅ provisionado (projeto cloud + secrets geridos no console)

Runbook do projeto Supabase de produção/staging. O ambiente **local** é a stack do
**Supabase CLI** (não este projeto cloud) — ver [ADR-0016](../arch/0016-ambiente-local-supabase-cli.md)
e `supabase/config.toml`. Sem secrets aqui; os valores vivem na Vercel env e em `.env.local`.

---

## 1. Projeto

| Item | Valor |
|---|---|
| Região | **`sa-east-1`** (São Paulo) — residência de dados defensiva p/ LGPD ([ADR-0002](../arch/0002-vercel-supabase-plataforma.md)) |
| Postgres | **15** |
| Plano inicial | Free (gatilho de upgrade → Pro junto com a Vercel) |
| RLS | **desabilitado** — autorização na camada de app via `requirePermission()` ([ADR-0003](../arch/0003-supabase-auth-rbac-identidade-publica.md)) |
| Auth | provider **email/senha** habilitado; confirmação de e-mail ON |
| Storage | buckets **privados** para arquivos sensíveis ([ADR-0005](../arch/0005-storage-arquivos-sensiveis.md)) |

> **Staging/Preview:** recomenda-se um **projeto Supabase separado** para o escopo Preview da Vercel,
> evitando que PRs toquem dados de produção.

---

## 2. Banco — conexões (Pooler vs Direct)

Dois URLs distintos, conforme o uso (padrão Prisma + Supabase):

| Variável | Conexão | Porta | Uso |
|---|---|---|---|
| `DATABASE_URL` | **Transaction Pooler** (PgBouncer) | `6543` + `?pgbouncer=true` | runtime da aplicação (serverless — muitas conexões curtas) |
| `DIRECT_URL` | **Session Pooler / conexão direta** | `5432` | `prisma migrate` / `db push` (migrations precisam de conexão de sessão) |

Refletido em [`prisma/schema.prisma`](../../prisma/schema.prisma):

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // Pooler (runtime)
  directUrl = env("DIRECT_URL")     // Direct (migrations)
}
```

> Em dev local ambos apontam para o Postgres do CLI (`127.0.0.1:55322`) — ver `.env.example`.

---

## 3. Storage — buckets

Buckets **privados** (acesso via URL assinada gerada na camada de app), alinhados a
[ADR-0005](../arch/0005-storage-arquivos-sensiveis.md) e ao escopo de backup de
[ADR-0006](../arch/0006-backup-duplo-supabase-backblaze.md):

| Bucket | Conteúdo | Visibilidade |
|---|---|---|
| `cvs` | CVs de candidatos (PDF/DOC/DOCX, ≤ 5 MB) | privado — URL assinada |
| `consent-terms` | termos de consentimento (PDF/JPG/PNG, ≤ 10 MB) | privado — URL assinada |
| `provider-photos` | fotos de serviços de prestadores (JPG/PNG/WEBP, ≤ 5 MB) | **público** — URL direta do CDN |

> `supabase/config.toml` declara os buckets, mas **só provisiona a stack local do CLI** —
> projeto hospedado não lê esse arquivo.

### Provisionar buckets em ambiente hospedado (staging/produção)

Passo **obrigatório** ao criar um projeto Supabase novo — sem ele o upload de CV falha com
"Não foi possível enviar o currículo" e o upload de foto de serviço falha do mesmo jeito:

```bash
npm run storage:ensure:staging   # ou storage:ensure:prod
```

Idempotente: cria o que falta, corrige divergência de visibilidade/limite/MIMEs e nunca
apaga bucket ou objeto. Fonte de verdade das specs: `STORAGE_BUCKET_SPECS` em
`src/shared/lib/supabase/storage-buckets.ts` (ADR-0005). Ao alterar um bucket, atualizar
**também** o `supabase/config.toml` para o ambiente local não divergir.

---

## 4. Secrets coletados

Registrados na Vercel (Production/Preview) — ver **[matriz de secrets](./README.md#matriz-de-secrets)**:

- `DATABASE_URL` (Pooler, transaction mode, `?pgbouncer=true`)
- `DIRECT_URL` (direct/session, porta 5432)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (⚠️ server-only — nunca expor ao client)

---

## 5. Done when (DoD da task #97)

- [x] Projeto Supabase ativo em `sa-east-1`, Postgres 15, Storage e Auth (email/senha) habilitados
- [x] RLS desabilitado (autorização na camada de app, conforme ADR-0003)
- [x] Secrets (`DATABASE_URL` Pooler, `DIRECT_URL`, URL/anon/service-role) registrados na Vercel env
- [x] Buckets privados `cvs` e `provider-photos` criados
- [x] Conexão ao banco confirmada (ver runbook abaixo)

---

## 6. Runbook — confirmar conexão / auditar

```bash
# 1) Confirmar conexão ao banco de produção (NÃO commitar a URL)
psql "$DIRECT_URL" -c "select version();"

# 2) Confirmar que Prisma alcança o banco
npm run db:migrate -- --help    # sanity do CLI
npx prisma db execute --url "$DIRECT_URL" --stdin <<< "select 1;"

# 3) Vincular CLI ao projeto cloud (para diffs de schema/migrations)
supabase link --project-ref <PROJECT_REF>
supabase db remote commit   # opcional: capturar drift do remoto

# 4) Conferir buckets via Studio (cloud) ou API
#    Storage → confirmar 'cvs' e 'provider-photos' como privados
```
