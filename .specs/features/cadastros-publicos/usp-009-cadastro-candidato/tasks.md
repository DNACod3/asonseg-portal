# USP-009 — Cadastro de candidato — Tasks (REFACTOR ao Design System)

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tasks com a skill spec-driven do projeto: **ative-a por nome e siga o fluxo Execute + Critical Rules.** Não busque arquivos de skill por caminho. A skill é a fonte da verdade do fluxo (ciclo por-task, delegação a sub-agentes, Verifier independente, sensor de discriminação). **Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

**Refactor style-only.** Regra de ouro desta unidade: os testes verdes de USP-009 (`candidate-schema.test`, `candidate-actions.test`, `candidate-actions.int.test`, `CandidateForm.test`, `e2e/candidato.spec`) são **testes negativos** e devem continuar passando **sem edição**. Se um deles ficar vermelho, o defeito está no restyle — corrija o componente/página, nunca o teste.

---

**Design**: [`design.md`](./design.md) · **Spec**: [`spec.md`](./spec.md)
**Status**: Draft

---

## §0. Entry Gate — ABERTO ✅

Reli `spec.md` `## Assumptions & Open Questions`: todos os itens têm owner `agent` com default aplicado (`Confirmed? = y`). **Nenhum item de owner externo bloqueante.** B-001 (DPO) e B-004 (checklist) são gates de go-live, não de desenvolvimento, e não tocam candidato. → A unidade **entra** em task breakdown.

## §1.5 Test Coverage Matrix

