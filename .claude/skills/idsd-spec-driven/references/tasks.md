# Tasks

**Goal**: Break into GRANULAR, ATOMIC tasks. Clear dependencies. Right tools. Parallel execution plan.

**Skip this phase when:** There are ≤3 obvious steps. In that case, tasks are implicit — go straight to Execute and list them inline in your implementation plan.

## Why Granular Tasks?

| Vague Task (BAD) | Granular Tasks (GOOD)             |
| ---------------- | --------------------------------- |
| "Create form"    | T1: Create email input component  |
|                  | T2: Add email validation function |
|                  | T3: Create submit button          |
|                  | T4: Add form state management     |
|                  | T5: Connect form to API           |
| "Implement auth" | T1: Create login form             |
|                  | T2: Create register form          |
|                  | T3: Add token storage utility     |
|                  | T4: Create auth API service       |
|                  | T5: Add route protection          |

**Benefits of granular:**

- **Agents don't err** - Single focus, no ambiguity
- **Easy to test** - Each task = one verifiable outcome
- **Parallelizable** - Independent tasks run simultaneously
- **Errors isolated** - One failure doesn't block everything

**Rule**: One task = ONE of these:

- One component
- One function
- One API endpoint
- One file change

---

## Process

### 0. 🧬 ICE Entry Gate (MANDATORY, precedes everything)

> **Two different things are called "gate". Keep them apart.**
> - **Entry Gate** (this step): an *authorization to enter dev* read from the matrix card. It blocks the **whole USP** before any task exists.
> - **TestGate** (the `TestGate` field of each task, formerly `Gate`): the *test-runner level* (quick/full/build). It runs per task during Execute.

Before breaking a USP into tasks, read its card in `docs/prd/matriz-conexoes.md` and the premise ledger (matrix §2). **Detect ALL 5 blocking signals:**

1. **Q-aberta(dono)** — an open `❓` owned by the client/PO (e.g. F3/US-011 "definition of active herd"; D-006/US-016 "report layout").
2. **❓(técnico/arquitetural)** — an open technical investigation (e.g. D-005/US-018 ".DBF extractability").
3. **ADR Proposed / `[NECESSITA VALIDAÇÃO]`** — the USP depends on an ADR not yet Accepted (e.g. ADR-0013/US-018).
4. **Pré-condição D-NNN** — an explicit precondition on the card even without a textual Q-aberta (e.g. US-016 precondition D-006).
5. **Premissa PR-NNN ABERTA consumida transitivamente** — a ledger premise in `ABERTO`/`[NECESSITA VALIDAÇÃO]` that this USP consumes directly OR through an upstream USP (e.g. PR-001 → US-018 → US-009/011/013/014/015/016).

**If ANY signal fires → STOP. Do NOT produce `tasks.md`.** Return the structured stop (mirrors guia §8.3):

```
⛔ US-NNN não entra em dev — gate <qual> aberto.
   <ADR Proposed / Q-aberta / pré-condição / premissa> inverificável/bloqueado.
   Não é meu para resolver: <Tech Lead (técnico) | Cliente via PO (dono do intent)>.
   Blast radius (ledger PR-NNN): trava em cascata <USPs downstream>.
```

Then offer only what is safe to advance without the blocked input (see guia §8.4 — e.g. staging tables, LOAD phase, Phases 1–4 with test data). **The dev agent never resolves an entry gate itself** — it is a Tech-Lead investigation or a Client decision, not an implementation choice.

**Write-back:** when a gate is later cleared (guia §8.5 — e.g. D-005 ratifies ADR-0013), the card in the matrix is flipped `ABERTO → RESOLVIDO` **before** the USP is admitted. The matrix (ledger §2 + cards §4) is the **single canonical source** of blocker/premise status; `STATE.md` only mirrors it by pointer (see [state-management.md](state-management.md)).

### 1. Review Design

Read `.specs/[feature]/design.md` before creating tasks. **🧬 In ICE mode** `design.md` is the *adapter* output — the resolved pointers from the card (TD §4.4/§4.5/§4.6 + ADRs + runbooks), not a re-derived architecture. See [design.md](design.md).

### 1.5. Load Test Coverage Matrix

Read `.specs/codebase/TESTING.md` (if it exists) before creating tasks. The Test Coverage Matrix
and Parallelism Assessment drive two critical decisions:

**Co-located tests:** Every task that creates or modifies a code layer with a required test type
MUST include writing/updating those tests in the same task. Tests are NOT separate tasks.

