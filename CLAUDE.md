# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ASONSEG Portal de Empregabilidade e Servicos — a social employment and services portal for the NGO "Acao Social Nossa Senhora de Guadalupe". Currently in **pre-development/documentation phase** (no implementation code yet). The repo contains architecture documents, PRD, ADRs, and a UI prototype.

**Language:** Portuguese (PT-BR). All UI text, error messages, commit messages, and documentation are in Portuguese. No i18n in MVP.

## Tech Stack (planned)

- **Next.js 15.x** (App Router, Server Components first, Server Actions for mutations)
- **TypeScript 5.x** strict (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`)
- **Prisma 5.x** + Postgres 15 (Supabase, sa-east-1)
- **Zod 3.x** for all input validation
- **shadcn/ui + Tailwind + Radix** for UI
- **React Hook Form** + Zod adapter for forms
- **Supabase Auth** (email/password, no RLS — authorization in app layer)
- **date-fns + date-fns-tz** with timezone `America/Sao_Paulo`
- **pino** for structured logging
- **Vitest** (unit/integration), **Playwright** (E2E)

**Forbidden:** Redux, MobX, Zustand, Jotai, alternative ORMs, CSS-in-JS beyond Tailwind, date libraries beyond date-fns, state machine libraries.

## Commands (planned)

```bash
npm run dev              # Next.js dev server
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test             # Vitest unit/integration
npm run test:e2e         # Playwright E2E
npm run test:coverage    # Coverage (target 70%, CI fails < 65%)
npm run db:migrate       # Prisma migrations
npm run db:seed          # Seed data
npm run db:studio        # Prisma Studio
```

## Architecture

**Monolito modular fullstack** with 11 domain modules under `src/modules/`:

`identity` | `persons` | `companies` | `consents` | `moderation` | `jobs` | `services` | `referrals` | `cv-extraction` | `audit` | `reporting`

### Module Structure

Each module follows the same template:
```
modules/<name>/
├── actions/       # Server Actions ('use server')
├── queries/       # Read-only queries
├── domain/        # Types, enums, pure business rules (no IO)
├── schemas/       # Zod schemas
├── components/    # Module-specific React components
├── views/         # View Models per viewer role (privacy)
├── ports/         # Interfaces (DI)
├── adapters/      # Concrete implementations
├── __tests__/
└── index.ts       # Barrel export — all imports go through here
```

**Import rule:** Always import via barrel (`@/modules/persons`), never via deep paths.

### Route Groups

- `(public)/` — ISR 10min + on-demand revalidation (home, vagas, servicos)
- `(auth)/` — No cache (login, cadastro, recuperar-senha)
- `(app)/` — Authenticated, `force-dynamic` (perfil, empresa, candidato, moderacao, etc.)

### Shared Code

Lives in `src/shared/` (never `src/utils/` or `src/lib/` at root level):
- `shared/ui/` — shadcn/ui generic components
- `shared/lib/` — Prisma singleton, Supabase clients, time utils, logger
- `shared/env.ts` — Zod-validated environment variables
- `shared/errors.ts` — `ActionResult<T>` type
- `shared/container.ts` — Ports-to-adapters DI bindings

**Root `src/` structure is closed:** only `app/`, `modules/`, `shared/`. New top-level folders require an RFC.

## Critical Patterns

### Server Action Pattern

Every sensitive Server Action follows this exact sequence:
1. Validate input with Zod schema
2. Check permission via `requirePermission()`
3. Verify LGPD consent via `requireActiveConsent()` when applicable
4. Check business preconditions
5. Execute within `withAudit('EVENT_TYPE', async (tx) => { ... })`

Return type is always `{ ok: true, data } | { ok: false, error }`. Never `throw` from Server Actions.

### Privacy — View Models

Never query Prisma directly to return one Person's data to another. Always use View Models (`viewCandidateForEmployer`, `viewProviderForClient`, etc.) that control field visibility per viewer role. Direct Prisma access is only OK when a Person views their own data.

### Moderation State Machine

Content status (vagas, CVs, servicos) is never updated via direct `prisma.update`. Always use `transitionContent()` from `@/modules/moderation`, which validates transitions, requires justification when configured, runs in transaction with audit, and triggers side effects.

### LLM Abstraction (CV Extraction)

Consumer code depends only on the `CVExtractor` port interface, never on `@anthropic-ai/sdk` directly. The adapter is resolved via `shared/container.ts`.

### Audit Log

All sensitive writes are wrapped in `withAudit('EVENT_TYPE', ...)`. Event types come from the catalog at `@/modules/audit/events`. The audit_log table is append-only (REVOKE UPDATE, DELETE at DB level).

### LGPD Consents

8 consent purposes in MVP. Always call `requireActiveConsent(personId, purpose)` before purpose-bound operations. Terms live in `legal/consent-terms/`.

## Conventions

- **Conventional Commits** with module scopes: `feat(jobs):`, `fix(consents):`, `test(moderation):`, etc.
- Valid scopes: `identity`, `persons`, `companies`, `consents`, `moderation`, `jobs`, `services`, `referrals`, `cv-extraction`, `audit`, `reporting`, `infra`, `docs`, `tests`, `ci`
- **Squash merge** for clean history
- **Timezone:** Store `timestamptz` (UTC) in DB, convert with `date-fns-tz` at the boundary using `America/Sao_Paulo`
- **Prisma queries:** Always use `take` (pagination mandatory), explicit `select`/`include`, avoid N+1
- **Env validation:** Zod schema in `shared/env.ts` — build fails if vars are missing
- PRs use **dual review**: AI agent (convention adherence) + Tech Lead (design decisions)

## Key Documentation

| File | Content |
|---|---|
| `docs/arch/architecture-document.md` | Full architecture vision, quality attributes, risks, phase plan |
| `docs/arch/technical-design.md` | Prisma schema, sequence diagrams, integration contracts |
| `docs/arch/project-guideline.md` | Developer operational guide — canonical patterns, conventions, DoD |
| `docs/arch/0001-0015.md` | 15 ADRs (monolith, platform, auth, audit, storage, backup, PWA, pessoa unificada, LGPD, visibility, moderation, LLM, ISR, CAPTCHA, empresa) |
| `docs/prd/prd-asonseg-portal-mvp.md` | PRD with 44 user stories, 13 epics, personas |
| `docs/prototipo/index.html` | UI prototype (static HTML) |

## Testing Requirements

- **Server Action tests must cover:** happy path, Zod validation failure, permission denied, consent absent, concurrency (when applicable)
- Unit tests: 90% coverage on domain/business rules
- Integration tests: 80% on sensitive Server Actions
- E2E: Top 8 critical user flows