> Gerada do codebase + guidelines + spec — confirmar antes do Execute. Guidelines encontradas: `CLAUDE.md` (Testing Requirements), `docs/arch/project-guideline.md` (DoD), `package.json` scripts, `vitest.integration.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Client component (`candidate-form.tsx`) | unit (component, jsdom/RTL) | Preservar as 5 asserções verdes (gate de consentimento, erros de validação, happy path, status em moderação) — **sem editar o teste** | `src/modules/persons/__tests__/CandidateForm.test.tsx` | `npm run test` |
| Server Actions (NÃO modificadas) | integration + unit | Já verdes; âncora de preservação de CAD-01/03/05 — não editar | `src/modules/persons/__tests__/candidate-actions*.test.ts`, `candidate-schema.test.ts` | `npm run test` · `npm run test:integration` |
| Route/página (`(app)/candidato/page.tsx`) | none (build gate) + E2E confinamento | Build verde; `e2e/candidato.spec.ts` verde (redirect sem sessão) | `src/app/(app)/candidato/page.tsx` · `e2e/candidato.spec.ts` | build gate · `npm run test:e2e` |
| Guard estático DS (must-not CAD-MN-03) | unit | 0 utilidades de paleta fixa nos 2 arquivos; regex discriminante | `src/modules/persons/__tests__/candidate-ds-tokens.guard.test.ts` | `npm run test` |

## §1.5 Parallelism Assessment

> Gerada do codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| Component (jsdom) | Yes | `vi.mock` de `next/navigation` + actions; sem estado compartilhado | `CandidateForm.test.tsx` (mocks hoisted) |
| Static guard (unit) | Yes | `readFileSync` puro; sem IO externo | padrão `companies/__tests__/no-external-verify.test.ts` |
| Integration (actions) | No | Postgres compartilhado + cleanup cascata | `candidate-actions.int.test.ts` (não modificado nesta unidade) |

## §1.5 Gate Check Commands

> Gerada do codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | após tasks com testes unit/component | `npm run test` |
| Full | verificação da âncora de comportamento (actions/integração) | `npm run test && npm run test:integration` |
| Build | após restyle da página / conclusão da unidade | `npm run typecheck && npm run lint && npm run build` (+ `npm run test:e2e` p/ confinamento de rota) |

---

## Execution Plan

### Phase 1 — Restyle (Parallel OK: arquivos distintos, sem estado compartilhado)

```
├── T1 [P]  candidate-form.tsx
└── T2 [P]  (app)/candidato/page.tsx
```

### Phase 2 — Guard (Sequential)

```
T1, T2 ──▶ T3 (guard cobre os 2 arquivos)
```

> 2 fases → abaixo do limiar de 3 fases → execução inline (sem sub-agentes por fase). Verifier independente sempre roda após a última task.

---

## Task Breakdown

### T1 — Restyle do `CandidateForm` às primitivas do DS `[P]`

**What**: Reestilizar o Client Component do formulário de candidato com `@/shared/ui` + tokens, preservando 100% do comportamento (RHF/Zod/actions/gate LGPD/fluxo rascunho→moderação).
**Where**: `src/modules/persons/components/candidate-form.tsx` (modificar)
**Depends on**: None
**Reuses**: `create-company-form.tsx` (template de form+LgpdBox+gate); `job-form.tsx` (`selectClass`/`errorClass` por token); `@/shared/ui` (`Button`/`Input`/`Label`/`Textarea`/`LgpdBox`)
**Requirement**: CAD-R1 · **Must-nots**: CAD-MN-01, CAD-MN-02

**Tools**: MCP: NONE · Skill: spec-driven (Execute)

**Done when**:
- [ ] Importa `{ Button, Input, Label, LgpdBox, Textarea }` de `@/shared/ui`; removidas as constantes locais de paleta fixa (`inputClass`/`labelClass`/`errorClass` antigas). `errorClass='mt-1 text-xs text-danger'` e `selectClass` (token) em uso.
- [ ] Campos: `<Label htmlFor>` + `<Input>`/`<Textarea>`/`<select className={selectClass}>`; associações `htmlFor↔id` preservadas para escolaridade, área de interesse e telefone (`getByLabelText`).
- [ ] Termo em `<LgpdBox title="Termo de uso para candidatura a vagas">` com **um único** checkbox (`accent-primary`) gateando o submit; condicional `!alreadyCandidate` preservada; corpo do termo e `aria-label` renderizados.
- [ ] Caixa de erro `role="alert"` tintada em `danger`; caixa "rascunho" neutra de superfície com CTA `Button variant="primary" size="sm"`; caixa "em moderação" `role="status"` tintada em `primary`.
- [ ] Botões preservam os rótulos "Salvar cadastro" e "Enviar para moderação" e o `disabled={isPending || !consentChecked}`.
- [ ] Nenhuma lógica alterada (`useForm`, `onSubmit`, `onSubmitForModeration`, `startTransition`, `router.refresh`, estados). **Nenhuma** chamada nova a Prisma/action; nenhuma via de status fora de `submitCandidateForModeration`→`transitionContent` (CAD-MN-02).
- [ ] `CandidateForm.test.tsx` passa **sem edição** (5/5) — inclui CAD-MN-01 ("desabilita o envio até o aceite").
- [ ] Gate quick passa: `npm run test`.

**Tests**: unit (component) — `CandidateForm.test.tsx` verde inalterado (negative test de CAD-MN-01; CAD-MN-02 ancorado em `candidate-actions*` intactos).
**Gate**: quick

**Commit**: `refactor(persons): restyle CandidateForm ao design system (USP-009)`

---

### T2 — Restyle da página `(app)/candidato` ao padrão de cadastro do DS `[P]`

**What**: Reestilizar o Server Component da rota de candidato ao padrão `StepIcon`+`FormHeader`+`FormCard` (como `empresa/cadastrar`), com caixa de erro por token — preservando data-loading e props.
**Where**: `src/app/(app)/candidato/page.tsx` (modificar)
**Depends on**: None
**Reuses**: `src/app/(app)/empresa/cadastrar/page.tsx` (layout exato); `@/shared/ui` (`StepIcon`/`FormHeader`/`FormCard`)
**Requirement**: CAD-R2 · **Must-not**: CAD-MN-03 (co-owner; guard em T3)

**Tools**: MCP: NONE · Skill: spec-driven (Execute)

**Done when**:
- [ ] `dynamic='force-dynamic'`, `requireActivePerson()`, `Promise.all(jobAreas, profile)`, `loadTerm('JOB_APPLICATION')` + `try/catch TermLoaderError`, e as props passadas ao `<CandidateForm>` **inalterados**.
- [ ] Header via `StepIcon variant="orange"` (SVG de usuário inline, sem dependência externa) + `FormHeader title="Cadastro de candidato" description=…`; form dentro de `<FormCard>`.
- [ ] Caixa "termo indisponível" `role="alert"` tintada em `danger` (sem `bg-red-*`).
- [ ] Sem utilidade de paleta fixa (`text-gray-*`, `bg-red-*`, etc.) no arquivo.
- [ ] Gate build passa: `npm run typecheck && npm run lint && npm run build`; `e2e/candidato.spec.ts` verde (`npm run test:e2e`).

**Tests**: none (build gate) — camada de rota; E2E de confinamento (`e2e/candidato.spec.ts`) permanece verde sem edição.
**Gate**: build

**Commit**: `refactor(persons): restyle rota (app)/candidato ao design system (USP-009)`

---

### T3 — Guard estático anti-deriva de DS (must-not CAD-MN-03)

**What**: Teste unit que lê `candidate-form.tsx` e `(app)/candidato/page.tsx` e falha se qualquer utilidade Tailwind de paleta fixa permanecer — negativa discriminante de CAD-MN-03.
**Where**: `src/modules/persons/__tests__/candidate-ds-tokens.guard.test.ts` (criar)
**Depends on**: T1, T2
**Reuses**: padrão de guarda estática `src/modules/companies/__tests__/no-external-verify.test.ts` (`readFileSync` + assertivas por regex)
**Requirement**: CAD-R1/CAD-R2 · **Must-not**: CAD-MN-03

**Tools**: MCP: NONE · Skill: spec-driven (Execute)

**Done when**:
- [ ] Lê os 2 arquivos-alvo por caminho absoluto (`process.cwd()`), sem tocar em `__tests__`.
- [ ] Assertiva: nenhum casamento de `/\b(?:bg|text|border|ring|from|to|via|accent|fill|stroke|divide|outline|shadow|placeholder)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/` nos 2 arquivos.
- [ ] **Discriminância comprovada**: o teste rodado contra a versão PRÉ-refactor (ou uma linha reintroduzindo `bg-blue-600`) FALHA; contra a versão reestilizada, PASSA (registrar a evidência no commit/validação).
- [ ] Gate quick passa: `npm run test`.

**Tests**: unit (static guard).
**Gate**: quick

**Commit**: `test(persons): guard anti-deriva de DS nas telas de candidato (CAD-MN-03)`

---

## Definition of Done (unidade U1 — refactor USP-009)

- [ ] T1/T2/T3 completas; 3 commits atômicos.
- [ ] Todas as suítes de USP-009 verdes **sem edição** (`candidate-schema.test`, `candidate-actions.test`, `candidate-actions.int.test`, `CandidateForm.test`, `e2e/candidato.spec`) — CAD-01/03/05 preservados.
- [ ] Guard CAD-MN-03 verde e discriminante.
- [ ] Sweep final Full+Build: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` verdes; `npm run test:e2e` verde.
- [ ] Zero mudança em schema/migração/actions/domain/schemas Zod (refactor style-only).