| Task creates...                           | Done When must include...                   |
| ----------------------------------------- | ------------------------------------------- |
| Code layer with "unit" requirement        | Unit test written + quick gate passes       |
| Code layer with "e2e" requirement         | E2E test written + full gate passes         |
| Code layer with "integration" requirement | Integration test written + full gate passes |
| Code layer with "none" requirement        | Gate check at appropriate level             |

**Parallelism flags:** Cross-reference the Parallelism Assessment when marking tasks `[P]`:

- If a task's required test type is marked "Parallel-Safe: No" → strip `[P]` flag
- If a task's required test type is marked "Parallel-Safe: Yes" → `[P]` is allowed
- If a task has no tests → `[P]` depends only on code dependencies

If TESTING.md does not exist (greenfield project), ask the user what test types and commands
the project will use before creating tasks.

**🧬 ICE mode — `TESTING.md` is mandatory and pre-authored, not asked for ad-hoc.** Even greenfield, the project ships a versioned `docs/architecture/TESTING.md` (Test Coverage Matrix + Parallelism Assessment + Gate Check Commands). Read it; do not negotiate gates verbally.

**🧬 ICE mode — the test producer is `skill-tdad`, and the agent does NOT invent the `Tests` field.** For each USP:

1. Run `skill-tdad` over `expectations-US-NNN.md`. It emits, in RED, one `.feature` per US (PT-BR, one `Scenario` per AC tagged `@ac-NNN-N`), the Vitest specs, the Playwright E2E skeletons for top flows, and a traceability map AC→target-path. It returns the **target paths**.
2. **Slicing rule (resolves the co-location tension):** the `.feature` is per-US but tasks are atomic. `skill-tdad` returns paths **keyed by AC**; the Tasks phase maps **each AC → the task that satisfies it**, and that task's `Tests` field = the AC's fact path. So a per-US feature file is sliced across N tasks by AC ownership — every task still carries its own executable tests (no deferral), and there is exactly **one** test producer (not the Execute sub-agent — see [implement.md](implement.md), the native "write tests first" step is suppressed in ICE mode).
3. Each `eval(−)` / must-not `P-NNN` becomes a **negative scenario** (asserts the failure-of-outcome does NOT happen) owned by whichever task could violate it. A must-not with no owning task is a red flag — the decomposition missed a guard.

### 2. Break Into Atomic Tasks

**Task = ONE deliverable**. Examples:

- ✅ "Create UserService interface" (one file, one concept)
- ❌ "Implement user management" (too vague, multiple files)

### 3. Define Dependencies

What MUST be done before this task can start?

### 4. Create Execution Plan

Group tasks into phases. Identify what can run in parallel.

### 5. Validate Before Presenting (MANDATORY)

Before showing tasks to the user, run ALL three pre-approval checks. These are NOT optional — they are gates. If any check fails, restructure the tasks and re-run until all pass.

**Check 1: Task Granularity** — verify each task is atomic (see Granularity Check section).

**Check 2: Diagram-Definition Cross-Check** — verify the execution diagram matches every task's `Depends on` field (see Diagram-Definition Cross-Check section). Build the cross-check table and include it in the output.

**Check 3: Test Co-location Validation** — verify every task's `Tests` field matches the TESTING.md coverage matrix (see Test Co-location Validation section). Build the validation table and include it in the output.

**Output both tables with the tasks** so the user can see the validation results. Any ❌ means you MUST restructure before presenting — do not show failing tasks to the user and ask them to approve.

**🧬 ICE mode — Dev Sênior is in the loop, not optional.** The project model is "Claude per-US, Senior Dev reviews". For any ICED/must-not/foundational USP, the 3 pre-approval tables (Granularity, Diagram-Definition Cross-Check, Test Co-location) go to the **Dev Sênior for human approval BEFORE Execute** — the orchestrator does not self-approve and proceed. After Execute, the same reviewer checks the result against the `project-guideline` checklists (□) and 🚨 rules, using the `pr-review` skill as the materializer (see [validate.md](validate.md)). Human review is mandatory on the 5 ICE USPs (all high-risk); for low-risk PRD-only USPs it may be lighter.

### 6. ASK About MCPs and Skills

**CRITICAL**: Before execution, ask the user:

> "For each task, which tools should I use?"
>
> **Available MCPs**: [list from project or user]
> **Available Skills**: [list from project or user]

---

## Template: `.specs/[feature]/tasks.md`

