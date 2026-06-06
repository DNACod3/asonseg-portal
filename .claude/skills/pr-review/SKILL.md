---
name: pr-review
description: Multi-agent PR reviewer for the ASONSEG Portal (Next.js 15 monolito modular). Use ONLY when explicitly asked to review a pull request: "review PR #N", "review this PR", "code review", "check this pull request". Do NOT trigger automatically during coding, feature implementation, or general questions.
license: CC-BY-4.0
metadata:
  author: cfassula
  version: 1.0.0
---

# PR Review — Orchestration Protocol

Coordinates 6 specialized subagents (via the Task tool) then consolidates findings into a unified summary. Each subagent loads the relevant existing project docs — this skill does not duplicate them.

> **Canonical project docs (this repo).** There is no `docs/coding-patterns.md` or `docs/integration-patterns.md` here. Subagents must load these instead:
> - `CLAUDE.md` — authoritative: tech stack, forbidden deps, `src/` closed structure (`app`/`modules`/`shared`), module template, route-group caching, Server Action pattern, conventions, testing targets.
> - `docs/arch/project-guideline.md` — canonical patterns, conventions, DoD.
> - `docs/arch/architecture-document.md` and `docs/arch/technical-design.md` — architecture vision and Prisma schema/contracts.
> - `docs/arch/0001`–`0015-*.md` — the 15 ADRs (cite by number, e.g. ADR-0013 for ISR).
> - `.claude/skills/modular-architecture/` — note: this skill is **Fakeflix/NestJS-specific** (TypeORM, facades, `@Transactional`) and does NOT map to this Next.js project. Use it only for generic modularity reasoning, never apply its NestJS conventions verbatim.
> - `.claude/skills/create-e2e-tests/SKILL.md` — likewise describes a NestJS/Knex/supertest stack. This project uses **Vitest (unit/integration) + Playwright (E2E)**; review against the actual stack and `CLAUDE.md` testing targets.

## Step 1: Initialize

1. Get PR number from context or ask the user.
2. Identify repo: `gh repo view --json nameWithOwner -q .nameWithOwner`
3. Fetch diff: `gh pr diff {PR_NUMBER}`
4. Load existing inline comments: `gh api repos/{REPO}/pulls/{PR_NUMBER}/comments` — build a set of `{path, line}` pairs to avoid reposting.
5. Read PR intent: `gh pr view {PR_NUMBER} --json title,body,headRefName`
6. Check for a linked task on gh project in the branch name (pattern `^(feat|fix|chore|docs|refactor|test|perf|build|ci|style|revert)/(#\d+-|TASK-\d{3,}-)?[a-z0-9]+(-[a-z0-9]+)*$`). 

## Step 2: Launch Subagents in Parallel

Send **one message** with **six Task tool calls** — all launched simultaneously. Pass REPO, PR_NUMBER, the diff, existing comment locations, and PR intent to each subagent prompt. After all complete, run Step 3.

---

## Severity Labels (all subagents use these)

- 🚨 Critical — bugs or logic errors that will cause failures
- 🔒 Security — security vulnerabilities or data exposure
- ⚡ Performance — significant performance concerns
- ⚠️ Warning — code smells or maintainability issues
- 💡 Suggestion — optional improvements

---

## Universal Rules (every subagent must follow)

1. **Comment allowlist:** Only post inline comments on lines in the diff starting with `+` (excluding `+++`).
2. **Skip duplicates:** If `{path, line}` within ±3 lines already has a comment, skip.
3. **Mark resolved:** Reply `[RESOLVED] This appears resolved by the recent changes.` on existing comments where the issue is fixed.
4. **False positive guard:** Only report findings with ≥80% confidence. Skip when uncertain.
5. **Positive highlight:** Include at least one well-done aspect of the change before listing issues.
6. **Tone:** Specific, actionable, collegial. Explain WHY something is a problem.
7. **Never** approve, request-changes, or modify files. Use `--comment` only.
8. **Marker:** Start every inline comment body with `<!-- cursor-review:{type} -->` (invisible in rendered view, used by the consolidation subagent).

---

## Subagent 1: Security

**Marker:** `<!-- cursor-review:security -->`

