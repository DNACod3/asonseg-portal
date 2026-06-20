---
name: idsd-spec-driven
description: IDSD/ICE-aware execution tail for the per-US dev pipeline — the downstream consumer that po-bravi-idsd and architecture-planning-idsd hand off to. 4 adaptive phases (Specify, Design, Tasks, Execute), but in ICE mode Specify and Design are THIN ADAPTERS that resolve to existing ICE artifacts (intent/expectations as spec; technical-design + ADRs + runbooks as design) instead of re-deriving them — the connection matrix card is the single entry point. Adds the layer ICE lacks: atomic tasks with verification, an entry-gate that STOPS blocked USPs, skill-tdad as the test producer, atomic git commits, requirement traceability keyed on ICE IDs (E-NNN/P-NNN), and persistent memory. Use when (1) Starting new projects, (2) Mapping existing codebases, (3) Planning features (requirements, design, task breakdown), (4) Implementing with verification and atomic commits, (5) Quick ad-hoc tasks, (6) Tracking decisions/blockers/deferred ideas, (7) Pausing/resuming work. Triggers on "implementar a US-NNN", "implement task", "specify feature", "design", "tasks", "validate", "verify work", "UAT", "quick fix", "pause work", "resume work", "initialize project", "map codebase". Do NOT use for architecture decomposition (use architecture-planning-idsd) or technical design docs (use create-technical-design-doc) — this skill CONSUMES those, it does not produce them.
license: CC-BY-4.0
metadata:
  author: cfassula
  version: 2.1.0-idsd
  derivedFrom: bravi-spec-driven@2.0.0
---

# IDSD - Spec-Driven Development (execution tail of the ICE pipeline)

Plan and implement projects with precision. Granular tasks. Clear dependencies. Right tools. Zero ceremony.

> **This is the IDSD-adapted variant of `bravi-spec-driven`.** It is the *execution tail* the IDSD method
> names but never materialized: it begins where `architecture-planning-idsd` stops — at the **card of a USP
> in the connection matrix** (`docs/prd/matriz-conexoes.md`) — and carries it through atomic tasks → tests →
> atomic commit. In **ICE mode** (a project that already has intent/expectations + technical-design + ADRs +
> runbooks), it does **not** re-derive requirements or architecture: it RESOLVES the card's pointers. The
> stack-agnostic generative behavior of the original survives only for greenfield projects with no ICE layer.

## ICE Mode vs. Greenfield Mode — the master switch

Before anything, detect the mode:

| Signal | Mode | What changes |
|---|---|---|
| Repo has `docs/prd/matriz-conexoes.md` + `intents/` + `expectations/` + `docs/architecture/technical-design.md` | **ICE mode** | Specify/Design become ADAPTERS (resolve, never re-generate). The matrix card is the single entry point. Requirement IDs ARE the ICE IDs (E-NNN/P-NNN/AC-NNN-N). Tests come from `skill-tdad`. An **entry gate** precedes task breakdown. |
| No ICE layer (plain greenfield/brownfield) | **Greenfield mode** | Original `bravi-spec-driven` behavior: Specify/Design generate from scratch. |

Everything below applies to both modes; **ICE-mode deltas are flagged with 🧬**.

```
┌──────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐
│ SPECIFY  │ → │  DESIGN  │ → │  TASKS  │ → │ EXECUTE │
└──────────┘   └──────────┘   └─────────┘   └─────────┘
   required      optional*      optional*     required

* Agent auto-skips when scope doesn't need it
```

## Auto-Sizing: The Core Principle

**The complexity determines the depth, not a fixed pipeline.** Before starting any feature, assess its scope and apply only what's needed:

| Scope       | What                     | Specify                                                 | Design                                          | Tasks                         | Execute                                               |
| ----------- | ------------------------ | ------------------------------------------------------- | ----------------------------------------------- | ----------------------------- | ----------------------------------------------------- |
| **Small**   | ≤3 files, one sentence   | **Quick mode** — skip pipeline entirely                 | -                                               | -                             | -                                                     |
| **Medium**  | Clear feature, <10 tasks | Spec (brief)                                            | Skip — design inline                            | Skip — tasks implicit         | Implement + verify                                    |
| **Large**   | Multi-component feature  | Full spec + requirement IDs                             | Architecture + components                       | Full breakdown + dependencies | Implement + verify per task                           |
| **Complex** | Ambiguity, new domain    | Full spec + [discuss gray areas](references/discuss.md) | [Research](references/design.md) + architecture | Breakdown + parallel plan     | Implement + [interactive UAT](references/validate.md) |

