# LESSONS — auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

### L-007 — When a task's Done-when requires an e2e spec file and skill-tdad only produced a test.fixme skeleton under .specs/.../tests/e2e/, the Execute phase must promote it into the real e2e/ directory with live assertions before the task is marked done — a skeleton left in .specs/ is invisible to npm run test:e2e in CI, so 'Gate: build' passing does not prove e2e coverage exists.
- signal: `ac_gap` · recurrence: 2 feature(s) · scope: `jobs/e2e` · harmful: 0
- features: vagas/usp-023-editar-vaga, vagas/usp-024-expiracao-automatica
- evidence: tasks.md T7/T8/T9 Done-when (e2e required, Gate: build) (jobs/e2e) (+1 more)
- last seen: 2026-07-08T02:17:56Z

## Candidates (under observation — do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 — When a cva variant's base class and its hover/active sibling share a common substring (e.g. bg-cta and hover:bg-cta-hover), assert the base class as a standalone token (split on whitespace or use a word-boundary regex), not via className.toContain, or a regression in the base class alone will not be caught.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `ui-primitives` · harmful: 0
- features: fundacao-ui-design-system
- evidence: src/shared/ui/__tests__/button.test.tsx:13 (ui-primitives)
- last seen: 2026-07-07T14:00:34Z

### L-002 — When a spec requires pixel-parity with a prototype's literal hardcoded tint colors while a must-not simultaneously forbids raw hex/fixed-palette utilities in the same files, resolve the tension explicitly in the spec (e.g. approved formula or tolerance) instead of leaving it for the implementer to invent a workaround.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `design-tokens` · harmful: 0
- features: fundacao-ui-design-system
- evidence: spec.md P1 Primitivos AC5/AC7 (StepIcon/Badge) vs DS-MN-02 (design-tokens)
- last seen: 2026-07-07T14:00:34Z

### L-003 — When a spec AC claims a composed screen works correctly under a given state (e.g. dark mode), require an RTL test on the composed screen itself, not just on each primitive in isolation — composition can hide interaction bugs that per-primitive tests cannot see.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `testing` · harmful: 0
- features: fundacao-ui-design-system
- evidence: spec.md P1 Prova de paridade AC3 (login dark mode) (testing)
- last seen: 2026-07-07T14:00:34Z

### L-004 — When a Zod-required field also gets a runtime cryptographic/authorization check, document two distinct failure outcomes (VALIDATION for absent/malformed, FORBIDDEN for well-formed-but-invalid) instead of one generic error code in the spec's edge cases.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `identity` · harmful: 0
- features: identity-acesso-papeis/usp-001-auto-cadastro
- evidence: spec.md:113 (Edge Cases) vs acceptRoleConsent.int.test.ts:182-199 (identity)
- last seen: 2026-07-07T15:00:41Z

### L-005 — A dark-mode/token-parity AC is not proven by a static absence-of-raw-palette guard alone; pair it with an actual rendered or visual-regression check, or explicitly scope the AC down to 'no raw-palette utilities' in the spec.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `companies,design-system` · harmful: 0
- features: vinculos-pessoa-empresa/usp-015-editar-empresa
- evidence: ds-empresa-editar-parity.test.ts:28-34 (AC4, recurs identically at ds-empresa-cadastro-parity, ds-empresa-responsaveis-parity, ds-empresa-remover-parity) (companies,design-system)
- last seen: 2026-07-07T22:23:49Z

