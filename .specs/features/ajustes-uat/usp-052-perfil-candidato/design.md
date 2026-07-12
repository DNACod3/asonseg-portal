# USP-052 — Perfil do candidato consistente Design

**Spec**: `.specs/features/ajustes-uat/usp-052-perfil-candidato/spec.md`
**Status**: Draft

> **Adapt, don't re-derive.** Design conforme decisões ativas do STATE.md e ADRs: AD-014/015/016 (Design System tokens-only, primitivas `@/shared/ui`), ADR-0030 (`requireActivePerson`/`getCurrentPerson` session guards), CLAUDE.md (sequência da Server Action, privacidade do titular = Prisma direto para dado próprio, consents append-only). Nenhuma decisão ativa é contrariada — **conforma, não supera** (nenhum AD-NNN novo).

---

## Architecture Overview

Quatro correções cirúrgicas em 4 arquivos-fonte + seus testes, sem tocar arquitetura, schema, DI ou dependências. Duas camadas: **Server Action `activateCandidateRole`** (CAND-1 + CAND-2 backend) e **camada de apresentação** (`candidate-form.tsx` CAND-2-UI+CAND-3; `candidato/page.tsx` wiring CAND-3+CAND-6; `CvUploadForm.tsx` CAND-6 gate).

```mermaid
graph TD
    subgraph Página (Server Component)
      P["candidato/page.tsx"]
    end
    subgraph Client Components
      CF["candidate-form.tsx"]
      CU["CvUploadForm.tsx"]
    end
    subgraph Server Actions
      ACR["activateCandidateRole (persons)"]
      GC["grantConsent (consents)"]
      UP["uploadCv (cv-extraction)"]
    end
    P -->|"defaultValues + status real (CAND-3)"| CF
    P -->|"term + alreadyGranted (CAND-6)"| CU
    CF -->|"save"| ACR
    ACR -->|"upsert partial (CAND-1) + retorna status real (CAND-2)"| DB[(candidate_profiles)]
    CU -->|"1. aceite → grantConsent (CAND-6)"| GC
    CU -->|"2. uploadCv (já exige consent — CVE-06)"| UP
    GC --> CDB[(consents append-only)]
```

**Princípio comum:** cada correção reusa um padrão já existente no repo (partial write, captura do retorno de `withAudit`, `defaultValues` do RHF, `LgpdBox`+`grantConsent`). Nenhum código novo de infraestrutura.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
|---|---|---|
| `activateCandidateRole` (upsert em `withAudit`) | `src/modules/persons/actions/activate-candidate-role.ts` | Modificar ramo `update` (partial) + capturar `publicationStatus` do retorno do upsert |
| Captura do retorno de `withAudit` | `src/modules/consents/actions/grant-consent.ts:96` (`const roleReactivated = await withAudit(...)`) | Mesmo padrão para devolver o `publicationStatus` real |
| `CandidateForm` (RHF + gate de consentimento) | `src/modules/persons/components/candidate-form.tsx` | Adicionar prop `defaultValues`; ajustar renderização condicional por status |
| `useForm({ defaultValues })` do RHF | Padrão do repo (ex.: `job-form.tsx`) | Pré-preencher o formulário (CAND-3) |
| `LgpdBox` + checkbox + termo (`term.body`/`term.version`) | `candidate-form.tsx:184-206` | Espelhar o gate de aceite no `CvUploadForm` (CAND-6) |
| `grantConsent({ purpose })` | `src/modules/consents/actions/grant-consent.ts` | Registrar `CV_AI_EXTRACTION` antes do `uploadCv` (autossuficiente: carrega termo, valida hash, idempotente, audita) |
| Import direto de action `'use server'` em Client Component | `candidate-form.tsx:15` (`activateAdditionalRole`) | Importar `grantConsent` de `@/modules/consents/actions/grant-consent` (stub RPC), com `eslint-disable no-restricted-imports` |
| `loadTerm` + `stripTermFrontMatter` + `requireActiveConsent` | `candidato/page.tsx:1-2,51-61` / `@/modules/consents` | Carregar termo `CV_AI_EXTRACTION` e `alreadyGranted` server-side |
| `CurrentPerson.phone` | `src/modules/identity/server/session.ts:32` | `defaultValues.phone` (sem query extra) |

