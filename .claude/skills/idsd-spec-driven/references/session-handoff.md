# Session Handoff

## Pause Work

**Trigger:** "Pause work", "End session", "Create handoff"

**Purpose:** Checkpoint current state for resumption.

**Output:** `.specs/HANDOFF.md` (overwrites previous)

**Size target:** ~500 tokens

**Structure:**

```markdown
# Handoff

**Date:** [ISO timestamp]
**Feature:** [feature name]
**Task:** [task identifier] - [brief status]

## Completed ✓

- [Completed work item]
- [Completed work item]

## In Progress

- [Current work] ([percentage or status])
- Specific location: [file:line if applicable]

## Pending

- [Next immediate step]
- [Following step]

## Blockers

- [Blocker description] - [impact]

## Context

- Branch: [git branch if applicable]
- Uncommitted: [files with changes]
- Related decisions: [STATE.md references if applicable]
```

**Instructions:**

- Focus on actionable information for resumption
- Include specific file/line references where relevant
- Note uncommitted changes explicitly
- Reference related STATE.md entries if applicable

## Resume Work

**Trigger:** "Resume work", "Continue", "Load handoff"

**Process:**

1. Load HANDOFF.md
2. Load STATE.md for context
3. Summarize current position
4. Propose next action

**Response pattern:**

- "Resuming [feature] at [task]"
- "Completed: [summary]"
- "Next: [immediate action]"
- "Continue with [specific step]?"

## 🧬 Close Project — Promote to `bravi-architecture-catalog` (cross-project memory)

**Trigger:** "Close project", "Project done", "Wrap up"

This is a **terminal step the IDSD method records as method debt** (`architecture-document` §10, guia §11): without it, each greenfield Bravi project restarts from zero and STATE.md "Lessons Learned" dies with the repo. On project close:

1. Identify the **generic, reusable** artifacts produced here — runbooks (e.g. `runbook-audit-log`, `runbook-estorno-soft-state`, `runbook-transacao-atomica`, `runbook-relatorio-pdf`), generic technical ADRs, and STATE.md `L-NNN` lessons.
2. Strip project-specific detail; promote each as a **proto-play** to `bravi-architecture-catalog` (the cross-project catalog). If the catalog does not exist yet, create it and seed it with these.
3. Record in STATE.md which artifacts were promoted, so the debt is visibly paid.

The catalog is what lets the next project's `architecture-planning-idsd` reuse calibrated decisions instead of guesswork.