Load `CLAUDE.md` (Critical Patterns: Server Action sequence, Privacy/View Models, Audit, LGPD Consents) plus ADRs `docs/arch/0003-supabase-auth-rbac-identidade-publica.md`, `0004-auditoria-imutavel-append-only.md`, `0005-storage-arquivos-sensiveis.md`, `0009-consentimentos-lgpd-por-finalidade.md`, `0010-visibilidade-conservadora-view-models.md`. Review the PR diff for any violations: hardcoded secrets, env vars not validated via `shared/env.ts` (Zod), service-role/admin Supabase keys reachable from the browser, missing `requirePermission()`/`requireActiveConsent()` guards on sensitive Server Actions, PII in logs (check the `redact` baseline in `shared/lib/logger.ts`), sensitive fields returned without a View Model, raw Prisma `update` bypassing `transitionContent`/`withAudit`, and SQL string concatenation. Dev-only placeholder credentials in `.env.example`/`docker-compose.yml` for LOCAL dev are expected and NOT findings.

**Second pass:** Re-read the full diff from top to bottom. List every file or hunk you did not comment on. For each uncovered file, ask: "Does this file violate any security rule in my scope?" Only skip a file when you can explicitly state why it is clean.

**Comment format:**
```
<!-- cursor-review:security -->
🔒 Security — [Short title]
[What the issue is and why it matters]
**Recommendation:** [Specific fix]
```

---

## Subagent 2: Requirements & Definition of Done

**Marker:** `<!-- cursor-review:requirements -->`
**Posts:** One PR-level summary comment only — no inline comments.

Use a two-track approach to find requirements. Run both tracks in parallel; use whichever yields content.

### Track A — gh project Ticket

1. Extract ticket ID from branch name (pattern `^(feat|fix|chore|docs|refactor|test|perf|build|ci|style|revert)/(#\d+-|TASK-\d{3,}-)?[a-z0-9]+(-[a-z0-9]+)*$`).
2. If found, fetch: via gh command or gh mcp
<!-- `curl -su "$JIRA_USER:$JIRA_API_TOKEN" "$JIRA_BASE_URL/rest/api/2/issue/$TICKET_ID?fields=summary,description"` -->
3. Parse for acceptance criteria, user stories, and DoD checklist items.

### Track B — Repo Spec Files

1. Scan the PR title and body for any reference to spec or task files. Common patterns:
   - Explicit file paths: `.specs/`, `docs/`, `*.spec.md`, `*-tasks.md`, `*-spec.md`
   - Markdown links: `[...](path/to/file.md)`
   - Inline mentions: `spec: path/to/file`, `tasks: path/to/file`
2. Also look for a `.specs/` directory at the repo root — if present, check whether any file inside matches the PR branch name, ticket ID, or feature name (fuzzy match on file stem).
3. For each candidate file found, read it with `cat {path}` and extract: acceptance criteria, task checklist items, and any stated goals or non-goals.

### Resolution Logic

| Tracks with content | Action |
|---|---|
| Both A and B | Merge requirements from both sources; note the source of each item |
| A only | Use gh Project requirements |
| B only | Use spec file requirements |
| Neither | Post: "⚠️ No gh project ticket or spec file found — requirements verification skipped." and stop |

Compare the merged requirements against the PR diff and post a summary with `gh pr comment {PR_NUMBER} --body '...'`

**Second pass:** After drafting the summary, re-read the full requirements list one item at a time and ask: "Did I evaluate this criterion against the diff?" For any item not yet assessed, find the relevant section of the diff and explicitly mark it ✅, ❌, or 🔲.

**Summary format:**
```markdown
<!-- cursor-review:requirements -->
## 📋 Requirements Review

**Sources:** {e.g. "project: TASK-123" | "Spec: .specs/recommendations-v2.md" | "Both"}

### ✅ Implemented
### ❌ Missing or Incomplete
### 🔲 Definition of Done
- [x] covered  - [ ] not covered
### 💬 Notes
```

---

## Subagent 3: E2E Test Coverage

**Marker:** `<!-- cursor-review:e2e -->`

This project uses **Vitest** (unit/integration) + **Playwright** (E2E) — NOT the NestJS/supertest stack in `create-e2e-tests/SKILL.md` (read it only for generic test-quality principles, not its concrete patterns). Reference `CLAUDE.md` → Testing Requirements: Server Action tests cover happy path / Zod failure / permission denied / consent absent / concurrency; domain 90%, sensitive Server Actions 80%, E2E top-8 flows; coverage gate fails <65%. Review the PR diff for: new Server Actions / queries / route handlers without a corresponding test (🚨 Critical), Playwright E2E missing for new critical user flows, test config issues (wrong `environment` for `.tsx`, coverage gate drift, dev-vs-prod server in CI), test placement (must be colocated in `__tests__/`), and anti-patterns (trivial assertions, no teardown, timezone/locale-dependent assertions).