### Integration Points

| System | Integration Method |
|---|---|
| `candidate_profiles` (Prisma) | `activateCandidateRole` upsert (partial update) + `candidato/page.tsx` read pré-preenchimento — titular lê/escreve o próprio dado (Prisma direto permitido) |
| `consents` (append-only) | `grantConsent('CV_AI_EXTRACTION')` — sem RLS, autorização na app; idempotente |
| `uploadCv` (cv-extraction) | Inalterado — já exige `requireActiveConsent('CV_AI_EXTRACTION')`; esta USP só garante o consentimento antes de chamá-lo |

**Nenhum barrel novo, nenhuma migração, nenhuma dep.** `CV_AI_EXTRACTION` já existe no enum `ConsentPurpose`, no `TERMS_REGISTRY` e o termo em `legal/consent-terms/cv-ai-extraction/v1.0.md`.

---

## Components

### 1. `activateCandidateRole` — partial update + status real (CAND-1, CAND-2)

- **Purpose**: Salvar o perfil sem destruir campos não gerenciados e retornar o status real.
- **Location**: `src/modules/persons/actions/activate-candidate-role.ts`
- **Interfaces**:
  - `ActivateCandidateRoleResult.publicationStatus`: `'DRAFT'` → **`ContentStatus`** (`import type { ContentStatus } from '@prisma/client'`).
  - `activateCandidateRole(input): Promise<ActionResult<ActivateCandidateRoleResult>>` — assinatura inalterada.
- **Mudanças**:
  1. **CAND-1 (ramo `update`)**: manter obrigatórios (`educationLevel`, `primaryAreaOfInterestId`) incondicionais; para cada opcional (`headline`, `educationArea`, `experienceText`, `skillsText`, `coursesText`, `availability`) incluir a chave no payload **só se `data[key] !== undefined`**. Ramo `create` **inalterado** (mantém `?? null`).
  2. **CAND-2**: `upsert({ ..., select: { publicationStatus: true } })`; capturar `saved.publicationStatus` (via retorno do callback de `withAudit`, precedente `grantConsent`); `audit.after.publicationStatus = saved.publicationStatus`; `return ok({ personId, publicationStatus: saved.publicationStatus })`.
- **Dependencies**: `withAudit`, `getCurrentPerson`, `requireActiveConsent`, `candidateProfileSchema` (inalteradas).
- **Reuses**: padrão de captura do retorno de `withAudit` (`grant-consent.ts`).

**Esboço do ramo `update` (CAND-1):**
```ts
const updateData: Prisma.CandidateProfileUncheckedUpdateInput = {
  educationLevel: data.educationLevel,
  primaryAreaOfInterestId: data.primaryAreaOfInterestId,
};
// Só as chaves ENVIADAS pelo formulário entram — as ausentes (campos de CV
// donos de confirmCvFields) são preservadas (CAND-1 / CVE-04).
if (data.headline !== undefined) updateData.headline = data.headline;
if (data.educationArea !== undefined) updateData.educationArea = data.educationArea;
if (data.experienceText !== undefined) updateData.experienceText = data.experienceText;
if (data.skillsText !== undefined) updateData.skillsText = data.skillsText;
if (data.coursesText !== undefined) updateData.coursesText = data.coursesText;
if (data.availability !== undefined) updateData.availability = data.availability;

const saved = await tx.candidateProfile.upsert({
  where: { personId: person.id },
  create: { /* inalterado: ?? null */ },
  update: updateData,
  select: { publicationStatus: true },
});
```
> O guard `!== undefined` é robusto tanto se o Zod omite a chave do opcional ausente quanto se a inclui como `undefined` — nos dois casos a coluna é preservada.

### 2. `candidate-form.tsx` — status real + defaultValues (CAND-2-UI, CAND-3)

