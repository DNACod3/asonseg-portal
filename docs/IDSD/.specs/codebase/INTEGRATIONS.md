# INTEGRATIONS.md — Integrações externas (estado atual)

## Supabase Auth

- ✅ SDK instalado: `@supabase/ssr@0.10.3` + `@supabase/supabase-js@2.106.2`
- ✅ Clients separados: `browser.ts`, `server.ts` (com Admin), em `src/shared/lib/supabase/`
- ✅ Env vars validadas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- ⚠️ Auth provider habilitado no `supabase/config.toml`: presumido (defaults da Supabase CLI ativam email/password); **verificar manualmente** antes da USP-004 T-05 (`supabase status` + Studio → Auth)
- ❌ Nenhuma chamada a `signInWithPassword` / `signUp` no código yet

## Supabase Storage

- ✅ Buckets declarativos no `config.toml`:
  - `cvs` (private, 5MiB) — USP-009 / USP-040
  - `consent-terms` (private, 10MiB) — USP-043
  - `provider-photos` (public, 2MiB) — USP-029
- ❌ Nenhum upload/download implementado yet

## Postgres (Supabase)

- ✅ Prisma 5.22 com `DATABASE_URL` (PgBouncer/Pooler) + `DIRECT_URL` (migrations)
- ✅ 2 migrations rodadas: init (HealthCheck), taxonomia (JobArea, ServiceCategory, Region)
- ✅ Seed idempotente (`prisma/seed.ts`): 10 regiões SC, 12 áreas de vaga, 10 categorias de serviço
- ❌ Sem models de domínio (Person, Credential, AuthAttempt, Job, Service, Consent, AuditLog...) — gap principal para USP-004

## pino logger

- ✅ `src/shared/lib/logger.ts`: configurado com redaction de 35 campos sensíveis (password, cpf, email, token, authorization, secret etc.) + 3 níveis de profundidade
- ✅ `childLogger(bindings)` para contexto fixo
- ✅ pino-pretty em dev, JSON em prod
- ❌ Nenhum consumidor real ainda

## Email (Mailpit local / Resend prod)

- ✅ Mailpit local via Supabase CLI (porta 55324) — captura emails de Auth (confirmação, reset)
- ✅ Env vars: `RESEND_API_KEY`, `EMAIL_FROM`
- ❌ Nenhum cliente Resend implementado yet; outbox post-commit (ADR-0020) não existe

## Anthropic Claude (CV Extraction USP-040)

- ✅ Env vars presentes: `ANTHROPIC_API_KEY` (dummy em dev), `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`)
- ⚠️ **Default desalinhado com IDSD** — `architecture-document` e ADR-0018/0027 mencionam Claude Haiku (custo e ZDR). Default Sonnet pode encarecer / não atender ZDR. Ver `CONCERNS.md §C-09`.
- ❌ SDK `@anthropic-ai/sdk` não instalado
- ❌ Porta `CVExtractor` não definida; container sem binding

## Cloudflare Turnstile (CAPTCHA)

- ✅ Env vars presentes: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (chaves demo `1x00000000...`)
- ❌ Componente / verificação server-side não implementado
- *Aplicação prevista:* USP-001 (auto-cadastro) e USP-005 (reset). **Não** na USP-004 (login) — `spec.md §6` e ADR-0029.

## Backblaze B2 (backup)

- ✅ Env vars presentes: `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET`
- ✅ Scripts `scripts/backup/dump-db.sh` e `restore-db.sh` (spike US #105)
- ❌ Cron / agendamento não ativo

## Sentry

- ✅ Env vars presentes: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT`
- ❌ SDK `@sentry/nextjs` não instalado
- ❌ `sentry.client.config.ts` / `sentry.server.config.ts` não existem
- *Impacto:* erros em produção dependem só do `pino` JSON na Vercel — sem agrupamento, alertas, source maps. **Não bloqueia USP-004 dev** mas é gap importante pré-MVP.

## CI / GitHub Actions

- ✅ `.github/workflows/` configurado (verificar conteúdo se necessário)
- ⚠️ Sem step explícito `npm run db:generate` antes de testes — implícito via `postinstall`

## Gaps consolidados que tocam USP-004

| Integração | Faltando para USP-004 |
|------------|------------------------|
| Supabase Auth | Validar config `[auth].enable_signup=true` e email provider ativo |
| Postgres | Models `Person`, `Credential`, `AuthAttempt` |
| pino | Primeiro consumidor real (loginAction) |
| Email | Não exigido pela USP-004 — exigido por USP-005 |
| Turnstile | Não exigido pela USP-004 |
| Sentry | Não bloqueia, mas seria boa adição quando deploy de auth chegar a staging |
