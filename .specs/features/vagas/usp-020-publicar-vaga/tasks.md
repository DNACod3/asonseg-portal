# USP-020 — Publicar vaga — Refactor (Fase 2 / Design System) — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill files
by filesystem path. The skill is the source of truth for the per-task cycle (implement → gate → atomic
commit), sub-agent delegation, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator — do not proceed without it.**

**Refactor discipline (every task):** change **only markup/classes**. Do not touch handlers, schemas,
Server Actions, the FSM adapter, navigation, `metadata` or cache config. Existing tests MUST stay green (no
weakening/deleting). Preserve: `createJobDraft`/`submitJobForModeration`, gate P-006, dedup P-003 (`CONFLICT`),
validade E-004/E-005, rascunho E-003, audit L-004, e o `status ContentStatus` na entidade (AD-009).

**Novos testes (skill-tdad):** os testes negativos novos (RTL de preservação, guarda de estilo) podem ser
gerados via `skill-tdad` a partir dos must-nots U20-MN-*.

---

**Design**: `.specs/features/vagas/usp-020-publicar-vaga/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada do codebase + guidelines + spec — confirmar antes do Execute. Guidelines: `CLAUDE.md` (§Testing),
> `project-guideline.md` (§10/§18), `vitest.config.ts`, `vitest.integration.config.ts`. Server Components de
> página ficam fora do gate de cobertura (filosofia do repo, AD-015): restyle validado por `build`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client Component (`JobForm`) | unit (RTL) | Campos presentes + submit chama action com mesmo payload (U20-MN-05) + botões rascunho/enviar | `src/modules/jobs/__tests__/*.spec.tsx` | `npm run test` |
| Guarda de estilo (DS parity) | unit (node:fs) | Zero paleta crua/hex nos arquivos tocados (U20-MN-04) | `src/shared/__tests__/ds-*-parity.test.ts` | `npm run test` |
| Server Action (existente, preservado) | integration | Suíte existente verde — gate P-006, dedup, validade (U20-MN-01/02/03) | `src/modules/jobs/__tests__/*.int.test.ts` | `npm run test:integration` |
| Domain/schema (existente) | unit | `validade.spec.ts` / `publish-job.schema.spec.ts` verdes | `src/modules/jobs/__tests__/*.spec.ts` | `npm run test` |
| Server Component (página) | none | Gate de build | `src/app/(app)/empresa/**` | build gate |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (RTL, jsdom) | Yes | Isolamento por arquivo; deps mockadas (`vi.mock`) | `RegisterPersonForm.test.tsx` pattern |
| unit (node:fs guard) | Yes | Leitura de arquivo, sem estado compartilhado | `ds-ui-uses-tokens.test.ts` |
| integration (Postgres) | No | Postgres compartilhado + cleanup `deleteMany` | `submit-job-for-moderation.int.test.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks com unit/RTL/guard apenas | `npm run typecheck && npm run lint && npm run test` |
| Full | Tasks que precisam confirmar preservação de comportamento (integração) | `npm run typecheck && npm run lint && npm run test && npm run test:integration` |
| Build | Restyle de Server Component (página) | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Restyle do formulário (Sequential)

```
T1
```

### Phase 2: Casca de página (Sequential)

```
T1 ──→ T2
```

2 fases → execução inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Restyle `JobForm` para o Design System (só estilo) + RTL de preservação + guarda de estilo

**What**: Trocar `<label>/<input>/<textarea>/<button>` crus e as constantes `inputClass/errorClass/labelClass`
pelos primitivos `Label/Input/Textarea/Button/FormRow` do DS; caixa de erro/sucesso em tokens
`danger`/`success`; selects/date/checkbox com classes de token. Criar o RTL de preservação e a guarda de
estilo.
**Where**:
- `src/modules/jobs/components/job-form.tsx` (modify — só marcação/classe)
- `src/modules/jobs/__tests__/job-form.spec.tsx` (novo — RTL)
- `src/shared/__tests__/ds-vagas-parity.test.ts` (novo — guarda node:fs; cobre os arquivos de vagas desta e das próximas USPs)
**Depends on**: None
**Reuses**: `RegisterPersonForm.tsx`/`LoginForm.tsx` (padrão de restyle RHF), `@/shared/ui`, `ds-login-parity.test.ts` (padrão de guarda)
**Requirement**: U20-STYLE-01, U20-MN-01, U20-MN-02, U20-MN-03, U20-MN-04, U20-MN-05

**Tools**:
- MCP: NONE
- Skill: `skill-tdad` (gerar RTL + guarda dos must-nots), opcional

**Done when**:
- [ ] `JobForm` usa `Label/Input/Textarea/Button/FormRow` de `@/shared/ui`; selects/date/checkbox com classes de token; nenhuma classe de paleta crua (`bg-blue-600`, `text-gray-*`, `border-gray-300`, `focus:ring-blue-*`) nem hex.
- [ ] Comportamento preservado: RHF + `zodResolver(publishJobSchema)`/`draftJobSchema`, os dois caminhos de submit (`onPublish` → `submitJobForModeration`; `onSaveDraft` → `createJobDraft`), `applyFieldErrors`, `useTransition`, `useRouter`, o `companyId` hidden, o date `min/max` 1–180d, o default `salaryVisible=true`, o mapa `ActionResult`→PT-BR.
- [ ] Botões: "Enviar para moderação" `Button variant="primary"` (`type="submit"`); "Salvar rascunho" `Button variant="secondary"` (`type="button"`). Banner de erro token `danger` (`role="alert"`) e sucesso token `success` (`role="status"`).
- [ ] **RTL (U20-MN-05):** todos os campos esperados renderizam (título, área, descrição, requisitos, benefícios, salário+`salaryVisible`, regime, contrato, região, escolaridade, validade); submit com dados válidos chama `submitJobForModeration` (mock) com o mesmo payload; "Salvar rascunho" chama `createJobDraft`.
- [ ] **Guarda (U20-MN-04):** `ds-vagas-parity.test.ts` assevera zero paleta crua/hex em `job-form.tsx` (e demais arquivos de vagas conforme forem restilizados).
- [ ] **Preservação (U20-MN-01/02/03):** gate full verde — `submit-job-for-moderation.int.test.ts`, `create-job-draft.int.test.ts`, `validade.spec.ts`, `publish-job.schema.spec.ts` permanecem verdes (sem deleções).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run test:integration`
- [ ] Test count: `job-form.spec.tsx` com ≥4 casos verdes; suítes de integração da USP-020 sem regressão.

**Tests**: unit (RTL) + integration (preservação)
**Gate**: full

**Commit**: `refactor(jobs): restyle JobForm com Design System (AD-014) — só estilo (USP-020)`

---

### T2: Restyle da casca `(app)/empresa/[empresaId]/vagas/nova/page.tsx` (só estilo)

**What**: Compor `StepIcon variant="blue"` + `FormHeader` + `FormCard` ao redor do `<JobForm/>`; remover
paleta crua do container; estender a guarda de estilo ao arquivo da página.
**Where**:
- `src/app/(app)/empresa/[empresaId]/vagas/nova/page.tsx` (modify — só marcação/classe)
- `src/shared/__tests__/ds-vagas-parity.test.ts` (estender p/ cobrir a página)
**Depends on**: T1 (o `JobForm` restilizado é renderizado dentro do `FormCard`)
**Reuses**: `@/shared/ui` (`StepIcon`, `FormHeader`, `FormCard`); `cadastro/page.tsx` (padrão de casca)
**Requirement**: U20-STYLE-02, U20-MN-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Página compõe `StepIcon` + `FormHeader` + `FormCard` ao redor do `JobForm`; sem paleta crua.
- [ ] **Preservado sem alteração:** `dynamic='force-dynamic'`, `requireActivePerson()`, o gate P-006 → `notFound()`, os `Promise.all` (`company`/`listApprovedJobAreas`/`listActiveRegions`), o `notFound()` de company inexistente, o `metadata`.
- [ ] Renderiza corretamente em light e dark (tokens).
- [ ] **Guarda (U20-MN-04):** `ds-vagas-parity.test.ts` cobre a página (zero paleta crua/hex).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component — gate de build)
**Gate**: build

**Commit**: `refactor(jobs): restyle página publicar vaga com Design System (AD-014) (USP-020)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1  (restyle form + RTL + guarda; gate full)

Phase 2 (Sequential):
  T1 complete, then:
    T2  (restyle casca de página; gate build)
```

Nenhuma task `[P]`: T2 depende de T1 (o form vive dentro do card).

---

## Task Granularity Check

| Task | Escopo | Status |
| --- | --- | --- |
| T1: restyle form + RTL + guarda | 1 componente + seu teste + guarda coesa | ✅ Granular |
| T2: restyle casca de página | 1 arquivo | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram | Status |
| --- | --- | --- | --- |
| T1 | None | raiz | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Client Component + guarda + preservação | unit (RTL) + integration | unit + integration | ✅ OK |
| T2 | Server Component (página) | none (build) | none | ✅ OK |

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U20-MN-01 (gate P-006 preservado) | T1 | `submit-job-for-moderation.int.test.ts` / `create-job-draft.int.test.ts` — não-responsável ⇒ `FORBIDDEN`, zero persistência (permanece verde) |
| U20-MN-02 (validade preservada) | T1 | `validade.spec.ts` + `submit-job-for-moderation.int.test.ts` — passada/excede ⇒ `VALIDATION` (permanece verde) |
| U20-MN-03 (dedup preservado) | T1 | `submit-job-for-moderation.int.test.ts` — 2ª idêntica ⇒ `CONFLICT` (permanece verde) |
| U20-MN-04 (sem paleta crua) | T1 (form) + T2 (página) | `ds-vagas-parity.test.ts` — zero paleta crua/hex nos arquivos tocados |
| U20-MN-05 (campos/binding preservados) | T1 | `job-form.spec.tsx` — todos os campos presentes; submit com mesmo payload |

---

## Task Verification Standards

Cada `Done when` é binário e referencia o comando de gate. Contagens de teste explícitas previnem deleções
silenciosas. Restyle tasks devem manter verdes todos os testes existentes da USP-020 (regra de refactor: só
estilo).
