# Infra — Provisionamento de ambientes (US #95)

Documentação operacional dos provedores externos do Portal ASONSEG e da **matriz de secrets**.
Cobre a US #95 (Fase 0 — Setup) e suas tasks #96–#99.

> **Princípio:** nenhum secret real entra no git. Estes documentos registram **decisões, escopos e
> runbooks**; os valores vivem em **Vercel Environment Variables**, **GitHub Actions Secrets** e,
> localmente, em `.env.local` (coberto pelo `.gitignore`). O `.env.example` só traz placeholders e
> valores demo da stack local.

## Documentos

| Task | Provedor(es) | Doc |
|---|---|---|
| #96 | Vercel (hospedagem, deploy, plano) | [vercel.md](./vercel.md) |
| #97 | Supabase (Postgres `sa-east-1`, Auth, Storage) | [supabase.md](./supabase.md) |
| #98 | Resend · Sentry · Cloudflare Turnstile | [resend-sentry-turnstile.md](./resend-sentry-turnstile.md) |
| #99 | Anthropic (LLM) · Backblaze B2 (backup) | [anthropic-backblaze.md](./anthropic-backblaze.md) |

Ambiente **local** não usa estes projetos cloud: ver [ADR-0016](../arch/0016-ambiente-local-supabase-cli.md)
(Supabase CLI) e `.env.example`.

---

## Matriz de secrets

Todas as variáveis de runtime são validadas por [`src/shared/env.ts`](../../src/shared/env.ts)
(o build falha se faltar). `SENTRY_AUTH_TOKEN` é exceção: usado só no **build/CI** (upload de
source maps), não no runtime, portanto não está no schema do `env.ts`.

| Variável | Provedor | Escopo | Público? | Cofre |
|---|---|---|---|---|
| `NODE_ENV` | — | todos | — | env |
| `LOG_LEVEL` | — | todos | — | env |
| `DATABASE_URL` | Supabase | Prod/Preview/Dev | ❌ server | Vercel env |
| `DIRECT_URL` | Supabase | Prod/Preview/Dev | ❌ server | Vercel env |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Prod/Preview/Dev | ✅ client | Vercel env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Prod/Preview/Dev | ✅ client | Vercel env |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Prod/Preview/Dev | ❌ **server-only** | Vercel env |
| `RESEND_API_KEY` | Resend | Prod/Preview | ❌ server | Vercel env |
| `EMAIL_FROM` | Resend | todos | — | env |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry | Prod/Preview | ✅ client | Vercel env (vazio em Dev) |
| `SENTRY_AUTH_TOKEN` | Sentry | build/CI | ❌ server | Vercel env / GitHub Actions Secrets |
| `SENTRY_ENVIRONMENT` | Sentry | todos | — | env |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare | Prod/Preview/Dev | ✅ client | Vercel env (test key em Dev) |
| `TURNSTILE_SECRET_KEY` | Cloudflare | Prod/Preview/Dev | ❌ server | Vercel env (test key em Dev) |
| `ANTHROPIC_API_KEY` | Anthropic | Prod/Preview | ❌ **server-only** | Vercel env |
| `ANTHROPIC_MODEL` | Anthropic | todos | — | env (default `claude-sonnet-4-6`) |
| `B2_KEY_ID` | Backblaze B2 | backup runner | ❌ server | GitHub Actions Secrets (+ Vercel se a app usar) |
| `B2_APPLICATION_KEY` | Backblaze B2 | backup runner | ❌ server | GitHub Actions Secrets |
| `B2_BUCKET` | Backblaze B2 | backup runner | — | GitHub Actions Secrets |

> **Regra de exposição:** apenas `NEXT_PUBLIC_*` chegam ao browser. `SERVICE_ROLE_KEY`,
> `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY` e as chaves B2 são **server-only**.

---

## Definition of Done (US #95)

- [x] Todos os provedores acessíveis e com secrets em Vercel env / GitHub Actions Secrets
- [x] Decisão de plano Vercel documentada ([vercel.md](./vercel.md))
- [x] Sub-tasks #96–#99 documentadas e fechadas
- [ ] (aberto) Resposta da Vercel sobre elegibilidade OSS/ONG antes do go-live público ([vercel.md §2](./vercel.md))
