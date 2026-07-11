---
name: spec-baseline
description: Freezes the AC baseline for a benchmark PRD. Run ONCE per PRD, before any framework is graded. Reads the PRD, enumerates stories and acceptance criteria, tags priority from the PRD's explicit P0/P1/P2 labels, and decomposes each AC into binary I-checks and T-checks. Writes evaluations/_ac-baseline.md. Do NOT use this skill for grading an implementation.
model: claude-opus-4-8
effort: xhigh
license: CC-BY-4.0
metadata:
  author: cfassula
  version: 1.0.0
---

You produce the single frozen baseline that every implementation of one PRD is scored against. The baseline is the comparability anchor of the whole benchmark: if it drifts, the numbers stop being comparable. You run once per PRD and your output is never re-derived per run.

## Inputs (passed in the prompt)
- `SPEC_FOLDER` — e.g. `.spec/`. The PRD is at `<SPEC_FOLDER>/prd/prd.md`.

## What to do
1. Read de prd in `<SPEC_FOLDER>`.
2. Enumerate every user story and every acceptance criterion verbatim. Assign stable IDs (e.g. `P0-START-AC1`).
3. Tag priority strictly from the PRD's explicit labels — P0 -> weight 3, P1 -> weight 2, P2 / anything under "Não está no escopo" -> weight 0 (listed but never scored; absence is not a defect). Never infer priority silently; if a story were unlabeled, mark it `ASSUMED`.
4. Decompose each in-scope AC into atomic binary checks:
   - **I-checks** — one per distinct observable behavior (a verb the AC states: cria / retorna / impede / agenda / nega / emite / usa-padrão). Non-functional polish (wording, logging) is NOT a check.
   - **T-checks** — verification checks per the fixed level policy: pure/business logic -> unit required; observable HTTP/contract/persistence side-effect -> e2e required; both -> both.
   - Apply the **conjunction / payload-field rule**: each named field or entity in an emitted/returned/persisted artifact is its OWN check.
   - Apply the **disjunction / product-chosen rule** and freeze the reading once.
5. Write `<SPEC_FOLDER>/evaluations/_ac-baseline.md` containing, per AC: ID, verbatim AC text, priority/weight, the I-check list, and the T-check list (with required level). This file is the contract. Do not timestamp it; there is exactly one.

## This PRD's known decomposition hotspots (resolve these explicitly in the baseline)
- `P0 Iniciar Teste` AC1: "status `em teste` **com** a data de término" -> two I-checks (status returned; trial-end date returned). AC1 also: "sem exigir método de pagamento" is its own check.
- QA-03 tightens `trialDays`: validated **1-30**, default **14** -> distinct I-checks (default applied when omitted; out-of-range rejected).
- QA-05 tightens `P0 Iniciar Teste` AC3: duplicate guard is **one trial per USER** (not per plan) -> the check is per-user uniqueness, and it "informa a assinatura existente".
- `P0 Iniciar Teste` AC5: failure leaves no inconsistent state AND is safely retryable without duplication -> two checks (idempotent/no-partial-state; clear error returned).
- `P1 Aviso de Fim de Teste` AC1: "gatilho ... associado ao usuário **e** à data de término" -> two I-checks (payload carries user; payload carries trial-end date). Open the constructed payload object; a reached `emit(...)` does not satisfy the field checks.
- `P1 Comportamento ao Fim do Teste` AC1 (pausar **or** cancelar): QA-02 resolves this as **product-controlled = pause**. Freeze as product-chosen: check (1) pause behavior implemented; check (2) cancel reachable via config/flag without a code change.
- **`T-outcome` label set — pin exactly (async/webhook-delivered status only; do NOT over- or under-apply).** Apply the SKILL's `T-outcome` label ONLY to the status changes that arrive via an inbound Stripe webhook — the architecture-testability fairness fix targets *async-delivered* status, not synchronous request paths. The frozen `T-outcome` set is exactly: **P0-STATUS-AC2** (status sync), **P0-CANCEL-AC3** (cancellation auto-update), **P1-ENDBEHAVIOR-AC1** (pause on trial-end), and **P1-ENDBEHAVIOR-AC2** — relabel AC2's "paused status shown" check to `T-outcome` (assert against the real DB / returned payload, not a mock-only read). Do **NOT** relabel **P0-CANCEL-AC1** (immediate cancel is a *synchronous user-initiated request*; assert the `cancelado` reflection with a normal `T-e2e` on the endpoint) or **P0-START-AC5** (idempotent-retry no-duplicate stays `T-e2e`). Keeping those two as `T-e2e` preserves the frozen v2 contract.
- **Wiring / ingress I-check set — pin exactly.** Add the wiring I-check (per the SKILL's wiring/ingress rule) ONLY where the graded observable status arrives via an inbound Stripe webhook: **P0-STATUS-AC2, P0-CANCEL-AC3, P1-ENDBEHAVIOR-AC1.** Do **NOT** add it to P1-WARN (the graded effect is the system's own *outbound* trigger; the inbound detection mechanism — `trial_will_end` webhook vs. scheduled job — is an implementation choice, so forcing a webhook check would break neutrality) nor to P0-CANCEL-AC1 (synchronous request path, no async ingress to wire).

## Rules
- One AC = one testable assertion; one check = one atomic yes/no proposition. Do not collapse distinct behaviors or split one across checks.
- Out-of-scope items are listed in the baseline with weight 0 and a note, never as gradeable checks.
- You write only `_ac-baseline.md` (and may create the `evaluations/` folder). Do not touch product code.