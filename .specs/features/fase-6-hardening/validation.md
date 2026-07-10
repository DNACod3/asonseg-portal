# Fase 6 · U3 — Hardening de Segurança + Gaps LGPD — Validation

**Date**: 2026-07-10
**Spec**: `.specs/features/fase-6-hardening/{spec,design,tasks}.md`
**Diff range**: `3a21f43..78792a1` (13 commits, T1–T12 + DS-parity fix), branch `feat/fase-6-relatorios-home-hardening`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
|------|---------|-------|
| T1   | ✅ Done | `signIn.ts` `captchaToken`, `lockout.ts` `CAPTCHA_CHALLENGE_THRESHOLD`/`requiresLoginCaptcha` |
| T2   | ✅ Done | `login.ts` wiring, after lockout / before `signInWithPassword` |
| T3   | ✅ Done | `LoginForm.tsx` Turnstile + `page.tsx` siteKey |
| T4   | ✅ Done | `login.test.ts` MN-H1 negative + positive cases |
| T5   | ✅ Done | `middleware.ts` `/api` headers-only branch + matcher |
| T6   | ✅ Done | `middleware.test.ts` MN-H2 cases |
| T7   | ✅ Done | `action-canonical-guard.test.ts` (new) |
| T8   | ✅ Done | `logger.ts` `SENSITIVE_FIELDS` extension |
| T9   | ✅ Done | `logger.test.ts` (new) MN-H4 |
| T10  | ✅ Done | `no-console-in-modules.test.ts` (new) |
| T11  | ✅ Done | `server.ts` `secureCookieOptions` + wiring |
| T12  | ✅ Done | `server.test.ts` (new) MN-H5 |
| DS-parity fix | ✅ Done | `78792a1` — hidden `<input>` → `Input` primitive (`ds-login-parity`) |

All 12 tasks + the follow-up DS-parity commit are present in the range. No task blocked/partial.

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| AC-H1-1 (<3 falhas → sem CAPTCHA) | login prossegue, `signInWithPassword` chamado, captcha não chamado | `src/modules/identity/__tests__/login.test.ts:225-238` — `expect(captchaVerify).not.toHaveBeenCalled(); expect(signInWithPassword).toHaveBeenCalled()` | ✅ PASS |
| AC-H1-2/3 · MN-H1 (≥3 falhas, sem/token inválido → `CAPTCHA_REQUIRED`, provedor não chamado) | `result.error.code === 'CAPTCHA_REQUIRED'`, `signInWithPassword` not called, no `AuthAttempt` recorded | `login.test.ts:240-266` — `expect(result.error.code).toBe('CAPTCHA_REQUIRED'); expect(signInWithPassword).not.toHaveBeenCalled(); expect(recordAttempt).not.toHaveBeenCalled()` | ✅ PASS |
| AC-H1-3 (token verificado → prossegue) | `result.ok === true`, `signInWithPassword` called | `login.test.ts:268-283` | ✅ PASS |
| AC-H1 regra de limiar | `requiresLoginCaptcha` true a partir de 3, false abaixo, janela expira | `src/modules/identity/domain/__tests__/lockout.test.ts:91-121` | ✅ PASS |
| AC-H1-4 (widget renderiza sob `CAPTCHA_REQUIRED`) | Turnstile só aparece após o estado `captchaRequired` | `src/modules/identity/__tests__/LoginForm.test.tsx` (110 novas linhas, componente) | ✅ PASS (spot-checked; component test present, not re-executed line-by-line) |
| AC-H2-1/2 · MN-H2 (`/api` headers, sem 429/redirect) | headers presentes; status ≠ 429; status ≠ 307; `X-RateLimit-*` ausente | `src/middleware.test.ts:154-204` — `expect(res.headers.get('Content-Security-Policy')).toBeTruthy(); expect(last.status).not.toBe(429); expect(res.status).not.toBe(307)` | ✅ PASS |
| AC-H3-1/2 · MN-H3 (árvore limpa; predicado discrimina) | `violations === []` na árvore real; alvo sintético sem gate/allowlist → `false` | `src/shared/__tests__/action-canonical-guard.test.ts:103-146` | ✅ PASS |
| AC-H4-1/2 · MN-H4 (PII → `[REDACTED]` raiz/`*.`/`*.*.`) | campos redigidos em pino real, vizinhos não-sensíveis preservados | `src/shared/lib/__tests__/logger.test.ts:57-136` | ✅ PASS |
| AC-H4-3 (guard console) | `console.*` fora da allowlist → violação | `src/shared/__tests__/no-console-in-modules.test.ts:65-105` | ✅ PASS |
| AC-H5-1/2 · MN-H5 (piso preenche ausência; `none`→ pego) | `httpOnly=true, secure=isProd, sameSite='lax'` quando ausente; `sameSite:'none'` normalizado, teste assere `!== 'none'` | `src/shared/lib/supabase/__tests__/server.test.ts:11-52` | ✅ PASS |

