# State Management

**Purpose:** Persistent memory across sessions - decisions, blockers, learnings.

## Structure

**Output:** `.specs/project/STATE.md`

```markdown
# State

**Last Updated:** [ISO timestamp]
**Current Work:** [Feature name] - [Task identifier]

---

## Recent Decisions (Last 60 days)

### AD-[NNN]: [Decision title] ([date])

**Decision:** [What was decided]
**Reason:** [Why this choice]
**Trade-off:** [What was sacrificed]
**Impact:** [How this affects implementation]

### AD-[NNN]: [Decision title] ([date])

[Same structure]

---

## Active Blockers

### B-[NNN]: [Blocker description]

**Discovered:** [Date]
**Impact:** [Severity and scope]
**Workaround:** [Temporary solution if available]
**Resolution:** [Path to permanent fix]
**🧬 Ledger pointer:** [PR-NNN / D-NNN in docs/prd/matriz-conexoes.md — REQUIRED in ICE mode]

> **🧬 ICE mode — the matrix is the single source of truth for blocker/premise status.** STATE.md does **not** own blocker status; it **mirrors by pointer**. Every `B-NNN` that reflects an ICE blocker (e.g. D-005, F3, D-006) or an open premise (e.g. PR-001) MUST carry the `PR-NNN`/`D-NNN` pointer above. The canonical status lives in the ledger (`matriz-conexoes.md` §2) and the cards (§4). The Entry Gate (tasks.md §0) reads the **matrix**, not STATE.md.
>
> **Write-back is mandatory.** When a gate clears (e.g. D-005 ratifies ADR-0013), the orchestrator flips the **card** `ABERTO → RESOLVIDO` in the matrix BEFORE admitting the USP, then updates the mirror here. Never let STATE.md say "resolved" while the matrix still says "ABERTO" — the matrix wins, and the matrix is updated first.

---

## Lessons Learned

### L-[NNN]: [Learning description]

**Context:** [Situation that occurred]
**Problem:** [What went wrong]
**Solution:** [How it was resolved]
**Prevents:** [What this knowledge prevents in future]

---

## Quick Tasks Completed

| #   | Description              | Date   | Commit | Status  |
| --- | ------------------------ | ------ | ------ | ------- |
| 001 | [Quick task description] | [date] | [hash] | ✅ Done |

---

## Deferred Ideas

Ideas captured during work that belong in future features or phases. Prevents scope creep while preserving good ideas.

- [ ] [Idea description] — Captured during: [feature/phase]
- [ ] [Idea description] — Captured during: [feature/phase]

---

## Todos

Capture in-progress thoughts and action items that don't fit in active tasks.

- [ ] [TODO: action item]
- [ ] [TODO: action item]
```

## When to Update

| Event                            | Action                                 |
| -------------------------------- | -------------------------------------- |
| Significant architectural choice | Add AD-[NNN]                           |
| Implementation blocked           | Add B-[NNN]                            |
| Important discovery/learning     | Add L-[NNN]                            |
| Quick task completed             | Add row to Quick Tasks table           |
| Scope creep captured             | Add to Deferred Ideas                  |
| In-progress thought              | Add to Todos                           |
| Session end                      | Update "Last Updated" + "Current Work" |

## 🧬 ICE mode — reconcile with the task board (openwolf-task-protocol)

If `openwolf-task-protocol` governs a GitHub Project board for this project, **decide one source of USP/task status** — do not let the board and the matrix drift into a fourth map. The board's *sibling-unblock cascade* and the ledger's *blast-radius* are the **same concept** (a premise falls → downstream USPs (un)block) in two systems. Rule of thumb: the **matrix ledger** owns premise/gate truth; the board owns time/Status(In Progress)/Spent. When a gate flips in the matrix, propagate the unblock to the board (and vice-versa) explicitly — never silently.

## Size Management (Hybrid Strategy)

**Zones:**

- 🟢 <7k tokens: No action
- 🟡 7-10k tokens: Footer note "STATE.md at [X]k. Cleanup recommended."
- 🔴 >10k tokens: Active prompt "STATE.md critical ([X]k). Cleanup now?"

**Cleanup process:**

- Move decisions >60 days to STATE-ARCHIVE.md
- Keep only active blockers
- Preserve recent learnings (<60 days)

**Validation:**

- Decisions have clear rationale?
- Blockers include resolution path?
- Learnings are actionable?

---

## Preferences

Track user-facing behavioral state in STATE.md:

```markdown
## Preferences

**Model Guidance Shown:** [ISO date or "never"]
```

**Update when:**

| Event                       | Action                   |
| --------------------------- | ------------------------ |
| First model tip given       | Set date                 |
| User acknowledges/dismisses | Keep date (don't repeat) |

This prevents repetitive suggestions while maintaining natural, helpful behavior.
