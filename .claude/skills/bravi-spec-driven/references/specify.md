# Specify

**Goal**: Capture WHAT to build with testable, traceable requirements.

If the feature has ambiguous gray areas (multiple valid approaches for user-facing behavior), the agent will automatically trigger the [discuss gray areas](discuss.md) process within this phase. For clear, well-defined features, it goes straight to the next phase.

## Implicit-Requirement Dimensions

The canonical rubric for requirements that are easy to miss. Referenced by [discuss.md](discuss.md) — defined here, not duplicated.

| Dimension | What to cover |
| --------- | ------------- |
| Input validation & bounds | Limits, formats, sanitization |
| Failure / partial-failure states | Timeouts, partial saves, rollbacks |
| Idempotency / retry / duplicate handling | Safe retries, dedup keys |
| Auth boundaries & rate limits | Who can call what, throttle rules |
| Concurrency / ordering | Race conditions, ordering guarantees |
| Data lifecycle / expiry | TTL, archival, deletion |
| Observability | Logging, metrics, tracing hooks |
| External-dependency failure | Circuit breakers, fallbacks |
| State-transition integrity | Valid transitions, guards |

---

## 💠 External Source of Truth: Adapt, Don't Re-Derive

When the requirements already exist in an upstream artifact — a PRD, a ticket (Jira/Linear/GitHub issue), a requirements document, a client contract — Specify becomes an **adapter**, not a generator. Re-deriving requirements that already exist forks the source of truth: two documents drift apart, and traceability breaks at the first change nobody mirrors.

Rules:

1. `spec.md` **points to** the upstream artifact as the source of truth (path/URL + version or date).
2. **Reuse the upstream IDs as the canonical Requirement IDs** whenever the artifact has them (ticket keys, requirement numbers, AC numbers). Never mint a parallel `[CATEGORY]-NN` for a requirement that already has an upstream ID — parallel IDs are how traceability dies. Mint local IDs only for requirements the upstream artifact does not cover, and flag them as local additions.
3. **Translate what the upstream format cannot express.** Upstream prohibitions ("must never…", compliance constraints) become Must-Nots (see below); upstream open points become Assumptions & Open Questions entries **with an owner**. This translation step is where value is most often lost — do it explicitly.
4. The generative interview below runs only for the **gaps** — never to restate what upstream already answers. If the user and the upstream artifact disagree, that is an upstream change to surface, not a silent local override.

The same principle applies at Design ([design.md](design.md)): existing design docs and ADRs are resolved and referenced, never re-decided.

---

## Process

### 1. Clarify Requirements

**Load confirmed lessons first:** Before clarifying, load the project's confirmed lessons so past verification failures shape this spec instead of repeating. Run `python3 scripts/lessons.py list --status confirmed` (optionally `--scope [area]` or `--query [term]` for the area this feature touches) and apply what comes back as guidance. Load only `confirmed` — never `candidate` or `quarantined`. If no store exists yet or no code tool is available, skip silently. See [lessons.md](lessons.md).

**Lightweight context scan first (Knowledge Verification Chain Step 1):** Before asking questions, briefly scan existing code, patterns, and neighboring features relevant to this feature. Use what you find to ground your clarifying questions in reality — not to constrain the spec to current implementation. Keep it lightweight (stay within the <40k token budget; reuse the chain, no new machinery). The spec captures WHAT is needed, not only what exists.

You are a thinking partner, not an interviewer. Start open — let the user dump their mental model. Follow the energy: whatever they emphasize, dig into that.

Ask conversationally (not as a checklist):

- "What problem are you solving?"
- "Who is the user and what's their pain?"
- "What does success look like?"

If needed:

- "What are the constraints (time, tech, resources)?"
- "What is explicitly out of scope?"

**Challenge vagueness.** Never accept fuzzy answers. "Good" means what? "Users" means who? "Simple" means how? Make the abstract concrete: "Walk me through using this." "What does that actually look like?"

**Know when to stop — then run the dimensions sweep.** When you understand what they're building, why, who it's for, and what done looks like, run a closing **implicit-requirement dimensions sweep** before offering to proceed:

- **Large / Complex:** Cover every dimension above — each must resolve to a requirement OR an explicit `N/A because [reason]`. No blank entries allowed.
- **Medium:** Cover only dimensions obviously present for this feature's domain; collapse the rest to a single `remaining dimensions N/A for this scope`.
- **Small:** Skip the sweep entirely.

The `N/A because...` escape is mandatory — it prevents inventing requirements to fill the checklist. Bound the sweep to THIS feature's scope; never add requirements outside the feature boundary.

### 2. Capture User Stories with Priorities

**P1 = MVP** (must ship), **P2** (should have), **P3** (nice to have)

Each story MUST be **independently testable** - you can implement and demo just that story.

### 3. Write Acceptance Criteria

Use **WHEN/THEN/SHALL** format - it's precise and testable:

- WHEN [event/action] THEN [system] SHALL [response/behavior]

### 3.5. 💠 Capture Must-Nots (world-level prohibitions)

ACs say what the system SHALL do. Now ask explicitly what must NEVER happen — data visible to the wrong role, a paid order double-charged, a deleted record still counted in reports. These are **must-nots**: prohibitions on the state of the world, not merely missing features. They are the highest-value requirements to capture, because their violation is usually the costliest failure and the least likely to be caught by happy-path tests.

For each must-not:

- Give it an ID: `[FEAT]-MN-NN` (it enters the traceability table like any requirement).
- Phrase it as a negative AC: `WHEN [context] THEN system SHALL NOT [prohibited outcome]`.
- Anchor it to the failure it prevents (**Prevents:** [concrete bad outcome]).
- It requires a **negative test** — one that asserts the prohibited outcome does not occur. Ownership is assigned at Tasks ([tasks.md](tasks.md) Check 4) and enforced at validation ([validate.md](validate.md) §6b).

Not every feature has must-nots — do not invent them to fill a section. But if the feature touches money, auth, privacy, destructive operations, or state machines, zero must-nots is a smell: probe once before accepting it.

### 4. Requirement Closure Gate (before confirm)

Before presenting the spec for confirmation, run the three checks below. The spec is not presentable for confirmation until every item is resolved or assumption-logged — this is the guarantee that no requirement leaves the spec silently unclear.

**Scope-tiered:** Large/Complex = full gate; Medium = resolve obvious ambiguities, log the rest as assumptions; Small = skip entirely (consistent with skipping the sweep).

1. **Unambiguity + precision (hard).** Every AC must (a) have a single interpretation and (b) define a precise, spec-defined expected outcome. Any AC that fails either check: resolve with the user, split it, or log it as an explicit assumption with the chosen interpretation and rationale. No AC proceeds readable two ways or with an undefined outcome.

2. **Open-questions / assumptions closure.** Enumerate every unresolved decision that surfaced during clarification. Each must be either (a) resolved with the user OR (b) recorded as an **assumption** (chosen default + rationale) in the spec's Assumptions & Open Questions section. Nothing proceeds unmarked.

3. **Declined gray areas become assumptions.** Any gray area the user declined to discuss or that went undiscussed is written to the spec's Assumptions & Open Questions section (agent's chosen default + rationale) — never silently dropped. See [discuss.md](discuss.md).

Fix inline. This gate is bounded to THIS feature's stated dimensions and actual behavior — never to "anything imaginable." The Out of Scope table and anti-scope-creep rules remain the counterweights: the gate clarifies existing requirements, it never invents new ones.

---

## Template: `.specs/features/[feature]/spec.md`

