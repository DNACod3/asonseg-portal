# USP-052 — Perfil do candidato consistente Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tasks com a skill **`bravi-spec-driven`**: **ative-a pelo nome** e siga o fluxo Execute + Critical Rules. Não busque arquivos da skill por caminho. A skill é a fonte de verdade do fluxo (ciclo por-task, delegação de sub-agente, revisão de adequação, Verifier, sensor de discriminação). Os testes-red por AC podem ser derivados com **`skill-tdad`** (produtor de testes).

**Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

---

**Design**: `.specs/features/ajustes-uat/usp-052-perfil-candidato/design.md`
**Status**: Implemented (Execute concluído — T1-T5; Verifier não executado nesta rodada por instrução explícita do orquestrador)

---

## 0. 💠 Entry Gate

Reavaliadas as **Assumptions & Open Questions** da spec. Único item de owner externo: **A-10 (H-5 — editar ACTIVE re-modera?)**, dono = **PO (Fase 9)**. A implementação desta USP **NÃO depende** da resolução de H-5: ela apenas (a) para de mentir o status e (b) deixa de oferecer a ação inválida, **mantendo** a persistência atual (upsert preserva o status, sem rebaixar). O resultado é correto sob qualquer decisão futura de H-5.

**→ Entry Gate LIVRE.** Todos os demais itens têm owner `agent` (resolvidos). Prossegue para o breakdown.

---

## Test Coverage Matrix

> Gerada de codebase + `CLAUDE.md`/`package.json` + spec — confirmar antes do Execute. Guidelines: `CLAUDE.md` (Testing Requirements: happy/Zod/permission/consent/concurrency; unit 90% domínio, integração 80% Server Actions sensíveis), `package.json` scripts, `vitest.integration.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Server Action (`persons/actions/activate-candidate-role.ts`) | unit + integration | Todos os ramos; 1:1 aos ACs (PERF-01/01b/01c/02); must-nots PERF-MN-01/02 com teste negativo; borda "campo vazio enviado" | unit `src/modules/**/__tests__/*.test.ts`; int `src/modules/**/__tests__/*.int.test.ts` | `npm run test` / `npm run test:integration` |
| React Component (`candidate-form.tsx`, `CvUploadForm.tsx`) | unit (component/RTL) | Render + gate; ACs PERF-03/03b/04/04b/05/05b/05c; must-nots PERF-MN-02(UI)/MN-03 com teste negativo | `src/modules/**/components/__tests__/*.test.tsx`, `src/modules/**/__tests__/*.test.tsx` | `npm run test` |
| Server Page (`app/(app)/candidato/page.tsx`) | unit (component/RTL, mockado) | Wiring: `defaultValues` passados (PERF-04), `term`/`alreadyGranted` passados ao `CvUploadForm` (PERF-05), gating do upload por perfil (preservado) | `src/app/**/*.test.tsx` | `npm run test` |
| Entity / Schema / Config | none | — (sem migração; build gate) | — | build gate only |

**Coverage Expectation** conforme `CLAUDE.md` (guideline encontrada — não default). E2E autenticado **deferido** (padrão L-007: sem seed de sessão Supabase no Playwright; cobertura autoritativa em unit/component/integração).

## Parallelism Assessment

> Gerada de codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit / component (`*.test.ts(x)`) | **Yes** | Mocks por-teste (`vi.hoisted`/`vi.mock`), RTL isolado, sem DB | `candidate-actions.test.ts`, `CvUploadForm.test.tsx` (tudo mockado) |
| integration (`*.int.test.ts`) | **No** | Postgres compartilhado + cleanup por-suite (`beforeAll`/`afterAll`), `skipIf(!DATABASE_URL)` | `candidate-actions.int.test.ts:35` (`describe.skipIf`), suite de integração sequencial (`vitest.integration.config.ts`) |

## Gate Check Commands

> Gerada de codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tasks só com testes de component/unit | `npm run test` |
| Full | Após tasks que tocam a Server Action (unit + integração) | `npm run test && npm run test:integration` |
| Build | Fim de fase / fechamento | `npm run typecheck && npm run lint && npm run build && npm run test` (+ `npm run test:integration`) |

---

## Execution Plan

### Phase 1: Server Action (Sequential — integração, NÃO parallel-safe)

```
T1 → T2
```

### Phase 2: Client Components (Parallel OK — component tests parallel-safe)

```
T2 ──→ T3 [P]
        T4 [P]   (sem dependência)