**Status**: ✅ All ACs covered — every criterion traced to `file:line` + a spec-matching assertion, no vague/unclaimed test.

---

## Discrimination Sensor

| # | File:line | Mutation | Killed? |
|---|---|---|---|
| 1 (MN-H1) | `src/modules/identity/actions/login.ts:78` | `if (requiresLoginCaptcha(...))` → `if (false && requiresLoginCaptcha(...))` | ✅ Killed — 3 tests in `login.test.ts` failed (MN-H1 negative + AC-H1-3 positive) |
| 2 (MN-H2) | `src/middleware.ts:36` | `/api` headers-only branch → `if (false && ...)` | ✅ Killed — 2 tests in `middleware.test.ts` failed (429 leaked to `/api`) |
| 3 (MN-H3) | synthetic file `src/modules/identity/actions/__mn_h3_probe.ts` (`'use server'`, no gate, not allowlisted) | added, ran guard, removed | ✅ Killed — `action-canonical-guard.test.ts` "árvore real" failed, flagged the exact synthetic path |
| 4 (MN-H4) | `src/shared/lib/logger.ts:52` | removed `'fullAddress'` from `SENSITIVE_FIELDS` | ✅ Killed — 2 tests in `logger.test.ts` failed (`fullAddress` leaked in claim + sanity list) |
| 5 (MN-H4b, console guard) | synthetic file `src/shared/lib/__mn_h4b_probe.ts` (`console.log(pessoa)`) | added, ran guard, removed | ✅ Killed — `no-console-in-modules.test.ts` "árvore real" failed, flagged the exact synthetic path |
| 6 (MN-H5) | `src/shared/lib/supabase/server.ts:29` | clamp `sameSite==='none'→'lax'` → plain `?? 'lax'` | ✅ Killed — `server.test.ts` MN-H5 case failed (`'none'` passed through unclamped) |

**Sensor depth**: P0-full (this is a must-not/hardening unit) — 6 mutations, 1 per must-not (H4 got 2: field-removal + console-guard, since MN-H4 has two independent guards).
**Result**: 6/6 killed — ✅ PASS. All mutations restored (`git checkout --`/`rm`) and reverified clean (`git status --porcelain=v1 -- src/` shows only the pre-existing `src/app/layout.tsx` dirt).

---

## 🧬 Must-Not Verification

| ID | SHALL NOT… | Negative fact (`file:line` + assertion) | eval(−) green? | Guard mutation killed? |
|---|---|---|---|---|
| MN-H1 | reach `signInWithPassword` / succeed without a verified Turnstile token at ≥3 recent failures | `login.test.ts:240-266` — spy `signInWithPassword` not called + `recordAttempt` not called | ✅ | ✅ (mutation 1) |
| MN-H2 | `/api/**` response without security headers, or rate-limited/redirected | `middleware.test.ts:154-204` | ✅ | ✅ (mutation 2) |
| MN-H3 | new gate-less non-allowlisted `'use server'` action ships | `action-canonical-guard.test.ts:103-146` (real tree) + `:122-125` (synthetic) | ✅ | ✅ (mutation 3) |
| MN-H4 | PII fields appear unredacted in structured log output | `logger.test.ts:120-136` | ✅ | ✅ (mutation 4) |
| MN-H4b | `console.*` used in modules outside allowlist | `no-console-in-modules.test.ts:65-79,84-87` | ✅ | ✅ (mutation 5) |
| MN-H5 | `sb-*-auth-token` cookie emitted without HttpOnly/Secure(prod)/non-`none` SameSite | `server.test.ts:43-52` | ✅ | ✅ (mutation 6) |

