# USP-020 — Publicar vaga — Refactor (Fase 2 / Design System) — Design

**Spec**: `.specs/features/vagas/usp-020-publicar-vaga/spec.md`
**Status**: Draft

> **Disciplina (AD-015).** Restyle **style-only**: muda-se **markup/classes**; não se tocam handlers,
> schemas, actions, navegação, `metadata` ou cache. Os testes existentes da USP-020 são os **testes de
> preservação** (não podem ficar vermelhos). Ver `docs/arch/project-guideline.md` (§10 UI, §18 DoD) e
> AD-014 (fundação de DS em `src/shared/ui`).

## 0. Comportamento preservado (fonte da verdade = código, não este doc)

A USP-020 já está implementada; o restyle **não re-deriva** nada abaixo — apenas o preserva:

- **Server Actions** (`src/modules/jobs/actions/create-job-draft.ts`, `submit-job-for-moderation.ts`):
  `safeParse` (Zod) → `getCurrentPerson()` → **gate P-006** (`personCompanyGrant` responsável `ACTIVE`,
  senão `FORBIDDEN`) → `withAudit('JOB_DRAFT_SAVED', tx.job.create status DRAFT)`; submit chama
  `transitionContent(JOB → IN_MODERATION, 'AUTHOR_ACTION')` (grava `CONTENT_SUBMITTED_TO_MODERATION`, L-004);
  dedup P-003 via `isJobDedupViolation` (P2002) → `CONFLICT`; retorno `ActionResult` (nunca `throw`).
- **Schema/domínio** (`schemas/publish-job.schema.ts`, `domain/validade.ts`): `publishJobSchema` /
  `draftJobSchema` / `submitJobSchema`; `validadeStatus` (America/Sao_Paulo, teto 180d, E-004/E-005).
- **FSM/adapter** (`adapters/prisma-job-status.ts` + `shared/container.ts`): `status ContentStatus` na
  entidade (AD-009); concorrência otimista `updateMany where status=from`.
- **Rota** `(app)/empresa/[empresaId]/vagas/nova/page.tsx`: `dynamic='force-dynamic'` (ADR-0030),
  `requireActivePerson()`, **gate P-006 na borda** (`notFound()` se não-responsável).

Nada disso muda. O delta é 100% de apresentação.

## 1. Architecture Overview

```mermaid
graph TD
    A["(app)/empresa/[empresaId]/vagas/nova/page.tsx (Server, casca)"] -->|StepIcon+FormHeader+FormCard| B[JobForm 'use client']
    B -->|Label/Input/Textarea/FormRow/Button| C[@/shared/ui]
    B -->|handleSubmit → inalterado| D[createJobDraft / submitJobForModeration]
```

Superfície de restyle: **1 Client Component** (`job-form.tsx`) + **1 casca de página** (Server Component).
Nenhum outro arquivo do módulo `jobs` é tocado.

## 2. Code Reuse Analysis

### Primitivos do DS a adotar (barrel `@/shared/ui`, AD-014)

| Primitivo | Props/variantes relevantes | Substitui (markup cru atual) |
| --- | --- | --- |
| `Label` | `htmlFor` (Radix Label) | `<label className={labelClass}>` (`text-gray-700`) |
| `Input` | `forwardRef` (RHF `register` compatível) | `<input className={inputClass}>` (`border-gray-300`, `focus:ring-blue-200`) |
| `Textarea` | `forwardRef`, `resize-y` | `<textarea className={inputClass}>` (descrição/requisitos/benefícios) |
| `Button` | `variant` primary/secondary/outline; `size`; `asChild` | `<button className="bg-blue-600 …">` (enviar) e botão cinza (rascunho) |
| `FormRow` | `cols={2}` | par `salaryMin`/`salaryMax` (hoje em `<fieldset>`) e outros pares |
| `FormCard` / `FormSectionTitle` | wrapper de seção + `<h2 font-heading>` | seção de salário (`<fieldset><legend>`) e envelope do form |
| `Badge` | `variant` gray/blue | rótulo opcional de status/obrigatório (se houver) |

### Padrão de restyle já validado (reusar)

`src/modules/identity/components/RegisterPersonForm.tsx` + `LoginForm.tsx` (Fase 1, AD-015) são o **padrão
de restyle de form RHF**: `<label>/<input>/<button>` → `Label`/`Input`/`Button`; caixa de erro em token
`danger`; nenhuma classe de paleta crua. `@/shared/ui` é a fonte única (import via barrel).

### Selects e date picker (decisão)

O DS **não exporta** Select/DatePicker. `areaId`/`regionId` permanecem `<select>` nativos; `validUntil`
permanece `<input type="date" min max>`; ambos recebem **classes de token** equivalentes ao `Input`
(`border-border bg-surface focus:ring-primary`) — sem criar primitivo novo (fora do escopo, ver spec
Assumptions). O `salaryVisible` permanece checkbox nativo com `accent-primary`.

## 3. Refactor deltas — `job-form.tsx` (Client Component)

Trocas **1:1 de marcação/classe**, preservando cada `register(...)`, `handleSubmit(onPublish)`,
`onSaveDraft`, `applyFieldErrors`, `useTransition`, `useRouter` e o mapa de erros PT-BR:

1. **Constantes de classe crua** (`inputClass`/`errorClass`/`labelClass`) → **remover**; usar primitivos.
2. `<label className={labelClass}>` → `<Label htmlFor=…>` (todos os campos).
3. `<input …>` de texto/número/date → `<Input …>` (mantendo `type`, `min`, `max`, `step`, `register`).
4. `<textarea rows=…>` (descrição, requisitos, benefícios) → `<Textarea rows=… />`.
5. `<select>` (área, região) → `<select>` com classes de token (mesma aparência de `Input`).
6. Erro de campo `errorClass` (`text-red-600`) → `text-danger text-xs mt-1` (token).
7. Banner topo: `serverError` (`role="alert"`) → caixa com token `danger` (padrão `LoginForm`); `success`
   (`role="status"`) → token `success`. Texto e `role` **preservados**.
8. `<fieldset><legend>` do salário → `FormSectionTitle` + `FormRow cols={2}` para `salaryMin`/`salaryMax`;
   checkbox `salaryVisible` com `accent-primary` + `Label`.
9. Botões: "Enviar para moderação" → `<Button type="submit" variant="primary">`; "Salvar rascunho" →
   `<Button type="button" variant="secondary" onClick={onSaveDraft}>`. `disabled`/`isPending` preservados.
10. Envelope do form `flex flex-col gap-5 max-w-lg` → manter layout, converter cores/spacing a tokens
    (`gap-…` do DS); envolver em `FormCard` se a casca não o fizer (ver §4 — evita card duplo).

**Preservado sem tocar:** todos os `name`/`register`, os dois caminhos de submit, o `companyId` hidden, o
`isoDateOffset(1..180)` do date picker, o default `salaryVisible=true`, o mapeamento `ActionResult`→PT-BR.

## 4. Refactor deltas — `(app)/empresa/[empresaId]/vagas/nova/page.tsx` (Server Component)

1. `<main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-10">` → manter container,
   compor **`StepIcon variant="blue"`** (ícone de maleta/vaga do protótipo) + **`FormHeader title="Publicar
   vaga" description=…`** + **`FormCard`** ao redor do `<JobForm/>`.
2. Cores/spacing de qualquer texto auxiliar (título/subtítulo antigos) → tokens; remover paleta crua.
3. **Preservado sem tocar:** `dynamic='force-dynamic'`, `requireActivePerson()`, o **gate P-006 → `notFound()`**,
   os `Promise.all` de `company`/`listApprovedJobAreas`/`listActiveRegions`, o `metadata` (se houver), e o
   `notFound()` de company inexistente.

> **Card duplo:** decidir se o `FormCard` fica na casca (page) ou dentro do `JobForm`. Recomendado: casca
> provê `FormCard`; `JobForm` provê só os campos (espelha `cadastro/page.tsx` + `RegisterPersonForm`).

## 5. Data Models

Nenhum. O restyle não toca schema/migração (os campos AD-011 já existem).

## 6. Error Handling Strategy

| Cenário | Tratamento (preservado) | Delta de estilo |
| --- | --- | --- |
| Validade passada / > 180d | `VALIDATION` do Zod (`validadeStatus`) → erro no campo `validUntil` | erro em `text-danger` |
| Não-responsável (P-006) | `FORBIDDEN` do action | banner `danger` |
| Vaga duplicada (P-003) | `CONFLICT` (P2002) | banner `danger` |
| Sucesso | `success`/redirect | banner `success` |

## 7. Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| Trocar `<input>` por `Input` pode perder o forward de `ref` do RHF se o primitivo não encaminhar `ref` | `src/shared/ui/input.tsx` | `register()` deixaria de funcionar (mudança de comportamento) | `Input`/`Textarea` são `forwardRef` (DS-19, confirmado no inventário); RTL de preservação (T2) trava o submit com payload igual. |
| Converter o Server Component de página em client por engano ao adicionar interatividade | `vagas/nova/page.tsx` | Quebra `force-dynamic`/guard de sessão | Casca permanece Server Component; só `JobForm` é `'use client'`. |
| Guarda estática de paleta crua gerar falso-positivo em comentários/strings de dados | arquivos tocados | Ruído no gate | Guarda restrita a `className`/JSX; allowlist se necessário (padrão `ds-*` da Fase 1). |
| `salaryVisible`/faixa salarial reestilizados alterarem o default ou o binding | `job-form.tsx` | Mudança de contrato (L-003) | RTL trava presença de todos os campos + default; must-not U20-MN-05. |

> Nenhum concern de segurança/perf novo — o restyle não toca dados nem authz.

## 8. Tech Decisions (não óbvias)

| Decisão | Escolha | Rationale |
| --- | --- | --- |
| Onde vive o `FormCard` | Na casca de página, não no `JobForm` | Espelha `cadastro/page.tsx` + `RegisterPersonForm` (AD-015); evita card duplo. |
| Selects/date/checkbox | Nativos com classes de token (sem novo primitivo) | DS não exporta Select/DatePicker; criar um é foundation work fora do escopo. |
| Teste do restyle do form | RTL de preservação (`job-form.spec.tsx`, novo) | Client Component RHF; trava campos + submit + must-nots U20-MN-05; padrão `RegisterPersonForm.test.tsx`. |
| Teste da casca de página | Gate de build | Padrão do repo p/ Server Component restilizado (AD-015). |

> **Decisões de projeto:** nenhuma nova convenção — este design **consome** AD-014/AD-015. Nada a
> acrescentar em `STATE.md`.
