# STRUCTURE.md — Árvore comentada do repo

> Estado em 2026-05-30. Comentário por arquivo/diretório (status: ✅ implementado, ⚠️ placeholder, ❌ ausente, 📄 doc).

```
asonseg/portal/
├── package.json                     ✅ deps alinhadas; faltam shadcn-ui, RHF, bcryptjs
├── tsconfig.json                    ✅ strict + noUncheckedIndexedAccess
├── next.config.ts                   ✅ minimal Next 15
├── eslint.config.mjs                ✅ flat config + barrel rule
├── vitest.config.ts                 ✅ jsdom, coverage 65% gate
├── vitest.setup.ts                  ✅ jest-dom + TZ=UTC + TEST_ENV dummy
├── playwright.config.ts             ✅ Chromium, auto webServer
├── tailwind.config.ts               ✅ scan app/modules/shared
├── postcss.config.mjs               ✅ tailwind + autoprefixer
├── docker-compose.yml               ⚠️ DESCONTINUADO (ADR-0016) — coexiste com supabase/
├── .env.example                     ✅ 13+3 vars (FALTA: AUTH_ATTEMPTS_RETENTION_DAYS, AUTH_LOGIN_ENABLED)
├── CLAUDE.md                        📄 instruções para Claude Code
├── README.md                        ⚠️ ainda instrui `docker compose up` (desatualizado)
│
├── prisma/
│   ├── schema.prisma                ⚠️ apenas HealthCheck, JobArea, ServiceCategory, Region (sem Person/Credential)
│   ├── seed.ts                      ✅ taxonomia idempotente (US #111)
│   └── migrations/
│       ├── 20260525135319_init/                         ✅ HealthCheck
│       └── 20260527173555_taxonomia_.../                ✅ JobArea + ServiceCategory + Region + UNIQUE
│
├── supabase/                        ✅ Supabase CLI local (ADR-0016)
│   └── config.toml                   #     API 55321 · DB 55322 · Studio 55323 · Mailpit 55324
│
├── src/
│   ├── app/
│   │   ├── layout.tsx               ✅ root layout (html/body/metadata)
│   │   ├── globals.css              ✅ Tailwind + vars CSS
│   │   ├── (public)/
│   │   │   ├── layout.tsx            ✅ ISR per-route
│   │   │   └── page.tsx              ⚠️ placeholder (revalidate=600)
│   │   ├── (auth)/
│   │   │   ├── layout.tsx            ✅ force-dynamic
│   │   │   └── login/page.tsx        ⚠️ placeholder vazio (T-07 sobrescreve)
│   │   └── (app)/
│   │       ├── layout.tsx            ✅ force-dynamic
│   │       └── perfil/page.tsx       ⚠️ placeholder
│   ├── middleware.ts                 ❌ AUSENTE (impede T-08 / ADR-0030)
│   ├── modules/
│   │   └── README.md                 📄 template; ZERO módulos implementados
│   └── shared/
│       ├── errors.ts                 ✅ ActionResult + ActionErrorCode (sem INVALID_CREDENTIALS)
│       ├── env.ts                    ✅ Zod env validation (faltam 2 vars de USP-004)
│       ├── container.ts              ✅ DI puro; ZERO bindings registrados
│       ├── ui/                       ❌ vazio (.gitkeep) — sem shadcn/ui
│       ├── lib/
│       │   ├── prisma.ts             ✅ singleton + globalThis dev reuse
│       │   ├── logger.ts             ✅ pino + redaction 35 campos
│       │   ├── time.ts               ✅ date-fns-tz America/Sao_Paulo
│       │   ├── supabase/
│       │   │   ├── browser.ts        ✅ createSupabaseBrowserClient
│       │   │   └── server.ts         ✅ createSupabaseServerClient + Admin
│       │   └── __tests__/time.test.ts    ✅ 9 testes
│       └── __tests__/
│           ├── errors.test.ts        ✅ 3 testes (ok, fail, fieldErrors)
│           ├── env.test.ts           ✅ 5 testes (parse, enum, defaults)
│           ├── container.test.ts     ✅ 4 testes (register, singleton, reset)
│           └── smoke.test.ts         ⚠️ dummy
│
├── e2e/
│   └── smoke.spec.ts                 ⚠️ 1 teste (home carrega); top-8 IDSD não mapeados
│
├── legal/
│   └── consent-terms/                ✅ 8 finalidades já presentes (folders)
│       ├── cv-ai-extraction/          (USP-040/043)
│       ├── social-referral-to-job/    (USP-037/043)
│       ├── social-assistance/         (USP-036/043)
│       ├── company-representation/    (USP-012/043)
│       ├── job-application/           (USP-025/043)
│       ├── portal-access/             (USP-001/043)
│       ├── service-offering/          (USP-029/043)
│       └── service-hiring/            (USP-033/043)
│
├── scripts/
│   └── backup/                       ✅ dump-db.sh + restore-db.sh (spike US #105)
│
├── .github/workflows/                ✅ CI básico
│
└── docs/                             📄 IDSD + outros docs
    └── IDSD/
        ├── architecture/             # ADRs técnicos + architecture-document + technical-design + runbooks
        ├── prd/                      # PRD + 18 ADRs de negócio
        ├── ice-portal-asonseg/       # intents + expectations + matriz
        └── .specs/                   # ← este pipeline Bravi (você está aqui)
            ├── project/              # PROJECT/ROADMAP/STATE
            ├── codebase/             # ← 7 docs brownfield
            └── features/usp-004-autenticar-no-portal/   # spec + design + tasks + gap-analysis
```

## Resumo

- **Implementado e testado:** fundação `shared/` (errors, env, container, lib/*), config TS/ESLint/Vitest/Playwright, taxonomia DB, Supabase clients, logger, time utils.
- **Implementado mas não exercitado:** ActionResult, pino logger, container DI — esperando o primeiro módulo.
- **Placeholder:** rotas (public)/page, (auth)/login, (app)/perfil.
- **Ausente:** todos os 11 módulos de domínio (`src/modules/`), `src/middleware.ts`, `shared/ui/` componentes, models `Person`/`Credential`/`AuthAttempt` no Prisma.