**Rules:**

- **Specify and Execute are always required** — you always need to know WHAT and DO it
- **Design is skipped** when the change is straightforward (no architectural decisions, no new patterns)
- **Tasks is skipped** when there are ≤3 obvious steps (they become implicit in Execute)
- **Discuss is triggered within Specify** only when the agent detects ambiguous gray areas that need user input
- **Interactive UAT is triggered within Execute** only for user-facing features with complex behavior
- **Quick mode** is the express lane — for bug fixes, config changes, and small tweaks

**🧬 ICE-mode sizing floor (hard rule, not auto-sized):** A USP is classified **Large at minimum** (Tasks + Design-adapter mandatory, never Quick/Medium) when ANY of these holds — read from the matrix card:

- The USP is **ICED** (has an `intent-US-NNN.md` + `expectations-US-NNN.md`), OR
- It carries a **must-not** (`P-NNN` with `eval(−)` anchored to a failure-of-outcome `F-X`), OR
- It is **foundational** in the premise ledger (its fall propagates a blast radius — e.g. US-018).

Rationale: these are exactly the USPs where the 3 pre-approval checks and commit-per-task matter most; auto-sizing must never demote them. The agent does NOT get to choose Small/Medium for an ICED/must-not/foundational USP.

**Safety valve:** Even when Tasks is skipped, Execute ALWAYS starts by listing atomic steps inline (see [implement.md](references/implement.md)). If that listing reveals >5 steps or complex dependencies, STOP and create a formal `tasks.md` — the Tasks phase was wrongly skipped.

## Project Structure

```
.specs/
├── project/
│   ├── PROJECT.md      # Vision & goals
│   ├── ROADMAP.md      # Features & milestones
│   └── STATE.md        # Memory: decisions, blockers, lessons, todos, deferred ideas
├── codebase/           # Brownfield analysis (existing projects)
│   ├── STACK.md
│   ├── ARCHITECTURE.md
│   ├── CONVENTIONS.md
│   ├── STRUCTURE.md
│   ├── TESTING.md
│   ├── INTEGRATIONS.md
│   └── CONCERNS.md
├── features/           # Feature specifications
│   └── [feature]/
│       ├── spec.md     # Requirements with traceable IDs
│       ├── context.md  # User decisions for gray areas (only when discuss is triggered)
│       ├── design.md   # Architecture & components (only for Large/Complex)
│       └── tasks.md    # Atomic tasks with verification (only for Large/Complex)
└── quick/              # Ad-hoc tasks (quick mode)
    └── NNN-slug/
        ├── TASK.md
        └── SUMMARY.md
```

## Workflow

**New project:**

1. Initialize project → PROJECT.md + ROADMAP.md
2. For each feature → Specify → (Design) → (Tasks) → Execute (depth auto-sized)

**Existing codebase:**

1. Map codebase → 7 brownfield docs
2. Initialize project → PROJECT.md + ROADMAP.md
3. For each feature → same adaptive workflow

**Quick mode:** Describe → Implement → Verify → Commit (for ≤3 files, one-sentence scope)

## Context Loading Strategy

**Base load (~15k tokens):**

- PROJECT.md (if exists)
- ROADMAP.md (when planning/working on features)
- STATE.md (persistent memory)

**On-demand load:**

- Codebase docs (when working in existing project)
- CONCERNS.md (when planning features that touch flagged areas, estimating risk, or modifying fragile components)
- TESTING.md (when creating tasks or executing — drives test type assignment and gate checks)
- spec.md (when working on specific feature)
- context.md (when designing or implementing from user decisions)
- design.md (when implementing from design)
- tasks.md (when executing tasks)

**Never load simultaneously:**

- Multiple feature specs
- Multiple architecture docs
- Archived documents

**Target:** <40k tokens total context
**Reserve:** 160k+ tokens for work, reasoning, outputs
**Monitoring:** Display status when >40k (see [context-limits.md](references/context-limits.md))

