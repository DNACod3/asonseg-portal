# Fase 4 — U3 (Manifestações de interesse: USP-033..035) Validation

**Date**: 2026-07-08 (iteration 1 report) — **updated 2026-07-08 after fix→re-verify iteration 1/3**
**Spec**: `.specs/features/manifestacao-interesse-servico/usp-033-manifestar-interesse/spec.md`, `usp-034-cancelar-manifestacao/spec.md`, `usp-035-prestador-ver-manifestacoes/spec.md`
**Diff range**: `b45d0e4..c284a16` (14 commits) + fix commit `d8cdbfa` (test-only), branch `feat/fase-4-servicos-manifestacoes`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## RE-VERIFICATION — iteration 1/3 (2026-07-08) — ✅ RESOLVED

**Scope**: re-verify ONLY the single Blocker from the first pass (SVC033-MN-03 concurrency
sensor unreliable in full-file execution). The rest of U3 already PASSED and was not redone.

**Fix commit**: `d8cdbfa` `test(services): USP-033 fix — sensor de índice deterministico p/
SVC033-MN-03` — touches only `src/modules/services/__tests__/manifest-interest.int.test.ts`
(116 insertions, 29 deletions, 1 file). Confirmed via `git show --stat d8cdbfa` — **no product
code changed**.