**Second pass:** Re-read the full diff from top to bottom. List every new or modified Server Action, query, route handler, and page you did not comment on. For each uncovered handler, ask: "Is there a corresponding test covering the happy path and at least one error case?" Only skip a handler when you can explicitly state why coverage already exists or is not applicable (e.g. a bootstrap PR with no domain endpoints yet).

**Comment format:**
```
<!-- cursor-review:e2e -->
[🚨/⚠️/💡] — [Short title]
[Description of the gap or anti-pattern]
**Recommendation:** [Pattern to follow per create-e2e-tests skill]
```

---

## Subagent 4: Architecture & Coding Patterns

**Marker:** `<!-- cursor-review:architecture -->`

### Phase 0 — Load all reference documents

Load every document listed below before touching the diff. Do not skip any. (The generic `docs/coding-patterns.md` / `docs/integration-patterns.md` do NOT exist in this repo — use the canonical docs below.)

1. `CLAUDE.md` — authoritative: tech stack & forbidden deps, `src/` closed structure (`app`/`modules`/`shared`), module template, barrel-import rule, route-group caching, the 5-step Server Action sequence, View Models, Moderation state machine, Audit/LGPD, conventions.
2. `docs/arch/project-guideline.md` — canonical patterns, conventions, Definition of Done.
3. `docs/arch/architecture-document.md` — architecture vision, quality attributes, phase plan.
4. `docs/arch/technical-design.md` — Prisma schema, sequence diagrams, integration contracts.
5. The relevant ADRs in `docs/arch/0001`–`0015-*.md` for the area the PR touches (e.g. ADR-0001 monolito modular, ADR-0008 pessoa unificada, ADR-0010 visibilidade/View Models, ADR-0011 máquina de estados, ADR-0013 ISR).
6. `.claude/skills/modular-architecture/` — OPTIONAL and Fakeflix/NestJS-specific (TypeORM, facades, `@Transactional`). Use ONLY for generic modularity reasoning; do NOT apply its NestJS conventions to this Next.js project.

Then scan the diff for directory structure: if any changed path lives under `src/modules/<name>/`, check it against the module template in CLAUDE.md (`actions/ queries/ domain/ schemas/ components/ views/ ports/ adapters/ __tests__/ index.ts`) and the barrel-import rule — note this for Phase 1.

### Phase 1 — Extract the rule list from the loaded documents

Do not use a hardcoded list. After loading all documents in Phase 0, scan each one and extract every explicit rule into a single numbered checklist. Use these extraction targets per document:

- **`CLAUDE.md`** — extract every rule from: Tech Stack (allowed) + **Forbidden** list; Architecture (module structure template, barrel-import rule, route groups + caching, `src/` closed structure, `shared/` layout); Critical Patterns (Server Action 5-step sequence, View Models/privacy, Moderation state machine, LLM abstraction, Audit Log, LGPD Consents); Conventions (Conventional Commits scopes, timezone, Prisma `take`/`select` rules, env Zod fail-fast); Testing Requirements.
- **`project-guideline.md`** — extract every canonical pattern, convention, and Definition-of-Done item it states as a rule.
- **`technical-design.md`** — extract any binding contract/schema rule relevant to the changed files.
- **ADRs** — extract the decision and any "must"/"never" rule from each ADR relevant to the diff.

Number the combined list sequentially starting from 1. This numbered list is your evaluation matrix for Phase 2. Do not add rules not present in the documents, and do not omit any you find.

### Phase 2 — Evaluate the matrix

Work through the diff **one file at a time**. For each changed file:

- For each rule in the Phase 1 list, decide: **PASS** / **VIOLATION** / **N/A**
- N/A is only valid when the rule is structurally inapplicable to the file type (e.g. a DTO file cannot violate `@Transactional` rules; a migration file cannot violate controller leanness)
- For every VIOLATION: post an inline comment on the exact `+` line in the diff that is the evidence. Include the rule number and source document.

**Second pass:** After completing the matrix for all files, re-read the full diff from top to bottom. List every file or hunk you did not evaluate. For any uncovered file, run the matrix again. Only skip a file when you can explicitly state which rules are N/A and why.

**Comment format:**
```
<!-- cursor-review:architecture -->
[🚨/⚠️/💡] — [Short title]
Rule: [Rule number + which doc, e.g. "Rule 8 — verification.md New Feature Checklist"]
[What in the diff violates it — quote the offending line]
**Recommendation:** [Exact fix, code snippet if < 6 lines]
```

---

## Subagent 5: Regression & Hallucination Detection

**Marker:** `<!-- cursor-review:regression -->`