## Sub-Agent Delegation

Use sub-agents (the Task tool or equivalent) to keep the main context window lean and enable
parallel execution. The orchestrating agent plans and coordinates; sub-agents do the heavy lifting.

**When to delegate to a sub-agent:**

| Activity | Delegate? | Why |
|---|---|---|
| Research (design phase, brownfield mapping) | Yes | Research output is large; only the summary matters to the main context |
| Implementing a task | Yes | File reads, edits, test output consume context; only the result matters |
| Parallel `[P]` tasks | Yes (one per task) | The only way to actually run tasks in parallel |
| Sequential tasks with no `[P]` | Yes | Keeps implementation artifacts out of the main context |
| Planning, task creation, validation reports | No | These require the full accumulated context to be coherent |
| Quick mode tasks | No | Too small to justify the overhead |

**Context each sub-agent receives:**

The orchestrating agent MUST provide each sub-agent with:
- The specific task definition from tasks.md (What, Where, Depends on, Reuses, Done when, Tests, Gate)
- Relevant coding principles and conventions (coding-principles.md, CONVENTIONS.md)
- TESTING.md, if it exists (for gate check commands and test patterns)
- Any spec/design context the task references

The sub-agent does NOT receive: other tasks' definitions, accumulated chat history, validation reports
from other tasks, or STATE.md (unless the task explicitly references a decision/blocker).

**🧬 ICE mode — pre-resolve the pointers into the task.** The sub-agent does NOT receive the matrix card,
the matrix, or STATE.md. Therefore the **Tasks phase must resolve the card's pointers and embed the actual
fragments into each task definition** before delegating: the relevant TD §4.4/§4.5/§4.6 excerpt, the exact
runbook steps, the ADR constraint, and the `skill-tdad` test path. A task that says only "see TD §4.5" leaves
the executor blind. Resolve, copy the fragment in, then delegate.

**What sub-agents return:**

Each sub-agent reports back:
- Status: Complete | Blocked | Partial
- Files changed: [list]
- Gate check result: [pass/fail + test counts]
- SPEC_DEVIATION markers (if any)
- Issues encountered (if any)

The orchestrating agent uses this to update tasks.md status, traceability, and decide next steps.

## Commands

**Project-level:**
| Trigger Pattern | Reference |
|----------------|-----------|
| Initialize project, setup project | [project-init.md](references/project-init.md) |
| Create roadmap, plan features | [roadmap.md](references/roadmap.md) |
| Map codebase, analyze existing code | [brownfield-mapping.md](references/brownfield-mapping.md) |
| Document concerns, find tech debt, what's risky | [concerns.md](references/concerns.md) |
| Record decision, log blocker, add todo | [state-management.md](references/state-management.md) |
| Pause work, end session | [session-handoff.md](references/session-handoff.md) |
| Resume work, continue | [session-handoff.md](references/session-handoff.md) |

**Feature-level (auto-sized):**
| Trigger Pattern | Reference |
|----------------|-----------|
| Specify feature, define requirements | [specify.md](references/specify.md) |
| Discuss feature, capture context, how should this work | [discuss.md](references/discuss.md) |
| Design feature, architecture | [design.md](references/design.md) |
| Break into tasks, create tasks | [tasks.md](references/tasks.md) |
| Implement task, build, execute | [implement.md](references/implement.md) |
| Validate, verify, test, UAT, walk me through it | [validate.md](references/validate.md) |
| Quick fix, quick task, small change, bug fix | [quick-mode.md](references/quick-mode.md) |

## Skill Integrations

This skill coexists with other skills. Before specific tasks, check if complementary skills are installed and prefer them when available.

### 🧬 ICE entry → connection matrix (the SINGLE entry point)

**This is an enforcement hook, not a suggestion.** In ICE mode, the ONLY legal entry for "implement the US-NNN" is the **card of that USP in `docs/prd/matriz-conexoes.md`**. The skill MUST:

1. Read the card (~6 lines) **first**, before Specify/Design.
2. Resolve the card's pointers — Schemas→TD §4.5, Endpoints→TD §4.4, Eventos→TD §4.6, ADRs técnicos, Runbooks, Fase, Q-abertas/gate.
3. **Never generate a requirement, contract, schema, or behavior the card does not point to.** Anything not reachable from the card does not enter. This is the anti-fabrication rule of [coding-principles.md](references/coding-principles.md) applied at the door.

