---
name: spec-driven-execution
description: >-
  Orchestrate feature work in the ASONSEG Portal (Next.js 15 monolito modular)
  by dispatching Planner, Implementer, and Verifier sub-agents through the
  idsd-spec-driven pipeline. The orchestrator picks the ROADMAP phase, cleans
  env, sequences sub-agents, and handles PASS/FAIL — it does not plan,
  implement, or verify itself. Use for "build the next phase", "implement this
  feature", "advance the roadmap", "/loop".
---

# Spec-Driven Execution

**Driver only.** All planning, task format, implementation rules, and validation
live in `idsd-spec-driven`. This skill does not duplicate them.

## What this repo adds

| Delta                   | Meaning                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sub-agent roles**     | Planner → Implementer → Verifier, dispatched by sub-agent type. **Planner** = `planner` agent (Opus 4.8, effort `xhigh`); **Implementer** = `implementer` and **Verifier** = `verifier` agents (both Sonnet 5, effort `high`). Model + effort live in each agent's frontmatter (`.claude/agents/<role>.md`), not in this table. Orchestrator sequences them; never writes spec/code/tests. |
| **Single Implementer**  | One sub-agent runs every task in `tasks.md`. Skip per-phase worker offer.                                                                           |
| **Auto-commit in flow** | Implementer may commit per task without asking (only while this flow is active). Conventional Commits with module scopes.                                 |
| **ROADMAP loop**        | Autonomous mode walks `.specs/project/ROADMAP.md` one unchecked **unit** at a time. Phases are epics; the executable unit is a single **USP** line under a phase. The loop reads, dispatches, and flips exactly one USP per pass.                 |

## ROADMAP contract

The loop is driven entirely by `.specs/project/ROADMAP.md`. Every executable unit
is one USP line and MUST carry the fields the orchestrator needs — no lookups
elsewhere except STATE.md for blockers:

```
- [ ] USP-001 — Auto-cadastro · epic: identity-acesso-papeis · dir: .specs/features/identity-acesso-papeis/usp-001-auto-cadastro/ · deps: — · gate: —
```

| Field       | Purpose                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `- [ ]`/`[x]` | Progress marker. The **only** thing the orchestrator flips (unchecked → checked on Verifier PASS). |
| `USP-NNN`   | Stable key. Ties the unit to the board, to STATE `AD-NNN`/`B-NNN`, and to traceability IDs.      |
| title       | Short goal of the USP.                                                                           |
| `epic:`     | Epic slug (the parent folder under `.specs/features/`).                                          |
| `dir:`      | Output dir the Planner writes and the Implementer/Verifier read.                                 |
| `deps:`     | USP ids that must be `[x]` first. If any dep is unchecked, the unit is **not eligible** — skip.  |
| `gate:`     | STATE `B-NNN` blocker ref, or `—`. If the referenced blocker is **active** in STATE, the unit **STOPS**. |

Units run **top-to-bottom** within a phase, phases in order. The next eligible
unit is the first unchecked line whose `deps` are all `[x]` and whose `gate` is
clear. Reconcile checkbox state with reality before the first run (merged PRs /
STATE decisions → `[x]`), or the loop re-does finished work.

## Orchestrator flow

1. Pick the next eligible **unit** — first unchecked USP line in `.specs/project/ROADMAP.md` whose `deps` are all `[x]` and `gate` is clear (or loop payload). Resume in-flight work from `.specs/project/STATE.md` `## Handoff` (created on the first run) before picking a new unit. A unit whose `gate` names an **active** `B-NNN` in `## Active Blockers` STOPS — do not dispatch it.
2. Clean env — free port **3000** (Next.js dev) before gates; ensure the Supabase local stack is up (`supabase status`; API :55321, DB :55322).
3. Dispatch **Planner** sub-agent (`subagent_type: planner`).
4. Dispatch **Implementer** sub-agent (`subagent_type: implementer`) — only after Planner artifacts exist under `.specs/features/<epic>/<usp-slug>/`.
5. Dispatch **Verifier** sub-agent (`subagent_type: verifier`) — always; orchestrator handles fix→re-verify ≤3 iterations.
6. On Verifier **PASS** — flip the USP line to `[x]`, update `STATE.md` `## Handoff` (next unit) and record any decision as `AD-NNN`, commit `docs: marca USP-NNN concluída no ROADMAP e STATE`.

## Sub-agent prompts

Sub-agents cannot see this chat. Each prompt is self-contained:

1. **Activate** `bravi-spec-driven` **by name** and follow it for the assigned role (Specify/Design/Tasks, Execute, or Validate). If the skill cannot be activated, STOP.
2. **Feature context** — ROADMAP phase title + goal, epic + USP slug, output dir `.specs/features/<epic>/<usp-slug>/`, repo path `/Users/cfassula/projetos/asonseg/portal`.
3. **Autonomous mode** (loop / unattended) — resolve ambiguities as spec assumptions; no user confirmation gates.
4. **Project glue** (below) — repo inputs the skill does not know about.
5. **Role footnotes only:**

- _Implementer:_ paths to existing `spec.md` / `design.md` / `tasks.md`; authorized to commit per task; do **not** run Verifier.
- _Verifier:_ git diff/commit range for the feature; Implementer deviation summary if any.

Do not paste idsd-spec-driven templates, reference filenames, or quality rules into the prompt — the skill owns that.

## Project glue

Append to every sub-agent prompt. Point at repo docs; do not restate their contents.

- `.specs/project/ROADMAP.md` — phase scope and dependencies
- `.specs/project/STATE.md` — `## Recent Decisions` (`AD-NNN`), `## Active Blockers` (`B-NNN`), `## Handoff` (in-flight unit; created on first run)
- `.specs/project/PROJECT.md` — project baseline
- `CLAUDE.md` + `docs/arch/project-guideline.md` — conventions, patterns, and the testing contract (DoD)