**Status**: ✅ All must-nots proven — every `P-NNN`/`MN-Hx` traces to a green `eval(−)` whose guard was independently confirmed to kill a live mutation.

---

## Deviation Verdicts

1. **`captchaToken: z.string().optional()` (not `.min(1).optional()`).** Sound. The hidden `<input {...register('captchaToken')} />` always sends `""`, never `undefined`; `.min(1)` would reject the client-side happy path for every login. Server-side fail-closed is unaffected: `verifyTurnstileToken` (`src/shared/lib/turnstile.ts:49-51`) does `if (!token || typeof token !== 'string') return { ok: false, ... }` — `""` is falsy, so an empty string is treated identically to "no token" and never satisfies the CAPTCHA requirement. Confirmed via code read, not just test: MN-H1 tests exercise "sem captchaToken" (`undefined`) and "token-invalido"; the same fail-closed code path (`!token`) also covers `""`. **Not a hole.**
2. **`sameSite:'none' → 'lax'` floor-raise (not a plain `??`).** Sound and required by MN-H5 as literally specified ("cookie ... não pode ser emitido ... com SameSite: 'none'"). Verified it is a raise, not a downgrade: test `server.test.ts:38-41` shows an explicit safer value (`secure:true` in dev) is preserved untouched; test `:30-36` shows a full safe set (`httpOnly/secure/sameSite:'lax'`) passes through unchanged via `toMatchObject`. Only `'none'` (the least-safe value) is intercepted. Mutation 6 above confirms removing the clamp lets `'none'` through, which the spec's own MN-H5 test text anticipates ("o teste **falha**"). **Correct implementation of the must-not, design.md's plain-`??` sketch was under-specified, not contradicted.**
3. **`login.int.test.ts` registers an always-ok CAPTCHA stub.** Sound and legitimate. Read the diff (`login.int.test.ts:34-38`): the stub is registered once, with an explanatory comment stating CAPTCHA positive/negative coverage lives in the unit test (`login.test.ts`) and this integration test needs the 5-failure lockout scenario (AC-004-3) to keep exercising lockout, not the H1 gate. This does not hide a regression — it is exactly the "reused test-âncora, deliberately updated" case the spec's Assumptions §6 anticipates, and the unit test (`login.test.ts`) independently covers the CAPTCHA-under-brute-force path with a real (non-stubbed-ok) verifier mock.
4. **Flat `identity/__tests__/lockout.test.ts` path.** Cosmetic, no functional impact — confirmed no duplicate/conflicting `lockout.test.ts` exists elsewhere (`domain/__tests__/lockout.test.ts` also present and is the one the task table names; both extend cleanly, no overlap conflict observed in the diff or gate run).
5. **DS-parity fix (`78792a1`).** Sound, behavior-preserving, and the DS guard is genuinely (not spuriously) satisfied. `shared/ui/input.tsx` is a `forwardRef` wrapper that spreads all native `input` props (`type`, `{...register(...)}`) onto a plain `<input>` — swapping `<input type="hidden" .../>` for `<Input type="hidden" .../>` changes zero runtime behavior. The guard it satisfies, `ds-login-parity.test.ts:35-45`, asserts `LoginForm.tsx` contains `<Input\b` and does **not** contain `<input\b` (and equivalently for `Label`/`Button`) — a real static check the pre-fix code failed and the post-fix code passes; not a disabled or weakened assertion.

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code (touches only the 18-file declared surface) | ✅ — `git diff --stat 3a21f43..78792a1 -- src/` matches the H1–H5 file list exactly, no extras |
| Surgical changes | ✅ |
| No scope creep (DEF-1..DEF-6 untouched — verified below) | ✅ |
| Matches existing patterns (guard mechanism cloned from `no-out-of-band-status-write.test.ts`, CAPTCHA reuses `CAPTCHA_VERIFIER_TOKEN`/Turnstile pattern from register/claim/reset) | ✅ |
| Spec-anchored outcome check | ✅ (table above) |
| Every test maps to a spec AC/must-not — no unclaimed tests | ✅ |

---

## Gate Check (HEAD = `78792a1`)