```

### Phase 3: Wiring da página (Sequential)

```
T3, T4 → T5
```

---

## Task Breakdown

### T1: CAND-1 — `activateCandidateRole` preserva campos não enviados (partial update)

**What**: No ramo `update` do upsert, incluir cada coluna opcional só quando a chave está presente (`!== undefined`); ramo `create` intacto.
**Where**: `src/modules/persons/actions/activate-candidate-role.ts` (+ testes `src/modules/persons/__tests__/candidate-actions.test.ts`, `candidate-actions.int.test.ts`)
**Depends on**: None
**Reuses**: padrão de escrita parcial; `candidateProfileSchema` (inalterado)
**Requirement**: PERF-01, PERF-01b, PERF-01c, **PERF-MN-01**

**Tools**:
- MCP: NONE
- Skill: `skill-tdad` (derivar testes-red dos ACs), `bravi-spec-driven` (Execute)

**Done when**:
- [x] Ramo `update` monta `updateData` com obrigatórios + opcionais só-se-presentes; ramo `create` mantém `?? null`
- [x] **Teste negativo PERF-MN-01 (int)**: perfil com `skillsText`/`coursesText`/`educationArea`/`availability` setados + `activateCandidateRole` só com obrigatórios → essas 4 colunas **inalteradas** no DB; `educationLevel`/`primaryAreaOfInterestId` atualizados
- [x] **Teste unit**: `upsert.mock.calls[0][0].update` **não contém** as chaves de CV quando o input não as envia; **contém** `headline`/`experienceText` quando enviados
- [x] Testes existentes preservados: "happy path (só obrigatórios)" (ramo `create` → null) e "todos os opcionais" (ramo `update` com todas as chaves) permanecem verdes
- [x] Gate: `npm run test && npm run test:integration`
- [x] Test count: ~11 int + ~9 unit existentes preservados + ~2 novos (1 int negativo + 1 unit ramo-ausente)

**Tests**: integration
**Gate**: full
**Commit**: `fix(persons): preserva campos não enviados no save do candidato (CAND-1)`

---

### T2: CAND-2 — `activateCandidateRole` retorna o status real

**What**: Ler `publicationStatus` do retorno do upsert (`select`) e devolvê-lo; tipar `ActivateCandidateRoleResult.publicationStatus` como `ContentStatus`; `audit.after` reflete o real.
**Where**: `src/modules/persons/actions/activate-candidate-role.ts` (+ mesmos testes de T1)
**Depends on**: T1 (mesmo arquivo)
**Reuses**: captura do retorno de `withAudit` (`consents/actions/grant-consent.ts:96`)
**Requirement**: PERF-02, **PERF-MN-02 (backend)**

**Tools**:
- MCP: NONE
- Skill: `skill-tdad`, `bravi-spec-driven`

**Done when**:
- [x] `upsert({ …, select: { publicationStatus: true } })`; `return ok({ personId, publicationStatus: saved.publicationStatus })`; type = `ContentStatus` (import type de `@prisma/client`)
- [x] **Teste negativo PERF-MN-02 (unit)**: upsert mock resolve `{ publicationStatus: 'ACTIVE' }` → `res.data.publicationStatus === 'ACTIVE'` (não `'DRAFT'`)
- [x] **Teste (int)**: perfil pré-existente em `ACTIVE` + `activateCandidateRole` → `res.data.publicationStatus === 'ACTIVE'` e DB permanece `ACTIVE` (não rebaixa)
- [x] Atualização necessária (não-enfraquecedora): mock `upsert` da "happy path (só obrigatórios)" resolve `{ publicationStatus: 'DRAFT' }`; asserções `res.data`/`audit.after` seguem `DRAFT` (create)
- [x] Gate: `npm run test && npm run test:integration`
- [x] Test count: preservados + ~2 novos (1 unit ACTIVE + 1 int ACTIVE)

**Tests**: integration
**Gate**: full
**Commit**: `fix(persons): activateCandidateRole retorna status real do perfil (CAND-2)`

---

### T3: CAND-2-UI + CAND-3 — `candidate-form.tsx` reflete status real e pré-preenche [P]

**What**: Prop `defaultValues` no `useForm`; remover `defaultValue=""` dos `<select>`; renderizar caixa de rascunho só em `DRAFT`, aviso "em moderação" em `IN_MODERATION`, aviso informativo em `ACTIVE`, neutro nos demais.
**Where**: `src/modules/persons/components/candidate-form.tsx` (+ `src/modules/persons/__tests__/CandidateForm.test.tsx`)
**Depends on**: T2
**Reuses**: `defaultValues` do RHF (`job-form.tsx`); blocos de status existentes
**Requirement**: PERF-03, PERF-03b, PERF-04, PERF-04b, **PERF-MN-02 (UI)**

**Tools**:
- MCP: NONE
- Skill: `skill-tdad`, `bravi-spec-driven`

**Done when**:
- [x] `CandidateFormProps.defaultValues?: Partial<CandidateProfileInput>`; `useForm({ resolver, defaultValues })`; `<select>` sem `defaultValue=""` (mantém `<option value="" disabled>`)
- [x] **Teste negativo PERF-MN-02 (component)**: com status `ACTIVE` (via `activateCandidateRole` mock ou `initialStatus="ACTIVE"`), o botão "Enviar para moderação" **não** é renderizado; aviso de perfil ativo aparece
- [x] **Teste PERF-04**: com `defaultValues`, os campos abrem pré-preenchidos (ex.: telefone/escolaridade/área)
- [x] Testes existentes preservados: termo desabilita envio (CAD-05), habilita ao aceitar, erros de validação (submit vazio → "Selecione a escolaridade"), happy path revela "Enviar para moderação" (status DRAFT), `IN_MODERATION` mostra "em moderação"
- [x] Gate: `npm run test`
- [x] Test count: 5 existentes preservados + ~2 novos

**Tests**: unit
**Gate**: quick
**Commit**: `fix(persons): candidate-form reflete status real e pré-preenche defaultValues (CAND-2/CAND-3)`

---

### T4: CAND-6 — gate de aceite do termo `CV_AI_EXTRACTION` no `CvUploadForm` [P]

**What**: Props `term`/`alreadyGranted`; `LgpdBox`+checkbox quando `!alreadyGranted`; botão desabilitado até aceite; `grantConsent('CV_AI_EXTRACTION')` antes de `uploadCv`.
**Where**: `src/modules/cv-extraction/components/CvUploadForm.tsx` (+ `src/modules/cv-extraction/components/__tests__/CvUploadForm.test.tsx`)
**Depends on**: None
**Reuses**: gate `LgpdBox`+checkbox (`candidate-form.tsx`); import direto de action `'use server'` (precedente `candidate-form.tsx:15`)
**Requirement**: PERF-05, PERF-05b, PERF-05c, **PERF-MN-03**

**Tools**:
- MCP: NONE
- Skill: `skill-tdad`, `bravi-spec-driven`

**Done when**:
- [x] `CvUploadFormProps` ganha `term: {version;contentHash;body} | null` e `alreadyGranted: boolean`; `import { grantConsent } from '@/modules/consents/actions/grant-consent'` com `eslint-disable no-restricted-imports`
- [x] Com `!alreadyGranted`: `LgpdBox`+checkbox exibidos; "Enviar e extrair" desabilitado até `consentChecked`; ao enviar, `grantConsent` chamado **antes** de `uploadCv`; falha de grant → erro PT-BR + sem `uploadCv` (PERF-05c)
- [x] Com `alreadyGranted`: sem termo, sobe direto (PERF-05b); `term==null` → upload desabilitado com aviso
- [x] **Teste negativo PERF-MN-03 (component)**: `alreadyGranted=false` + checkbox desmarcado → clicar "Enviar e extrair" **não** chama `uploadCv` (nem `grantConsent`)
- [x] Testes existentes preservados (passar `alreadyGranted={true}` + `term`): render, pré-preenchimento IA (CVE-03), fallback (CVE-MN-06), confirmar, tamanho >5MB não chama `uploadCv`, erro do servidor
- [x] Gate: `npm run test`
- [x] Test count: 7 existentes preservados (com props adicionadas) + ~3 novos (gate desabilitado / grant-antes-de-upload / MN-03)

**Tests**: unit
**Gate**: quick
**Commit**: `fix(cv-extraction): gate de aceite do termo CV_AI_EXTRACTION no upload (CAND-6)`

---

### T5: CAND-3 + CAND-6 — `candidato/page.tsx` carrega perfil + termo de CV

**What**: Expandir o read do perfil e montar `defaultValues`; carregar `loadTerm('CV_AI_EXTRACTION')` + `alreadyGranted`; passar props a `CandidateForm` e `CvUploadForm`.
**Where**: `src/app/(app)/candidato/page.tsx` (+ `src/app/(app)/candidato/page.test.tsx`)
**Depends on**: T3, T4
**Reuses**: carregamento de termo existente (JOB_APPLICATION); `requireActiveConsent`/`loadTerm`/`stripTermFrontMatter`; `person.phone` da sessão
**Requirement**: PERF-04, PERF-05

**Tools**:
- MCP: NONE
- Skill: `bravi-spec-driven`

**Done when**:
- [x] `candidateProfile.findUnique` `select` expandido (`publicationStatus, educationLevel, primaryAreaOfInterestId, headline, experienceText`); `defaultValues` montado (perfil + `person.phone ?? ''`, `null → ''`) e passado ao `CandidateForm`
- [x] `cvTerm = loadTerm('CV_AI_EXTRACTION')` (try/catch `TermLoaderError` → `null`); `alreadyGranted = (await requireActiveConsent(person.id,'CV_AI_EXTRACTION')).active`; passados ao `CvUploadForm`
- [x] **Teste PERF-04**: `CandidateForm` recebe `defaultValues` correspondentes ao perfil mockado
- [x] **Teste PERF-05**: `CvUploadForm` recebe `term` e `alreadyGranted`
- [x] Testes existentes preservados: invoca `requireActivePerson`; `CvUploadForm` só aparece com perfil; ausente sem perfil. Atualizar mocks: adicionar `requireActiveConsent`, `loadTerm` resolve por finalidade
- [x] Gate: `npm run test`; ao fim da fase: `npm run typecheck && npm run lint && npm run build`
- [x] Test count: 3 existentes preservados + ~2 novos

**Tests**: unit
**Gate**: quick (+ build no fecho de fase)
**Commit**: `fix(persons): página /candidato carrega perfil e termo de CV (CAND-3/CAND-6)`

---

## Parallel Execution Map

```
Phase 1 (Sequential — integração):
  T1 ──→ T2

