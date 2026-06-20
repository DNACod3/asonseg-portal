# Coding Principles

Behavioral bias, not checklist. Read before every implementation.

---

## Before Coding

- State assumptions explicitly. If uncertain, ask.
- Multiple interpretations exist? Present all—don't pick silently.
- Simpler approach exists? Say so. Push back when warranted.
- Something unclear? Stop. Name what's confusing. Ask.
- User's approach seems wrong? Disagree honestly. Don't be sycophantic.

---

## During Implementation

### Simplicity

- No features beyond what was asked
- No abstractions for single-use code
- No "flexibility" or "configurability" not requested
- No error handling for impossible scenarios
- 200 lines that could be 50? Rewrite it.

### Surgical Changes

- Don't "improve" adjacent code, comments, or formatting
- Don't refactor things that aren't broken
- Match existing style, even if you'd do differently
- Unrelated dead code noticed? Mention it—don't delete it
- Remove ONLY imports/variables/functions YOUR changes orphaned
- Don't remove pre-existing dead code unless asked

### Test Integrity

- NEVER weaken an existing test assertion to make it pass
- NEVER delete a test to reduce failure count
- NEVER use the test framework's skip/disable/pending mechanism to bypass a failing test
- NEVER modify tests written in the RED phase during GREEN phase
- If a test is genuinely wrong, STOP and confirm with the user before changing it
- Tests are the spec — implementation conforms to tests, not the other way around

### Goal-Driven

- Transform vague tasks into verifiable goals
- Multi-step work? State brief plan with verify checkpoints
- Every changed line must trace directly to user's request

### 🧬 ICE Integrity (when the project has an ICE layer)

- **The matrix card is the only door.** Never implement a requirement, schema, contract, or behavior the card does not point to. If it isn't reachable from intent/expectations/TD/ADRs/runbooks, it does not exist for this USP — fabricating it (even plausibly) is the cardinal sin.
- **Never re-decide what an ADR fixed.** If the code would contradict an ADR or the technical-design, STOP and re-enter `architecture-planning-idsd` (delta). That is not a local choice.
- **A must-not deviation is not yours to resolve.** Diverging from a `P-NNN` / `F-X` is a blocking review escalation to the Dev Sênior / intent owner — never an inline note you decide alone.
- **Requirement IDs are the ICE IDs** (`E-NNN`/`P-NNN`/`AC-NNN-N`). Never mint a parallel ID scheme.

---

## After Each Change

Ask: "Would senior engineer call this overcomplicated?"
If yes → simplify before proceeding.