If there is no matrix or no card for the USP → you are NOT in ICE mode for this USP; fall back to greenfield Specify (and flag that the USP lacks an ICE layer).

### 🧬 Tests → skill-tdad (the test producer)

In ICE mode the agent does **NOT** invent the `Tests` field of a task and does **NOT** write the RED tests itself in Execute. The producer is **`skill-tdad`**: from each `eval(+)/eval(−)` and must-not in `expectations-US-NNN.md` it generates `.feature` (PT-BR, tag `@ac-NNN-N`) + Vitest RED specs (+ Playwright E2E for top flows) and returns the **target paths**. The Tasks phase populates each task's `Tests` field with those paths. See [tasks.md](references/tasks.md) §1.5 and the slicing rule (one `.feature` per US → cenários por AC → tasks por AC). This removes the native "Execute writes its own tests" step in ICE mode — there is one test producer, not two.

### Diagrams → mermaid-studio

Whenever the workflow requires creating or updating a diagram (architecture overviews, data flows, component diagrams, sequence diagrams, etc.), **always** check if the `mermaid-studio` skill is installed in the user's environment before proceeding. If it is installed, delegate all diagram creation and rendering to it. If it is not installed, proceed with inline mermaid code blocks as usual and recommend the user install `mermaid-studio` for richer diagram capabilities (rendering to SVG/PNG, validation, theming, etc.). Display this recommendation at most once per session.

### Code Exploration → codenavi

Whenever the workflow requires exploring or discovering things in an existing repository (brownfield mapping, code reuse analysis, pattern identification, dependency tracing, etc.), **always** check if the `codenavi` skill is installed in the user's environment before proceeding. If it is installed, delegate code exploration and navigation tasks to it. If it is not installed, fall back to the built-in code analysis tools (see [code-analysis.md](references/code-analysis.md)) and recommend the user install `codenavi` for more effective codebase exploration. Display this recommendation at most once per session.

## Knowledge Verification Chain

When researching, designing, or making any technical decision, follow this chain in strict order. Never skip steps.

```
Step 0 (🧬 ICE only): Connection matrix card of the USP → resolve to ICE artifacts.
        The card is the single door. It maps to:
          • intent-US-NNN.md + expectations-US-NNN.md  → the SPEC (do not re-derive)
          • technical-design §4.4/§4.5/§4.6 + ADRs 0008..  → the DESIGN (do not re-derive)
          • runbooks/                                       → the recipes (Done-when checklist)
        NEVER generate a requirement or contract the card does not point to. The card bounds the work.
Step 1: Codebase → check existing code, conventions, and patterns already in use
Step 2: Project docs → README, docs/, inline comments, .specs/codebase/
Step 3: Context7 MCP → resolve library ID, then query for current API/patterns
Step 4: Web search → official docs, reputable sources, community patterns
Step 5: Flag as uncertain → "I'm not certain about X — here's my reasoning, but verify"
```

**Rules:**

- **🧬 In ICE mode, Step 0 is mandatory and precedes everything.** If the card does not point to it, it does not exist for this USP — re-deriving requirement/contract from scratch is the fabrication anti-pattern, even when it looks plausible.
- Never skip to Step 5 if Steps 1-4 are available
- Step 5 is ALWAYS flagged as uncertain — never presented as fact
- **NEVER assume or fabricate.** If you cannot find an answer, say "I don't know" or "I couldn't find documentation for this". Inventing APIs, patterns, or behaviors causes cascading failures across design → tasks → implementation. Uncertainty is always preferable to fabrication.

## Output Behavior

**Model guidance:** After completing lightweight tasks (validation, state updates, session handoff), naturally mention once that such tasks work well with faster/cheaper models. Track in STATE.md under `Preferences` to avoid repeating. For heavy tasks (brownfield mapping, complex design), briefly note the reasoning requirements before starting.

Be conversational, not robotic. Don't interrupt workflow—add as a natural closing note. Skip if user seems experienced or has already acknowledged the tip.

## Code Analysis

Use available tools with graceful degradation. See [code-analysis.md](references/code-analysis.md).
