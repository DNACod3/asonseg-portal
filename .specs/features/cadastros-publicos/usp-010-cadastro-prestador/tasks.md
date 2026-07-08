# USP-010 — Cadastro de prestador de serviço — Tasks (REFACTOR ao Design System)

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tasks com a skill spec-driven do projeto: **ative-a por nome e siga o fluxo Execute + Critical Rules.** Não busque arquivos de skill por caminho. A skill é a fonte da verdade do fluxo (ciclo por-task, delegação a sub-agentes, Verifier independente, sensor de discriminação). **Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

**Refactor style-only.** Regra de ouro desta unidade: os testes verdes de USP-010 (`provider-schema.test`, `provider-actions.test`, `provider-actions.int.test`, `ProviderForm.test`, `e2e/prestador.spec`) são **testes negativos** e devem continuar passando **sem edição**. Se um deles ficar vermelho, o defeito está no restyle — corrija o componente/página, **nunca** o teste.

---

**Design**: [`design.md`](./design.md) · **Spec**: [`spec.md`](./spec.md)
**Status**: Draft

---

## §0. Entry Gate — ABERTO ✅

Reli `spec.md` `## Assumptions & Open Questions`: todos os itens têm owner `agent` com default aplicado (`Confirmed? = y`). **Nenhum item de owner externo bloqueante.** Sinais de bloqueio do gate ICE (Q-aberta dono/técnico, ADR Proposed, pré-condição, premissa aberta): **nenhum** — a matriz aponta `Q-abertas: —`; **ADR-0031** já está **Accepted** e implementado (ProviderProfile sem CNPJ); D-002 (termo jurídico da finalidade 3) é gate de **go-live**, não de desenvolvimento, e o código não muda o termo. → A unidade **entra** em task breakdown.

## §1.5 Test Coverage Matrix

