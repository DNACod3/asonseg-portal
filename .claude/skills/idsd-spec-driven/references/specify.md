# Specify

**Goal**: Capture WHAT to build with testable, traceable requirements.

If the feature has ambiguous gray areas (multiple valid approaches for user-facing behavior), the agent will automatically trigger the [discuss gray areas](discuss.md) process within this phase. For clear, well-defined features, it goes straight to the next phase.

## 🧬 ICE Mode: adapt, do NOT re-derive requirements

When the USP already has an ICE layer (`intent-US-NNN.md` + `expectations-US-NNN.md`), the requirements **already exist** as EARS + eval stubs. Do **not** run the generative interview below — it would fork a second source of truth. Instead, produce a **thin `spec.md` stub** (~10 lines) that:

1. **Points to** `intent-US-NNN.md` (the WHAT/why + failures-of-outcome `F-X`) and `expectations-US-NNN.md` (must-do `E-NNN` with `eval(+)`, must-not `P-NNN` with `eval(−)`, the owner's definition-of-done) as the **source of truth**.
2. **Reuses the ICE IDs as the canonical Requirement IDs** — `E-NNN`, `P-NNN`, `AC-NNN-N`. **Never mint a parallel `[CATEGORY]-NN`** — that breaks traceability between intent/expectations and `tasks.md`/`validate.md`.
3. **Translates each must-not `P-NNN` into a negative AC + an Edge Case, preserving the `F-X` anchor.** `spec.md` has no native field for a failure-of-outcome (world-level prohibition); its only home is `Edge Cases` (WHEN/THEN) + a negative acceptance clause. If you skip this, the must-not — the **highest-value item in the ICE layer** — is lost before it can become a fact. This is the most dangerous translation gap; do it explicitly.

**Stub shape:**

```markdown
# US-NNN Specification (ICE adapter — source of truth is intent + expectations)

> SOURCE OF TRUTH: docs/prd/intents/intent-US-NNN.md + docs/prd/expectations/expectations-US-NNN.md
> This file does not re-derive requirements. It indexes the ICE IDs and surfaces the must-not as negative ACs.

## Requirement IDs (canonical = ICE IDs)
| ID | Type | From | Fact (skill-tdad) |
| E-001 | must-do  | expectations §must-do | <path or "pending"> |
| P-001 | must-not | expectations §must-not (anchored to F-X) | <negative fact path> |

## Negative ACs (must-not → world-level prohibition)
- P-001 (F-X): WHEN <…> THEN system SHALL NOT <failure-of-outcome>. eval(−): <stub>.

## Edge Cases
- <from expectations / intent ❓ resolved>
```

**13 PRD-only USPs (no intent/expectations):** these have a thinner card. Generate EARS ACs **from the PRD** (`docs/prd/prd.pdf`, once anchored — see project note), **not from a blank interview**, then hand them to `skill-tdad`. Accept by design that they carry **no must-not** (only happy-path EARS) — a lower guarantee level inherited from the IDSD analysis (single owner, low risk). Do not fake parity with the 5 ICE USPs.

If there is no ICE layer and no PRD, fall back to the generative Process below.

## Process

### 1. Clarify Requirements

You are a thinking partner, not an interviewer. Start open — let the user dump their mental model. Follow the energy: whatever they emphasize, dig into that.

Ask conversationally (not as a checklist):

- "What problem are you solving?"
- "Who is the user and what's their pain?"
- "What does success look like?"

If needed:

- "What are the constraints (time, tech, resources)?"
- "What is explicitly out of scope?"

**Challenge vagueness.** Never accept fuzzy answers. "Good" means what? "Users" means who? "Simple" means how? Make the abstract concrete: "Walk me through using this." "What does that actually look like?"

**Know when to stop.** When you understand what they're building, why, who it's for, and what done looks like — offer to proceed.

### 2. Capture User Stories with Priorities

**P1 = MVP** (must ship), **P2** (should have), **P3** (nice to have)

Each story MUST be **independently testable** - you can implement and demo just that story.

### 3. Write Acceptance Criteria

Use **WHEN/THEN/SHALL** format - it's precise and testable:

- WHEN [event/action] THEN [system] SHALL [response/behavior]

---

## Template: `.specs/[feature]/spec.md`

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

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story       | Phase  | Status  |
| -------------- | ----------- | ------ | ------- |
| [FEAT]-01      | P1: [Story] | Design | Pending |
| [FEAT]-02      | P1: [Story] | Design | Pending |
| [FEAT]-03      | P2: [Story] | -      | Pending |

**ID format:** `[CATEGORY]-[NUMBER]` (e.g., `AUTH-01`, `CART-03`, `NOTIF-02`)

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
- **Confirm before Discuss** — User must approve spec before moving to discuss phase
