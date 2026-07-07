# LESSONS — auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

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

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