Phase 2 (Parallel — component):
  T2 completo, então:
    ├── T3 [P]   (depende de T2)
    └── T4 [P]   (independente)

Phase 3 (Sequential):
  T3, T4 completos, então:
    T5
```

**Parallelism constraint:** T1/T2 têm testes de integração (NOT parallel-safe) → sequenciais. T3/T4 têm só testes de component (parallel-safe) e tocam arquivos distintos (`candidate-form.tsx` × `CvUploadForm.tsx`) → `[P]`. 3 fases → execução inline (sem sub-agente por fase).

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: partial update (1 função, 1 ramo) | 1 função | ✅ Granular |
| T2: retorno de status (1 função) | 1 função | ✅ Granular |
| T3: candidate-form (1 component) | 1 component | ✅ Granular |
| T4: CvUploadForm (1 component) | 1 component | ✅ Granular |
| T5: page wiring (1 arquivo) | 1 arquivo | ✅ Granular |

T1 e T2 tocam o mesmo arquivo mas são deliverables distintos (não-clobber × status-real), sequenciais — commits separados por achado (traceabilidade CAND-1/CAND-2).

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | (sem seta de entrada) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | None | (sem seta de entrada) | ✅ Match |
| T5 | T3, T4 | T3 → T5, T4 → T5 | ✅ Match |

T3 `[P]` e T4 `[P]` na Phase 2 não dependem um do outro → paralelismo válido.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Server Action (persons) | integration (+unit) | integration | ✅ OK |
| T2 | Server Action (persons) | integration (+unit) | integration | ✅ OK |
| T3 | React Component (candidate-form) | unit | unit | ✅ OK |
| T4 | React Component (CvUploadForm) | unit | unit | ✅ OK |
| T5 | Server Page (candidato) | unit | unit | ✅ OK |

Nenhum `Tests: none`. Nenhum teste diferido para outra task. ✅

---

## 💠 Must-Not Ownership (Check 4)

| Must-Not | Owning task(s) | Negative test (no task) | Status |
|---|---|---|---|
| PERF-MN-01 (não apagar campos não enviados) | **T1** | int: colunas de CV inalteradas após save só-obrigatórios; unit: `update` payload sem chaves de CV | ✅ Owned + negative test |
| PERF-MN-02 (não mentir status / não oferecer transição inválida) | **T2** (backend) + **T3** (UI) | unit: ACTIVE retorna ACTIVE; component: sem "Enviar para moderação" em ACTIVE | ✅ Owned + negative test |
| PERF-MN-03 (não despachar `uploadCv` sem aceite/consent) | **T4** | component: checkbox desmarcado + `alreadyGranted=false` → `uploadCv` não chamado | ✅ Owned + negative test |

Todos os must-nots têm task dona e teste negativo. ✅

---

## 6. MCPs e Skills (resolvido — modo autônomo)

- **MCPs**: NONE (edições TS puras; sem dúvida de API de biblioteca → `context7` desnecessário).
- **Skills**: `skill-tdad` (produz os testes-red por AC/must-not antes de codar) + `bravi-spec-driven` (fluxo Execute + Verifier independente). E2E autenticado **deferido** (L-007).
