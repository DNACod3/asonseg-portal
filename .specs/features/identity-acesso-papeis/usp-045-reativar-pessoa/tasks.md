# USP-045 Reativar Pessoa - Restyle ao DS - Tasks

## Execution Protocol (MANDATORY - do not skip)

Implement these tasks with the `bravi-spec-driven` skill (fallback `idsd-spec-driven`):
**activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill
files by filesystem path. The skill is the source of truth for the full flow (per-task cycle,
Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

**Style-only guarantee (locked):** the restyle task changes markup/classes only. No handler,
schema, Server Action, query, view or navigation change. Existing behavior tests must stay green
and unmodified. The behavior of USP-045 was **backfilled** into `spec.md` from the code - this
unit does not change it.

**Entry Gate (§0):** the only external open item is **D-005** (controlled reason catalog). The
implementation does not depend on it (ships with free text) and the restyle does not depend on it.
Entry Gate does **not** trip - proceed.

---

**Design:** `.specs/features/identity-acesso-papeis/usp-045-reativar-pessoa/design.md`
**Status:** Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found: `CLAUDE.md`
> (§Testing Requirements), `docs/arch/project-guideline.md` (DoD), `vitest.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Client component - diálogo (.tsx) | unit (RTL) | Regressão: seletores/nomes acessíveis, aviso de zeragem preservado, validação, submit→action+refresh, FORBIDDEN preservados | `src/modules/persons/__tests__/ReactivatePersonDialog.test.tsx` | `npm run test` |
| Domain/action (comportamento) | unit + integration (regressão) | Suítes existentes seguem verdes e **inalteradas** (rede de segurança; restyle não toca esses arquivos) | `person-reactivation.test.ts`, `reactivate-person.int.test.ts` | `npm run test` / `npm run test:integration` |

## Parallelism Assessment

> Generated from codebase.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit RTL (jsdom) | Yes | Render por-teste isolado; `vi.mock` da action/router por arquivo | `ReactivatePersonDialog.test.tsx` |
| integração (Postgres) | No | Backing store compartilhado + cleanup global | `reactivate-person.int.test.ts` (não modificado nem exercitado por restyle) |

## Gate Check Commands

> Generated from codebase (`package.json` scripts).

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após a tarefa de restyle do diálogo (RTL) | `npm run test` |
| Full | Rede de segurança de regressão (nenhum servidor/DB tocado) | `npm run test && npm run test:integration` |
| Build | Fecho da unidade | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Restyle (Sequential - tarefa única)

```
T1
```

Unidade de tarefa única (o `page.tsx` é da USP-007). O deliverable principal desta USP - a spec de
**backfill** - já está entregue em `spec.md`.

---

## Task Breakdown

### T1: Restyle do `reactivate-person-dialog.tsx` ao DS

**What:** trocar controles brutos por `Button`/`Textarea`/`Label` e a casca por tokens; reestilizar o aviso de zeragem preservando o texto; preservar 100% do comportamento e dos seletores.
**Where:** `src/modules/persons/components/reactivate-person-dialog.tsx` (modificar markup/classes)
**Depends on:** None (usa variantes de `Button` já existentes; não depende da USP-007)
**Reuses:** `Button` (primary/outline), `Textarea`, `Label` de `@/shared/ui`
**Requirement:** U45-01, U45-02, U45-03, U45-MN-R01, U45-MN-R02, U45-MN-R03 (e preservação de U45-MN-B01..B03)

**Tools:**
- MCP: NONE
- Skill: NONE

**Done when:**
- [ ] `<textarea>` → `<Textarea>`; `<label>` → `<Label htmlFor="reactivation-reason">`; const `inputClass` removida.
- [ ] Gatilho "Reativar Pessoa" e submit "Confirmar reativação" → `Button variant="primary"`; "Cancelar" → `Button variant="outline"`.
- [ ] Casca em tokens: `bg-surface`, `text-fg`, `text-fg-muted`, `border-border`, `rounded-lg`, `shadow-xl`; bloco de erro em token; nenhuma classe de paleta fixa (`bg-green-*`, `text-gray-*`, `bg-amber-*`, `border-gray-*`).
- [ ] Aviso de zeragem reestilizado com token, **texto preservado** ("todos os papéis e permissões anteriores serão removidos...").
- [ ] **Preservados:** `useForm`/`register`/`handleSubmit`/`zodResolver`, `onSubmit`→`reactivatePerson(data)`→`router.refresh()`, `startTransition`, `<input type="hidden" {...register('personId')}>`, overlay bespoke (backdrop+`role="dialog"`+`aria-*`+Esc+`autoFocus`), `role="alert"` de erro, e os **nomes acessíveis** dos botões.
- [ ] Sem import de `@radix-ui/react-dialog` ou qualquer dependência de dialog.
- [ ] `ReactivatePersonDialog.test.tsx` segue **verde e inalterado** (6 testes, incluindo o aviso de zeragem).
- [ ] Gate quick passa: `npm run test`
- [ ] Rede de segurança: `npm run test:integration` verde (comportamento R1/R2/P-003 intacto).
- [ ] Test count: `ReactivatePersonDialog.test.tsx` = 6 testes verdes (sem deleções).

**Tests:** unit
**Gate:** quick (fecho da unidade: build)

**Commit:** `refactor(identity): restyle reactivate-person-dialog ao DS (USP-045)`

---

## Parallel Execution Map

```
Phase 1 (tarefa única):
  T1 (reactivate dialog restyle)
```

Sem tarefas `[P]` (unidade de tarefa única).

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: restyle do diálogo | 1 arquivo | Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | (raiz, tarefa única) | Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Client component diálogo (.tsx) | unit (regressão RTL) | unit | OK |

## Must-Not Ownership Check

| Must-Not | Owning task(s) | Negative test |
|---|---|---|
| U45-MN-B01 (não devolver grants ativos) | T1 (preservar) | `reactivate-person.int.test.ts` (ACTIVE→REVOKED na tx) verde e inalterado |
| U45-MN-B02 (não reinstaurar consentimentos) | T1 (preservar) | `reactivate-person.int.test.ts` (`consentsPreserved`) verde e inalterado |
| U45-MN-B03 (não abrir por baixo - R1) | T1 (preservar) | `person-reactivation.test.ts` + `reactivate-person.int.test.ts` (INSUFFICIENT_RANK) verdes e inalterados |
| U45-MN-R01 (preservar comportamento no restyle) | T1 | Suíte de comportamento verde e inalterada |
| U45-MN-R02 (não remover aviso de zeragem) | T1 | Asserção RTL do aviso verde |
| U45-MN-R03 (sem dep de dialog) | T1 | Grep guard de ausência de dep de dialog verde |