- **Purpose**: Refletir o status real e pré-preencher o formulário.
- **Location**: `src/modules/persons/components/candidate-form.tsx`
- **Interfaces**: `CandidateFormProps` ganha `defaultValues?: Partial<CandidateProfileInput>` (opcional — testes atuais que omitem seguem com form vazio).
- **Mudanças**:
  1. **CAND-3**: `useForm({ resolver, defaultValues })`; **remover** o `defaultValue=""` hardcoded dos dois `<select>` (RHF passa a dirigir o valor via `register`; manter a `<option value="" disabled>Selecione…</option>`).
  2. **CAND-2-UI**: `isDraft = status === 'DRAFT'` já existe; a caixa de rascunho + "Enviar para moderação" já são gated por `isDraft`. Como a action agora devolve o status real, `setStatus(result.data.publicationStatus)` deixa de forçar DRAFT. Adicionar bloco informativo `isActive = status === 'ACTIVE'` ("Seu perfil está **ativo** e visível nas buscas.") — não-acionável. Demais status: nenhuma caixa acionável (superfície neutra).
- **Dependencies**: RHF, actions (inalteradas).
- **Reuses**: `defaultValues` do RHF (`job-form.tsx`); blocos de status já existentes.

### 3. `CvUploadForm.tsx` — gate de aceite `CV_AI_EXTRACTION` (CAND-6)

- **Purpose**: Conceder o termo antes do upload; sem consentimento, sem despacho.
- **Location**: `src/modules/cv-extraction/components/CvUploadForm.tsx`
- **Interfaces**: `CvUploadFormProps` ganha `term: { version: string; contentHash: string; body: string } | null` e `alreadyGranted: boolean` (mantém `onConfirmed?`).
- **Mudanças**:
  1. Estado `consentChecked` (init = `alreadyGranted`), espelhando `candidate-form.tsx`.
  2. Renderizar `LgpdBox` com `term.body` + checkbox quando `!alreadyGranted` (e `term != null`); botão "Enviar e extrair dados" `disabled` até `consentChecked` (quando `!alreadyGranted`).
  3. Em `onUploadClick`: se `!alreadyGranted` → chamar `grantConsent({ purpose: 'CV_AI_EXTRACTION' })` **antes** de `uploadCv`; se falhar, `setServerError` + parar (não sobe). Se `term == null`, desabilitar upload com aviso PT-BR.
  4. Import direto `import { grantConsent } from '@/modules/consents/actions/grant-consent'` (`eslint-disable no-restricted-imports`, precedente do `candidate-form.tsx`).
- **Dependencies**: `grantConsent`, `uploadCv`/`extractCvFromUpload`/`confirmCvFields` (inalteradas).
- **Reuses**: gate `LgpdBox`+checkbox do `candidate-form.tsx`.

### 4. `candidato/page.tsx` — wiring (CAND-3 + CAND-6)

- **Purpose**: Carregar `defaultValues` do perfil e o termo/consentimento de CV.
- **Location**: `src/app/(app)/candidato/page.tsx`
- **Mudanças**:
  1. **CAND-3**: expandir o `candidateProfile.findUnique` `select` para `{ publicationStatus, educationLevel, primaryAreaOfInterestId, headline, experienceText }`; montar `defaultValues = { educationLevel: profile?.educationLevel ?? '', primaryAreaOfInterestId: profile?.primaryAreaOfInterestId ?? '', phone: person.phone ?? '', headline: profile?.headline ?? '', experienceText: profile?.experienceText ?? '' }`; passar `defaultValues` ao `CandidateForm`.
  2. **CAND-6**: `loadTerm('CV_AI_EXTRACTION')` (try/catch `TermLoaderError` → `cvTerm=null`) + `alreadyGranted = (await requireActiveConsent(person.id, 'CV_AI_EXTRACTION')).active`; passar `term={cvTerm}` e `alreadyGranted` ao `CvUploadForm`.
- **Dependencies**: `loadTerm`, `stripTermFrontMatter`, `requireActiveConsent`, `prisma`, `requireActivePerson`.
- **Reuses**: o carregamento de termo já existente para `JOB_APPLICATION`.

---

## Data Models