---

## Validação pré-apresentação (Tasks §5)

### Check 1 — Granularidade

| Task | Escopo | Status |
|---|---|---|
| T1: restyle `candidate-form.tsx` | 1 componente | ✅ Granular |
| T2: restyle `(app)/candidato/page.tsx` | 1 arquivo de rota | ✅ Granular |
| T3: guard estático | 1 arquivo de teste | ✅ Granular |

### Check 2 — Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama mostra | Status |
|---|---|---|---|
| T1 | None | Phase 1, sem seta de entrada | ✅ Match |
| T2 | None | Phase 1, sem seta de entrada | ✅ Match |
| T3 | T1, T2 | T1,T2 ▶ T3 | ✅ Match |

T1 e T2 marcadas `[P]`: não dependem uma da outra (arquivos distintos, sem estado compartilhado) ✅.

### Check 3 — Test Co-location Validation

| Task | Camada criada/modificada | Matriz exige | Task diz | Status |
|---|---|---|---|---|
| T1 | Client component | unit (component) | unit | ✅ OK |
| T2 | Route/página | none (build) + e2e (inalterado) | none/build | ✅ OK |
| T3 | Static guard (unit) | unit | unit | ✅ OK |

### Check 4 — Must-Not Ownership 💠

| Must-not | Owning task(s) | Negative test (no `Done when`) | Status |
|---|---|---|---|
| CAD-MN-01 (gate LGPD) | T1 | `CandidateForm.test` "desabilita o envio até o aceite" (verde, inalterado) | ✅ |
| CAD-MN-02 (moderação só via `transitionContent`) | T1 | `candidate-actions*.test` DRAFT→IN_MODERATION + INVALID_TRANSITION (verde, inalterado); UI não introduz via de status | ✅ |
| CAD-MN-03 (deriva de DS) | T1, T2 | T3 guard estático (regex de paleta fixa) — discriminante | ✅ |

Todos os checks ✅ — tasks prontas para Execute.
