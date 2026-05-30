# STACK.md — Tecnologias instaladas (snapshot)

> Snapshot do estado real do repo em **2026-05-30**. Compare com `IDSD/architecture/architecture-document.md §4` para verificar aderência.

## Aderência ao stack-alvo IDSD

| Camada | Instalado | Alvo IDSD | Status |
|--------|-----------|-----------|--------|
| Node | ≥20 (`package.json` engines) | 20+ | ✅ |
| Next.js | 15.5.18 | 15.x App Router | ✅ |
| React | 19.0.0 | 19.x | ✅ |
| TypeScript | 5.9.3 (strict, `noUncheckedIndexedAccess`) | 5.x strict | ✅ |
| Prisma | 5.22.0 | 5.x | ✅ |
| Postgres | 15 (Supabase local + cloud) | 15 | ✅ |
| Zod | 3.25.76 | 3.x | ✅ |
| Tailwind | 3.4.19 | 3.x | ✅ |
| **shadcn/ui** | ❌ não instalado | obrigatório | ⚠️ pendente |
| **React Hook Form** | ❌ não instalado | obrigatório (form sensível) | ⚠️ pendente |
| Supabase (`@supabase/ssr` 0.10.3 + `@supabase/supabase-js` 2.106.2) | ✅ | Supabase Auth | ✅ |
| date-fns / date-fns-tz | 4.3.0 / 3.2.0 | date-fns + TZ SP | ✅ |
| pino + pino-pretty | 10.3.1 / 13.1.3 | pino estruturado | ✅ |
| Vitest | 4.1.7 (+ coverage v8) | Vitest 4.x | ✅ |
| Playwright | 1.60.0 | Playwright | ✅ |
| ESLint + Prettier | 9.17 / 3.8.3 (flat config) | strict + barrel rule | ✅ |
| **bcryptjs / argon2** | ❌ não instalado | dummy hash anti-timing (`design.md §D-A`) | ⚠️ requerido por USP-004 |
| **Sentry SDK** | ❌ não instalado | observabilidade `architecture-document.md §10` | ⚠️ env existe, SDK ausente |
| **Anthropic SDK** | ❌ não instalado (só env) | porta `CVExtractor` USP-040 | ⚠️ adiado |

## Scripts npm (`package.json`)

```
dev | build | start | lint | typecheck
test | test:watch | test:coverage | test:e2e
db:migrate | db:deploy | db:seed | db:studio | db:generate | postinstall (prisma generate)
```

Pattern: scripts `db:*` usam `dotenv -e .env.local --` (não dependem de shell env).

## TypeScript (`tsconfig.json`)

- `strict: true`, `noUncheckedIndexedAccess: true`, `isolatedModules: true`
- Target ES2022, module esnext, `moduleResolution: bundler`
- Path alias `@/*` → `./src/*`

## Vitest (`vitest.config.ts` + `vitest.setup.ts`)

- `environment: jsdom`, `globals: true`
- `include: src/**/*.{test,spec}.{ts,tsx}`
- Coverage: provider v8, **inclui apenas `src/shared/**/*.ts`** (excluindo `prisma.ts`, `logger.ts`, `supabase/`, `index.ts`)
- Threshold: **65%** lines/statements/functions/branches (CI). Alvo IDSD = 70% — ver `CONCERNS.md §C-04`
- `vitest.setup.ts` fixa `process.env.TZ = 'UTC'` e injeta `TEST_ENV` dummy

## Playwright (`playwright.config.ts`)

- `testDir: e2e/`, `baseURL: http://localhost:3000`
- `fullyParallel: true`; `forbidOnly: true` em CI
- CI: `retries: 2`, `workers: 1`; dev: `retries: 0`, auto workers
- Projetos: Chromium Desktop apenas
- `webServer` auto-start (`npm run dev` local, `npm run build && npm run start` CI)

## ESLint (`eslint.config.mjs`)

Flat config; `next/core-web-vitals`, `next/typescript`.
**Regra crítica** — `no-restricted-imports` proíbe `@/modules/*/*` (força barrel imports `@/modules/<modulo>`).

## Variáveis de ambiente (`.env.example`)

Validadas por Zod em `src/shared/env.ts` (build falha se inválida).

| Grupo | Variáveis |
|-------|-----------|
| Core | `NODE_ENV`, `LOG_LEVEL`, `DATABASE_URL`, `DIRECT_URL` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Observabilidade | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT` |
| CAPTCHA | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |
| LLM | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`) |
| Backup | `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET` |

**Faltando para USP-004** (impedimento — ver `gap-analysis.md`):
- `AUTH_ATTEMPTS_RETENTION_DAYS` (proposta 90)
- `AUTH_LOGIN_ENABLED` (feature flag)

## Supabase local (`supabase/config.toml`)

- `project_id: portal`
- API 55321 · DB 55322 · Shadow 55320 · Studio 55323 · Mailpit 55324
- Buckets declarativos: `cvs` (private, 5MiB), `consent-terms` (private, 10MiB), `provider-photos` (public, 2MiB)
- `docker-compose.yml` legado coexiste — ver `CONCERNS.md §C-01`