Nenhum modelo novo/alterado. Colunas usadas já existem em `candidate_profiles` (`skills_text`, `courses_text`, `education_area`, `availability`, `publication_status`, `education_level`, `primary_area_of_interest_id`, `headline`, `experience_text`) e o enum `ConsentPurpose.CV_AI_EXTRACTION`. **Sem migração.**

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
|---|---|---|
| Upsert falha (CAND-1/2) | `catch` já existente → `fail('INTERNAL', …)` | Mensagem PT-BR "Não foi possível salvar…" (inalterado) |
| `grantConsent` falha (termo adulterado/DB) — CAND-6 | `CvUploadForm` mostra `serverError` e não chama `uploadCv` (PERF-05c) | Erro PT-BR; upload não ocorre |
| Termo `CV_AI_EXTRACTION` indisponível | `page.tsx` passa `term=null`; `CvUploadForm` desabilita upload com aviso | "Termo indisponível…" PT-BR |
| Consentimento já ativo | `alreadyGranted=true` → sem termo, sobe direto | Zero fricção |
| Status ≠ DRAFT após save | Nenhuma ação inválida oferecida (PERF-03/03b) | Sem "transição não permitida" |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
|---|---|---|---|
| **Atualização de teste que codificava o bug** — `candidate-actions.test.ts` "happy path (só obrigatórios)" mocka `upsert` retornando `{}`; a action passará a ler `saved.publicationStatus` | `src/modules/persons/__tests__/candidate-actions.test.ts:92,104` | Teste falha se o mock não retornar status | T2: mock resolve `{ publicationStatus: 'DRAFT' }`; asserção de `res.data` segue `DRAFT` (create). **Sem enfraquecer** — só alinhar o mock ao novo contrato |
| Teste "todos os opcionais" verifica o ramo `update` com todas as chaves presentes | `candidate-actions.test.ts:126-147` | Com partial-update (A-01), todas presentes → todas incluídas → **passa sem mudança** | T1 preserva; adiciona teste do ramo ausente (PERF-MN-01) |
| `CvUploadForm.test.tsx` renderiza `<CvUploadForm />` sem props; props novas serão obrigatórias | `src/modules/cv-extraction/components/__tests__/CvUploadForm.test.tsx` | Testes quebram por falta de props | T4: passar `alreadyGranted={true}` (+ `term`) nesses testes → gate bypassado → fluxos upload/extract/confirm/fallback/tamanho **preservados**; adicionar testes do gate (PERF-05/MN-03) |
| `page.test.tsx` não mocka `requireActiveConsent`; `loadTerm` será chamado 2× (JOB_APPLICATION + CV_AI_EXTRACTION) | `src/app/(app)/candidato/page.test.tsx:23-27,53-57` | Página lança/props faltam | T5: adicionar mock de `requireActiveConsent` e ajustar `loadTerm` mock (resolver por finalidade); `CandidateForm`/`CvUploadForm` seguem stubbados → asserções de gating preservadas |
| Remover `defaultValue=""` dos `<select>` pode mudar o valor inicial | `candidate-form.tsx:121,140` | Submit vazio deve continuar disparando erro Zod | T3: `defaultValues` (quando ausente) mantém `undefined`/`''` → enum inválido → "Selecione a escolaridade" (teste existente preservado, `CandidateForm.test.tsx:67-75`) |
| Import client→server action fora do barrel | `CvUploadForm.tsx` (novo import de `grantConsent`) | Lint `no-restricted-imports` | `eslint-disable-next-line` com justificativa (precedente `candidate-form.tsx:14-15`) |

> Nenhum concern de segurança/perf novo: as barreiras de backend (CVE-06/CVE-MN-03 no `uploadCv`; consents append-only; sequência da Server Action em `activateCandidateRole`) permanecem intactas — esta USP corrige apresentação/persistência sem afrouxar guardas.

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
|---|---|---|
| Fronteira de escrita do perfil | `activateCandidateRole` escreve **só** os campos do formulário; `confirmCvFields` (USP-040) é dono dos campos de CV | Elimina o clobber (CAND-1) sem exibir os campos de CV no form; feature-local (não é convenção de projeto → sem AD-NNN) |
| Status real via retorno do `upsert` | Capturar `select: { publicationStatus: true }` no callback de `withAudit` | Sem query extra; precedente `grantConsent` |
| Não decidir H-5 | UI apenas **para de mentir**; persistência inalterada (sem rebaixar status) | H-5 é decisão do PO (Fase 9); implementação segura sob qualquer resolução → Entry Gate livre |
| `grantConsent` no client antes do `uploadCv` | Espelha `activateAdditionalRole` antes de `activateCandidateRole` no `CandidateForm` | Padrão consolidado; `grantConsent` autossuficiente e idempotente |

> **Projeto-level:** nenhuma. Todas as decisões são feature-local — nada a acrescentar em `.specs/STATE.md ## Decisions`.
