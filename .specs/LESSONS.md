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

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
