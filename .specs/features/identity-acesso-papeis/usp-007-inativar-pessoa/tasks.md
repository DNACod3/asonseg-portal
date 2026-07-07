# USP-007 Inativar Pessoa - Restyle ao DS - Tasks

## Execution Protocol (MANDATORY - do not skip)

Implement these tasks with the `bravi-spec-driven` skill (fallback `idsd-spec-driven`):
**activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill
files by filesystem path. The skill is the source of truth for the full flow (per-task cycle,
sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

**Style-only guarantee (locked):** every task below changes markup/classes only. No handler,
schema, Server Action, query, view model, navigation, metadata or cache change. Existing behavior
tests must stay green and unmodified.

---

**Design:** `.specs/features/identity-acesso-papeis/usp-007-inativar-pessoa/design.md`
**Status:** Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found: `CLAUDE.md`
> (§Testing Requirements), `docs/arch/project-guideline.md` (DoD), `vitest.config.ts`
> (`include` cobre `.tsx`; `coverage.include` só `.ts` → `.tsx` roda mas fica fora do gate de
> cobertura - filosofia do repo, herdada do AD-014).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Primitivo DS `Button` (.tsx) | unit (RTL) | Nova variante `danger` renderiza `bg-danger`; variantes existentes intactas | `src/shared/ui/__tests__/button.test.tsx` | `npm run test` |
| Client component - diálogo (.tsx) | unit (RTL) | Regressão: seletores/nomes acessíveis, validação, submit→action+refresh, PRECONDITION_FAILED preservados | `src/modules/persons/__tests__/InactivatePersonDialog.test.tsx` | `npm run test` |
| RSC page `pessoas/[id]/page.tsx` (.tsx) | none (build gate) | Sem teste de rota no repo; preservação por build+typecheck+diff | - | build gate |
| Domain/action (comportamento) | unit + integration (regressão) | Suítes existentes seguem verdes e **inalteradas** (rede de segurança; restyle não toca esses arquivos) | `person-inactivation.test.ts`, `inactivate-person.int.test.ts` | `npm run test` / `npm run test:integration` |

## Parallelism Assessment

> Generated from codebase.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit RTL (jsdom) | Yes | Render por-teste isolado; sem store compartilhado; `vi.mock` da action/router por arquivo | `InactivatePersonDialog.test.tsx`, `button.test.tsx` |
| integração (Postgres) | No | Backing store compartilhado + cleanup global | `*.int.test.ts` (não é modificado nem exercitado por restyle) |
| build/typecheck/lint | n/a | Processo único | `npm run build` / `tsc --noEmit` / `eslint .` |

## Gate Check Commands

> Generated from codebase (`package.json` scripts).

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tarefas com testes RTL/unit (Button, diálogo) | `npm run test` |
| Full | Após tarefas que toquem servidor/DB (nenhuma aqui) - rede de segurança de regressão | `npm run test && npm run test:integration` |
| Build | Após a tarefa de página e no fecho da unidade | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Foundation (Sequential)

```
T1
```

### Phase 2: Diálogo (depende da variante)

```
T1 → T2
```

### Phase 3: Página (fecho do screen)

```
T2 → T3
```

---

## Task Breakdown

### T1: Adicionar variante `danger` ao primitivo `Button`

**What:** estender `buttonVariants` (cva) com `danger` (token `bg-danger`, guard-safe) e cobrir com teste.
**Where:** `src/shared/ui/button.tsx` (modificar) + `src/shared/ui/__tests__/button.test.tsx` (asserção nova)
**Depends on:** None
**Reuses:** `buttonVariants` cva existente, `cn`
**Requirement:** U7-03, U7-MN-02

**Tools:**
- MCP: NONE
- Skill: NONE

**Done when:**
- [ ] `variant="danger"` disponível: classes `bg-danger text-white hover:shadow-md hover:brightness-95` (sem hex cru).
- [ ] Variantes `primary`/`secondary`/`outline` inalteradas (mesmas classes).
- [ ] `button.test.tsx` inclui asserção de que `danger` aplica `bg-danger` e não regride as demais.
- [ ] Guarda DS-MN-02 (`src/shared/ui/**` sem hex/paleta) segue verde.
- [ ] Gate quick passa: `npm run test`
- [ ] Test count: suíte de `button.test.tsx` verde, +1 asserção (sem deleções).

**Tests:** unit
**Gate:** quick

**Commit:** `feat(identity): adiciona variante danger ao Button do DS (USP-007 restyle)`

---

### T2: Restyle do `inactivate-person-dialog.tsx` ao DS

**What:** trocar controles brutos por `Button`/`Textarea`/`Label` e a casca por tokens; preservar 100% do comportamento e dos seletores.
**Where:** `src/modules/persons/components/inactivate-person-dialog.tsx` (modificar markup/classes)
**Depends on:** T1
**Reuses:** `Button` (danger/outline), `Textarea`, `Label` de `@/shared/ui`
**Requirement:** U7-01, U7-02, U7-05, U7-MN-01, U7-MN-02

**Tools:**
- MCP: NONE
- Skill: NONE

**Done when:**
- [ ] `<textarea>` → `<Textarea>`; `<label>` → `<Label htmlFor="reason">`; const `inputClass` removida.
- [ ] Gatilho "Inativar Pessoa" e submit "Confirmar inativação" → `Button variant="danger"`; "Cancelar" → `Button variant="outline"`.
- [ ] Casca em tokens: `bg-surface`, `text-fg`, `text-fg-muted`, `border-border`, `rounded-lg`, `shadow-xl`; bloco de erro em token (sem `bg-red-50`/`text-red-700`); nenhuma classe de paleta fixa (`bg-red-*`, `text-gray-*`, `border-gray-*`).
- [ ] **Preservados:** `useForm`/`register`/`handleSubmit`/`zodResolver`, `onSubmit`→`inactivatePerson(data)`→`router.refresh()`, `startTransition`, `<input type="hidden" {...register('personId')}>`, overlay bespoke (backdrop+`role="dialog"`+`aria-*`+Esc+`autoFocus`), `role="alert"` de erro, e os **nomes acessíveis** dos botões.
- [ ] `InactivatePersonDialog.test.tsx` segue **verde e inalterado**.
- [ ] Gate quick passa: `npm run test`
- [ ] Test count: `InactivatePersonDialog.test.tsx` = 4 testes verdes (sem deleções).

**Tests:** unit
**Gate:** quick

**Commit:** `refactor(identity): restyle inactivate-person-dialog ao DS (USP-007)`

---

### T3: Restyle do `pessoas/[id]/page.tsx` ao DS (arquivo único, ambos os ramos)

**What:** aplicar `Badge`/`Card`/tokens/`font-heading` à página inteira; preservar guardas, config e estrutura condicional.
**Where:** `src/app/(app)/pessoas/[id]/page.tsx` (modificar markup/classes)
**Depends on:** T2
**Reuses:** `Badge` (green/gray), `Card` de `@/shared/ui`; `formatSaoPaulo` inalterado
**Requirement:** U7-04, U7-MN-01, U7-MN-03

**Tools:**
- MCP: NONE
- Skill: NONE

**Done when:**
- [ ] Selo de status → `<Badge variant="green">Ativa</Badge>` / `<Badge variant="gray">Inativa</Badge>`.
- [ ] `<h1>` com `font-heading`+`text-fg`; seções → `<Card>`/tokens; textos → `text-fg`/`text-fg-muted`; aviso `isSelf` em token (não `text-amber-700`); `bg-gray-50` → token.
- [ ] Nenhuma classe de paleta fixa (`bg-green-100`, `text-gray-*`, `bg-gray-*`, `text-amber-*`, `border-gray-*`) nos trechos tocados.
- [ ] **Preservados byte-a-byte (U7-MN-03):** `requireActivePerson`, `hasInactivationPrivilege→notFound`, `viewPersonForStaff`, `isSelf`, `hasReactivationPrivilege`, `export const dynamic='force-dynamic'`, `ROLE_LABELS`, e a estrutura condicional ATIVO/INATIVO; `<InactivatePersonDialog>`/`<ReactivatePersonDialog>` renderizados com as mesmas props.
- [ ] Diff review confirma somente JSX/classes alteradas.
- [ ] Gate build passa: `npm run typecheck && npm run lint && npm run test && npm run build`
- [ ] Rede de segurança: `npm run test:integration` verde (regressão de comportamento).

**Tests:** none (build gate)
**Gate:** build

**Commit:** `refactor(identity): restyle da tela pessoas/[id] ao DS (USP-007/USP-045)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 (Button danger variant)

Phase 2 (Sequential - depende de T1):
  T1 ──→ T2 (inactivate dialog)

Phase 3 (Sequential - fecho do screen):
  T2 ──→ T3 (page.tsx)
```

Sem tarefas `[P]`: a cadeia é linear (variante → diálogo → página) por coerência visual e por
o diálogo consumir a variante nova.

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: variante danger no Button | 1 primitivo + 1 teste | Granular |
| T2: restyle do diálogo | 1 arquivo | Granular |
| T3: restyle da página | 1 arquivo | Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | (raiz) | Match |
| T2 | T1 | T1 → T2 | Match |
| T3 | T2 | T2 → T3 | Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Primitivo DS `Button` (.tsx) | unit | unit | OK |
| T2 | Client component diálogo (.tsx) | unit (regressão RTL) | unit | OK |
| T3 | RSC page (.tsx) | none (build gate) | none | OK |

## Must-Not Ownership Check

| Must-Not | Owning task(s) | Negative test |
|---|---|---|
| U7-MN-01 (preservar comportamento da inativação) | T2, T3 | `person-inactivation.test.ts`, `inactivate-person.int.test.ts`, `InactivatePersonDialog.test.tsx` verdes e inalterados |
| U7-MN-02 (sem dep de dialog / sem hex em shared/ui) | T1, T2 | Grep guard de ausência de dep de dialog + guarda DS-MN-02 verde |
| U7-MN-03 (preservar guardas/config da página) | T3 | Diff review + `npm run build`/`typecheck`/`lint` verdes |