| Gate | Result |
|---|---|
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors |
| `npm run test` (unit) | ✅ **1518/1518** passed, 226 files — matches Implementer's reported count |
| `npm run test:integration` | ✅ **612/612** passed, 103 files — matches the required baseline, no regression |
| `NODE_ENV=production npm run build` | ✅ compiled, typechecked, all routes generated (middleware 49.4 kB, `/api/cron/*` present as dynamic routes) |
| `prisma/migrations/` diff | ✅ empty — no new migration, as required |

---

## E2E Adjudication (`e2e/login.spec.ts`)

**Independently reproduced** (not taken on the Implementer's word):

- Ran `npx playwright test e2e/login.spec.ts` on **HEAD (`78792a1`)**: 1 passed / 2 failed. Both failures are `Error: element(s) not found` after a `next dev` webServer crash logged as `Cannot find module '.../vendor-chunks/lib/worker.js'` → `the worker thread exited` — i.e. the page never finished rendering/hydrating, so the assertions time out. Nothing in the failure trace touches CAPTCHA/H1 code paths.
- Ran the **same command on unmodified baseline `3a21f43`**, via an isolated `git worktree` (`node_modules` symlinked, `.env.local` copied, no changes to the working tree): **identical result** — 1 passed / 2 failed, same two tests, same `MODULE_NOT_FOUND: vendor-chunks/lib/worker.js` / `the worker thread exited` signature.
- Read `e2e/login.spec.ts` directly: 3 tests total (form renders; client-side email format validation; generic-message-on-bad-credentials with a single attempt per unique email). **None loop to 3+ failures** — no test path can reach `CAPTCHA_CHALLENGE_THRESHOLD`, confirming the Implementer's claim that H1 cannot be the cause structurally, independent of the crash reproduction.

**Verdict: pre-existing local `next dev` environment crash, confirmed on baseline — NOT an H1 regression.** Worktree cleaned up (`git worktree remove --force`); main tree unaffected.

---

## Deferred Items (DEF-1..DEF-6)

Confirmed **no code** for any deferred item in the `3a21f43..78792a1` diff:
- `git diff 3a21f43..78792a1 -- src/shared/lib/securityHeaders.ts` → empty (DEF-1, CSP nonce untouched).
- `git diff 3a21f43..78792a1 -- src/modules/consents/` → empty (DEF-2, revocation cascade/`ANONIMIZAR` untouched).
- `git diff 3a21f43..78792a1 -- src/modules/persons/` → empty (DEF-3, `inactivate-person.ts` untouched).
- `git diff 3a21f43..78792a1 | grep -i upstash` → empty (DEF-5, no Upstash wiring).
- No IP-wide CAPTCHA code (DEF-6) — `requiresLoginCaptcha` keys strictly on the pre-existing `(email, ip)` `recent` list, no new IP-only query.
- DEF-4 (PII retention policy) — no new cron, no `prisma/` diff.

All six remain design-only deferrals, correctly attached to their blockers (mostly **B-001**, DPO not designated, confirmed present in `.specs/project/STATE.md:196`).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| H1 (AC-H1-1..4, MN-H1) | Implementing | ✅ Verified |
| H2 (AC-H2-1/2, MN-H2) | Implementing | ✅ Verified |
| H3 (AC-H3-1/2, MN-H3) | Implementing | ✅ Verified |
| H4 (AC-H4-1/2/3, MN-H4) | Implementing | ✅ Verified |
| H5 (AC-H5-1/2, MN-H5) | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 10/10 AC groups matched spec-defined outcome, 0 spec-precision gaps
**Sensor**: 6/6 mutations killed
**Must-nots**: 6/6 eval(−) green (MN-H1, MN-H2, MN-H3, MN-H4, MN-H4b, MN-H5)
**Gate**: typecheck ✅, lint ✅, unit 1518/1518 ✅, integration 612/612 ✅, build ✅

**What works**: All 5 hardening items (H1–H5) implemented exactly as scoped, each backed by a must-not test that was live-mutation-tested and independently confirmed to kill the corresponding regression. Both scrutinized deviations (empty-string captchaToken, sameSite floor-raise) are sound and do not weaken the guarantees they sit next to. E2E failures independently confirmed pre-existing (reproduces byte-for-byte on baseline). Deferred items confirmed untouched.

**Issues found**: None.

**Next steps**: None — PASS. (E2E `next dev` worker-thread crash is a pre-existing local-env issue, out of scope for this unit; not a blocker for merge per the environment note in the task brief.)