```markdown
# [Feature] Tasks

**Design**: `.specs/[feature]/design.md`
**Status**: Draft | Approved | In Progress | Done

---

## Execution Plan

### Phase 1: Foundation (Sequential)

Tasks that must be done first, in order.
```

T1 → T2 → T3

```

### Phase 2: Core Implementation (Parallel OK)
After foundation, these can run in parallel.

```

     ┌→ T4 ─┐

T3 ──┼→ T5 ─┼──→ T8
└→ T6 ─┘
T7 ──────→

```

### Phase 3: Integration (Sequential)
Bringing it all together.

```

T8 → T9

---

## Task Breakdown

### T1: [Create X Interface]

**What**: [One sentence: exact deliverable]
**Where**: `src/path/to/file.ts`
**Depends on**: None
**Reuses**: `src/existing/BaseInterface.ts`
**Requirement**: [FEAT]-01

**Tools**:

- MCP: `filesystem` (or NONE)
- Skill: NONE

**Done when**:

- [ ] Interface defined with all methods from design
- [ ] Types exported correctly
- [ ] No TypeScript errors

**Tests**: [unit/e2e/integration/none — from coverage matrix]
**TestGate**: [quick/full/build — from gate check commands]

---

### T2: [Implement Y Service] [P]

**What**: [Exact deliverable]
**Where**: `src/services/YService.ts`
**Depends on**: T1
**Reuses**: `src/services/BaseService.ts` patterns

**Tools**:

- MCP: `filesystem`, `context7`
- Skill: NONE

**Done when**:

- [ ] Implements interface from T1
- [ ] Handles error cases from design
- [ ] Gate check passes: `[quick gate command from TESTING.md]`
- [ ] Test count: [N] tests pass (no silent deletions)

**Tests**: unit
**TestGate**: quick

---

### T3: [Create Z Component] [P]

**What**: [Exact deliverable]
**Where**: `src/components/ZComponent.tsx`
**Depends on**: T1
**Reuses**: `src/components/BaseComponent.tsx`

**Tools**:

- MCP: `filesystem`
- Skill: NONE

**Done when**:

- [ ] Component renders correctly
- [ ] Handles props from interface
- [ ] Follows existing component patterns
- [ ] Gate check passes: `[quick gate command from TESTING.md]`
- [ ] Test count: [N] tests pass (no silent deletions)

**Tests**: unit
**TestGate**: quick

---

### T4: [Add A Feature to Y]

**What**: [Exact deliverable]
**Where**: `src/services/YService.ts` (modify)
**Depends on**: T2, T3
**Reuses**: Existing service patterns

**Tools**:

- MCP: `filesystem`, `github`
- Skill: `api-design`

**Done when**:

- [ ] Feature works per acceptance criteria
- [ ] Gate check passes: `[full gate command from TESTING.md]`
- [ ] Test count: [N] tests pass (no silent deletions)

**Tests**: integration
**TestGate**: full

**Commit**: `feat([scope]): [description]`

---

## Parallel Execution Map

Visual representation of what can run simultaneously:

```

Phase 1 (Sequential):
  T1 ──→ T2 ──→ T3

Phase 2 (Parallel):
  T3 complete, then:
    ├── T4 [P]
    ├── T5 [P]  } Can run simultaneously
    └── T6 [P]

Phase 3 (Sequential):
  T4, T5, T6 complete, then:
    T7 ──→ T8

```

**Parallelism constraint:** A task marked `[P]` must have ALL of these:

- No unfinished dependencies
- Required test type is parallel-safe (per TESTING.md Parallelism Assessment)
- No shared mutable state with other `[P]` tasks in the same phase

If a task's tests are NOT parallel-safe, it MUST run sequentially even if its
implementation code has no dependencies. The test execution is the bottleneck.

**How parallel execution works:**

Tasks marked `[P]` are executed via sub-agents — one sub-agent per task, launched concurrently.
Each sub-agent receives only its task definition and relevant project context (see Sub-Agent
Delegation in SKILL.md). The orchestrating agent waits for all sub-agents in a phase to complete
before advancing to the next phase.

Sequential tasks (no `[P]`) are also delegated to sub-agents, but one at a time. This keeps
implementation artifacts (file reads, test output, gate check logs) out of the main context.

**The orchestrating agent's role during Execute:**
1. Pick the next task(s) to execute
2. Provide each sub-agent with its task definition + context
3. Monitor sub-agent completion
4. Update tasks.md with results
5. Decide whether to proceed, fix, or escalate

---

## Task Granularity Check

Before approving tasks, verify they are granular enough:

| Task                            | Scope         | Status       |
| ------------------------------- | ------------- | ------------ |
| T1: Create email input          | 1 component   | ✅ Granular  |
| T2: Add validation function     | 1 function    | ✅ Granular  |
| T3: Create form with all fields | 5+ components | ❌ Split it! |
| T4: Connect to API              | 1 function    | ✅ Granular  |

**Granularity check**:

- ✅ 1 component / 1 function / 1 endpoint = Good
- ⚠️ 2-3 related things in same file = OK if cohesive
- ❌ Multiple components or files = MUST split

---

## Diagram-Definition Cross-Check

Before approving tasks, verify the execution diagram is consistent with the task definitions. These are independent artifacts that can drift — the diagram is drawn for visual clarity while task bodies are written for precision. Both must agree.

For each task, check:

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T[N] | [deps from body] | [deps from diagram arrows] | ✅ Match or ❌ Mismatch |

**Rules:**

- Every `Depends on` in a task body must have a corresponding arrow in the diagram.
- Every arrow in the diagram must correspond to a `Depends on` in the target task's body.
- Tasks shown as parallel (`[P]`) in the diagram must not depend on each other.
- If a task depends on another task in the same parallel phase, they are NOT parallel — fix the diagram or remove the `[P]` flag.

---

## Test Co-location Validation

Before approving tasks, verify EVERY task's `Tests` field is consistent with the TESTING.md Test Coverage Matrix. This is a hard gate — tasks that fail this check MUST be fixed.

For each task, check: does the task create or modify a code layer that has a required test type in the coverage matrix? If yes, the task's `Tests` field MUST match.

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T[N]: [name] | [layer from coverage matrix] | [test type] | [task's Tests field] | ✅ OK or ❌ VIOLATION |

**Rules:**

- "Tested in another task" is NOT a valid justification for `Tests: none`. That is test deferral — the exact anti-pattern this validation prevents.
- `Tests: none` is only valid when the coverage matrix says "none" for that code layer.
- If a task creates MULTIPLE code layers (e.g., service + controller), use the HIGHEST test type required by any of them.
- Any ❌ VIOLATION → restructure the task to include its required tests before proceeding.

**Resolving compilation dependencies:**

When a task creates code that can't be tested until a later task completes (e.g., a controller that needs module wiring before its e2e tests can run), do NOT defer the tests to a separate task. Instead, restructure:

1. **Merge forward:** Move the untestable task's tests into the earliest task where they become runnable (e.g., the wiring task includes wiring + e2e tests for the controller it enables).
2. **Merge backward:** Absorb the blocking dependency into the current task so it becomes self-testable (e.g., controller task includes its own module registration).

Pick whichever option keeps tasks atomic and cohesive. The goal: no task produces unverified code. If code can't be tested in the task that creates it, the task boundaries are wrong.

---

## Tips

- **[P] = Parallel OK** — Mark tasks that can run simultaneously
- **Reuses = Token saver** — Always reference existing code
- **Tools per task** — MCPs and Skills prevent wrong approaches
- **Dependencies are gates** — Clear what blocks what
- **Done when = Testable** — If you can't verify it, rewrite it
- **Requirement ID = Traceable** — Every task traces back to a spec requirement. **🧬 In ICE mode the Requirement ID IS the ICE ID** (`E-NNN` for must-do, `P-NNN` for must-not, `AC-NNN-N` for acceptance clauses) — never invent a parallel `[CATEGORY]-NN` that would fork traceability away from intent/expectations.
- **One commit per task** — Plan the commit message format in advance

---

## Task Verification Standards

Every task MUST include:

**Done when checklist:**

- Specific, testable outcomes
- Pass/fail criteria
- The specific test command from the Gate Check Commands table
- Expected pass count (prevents silent test deletion)

**Verify section:**

- Commands to prove functionality
- Expected outputs
- Success indicators

**Structure:**

```markdown
### T1: [Task name]

**What:** [Deliverable]
**Where:** [File path]
**Tests**: [unit/e2e/integration/none]
**TestGate**: [quick/full/build]

**Done when:**

- [ ] [Specific outcome]
- [ ] [Specific outcome]
- [ ] Gate check passes: `[command from Gate Check Commands]`
- [ ] Test count: [N] tests pass (no silent deletions)

**Verify:**
[Command to prove it works]
[Expected output/behavior]
```

**Quality check:**

- Can task be verified without human judgment?
- Is success criteria binary (pass/fail)?
- Can verification be automated?