> Gerada do codebase + guidelines + spec — confirmar antes do Execute. Guidelines: `CLAUDE.md` (Testing Requirements), `docs/arch/project-guideline.md` (DoD), `package.json` scripts, `vitest.integration.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Client component (`provider-form.tsx`) | unit (component, jsdom/RTL) | Preservar as 7 asserções verdes (copy P-004, gate P-003, sem-CNPJ+CTA MEI E-002, foto GAP-B, happy path E-003, campos faltantes, alreadyProvider) — **sem editar o teste** | `src/modules/persons/__tests__/ProviderForm.test.tsx` | `npm run test` |
| Server Action + schema (NÃO modificados) | integration + unit | Já verdes; âncora de preservação de E-001/E-002/P-003/P-005 — não editar | `src/modules/persons/__tests__/provider-actions*.test.ts`, `provider-schema.test.ts` | `npm run test` · `npm run test:integration` |
| Route/página (`(app)/prestador/page.tsx`) | none (build gate) + E2E confinamento | Build verde; `e2e/prestador.spec.ts` verde (redirect sem sessão) | `src/app/(app)/prestador/page.tsx` · `e2e/prestador.spec.ts` | build gate · `npm run test:e2e` |
| Guard estático DS (must-not PRV-MN-01) | unit | 0 utilidades de paleta fixa nos 2 arquivos; regex discriminante | `src/modules/persons/__tests__/provider-ds-tokens.guard.test.ts` | `npm run test` |

## §1.5 Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| Component (jsdom) | Yes | `vi.mock` de `next/navigation` + actions; sem estado compartilhado | `ProviderForm.test.tsx` (mocks hoisted) |
| Static guard (unit) | Yes | `readFileSync` puro; sem IO externo | padrão `companies/__tests__/no-external-verify.test.ts` |
| Integration (actions) | No | Postgres compartilhado + cleanup cascata | `provider-actions.int.test.ts` (não modificado nesta unidade) |

## §1.5 Gate Check Commands

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | após tasks com testes unit/component | `npm run test` |
| Full | verificação da âncora de comportamento (actions/integração) | `npm run test && npm run test:integration` |
| Build | após restyle da página / conclusão da unidade | `npm run typecheck && npm run lint && npm run build` (+ `npm run test:e2e` p/ confinamento de rota) |

## §1.5 Facts (skill-tdad) — nota

Em modo ICE o produtor de testes é o `skill-tdad`. Nesta unidade de **refactor**, os facts de comportamento **já existem verdes** (as 5 suítes acima, geradas quando USP-010 foi construída) e servem de âncora negativa — **não** são regenerados. O único artefato de teste **novo** é o **guard estático** de deriva de DS (T3), fact da proibição nova PRV-MN-01, com discriminância comprovada (falha na versão pré-refactor).

---

## Execution Plan

### Phase 1 — Restyle (Parallel OK: arquivos distintos, sem estado compartilhado)

```
├── T1 [P]  provider-form.tsx
└── T2 [P]  (app)/prestador/page.tsx
```

### Phase 2 — Guard (Sequential)

```
T1, T2 ──▶ T3 (guard cobre os 2 arquivos)
```

> 2 fases → abaixo do limiar de 3 fases → execução inline (sem sub-agentes por fase). Verifier independente sempre roda após a última task.

---

## Task Breakdown

### T1 — Restyle do `ProviderForm` às primitivas do DS `[P]`  · **REFACTOR (behavior-preserving)**

**What**: Reestilizar o Client Component do formulário de prestador com `@/shared/ui` + tokens, preservando 100% do comportamento (RHF/Zod/actions/gate LGPD/copy P-004/redirect MEI E-002/CTA E-003).
**Where**: `src/modules/persons/components/provider-form.tsx` (modificar)
**Depends on**: None
**Reuses**: `candidate-form.tsx` (template gêmeo: `selectClass`/`errorClass`, `LgpdBox`+checkbox, caixa de erro `danger`); `job-form.tsx` (caixas por `color-mix`); `@/shared/ui` (`Button`/`Input`/`Label`/`Textarea`/`LgpdBox`, `Button asChild`)
**Requirement**: PRV-R1 · **Must-nots**: PRV-MN-P004, PRV-MN-P003, PRV-MN-E002

**Tools**: MCP: NONE · Skill: spec-driven (Execute)

**Done when**:
- [ ] Importa `{ Button, Input, Label, LgpdBox, Textarea }` de `@/shared/ui`; removidas as constantes locais de paleta fixa (`inputClass`/`labelClass`/`errorClass` antigas). `errorClass='mt-1 text-xs text-danger'` e `selectClass` (token) em uso.
- [ ] Caixa P-004 tintada em `success` por token com a copy **"agora você OFERECE serviços"** + **"contrata"** verbatim (PRV-MN-P004).
- [ ] Campos: `<Label htmlFor>` + `<Input>`/`<Textarea>`/`<select className={selectClass}>`; associações `htmlFor↔id` preservadas (campos faltantes, título, descrição, região, foto); placeholder de foto **disabled** (`getByLabelText(/foto do perfil/i)`).
- [ ] Termo em `<LgpdBox title="Termo de oferta de serviços">` com **um único** checkbox (`accent-primary`) gateando o submit; condicional `!alreadyProvider` preservada; corpo do termo (`{term.body}`) e `aria-label` renderizados (PRV-MN-P003).
- [ ] Caixa de erro `role="alert"` tintada em `danger`; caixa E-003 `role="status"` tintada em `success` com CTA `Button asChild variant="primary"` → `<Link href="/servicos/novo">`; caixa E-002 do MEI neutra com CTA `Button asChild variant="secondary"` → `<Link href="/empresa">`; **nenhum campo de CNPJ** (PRV-MN-E002).
- [ ] Botão submit preserva o rótulo "Ativar papel de prestador" e `disabled={isPending || !consentChecked}`.
- [ ] Nenhuma lógica alterada (`useForm`, `onSubmit`, orquestração `activateAdditionalRole`+`activateProviderRole`, `startTransition`, `router.refresh`, estados). **Nenhuma** chamada nova a Prisma/action; nenhuma coleta de CNPJ.
- [ ] `ProviderForm.test.tsx` passa **sem edição** (7/7) — inclui P-004, P-003 e E-002 (sem-CNPJ + CTA `/empresa`).
- [ ] Gate quick passa: `npm run test`.

**Tests**: unit (component) — `ProviderForm.test.tsx` verde inalterado (negative tests de PRV-MN-P004/P003/E002).
**TestGate**: quick

**Commit**: `refactor(persons): restyle ProviderForm ao design system (USP-010)`

---

### T2 — Restyle da página `(app)/prestador` ao padrão de cadastro do DS `[P]`  · **REFACTOR (behavior-preserving)**

**What**: Reestilizar o Server Component da rota de prestador ao padrão `StepIcon`+`FormHeader`+`FormCard` (como `candidato/page.tsx`), com caixa de erro por token — preservando data-loading e props.
**Where**: `src/app/(app)/prestador/page.tsx` (modificar)
**Depends on**: None
**Reuses**: `src/app/(app)/candidato/page.tsx` (layout exato); `@/shared/ui` (`StepIcon`/`FormHeader`/`FormCard`)
**Requirement**: PRV-R2 · **Must-not**: PRV-MN-01 (co-owner; guard em T3)

**Tools**: MCP: NONE · Skill: spec-driven (Execute)

**Done when**:
- [ ] `dynamic='force-dynamic'`, `requireActivePerson()`, `Promise.all(regions, profile)`, `loadTerm('SERVICE_OFFERING')` + `try/catch TermLoaderError`, e as props passadas ao `<ProviderForm>` **inalterados**. Import de `ProviderForm` via barrel `@/modules/persons` mantido.
- [ ] Header via `StepIcon variant="orange"` (SVG de prestador inline, sem dependência externa) + `FormHeader title="Cadastro de prestador de serviço" description=…`; form dentro de `<FormCard>`; `<main class="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">`.
- [ ] Caixa "termo indisponível" `role="alert"` tintada em `danger` (sem `bg-red-*`).
- [ ] Sem utilidade de paleta fixa (`text-gray-*`, `bg-red-*`, etc.) no arquivo.
- [ ] Gate build passa: `npm run typecheck && npm run lint && npm run build`; `e2e/prestador.spec.ts` verde (`npm run test:e2e`).

**Tests**: none (build gate) — camada de rota; E2E de confinamento (`e2e/prestador.spec.ts`) permanece verde sem edição.
**TestGate**: build

**Commit**: `refactor(persons): restyle rota (app)/prestador ao design system (USP-010)`

---

### T3 — Guard estático anti-deriva de DS (must-not PRV-MN-01)  · **NET-NEW (fact novo)**

**What**: Teste unit que lê `provider-form.tsx` e `(app)/prestador/page.tsx` e falha se qualquer utilidade Tailwind de paleta fixa permanecer — negativa discriminante de PRV-MN-01.
**Where**: `src/modules/persons/__tests__/provider-ds-tokens.guard.test.ts` (criar)
**Depends on**: T1, T2
**Reuses**: padrão de guarda estática `src/modules/companies/__tests__/no-external-verify.test.ts` (`readFileSync` + assertivas por regex) e o gêmeo `candidate-ds-tokens.guard.test.ts` (USP-009)
**Requirement**: PRV-R1/PRV-R2 · **Must-not**: PRV-MN-01

**Tools**: MCP: NONE · Skill: spec-driven (Execute)

**Done when**:
- [ ] Lê os 2 arquivos-alvo por caminho absoluto (`process.cwd()`), sem tocar em `__tests__`.
- [ ] Assertiva: nenhum casamento de `/\b(?:bg|text|border|ring|from|to|via|accent|fill|stroke|divide|outline|shadow|placeholder)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/` nos 2 arquivos.
- [ ] **Discriminância comprovada**: o teste rodado contra a versão PRÉ-refactor (ou uma linha reintroduzindo `bg-blue-600`) FALHA; contra a versão reestilizada, PASSA (registrar a evidência no commit/validação).
- [ ] Gate quick passa: `npm run test`.

**Tests**: unit (static guard).
**TestGate**: quick

**Commit**: `test(persons): guard anti-deriva de DS nas telas de prestador (PRV-MN-01)`

---

## Definition of Done (unidade U1 — refactor USP-010)

- [ ] T1/T2/T3 completas; 3 commits atômicos.
- [ ] Todas as suítes de USP-010 verdes **sem edição** (`provider-schema.test`, `provider-actions.test`, `provider-actions.int.test`, `ProviderForm.test`, `e2e/prestador.spec`) — E-001/E-002/E-003 + P-003/P-004/P-005 preservados.
- [ ] Guard PRV-MN-01 verde e discriminante.
- [ ] Sweep final Full+Build: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` verdes; `npm run test:e2e` verde.
- [ ] Zero mudança em schema/migração/action/domain/schema Zod (refactor style-only).

---

## Validação pré-apresentação (Tasks §5)

### Check 1 — Granularidade

| Task | Escopo | Status |
|---|---|---|
| T1: restyle `provider-form.tsx` | 1 componente | ✅ Granular |
| T2: restyle `(app)/prestador/page.tsx` | 1 arquivo de rota | ✅ Granular |
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
| PRV-MN-P004 (copy OFERECE) | T1 | `ProviderForm.test` "P-004: exibe copy …" (verde, inalterado) | ✅ |
| PRV-MN-P003 (gate LGPD) | T1 | `ProviderForm.test` "P-003: desabilita o envio até o aceite" + `provider-actions*` CONSENT_REQUIRED (verde) | ✅ |
| PRV-MN-E002 (sem CNPJ / CTA `/empresa`) | T1 | `ProviderForm.test` "E-002/ADR-0031 …" + `provider-schema.test` `cnpjMei` descartado (verde) | ✅ |
| PRV-MN-01 (deriva de DS) | T1, T2 | T3 guard estático (regex de paleta fixa) — discriminante | ✅ |

Todos os checks ✅ — tasks prontas para Execute.