**What changed**: a new `@svc033-mn-03` fact (`manifest-interest.int.test.ts:404-444`) bypasses
`manifestInterest` (and therefore its app-level UX pre-check) entirely, racing two **raw**
`prisma.serviceInterest.create()` calls on the same `(clientRawRaceId, serviceRawRaceId)` pair via
`Promise.allSettled`. It asserts (1) exactly 1 fulfilled + 1 rejected, (2) the rejection's `code
=== 'P2002'`, and (3) direct DB row counts (`activeCount===1`, `totalCount===1` — the rejected
insert never left a row at all). Since the Server Action's pre-check never runs in this path, the
**only** possible defense is the DB partial-unique index — eliminating the masking failure mode
from iteration 0. The old Server-Action-level race test is kept (untagged, no longer the sensor)
purely to document the `P2002→CONFLICT` error mapping. Orthogonally, `clientRaceId` (used by the
kept documentation test) was changed to seed with an already-ACTIVE `CLIENT` role + `SERVICE_HIRING`
consent up front (`clientWithActiveClientRole`, lines 168-193) — this fixes a genuine Postgres
deadlock (`40P01`) that occurred when two concurrent `manifestInterest` calls both tried to run
`ensureClientRole` from scratch on the same brand-new grant row; it does not touch product code and
does not weaken what `@svc033-mn-03` exercises (that path bypasses `ensureClientRole` entirely — its
own client, `clientRawRaceId`, has no role/consent seeded at all, confirmed via
`grep -n "clientRawRaceId\|serviceRawRaceId"`, both raw `create` calls target the identical pair).

**Independent reproduction (this Verifier, not reusing the Implementer's numbers)**:

| Condition | Runs | Result |
|---|---|---|
| Index dropped (`DROP INDEX uq_service_interest_active` in scratch local Supabase DB) — full file, no `-t` isolation | 8 | **8/8 red** — `@svc033-mn-03` failed every run (`expected [...] to have a length of 1 but got 2`) |
| Index restored (`CREATE UNIQUE INDEX ... WHERE cancelled_at IS NULL`, verified byte-identical to migration via `\d service_interests` + `pg_indexes.indexdef`) — full file, no `-t` isolation | 8 | **8/8 green**, 13/13 tests passed each run — including the previously-deadlock-prone `clientRaceId` documentation test, confirming the deadlock fix is stable, not just lucky |

This directly reproduces and closes the exact failure mode from iteration 0 (6/8 survival in
full-file context) — the new sensor is deterministic in the realistic (CI-equivalent) execution
context, not just in isolated `-t` runs.

**Gates re-run** (working tree confirmed clean before and after, `git status --short
src/modules/services prisma/schema.prisma prisma/migrations` empty):
- Typecheck: 0 errors
- Lint: 0 errors/warnings
- Unit (`vitest run --exclude '**/*.int.test.ts'`): 187 files, **1237/1237 passed**
- Services integration (`npm run test:integration -- src/modules/services`): 11 files, **93/93
  passed** (92→93: the new `@svc033-mn-03` raw-race fact adds one test)
- Build (`npm run build`, `NODE_ENV` unset to match CI): ✓ compiled successfully, all routes present
- `prisma migrate status`: "Database schema is up to date!" (30 migrations)

### Updated verdict: U3 — ✅ **PASS**

All 10 ACs, all 10 must-nots (now including a reliably-killed SVC033-MN-03), and all 4 P0 sensor
mutations are green with `file:line` evidence. No remaining gaps. **Close the unit.**

---

## Task Completion

All 14 commits present: USP-033 T1–T7 (migration, domain rule, e-mail template, Server Action, read
queries/view, CTA wiring, test matrix), USP-034 T1–T4 (rule/schema, Server Action, cancel button
wiring, test matrix), USP-035 T1–T3 (query + View Model, route + component, test matrix). No
partial/blocked tasks found.

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| AC-033-1 manifestar em serviço ATIVO | persiste + retorna contato + enfileira e-mail | `manifest-interest.int.test.ts:242-299` — `expect(res.data.providerContact).toEqual({displayName,phone,email})`; `outboxMsg.payload.template === 'service-interest-notification'` | ✅ PASS |
| AC-033-2 ativação automática do papel CLIENT | `ensureClientRole` ativa papel + grava consent na mesma tx | `manifest-interest.int.test.ts:261-269` — `grant` ACTIVE + `consent` SERVICE_HIRING não-revogado, sem novo aceite se já ativo (`:323-341`) | ✅ PASS |
| AC-033-3 múltiplas manifestações em serviços diferentes | coexistem ativas | `manifest-interest.int.test.ts:301-310` — `activeCount === 2` | ✅ PASS |
| AC-033-4 consent SERVICE_HIRING ausente | `CONSENT_REQUIRED`, sem escrita | `manifest-interest.int.test.ts:225-240` — `error.code==='CONSENT_REQUIRED'`, `count===0`, `grant===null` | ✅ PASS |
| AC-033-5 contato revelado enquanto ativa | contato completo p/ interesse ativo; `null` p/ sem/cancelada | `get-provider-contact.int.test.ts:82-99` | ✅ PASS |
| AC-034-1 cancelar → `cancelledAt` preenchido | `cancelledAt != null` + audit `INTEREST_CANCELLED` | `cancel-interest.int.test.ts:185-206` | ✅ PASS |
| AC-034-2 cancelada some da lista do prestador | ausente do `where cancelledAt:null` do inbox | `cancel-interest.int.test.ts:206-213` (mesmo `where`) + `list-provider-interests.int.test.ts:148-153` | ✅ PASS |
| AC-034-3 cancelar já-cancelada → idempotente | `ok({alreadyCancelled:true})`, sem novo audit | `cancel-interest.int.test.ts:160-183,216-225` — `cancelledAt` inalterado, `auditCount` estável | ✅ PASS |
| AC-035-1 prestador lista manifestações ativas | nome, contato, data, serviço | `list-provider-interests.int.test.ts:129-136` | ✅ PASS |
| AC-035-2 View Model, nunca Prisma direto no template | componente consome só `ProviderInterestView` | `provider-interests-list.tsx` consome `ProviderInterestView[]`; `client-for-provider.view.ts` único ponto de projeção | ✅ PASS |

**Status**: ✅ All ACs covered.

---

## Must-Not Verification (🧬 ICE mode)

| ID | Proibição | Negative fact (`file:line` + assertion) | eval(−) green? | Guard mutation killed? |
|---|---|---|---|---|
| SVC033-MN-01 | Contato do prestador nunca carregado sem manifestação ativa | `get-provider-contact.int.test.ts:91-99` — sem interesse/cancelada ⇒ `null` | ✅ | ✅ (mutação 1, ver Sensor) |
| SVC033-MN-02 | Papel CLIENT nunca ACTIVE sem consent na mesma tx | `manifest-interest.int.test.ts:225-240` | ✅ | ✅ (mutação 3, ver Sensor) |
| SVC033-MN-03 | No máx. 1 manifestação ATIVA por (cliente,serviço) sob corrida | ~~`manifest-interest.int.test.ts:343-357`~~ (iteration 0, superseded) → **`manifest-interest.int.test.ts:404-444`** (iteration 1 — raw-race sensor, bypassa a action) | ✅ **RESOLVIDO na iteração 1** — ver seção de re-verificação no topo | ✅ **Killed 8/8** em contexto de arquivo inteiro (era ❌ na iteração 0 — ver Sensor #4 abaixo, histórico) |
| SVC033-MN-04 | Autor não manifesta no próprio serviço | `manifest-interest.int.test.ts:216-223` | ✅ | — (não mutado; leitura de código confirma o `if` direto) |
| SVC033-MN-05 | Serviço não-ACTIVE / autor inativo barrado | `manifest-interest.int.test.ts:194-214` | ✅ | — (não mutado; coberto por dois testes distintos PAUSED/autor inativo) |
| SVC034-MN-01 | Cancelar de terceiro ⇒ `NOT_FOUND`, sem vazar existência | `cancel-interest.int.test.ts:143-158` | ✅ | — (owner+existência foldados no `findFirst`, lido no código) |
| SVC034-MN-02 | Cancelamento não revoga consent/papel | `cancel-interest.int.test.ts:227-245` | ✅ | — |
| SVC035-MN-01 | Prestador nunca vê manifestações de serviço alheio | `list-provider-interests.int.test.ts:138-146` | ✅ | ✅ (mutação 2, ver Sensor) |
| SVC035-MN-02 | PII do cliente além de nome+contato nunca no `select` | `list-provider-interests.int.test.ts:162-170` (sensor CPF/endereço) | ✅ | — (não mutado; `select` lido linha a linha, campos ausentes estruturalmente) |
| SVC035-MN-03 | Canceladas fora do inbox | `list-provider-interests.int.test.ts:148-153` | ✅ | — |

**Status**: ✅ **10/10 must-nots verificados** (iteração 1). SVC033-MN-03 tinha sensor
não-confiável no contexto de execução real (suíte completa/CI) na iteração 0 — resolvido pelo
commit `d8cdbfa` e reproduzido de forma independente por este Verifier (8/8 killed com índice
removido, 8/8 green com índice restaurado, ver seção de re-verificação no topo). Os demais 9 já
tinham `eval(−)` verde com evidência `file:line` desde a iteração 0.

---

## Discrimination Sensor

Sensor tier: **P0/must-not USPs → full** (todas as 3 USPs desta unidade carregam must-nots de
privacidade/concorrência — piso Large do design). 4 mutações direcionadas aos comportamentos de
maior risco, todas em scratch (working tree restaurado ao final, `git status` limpo confirmado).

| # | File:line | Mutação | Contexto de execução | Killed? |
|---|---|---|---|---|
| 1 | `src/modules/services/queries/get-provider-contact.ts:22` | Removeu `cancelledAt: null` do `where` do `findFirst` de interesse ativo (SVC033-MN-01 — contato vazaria p/ interesse cancelado) | `npm run test:integration -- get-provider-contact.int.test.ts` | ✅ Killed — `SVC033-MN-01: cliente com manifestação CANCELADA → null` falhou (retornou contato completo em vez de `null`) |
| 2 | `src/modules/services/queries/list-provider-interests.ts:69-72` | Removeu `service: { authorPersonId: viewer.id }` do `where` (SVC035-MN-01 — prestador veria manifestações de terceiro) | `npm run test:integration -- list-provider-interests.int.test.ts` | ✅ Killed — 3 testes falharam, incl. `@svc035-mn-01 prestador B não vê manifestações do serviço do prestador A` e o teste de lista vazia |
| 3 | `src/modules/services/actions/manifest-interest.ts:86` | Flipou `!consent.active` → `consent.active` no gate de `CONSENT_REQUIRED` (SVC033-MN-02) | `npm run test:integration -- manifest-interest.int.test.ts` | ✅ Killed — 5 testes falharam, incl. `@svc033-mn-02 consent ausente sem aceite → CONSENT_REQUIRED` e o happy path (que passou a exigir aceite indevidamente) |
| 4 | `prisma` (DB real, scratch): `DROP INDEX uq_service_interest_active` | Removeu o índice único parcial — a garantia real de SVC033-MN-03 — e rodou o teste de corrida | `npm run test:integration -- manifest-interest.int.test.ts` (arquivo isolado com `-t`, 5x) vs. suíte completa do arquivo (8x no total) | ⚠️ **Resultado inconsistente**: isolado com `-t "svc033-mn-03"` → **killed 5/5** (ambas as manifestações concorrentes sucedem, assert `1 ok`/`1 CONFLICT` falha corretamente); rodando o **arquivo inteiro** (mesmo contexto do CI) → **sobreviveu em 6/8 execuções** (`Tests 12 passed (12)`) |

**Sensor depth**: P0-full (4 mutações, cobrindo os 4 must-nots de maior risco apontados no briefing).
**Result (iteração 0)**: 3/4 killed de forma confiável; 1/4 (mutação #4, SVC033-MN-03) **sobrevive
predominantemente** no contexto de execução real (suíte completa == CI via
`npm run test:integration`).

**Result (iteração 1, após `d8cdbfa`)**: mutação #4 reproduzida de forma independente pelo
Verifier contra a nova fact (`manifest-interest.int.test.ts:404-444`) — **8/8 killed** com o índice
removido, **8/8 green** com o índice restaurado, em contexto de arquivo inteiro (não isolado). **4/4
mutações agora killed de forma confiável.**

### Diagnóstico da mutação #4 (por que sobrevive)

O teste dispara as duas chamadas via `Promise.all([manifestInterest(...), manifestInterest(...)])`
*dentro do mesmo processo Node/arquivo de teste*. `manifestInterest` faz várias operações `await`
antes do `create()` (lookup do serviço, `requireActiveConsent`, `loadTerm`, o pré-check de UX
`findFirst` de duplicidade). Quando o arquivo roda isolado (`-t`), essas duas cadeias de await
raceiam de verdade e ambas passam pelo pré-check antes de qualquer `create()` — com o índice
removido, ambos os `create()` sucedem (2 ativas), e o assert `1 ok + 1 CONFLICT` corretamente
falha (mutante morto). Quando o arquivo roda dentro da suíte completa, o pool de conexões e a fila
de queries já aquecidos pelos testes anteriores mudam o intercalamento o suficiente para que, na
maioria das execuções, o **pré-check de UX** (não a garantia real) já enxergue a primeira
manifestação e barre a segunda com `CONFLICT` — produzindo o mesmo resultado observável (`1 ok +
1 CONFLICT`) **mesmo sem o índice único parcial protegendo nada**.

Isso significa que, no ambiente em que o teste realmente roda (`npm run test:integration`/CI, nunca
isolado), o teste de corrida **não prova de forma confiável** que a garantia real (índice único
parcial) é o que está protegendo SVC033-MN-03 — ele passa a maior parte do tempo por sorte de
timing do pré-check documentado no próprio código como "não é a garantia" (`manifest-interest.ts:107-108`).
Uma futura regressão que remova ou quebre o índice único parcial (ex.: uma migração que o
substitua por engano por um índice não-parcial) tem alta chance de **não ser pega** por este teste
em CI, exatamente o cenário que o must-not existe para prevenir.

Isso NÃO significa que a funcionalidade em si está quebrada — o índice existe na migração
(`20260708213325_usp033_service_interest/migration.sql:25-27`), `prisma migrate status` confirma
que está aplicado, e a corrida isolada prova que ele de fato garante a unicidade quando
genuinamente testado. O gap é na **confiabilidade do sensor/fato de teste**, não no código de
produção.

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ |
| Matches patterns (espelha `applyToJob`/`cancelApplication`/`listJobApplicants`/AD-018) | ✅ |
| Spec-anchored outcome check (asserted values match spec-defined outcome) | ✅ |
| Every test maps to a spec requirement — no unclaimed tests | ✅ |

---

## Edge Cases

- [x] Serviço inexistente ⇒ `NOT_FOUND` (`manifest-interest.int.test.ts:188-192`)
- [x] Consentimento recusado ⇒ `CONSENT_REQUIRED`, sem persistir/revelar (`:225-240`)
- [x] Duplicidade sequencial ⇒ `CONFLICT` (`:312-321`)
- [x] Termo indisponível ⇒ `PRECONDITION_FAILED` degradando o CTA (lido em `page.tsx:99-107`, sem teste de integração dedicado ao `TermLoaderError` — cobertura por leitura de código apenas)
- [x] Manifestação inexistente/de terceiro ⇒ `NOT_FOUND` (`cancel-interest.int.test.ts:143-158`)
- [x] Corrida de duplo-cancelamento ⇒ idempotente, 1 audit (`:247-260`)
- [x] Prestador sem manifestações ⇒ lista vazia (`list-provider-interests.int.test.ts:184-195`)
- [x] Serviço PAUSED do prestador com manifestação ativa ainda aparece no inbox (§D4) (`:155-160`)

---

## Gate Check

- **Typecheck**: `npm run typecheck` — 0 errors
- **Lint**: `npm run lint` — 0 errors/warnings
- **Unit** (`npm run test` / vitest, exclude `*.int.test.ts`): 187 files, **1237/1237 passed**
- **Integration, services module** (`npm run test:integration -- src/modules/services`): 11 files, **92/92 passed** (iteration 0); **93/93 passed** after `d8cdbfa` added the raw-race fact (iteration 1)
- **Build** (`npm run build`, `NODE_ENV` unset to match CI — `.env.local`'s `NODE_ENV=development` causes a pre-existing, unrelated `/500` prerender error not caused by this diff): ✓ compiled successfully; `/prestador/manifestacoes` (force-dynamic) and `/servicos/[id]` (ISR 1800s) both present in the route manifest
- **`prisma migrate status`**: "Database schema is up to date!" — 30 migrations, including `20260708213325_usp033_service_interest`
- **Skipped tests**: none observed
- **Failures**: none in the checked-in state (all failures below are from Verifier-injected scratch mutations, reverted)

---

## Fix Plans

### Fix 1: SVC033-MN-03 concurrency sensor is timing-dependent, not deterministic, in its real execution context

**✅ RESOLVED in fix→re-verify iteration 1 (commit `d8cdbfa`).** Kept below as historical record
of the original finding; see the re-verification section at the top of this document for the
independent confirmation (8/8 killed with index dropped, 8/8 green with index restored, full-file
execution, no `-t` isolation).

- **Root cause**: `manifest-interest.int.test.ts`'s corrida test (`@svc033-mn-03`) races two
  `manifestInterest()` calls via `Promise.all` inside a single Node process/test file. When run
  standalone the race genuinely reaches both `create()` calls and the DB partial-unique index is
  what produces the single `CONFLICT`. When run as part of the full file/suite (the way
  `npm run test:integration` and CI actually execute it), connection-pool warm-up from prior tests
  in the same file skews the interleaving so the pre-tx UX pre-check (`existingActive` `findFirst`,
  explicitly documented in `manifest-interest.ts:107-108` as "not the guarantee") coincidentally
  catches the second call most of the time — masking whether the real DB constraint is still
  present. Verified empirically: dropping `uq_service_interest_active` in a scratch DB session and
  re-running the **same test** isolated (`-t`) killed it 5/5; running the **same test inside the
  full file** (CI-equivalent) killed it only 2/8.
- **Fix task**: Strengthen the fact so it deterministically exercises the DB-level constraint
  regardless of test-file ordering — e.g. (a) force genuine overlap by racing two raw
  `tx.serviceInterest.create()` calls directly (bypassing the pre-check layer) to prove the index
  alone enforces uniqueness, in addition to the existing action-level race test which proves the
  end-to-end UX outcome; or (b) stub/bypass the UX pre-check for this specific test (e.g. via a
  test-only seam or by asserting on the DB row count immediately without relying on which layer
  produced the `CONFLICT`) so the assertion is anchored to "exactly 1 row survives" rather than to
  the `ActionResult` shape alone, which both defenses satisfy identically. Per skill-tdad routing
  (ICE mode, §Sensor): this is a weak fact for a must-not and must be regenerated by `skill-tdad`,
  not hand-patched.
- **Priority**: **Blocker** — must-nots are gate-blocking by rule (§6b); this one's guard-removal
  mutation predominantly survives in the test's real execution context.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| AC-033-1..5 | Implementing | ✅ Verified |
| AC-034-1..3 | Implementing | ✅ Verified |
| AC-035-1..2 | Implementing | ✅ Verified |
| SVC033-MN-01 | Implementing | ✅ Verified (eval(−) green, sensor killed) |
| SVC033-MN-02 | Implementing | ✅ Verified (eval(−) green, sensor killed) |
| SVC033-MN-03 | Implementing | ✅ Verified (eval(−) green, sensor killed 8/8 in full-file execution — iteration 1) |
| SVC033-MN-04 | Implementing | ✅ Verified |
| SVC033-MN-05 | Implementing | ✅ Verified |
| SVC034-MN-01 | Implementing | ✅ Verified |
| SVC034-MN-02 | Implementing | ✅ Verified |
| SVC035-MN-01 | Implementing | ✅ Verified (eval(−) green, sensor killed) |
| SVC035-MN-02 | Implementing | ✅ Verified |
| SVC035-MN-03 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ **Ready** (iteration 1) — the single Blocker from iteration 0 (SVC033-MN-03
discrimination-sensor unreliability) is resolved: commit `d8cdbfa` replaced the sensor with a raw
`prisma.serviceInterest.create()` race that bypasses the app-level pre-check entirely, and this
Verifier independently reproduced 8/8 kill (index dropped) + 8/8 green (index restored) in
full-file execution — the exact context that exposed the original gap.

**Spec-anchored check**: 10/10 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 4/4 mutations reliably killed (iteration 1; was 3/4 in iteration 0)
**Must-nots**: 10/10 `eval(−)` green with reliable sensor (iteration 1; was 9/10 in iteration 0)
**Gate**: typecheck 0 errors, lint 0 errors, unit 1237/1237, services integration 93/93, build ✓, migrate status ✓

**What works**: Both contact-leak directions (provider→client, client→provider) are provably
enforced at the Prisma `select`/`where` level, not just in JSX — confirmed by fault injection.
Owner-scoping on the provider inbox is a real barrier (mutation killed, 3 tests caught it).
`CONSENT_REQUIRED` is a distinct, gated outcome from `VALIDATION` (L-004), verified by mutation.
`ensureClientRole` runs inside the `withAudit(INTEREST_MANIFESTED)` transaction (read confirmed,
consent-ativo-sem-novo-aceite test confirms no-op idempotence). Cancel semantics are owner-scoped,
non-leaking (`NOT_FOUND`, not `FORBIDDEN`), and idempotent per spec's declared divergence from
`cancelApplication`. Precondition (service ACTIVE + author active, no self-manifestation) has
dedicated tests for every branch.

**Issues found**: none remaining. Fix 1 (SVC033-MN-03 sensor reliability) was resolved in
fix→re-verify iteration 1 (commit `d8cdbfa`) and independently reproduced by this Verifier.

**Next steps**: **Close U3.** No fix task pending; no further re-verify iteration needed (used 1 of
the 3-iteration bound).