```markdown
# [Feature Name] Specification

## Problem Statement

[Describe the problem in 2-3 sentences. What pain point are we solving? Why now?]

## Goals

- [ ] [Primary goal with measurable outcome]
- [ ] [Secondary goal with measurable outcome]

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature     | Reason         |
| ----------- | -------------- |
| [Feature X] | [Why excluded] |
| [Feature Y] | [Why excluded] |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Owner | Chosen default  | Rationale | Confirmed? |
| --------------------- | ----- | --------------- | --------- | ---------- |
| [ambiguity]           | [agent/user/external: who] | [what we'll do] | [why]     | [y/n]      |

**Owner** — who can resolve it: `agent` (my discretion), `user`, or an external party (client, another team, a pending dependency or approval). 💠 An unconfirmed item with an **external owner** that the implementation depends on trips the Entry Gate at Tasks ([tasks.md](tasks.md) §0) — the feature does not enter task breakdown until it is resolved.

**Open questions:** none — all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: [Story Title] ⭐ MVP

**User Story**: As a [role], I want [capability] so that [benefit].

**Why P1**: [Why this is critical for MVP]

**Acceptance Criteria**:

1. WHEN [user action/event] THEN system SHALL [expected behavior]
2. WHEN [user action/event] THEN system SHALL [expected behavior]
3. WHEN [edge case] THEN system SHALL [graceful handling]

**Independent Test**: [How to verify this story works alone - e.g., "Can demo by doing X and seeing Y"]

---

### P2: [Story Title]

**User Story**: As a [role], I want [capability] so that [benefit].

**Why P2**: [Why this isn't MVP but important]

**Acceptance Criteria**:

1. WHEN [event] THEN system SHALL [behavior]
2. WHEN [event] THEN system SHALL [behavior]

**Independent Test**: [How to verify]

---

### P3: [Story Title]

**User Story**: As a [role], I want [capability] so that [benefit].

**Why P3**: [Why this is nice-to-have]

**Acceptance Criteria**:

1. WHEN [event] THEN system SHALL [behavior]

---

## Edge Cases

- WHEN [boundary condition] THEN system SHALL [behavior]
- WHEN [error scenario] THEN system SHALL [graceful handling]
- WHEN [unexpected input] THEN system SHALL [validation response]

---

## Must-Nots (world-level prohibitions)

What must NEVER happen, regardless of path. Each requires a negative test asserting the prohibited outcome does not occur (see validate.md §6b).

| ID           | WHEN [context] THEN system SHALL NOT… | Prevents            | Owning task        | Negative test          |
| ------------ | ------------------------------------- | ------------------- | ------------------ | ---------------------- |
| [FEAT]-MN-01 | [prohibited outcome]                  | [concrete bad outcome] | (filled at Tasks) | (filled at Tasks/Execute) |

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story       | Phase  | Status  |
| -------------- | ----------- | ------ | ------- |
| [FEAT]-01      | P1: [Story] | Design | Pending |
| [FEAT]-02      | P1: [Story] | Design | Pending |
| [FEAT]-03      | P2: [Story] | -      | Pending |

**ID format:** `[CATEGORY]-[NUMBER]` (e.g., `AUTH-01`, `CART-03`, `NOTIF-02`); must-nots use `[CATEGORY]-MN-[NUMBER]` and appear in this table like any requirement. 💠 When an upstream artifact provides IDs, those upstream IDs are canonical here — do not mint parallel ones.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** X total, Y mapped to tasks, Z unmapped ⚠️

---

## Success Criteria

How we know the feature is successful:

- [ ] [Measurable outcome - e.g., "User can complete X in < 2 minutes"]
- [ ] [Measurable outcome - e.g., "Zero errors in Y scenario"]
```

---

## Tips

- **P1 = Vertical Slice** — A complete, demo-able feature, not just backend or frontend
- **WHEN/THEN is code** — If you can't write it as a test, rewrite it
- **Requirement IDs are mandatory** — Every story maps to trackable IDs
- **Edge cases matter** — What breaks? What's empty? What's huge?
- **Out of Scope prevents creep** — If it's not here, it doesn't get built
- 💠 **Must-nots need a negative test** — a prohibition without a test asserting the prohibited outcome doesn't occur is a wish, not a requirement
- 💠 **Upstream IDs are canonical** — adapting an existing PRD/ticket? Index it, reuse its IDs, translate prohibitions and open points; never restate
- **Closure gate before confirm** — Three checks: unambiguity + precision, open-questions/assumptions closure, declined gray areas logged; scope-tiered; bounded to stated dimensions; never invents requirements
- **Confirm after the gate passes** — Present the spec for user confirmation only after the closure gate passes (no unresolved-and-unmarked items remain); user approves spec before moving to discuss phase