### L-006 — Int-test dateOffset() helpers using local Date.setDate() flake near the 21:00-00:00 America/Sao_Paulo window because hojeSaoPaulo() compares UTC-normalized calendar days against a @db.Date column — make date-offset test helpers UTC-safe (formatInTimeZone/Date.UTC), not local wall-clock arithmetic.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `src/modules/jobs/__tests__/*.int.test.ts` · harmful: 0
- features: vagas/usp-021-buscar-vagas-publica
- evidence: src/modules/jobs/__tests__/search-jobs.int.test.ts:26-30 (src/modules/jobs/__tests__/*.int.test.ts)
- last seen: 2026-07-08T00:52:02Z

### L-008 — This repo has an established cheap pattern for testing a page-level P-005 notFound() guard (mocked next/navigation + requireActivePerson + prisma, testing-library render, no Playwright needed, see empresa/[empresaId]/editar/page.test.tsx) — any new (app) route with the same requireActivePerson+personCompanyGrant+notFound shape should get an equivalent page.test.tsx; do not defer the 404 assertion to e2e alone.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `app-routes/authz-guard` · harmful: 0
- features: vagas/usp-023-editar-vaga
- evidence: src/app/(app)/empresa/[empresaId]/vagas/page.tsx notFound() guard vs. sibling src/app/(app)/empresa/[empresaId]/editar/page.test.tsx (app-routes/authz-guard)
- last seen: 2026-07-08T02:18:35Z

### L-009 — When a spec sets a p95 latency AC for a synchronous LLM/external-call action, add an explicit timing assertion (or a documented, deliberate decision to skip it) instead of leaving it evidenced only by design intent (max_tokens caps, sync framing).
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `cv-extraction` · harmful: 0
- features: extracao-cv-ia/usp-040-extracao-cv
- evidence: validation.md#Edge Cases — p95≤30s latency AC (cv-extraction)
- last seen: 2026-07-08T17:08:52Z

### L-010 — Concurrency race tests that fire two calls via Promise.all inside one Node process can be masked by an app-level UX pre-check when run in a warmed-up test suite; assert on final DB row count or bypass the pre-check layer to prove the DB constraint itself, not just the end-to-end ActionResult shape.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `src/modules/services,integration-tests,concurrency` · harmful: 0
- features: manifestacao-interesse-servico/usp-033
- evidence: SVC033-MN-03 / manifest-interest.int.test.ts:343-357 (src/modules/services,integration-tests,concurrency)
- last seen: 2026-07-08T22:23:32Z

### L-011 — Before proposing a new route prefix in design.md, check whether an existing route family for the same entity/audience already exists and reuse it instead of opening a new namespace.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `routes` · harmful: 0
- features: ficha-social-encaminhamento/usp-036-ficha-socioeconomica
- evidence: src/app/(app)/pessoas/[id]/ficha-social/page.tsx SPEC_DEVIATION comment (routes)
- last seen: 2026-07-09T15:45:55Z

### L-012 — When a design specifies a domain guard's role parameter as the Prisma Role enum, check the actual caller's session type first — getCurrentPerson()/CurrentPerson.roles is string[], so the guard signature should be readonly string[] to match, not Role[].
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `authorization` · harmful: 0
- features: ficha-social-encaminhamento/usp-036-ficha-socioeconomica
- evidence: src/modules/persons/domain/socioeconomic-record.ts SPEC_DEVIATION comment (authorization)
- last seen: 2026-07-09T15:46:03Z

### L-013 — Guardas node:fs de import proibido devem casar tanto 'from "pkg"' quanto 'import "pkg"' bare/side-effect, senão um mutante de import sem 'from' sobrevive.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `src/shared/__tests__/casca-*.test.ts` · harmful: 0
- features: fachada-publica/usp-046-casca-navegacao
- evidence: src/shared/__tests__/casca-no-icon-state-lib.test.ts:20 (mutant: bare 'import '\''lucide-react'\'';' with no 'from') (src/shared/__tests__/casca-*.test.ts)
- last seen: 2026-07-10T23:12:59Z

### L-014 — Ao entregar seams de composição (className?, actions?, items?), adicionar pelo menos um teste RTL que exercite o seam isoladamente, não só via composição indireta de outro componente.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `src/app/(public)/_components/**` · harmful: 0
- features: fachada-publica/usp-046-casca-navegacao
- evidence: CASCA-15 (spec.md) — seam className?/actions? sem teste RTL de merge (src/app/(public)/_components/**)
- last seen: 2026-07-10T23:12:59Z

### L-015 — Next.js middleware unit tests that build NextRequest directly with RSC-protocol headers (next-router-prefetch, rsc) baked in do not prove production behavior — verify prefetch/RSC signal detection in middleware.ts against a real 'next start' server (curl + real browser), since these headers can fail to reach request.headers in the live request pipeline even though unit tests pass.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/middleware.ts,src/shared/lib/rateLimitResponse.ts` · harmful: 0
- features: usp-050-rate-limiting
- evidence: PREF-01/RL-MN-01 (src/middleware.ts,src/shared/lib/rateLimitResponse.ts)
- last seen: 2026-07-12T13:45:34Z

### L-016 — When a rate-limit/security bypass keys off a single client-controlled HTTP header (e.g. Next.js's Next-Url), adversarially test with a plain curl request forging just that header before accepting the fix — an unauthenticated signal used to exempt traffic from a limiter is trivially exploitable unless corroborated with a second, harder-to-forge signal or bounded by a non-zero ceiling instead of a hard bypass.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `src/middleware.ts,src/shared/lib/rateLimitResponse.ts` · harmful: 0
- features: usp-050-rate-limiting
- evidence: live-scenario-b-prime (Next-Url spoof) (src/middleware.ts,src/shared/lib/rateLimitResponse.ts)
- last seen: 2026-07-12T14:23:25Z

### L-017 — When a spec's concurrency guarantee is framed as a pre-existing DB constraint acting as a backstop, don't mark the AC fully verified without a dedicated concurrent-write test — flag it as a spec-precision gap instead of silently trusting the index.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `companies` · harmful: 0
- features: ajustes-uat/usp-055-empresas
- evidence: EMP055-04 / .specs/features/ajustes-uat/usp-055-empresas/validation.md (companies)
- last seen: 2026-07-12T19:32:31Z

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