Review the PR diff for code changes that are unrelated to the PR's stated purpose, or that show signs of AI-generated artifacts. Look for: deleted code unrelated to the change (🚨 Critical), phantom imports referencing non-existent symbols (🚨 Critical), method calls with wrong signatures (🚨 Critical), `TODO` left in production code, type assertions hiding compiler errors, duplicate logic that already exists in the module, weakened error handling or validation, silently swallowed queue job errors, weakened test assertions, and dead code that is never called.

**Second pass:** Re-read the full diff from top to bottom. List every file or hunk you did not comment on. For each uncovered file, ask: "Does this file contain any unrelated deletions, phantom imports, duplicate logic, or weakened assertions?" Only skip a file when you can explicitly state why none of those categories apply.

**Comment format:**
```
<!-- cursor-review:regression -->
[🚨/⚠️/💡] — [Short title]
Type: [unrelated-deletion | phantom-import | hallucination | duplicate | regression | dead-code]
[Specific description with quoted evidence from the diff]
**Recommendation:** [Exact fix]
```

---

## Subagent 6: Performance

**Marker:** `<!-- cursor-review:performance -->`

Load `CLAUDE.md` (Conventions: Prisma queries always use `take`/pagination, explicit `select`/`include`, avoid N+1; Prisma singleton; ISR caching per route group) and `docs/arch/project-guideline.md`. Only flag issues **clearly visible in the diff** — no speculation. Look for: N+1 query patterns (Prisma call inside a loop), `findMany` without `take` (mandatory pagination), missing `select`/`include` pulling whole rows, sequential `await` for independent operations that could use `Promise.all`, multiple writes that should share a single `prisma.$transaction`/`withAudit` tx, `new PrismaClient()` outside the singleton (connection leak under HMR), and wrong/absent `revalidate` on public ISR routes.

**Second pass:** Re-read the full diff from top to bottom. List every service method, repository call, and loop you did not comment on. For each uncovered block, ask: "Does this contain a clearly visible performance issue?" Only skip a block when you can explicitly state why none of the patterns above apply.

**Comment format:**
```
<!-- cursor-review:performance -->
⚡ Performance — [Short title]
[Description with estimated impact, e.g. "O(N) queries per request"]
**Recommendation:** [Fix with short code sketch if < 6 lines]
```

---

## Step 3: Consolidation

After all 6 subagents complete, spawn one more subagent via Task tool to consolidate:

1. `gh api repos/{REPO}/pulls/{PR_NUMBER}/comments` — fetch all inline comments.
2. Filter to those starting with `<!-- cursor-review: -->` and parse the type from the marker.
3. Fetch PR-level comments for the `<!-- cursor-review:requirements -->` summary.
4. Group by severity: 🔒 Security → 🚨 Critical → ⚡ Performance → ⚠️ Warning → 💡 Suggestion.
5. Deduplicate findings at the same `{path, line}` (±3 lines) — note both agents in the entry.
6. Collect one positive highlight per agent.
7. **Gap detection:** Run `gh pr diff {PR_NUMBER} --name-only` to get the full list of changed files. Cross-reference against all collected inline comment paths. For any file with zero inline comments from any subagent, add it to a `### 🔍 Files With No Inline Comments` section in the summary. Omit a file from this section only if it is a config/lock file (e.g. `*.json`, `*.yaml`, `*.lock`) or a pure type declaration file with no logic.
8. Post: `gh pr review {PR_NUMBER} --comment --body '...'`

**Summary format:**
```markdown
## 🤖 AI Review Summary

| | |
|---|---|
| **Subagents invoked** | {N} of 6 (Security · Requirements (GitHub issues + Spec) · Test Coverage · Architecture · Regression · Performance) |
| **Skills loaded** | `.claude/skills/pr-review/SKILL.md` (+ `create-e2e-tests`/`modular-architecture` as generic references only) |
| **Docs loaded** | `CLAUDE.md`, `docs/arch/project-guideline.md`, `docs/arch/architecture-document.md`, `docs/arch/technical-design.md`, relevant `docs/arch/0001`–`0015-*.md` ADRs |
| **Findings** | {N} across {M} files |

---

### 🔒 Security ({N})
- [`path/file.ts:L42`] Finding title

### 🚨 Critical ({N})
### ⚡ Performance ({N})
### ⚠️ Warnings ({N})
### 💡 Suggestions ({N})

---
### 🔍 Files With No Inline Comments
- `path/to/file.ts` — no findings from any subagent (verify manually or re-run targeted review)

_(Omit this section if all logic files received at least one comment.)_

---
### ✅ Highlights
- [One positive highlight per agent]

---
> See inline comments for details and recommendations.
```

If no findings across all agents: post `✅ No issues found across all review dimensions.` but still include the metadata table.
