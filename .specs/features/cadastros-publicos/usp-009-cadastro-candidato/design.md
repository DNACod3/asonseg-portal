# USP-009 — Cadastro de candidato — Design

> Deriva de [`spec.md`](./spec.md). Contratos confirmados no código em 2026-06-10 (módulos `consents`, `audit`, `identity`, `shared` **e `moderation`** já existem — USP-016 mergeada).

## 1. Visão geral da arquitetura

Camadas (de baixo para cima), uma por sub-task:

```
#36  schema       prisma: model CandidateProfile (usa ContentStatus da USP-016) + relações + migration
        ↓
#41  domain+schemas  persons/domain (EducationLevel, regras puras) + persons/schemas (Zod PT-BR)
        ↓
#44  server-action   persons/actions: activateCandidateRole · submitCandidateForModeration
        ↓                (usa consents · audit · identity · moderation: transitionContent
        ↓                 + ContentKind.CANDIDATE_PROFILE + adapter ContentStatusRepository)
#46  ui              (app)/candidato/page.tsx + components/candidate-form.tsx (RHF + zodResolver)
```

Princípio: cada camada só depende das de baixo. A UI (#46) nunca toca Prisma; chama Server Actions.
As Server Actions (#44) nunca fazem `prisma.update` de status — usam `transitionContent()`.

## 2. Modelo de dados (#36)

`CandidateProfile` conforme `technical-design.md §2.2` (relação 1:1 com `Person`, FK opcional `JobArea`):

```prisma
model CandidateProfile {
  personId                String        @id @map("person_id") @db.Uuid
  headline                String?
  primaryAreaOfInterestId String?       @map("primary_area_of_interest_id") @db.Uuid
  educationLevel          String?       @map("education_level")
  educationArea           String?       @map("education_area")
  experienceText          String?       @map("experience_text") @db.Text
  skillsText              String?       @map("skills_text") @db.Text
  coursesText             String?       @map("courses_text") @db.Text
  availability            String?
  cvStoragePath           String?       @map("cv_storage_path")
  cvSha256                String?       @map("cv_sha256")
  cvUploadedAt            DateTime?     @map("cv_uploaded_at") @db.Timestamptz(6)
  cvLastConfirmedAt       DateTime?     @map("cv_last_confirmed_at") @db.Timestamptz(6)
  publicationStatus       ContentStatus @default(DRAFT) @map("publication_status")
  lastStatusChangeAt      DateTime      @default(now()) @map("last_status_change_at") @db.Timestamptz(6)
  createdAt               DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt               DateTime      @updatedAt @map("updated_at") @db.Timestamptz(6)
  person                  Person        @relation(fields: [personId], references: [id])
  primaryAreaOfInterest   JobArea?      @relation(fields: [primaryAreaOfInterestId], references: [id])
  @@index([publicationStatus])
  @@map("candidate_profiles")
}
```

**Decisões:**
- `educationLevel`/`educationArea` ficam como `String?` no DB (alinhado ao design doc); o **enum** `EducationLevel` vive no `domain/` (#41) e valida na fronteira. Evita migration por mudança de taxonomia.
- Relações reversas a adicionar: `Person.candidateProfile CandidateProfile?` e `JobArea.candidateProfiles CandidateProfile[]` (GAP-4).
- **`ContentStatus` já existe** no `schema.prisma` e em `@/modules/moderation` (entregue pela USP-016) — #36 **referencia** o enum, **não redeclara** (GAP-3 resolvido). `publicationStatus ContentStatus @default(DRAFT)`.

## 3. Domain & Schemas (#41)

- `persons/domain/candidate.ts`: `enum EducationLevel` (taxonomia de escolaridade), tipo `CandidateProfileInput`, regras **puras sem IO** (ex.: `normalizePhone(raw): string`).
- `persons/schemas/candidate.ts`: Zod 3.x.
  - **Obrigatórios:** `educationLevel` (enum), `primaryAreaOfInterestId` (uuid), `phone` (telefone BR normalizável). Mensagens PT-BR.
  - **Opcionais:** `headline`, `educationArea`, `experienceText`, `skillsText`, `coursesText`, `availability`.
  - Tipos derivados via `z.infer`. Export via barrel `@/modules/persons`.

## 4. Server Actions (#44) — sequência canônica

Retorno sempre `ActionResult<T>` (`{ ok:true, data } | { ok:false, error }`), **nunca `throw`**.

### `activateCandidateRole(input)` — CAD-01, CAD-05

```
1. safeParse(candidateSchema, input)            → erro VALIDATION (fieldErrors PT-BR)
2. requirePermission('candidate:self-activate') → erro UNAUTHENTICATED/FORBIDDEN (Pessoa própria)
3. requireActiveConsent(personId, 'PORTAL_ACCESS') && (…, 'JOB_APPLICATION')
                                                 → erro CONSENT_REQUIRED se ABSENT/OUTDATED/REVOKED
   (+ 'CV_AI_EXTRACTION' apenas quando houver anexo de CV — CAD-02 parcial)
4. pré-condição idempotência: se CandidateProfile já existe → não duplica (upsert/early-return)
5. withAudit('CANDIDATE_ROLE_ACTIVATED', async (tx) => {
       upsert CandidateProfile { publicationStatus: DRAFT }
       garantir Role CANDIDATE ativo para a Person
   })
```

Consentimento: o aceite vem do form (#46); `grantConsent()` (módulo `consents`) registra cada
finalidade **antes** ou dentro da mesma transação da ativação. Decisão: registrar consentimento via
`grantConsent` no fluxo do form e o `activateCandidateRole` apenas **verifica** com `requireActiveConsent` (passo 3). Isso mantém a Action idempotente e a coleta de consentimento explícita no cliente.

### `submitCandidateForModeration(personId)` — CAD-03

`transitionContent()` (USP-016) **já audita** a transição internamente (emite `CONTENT_SUBMITTED_TO_MODERATION` via `eventTypeFor(to, trigger)`) e roda status+audit na **mesma transação**. Logo a Action **não** envolve seu próprio `withAudit` para a transição — apenas valida permissão/propriedade e delega:

```ts
1. requirePermission(self) + propriedade do perfil (a Pessoa é dona do CandidateProfile)
2. pré-condição: perfil existe (a validação DRAFT→IN_MODERATION é feita pela máquina de estados)
3. return transitionContent({
       contentKind: ContentKind.CANDIDATE_PROFILE,
       contentId: personId,            // CandidateProfile.personId é o @id
       to: ContentStatus.IN_MODERATION,
       trigger: 'AUTHOR_ACTION',       // DRAFT→IN_MODERATION não exige justificativa
       actorPersonId: personId,
   })  // → ActionResult<{from, to}>; trata erros NOT_FOUND / INVALID_TRANSITION
```

**Trabalho de integração com `moderation` (GAP-1 — herdado pela #44, ver AD-005 da USP-016):**
1. **`ContentKind.CANDIDATE_PROFILE`** — adicionar ao enum em `moderation/domain/content-status.ts` e declarar as transições em `TRANSITIONS` (mínimo: `DRAFT→IN_MODERATION` `AUTHOR_ACTION`; e as de retorno/aprovação/rejeição que o coordenador usará — espelham as comuns de JOB/CV/SERVICE).
2. **Adapter concreto** `PrismaCandidateProfileStatusRepository implements ContentStatusRepository` (`loadStatus`/`updateStatus` com concorrência otimista) sobre a tabela `candidate_profiles` — análogo a `PrismaModerationContentRepository`, mas lendo/escrevendo `publicationStatus`.
3. **Despacho por `ContentKind` no `container.ts`** — hoje há **um único** `ContentStatusRepository` apontando para `_moderation_fixture`. Introduzir dispatch (factory/strategy por `ContentKind`) e registrar o adapter de candidato. Os tipos JOB/CV/SERVICE continuam na fixture até suas próprias USPs.

> **NUNCA** substituir `transitionContent` por `prisma.candidateProfile.update({ publicationStatus })` direto.

## 5. UI (#46)

- `src/app/(app)/candidato/page.tsx`: `export const dynamic = 'force-dynamic'`; SSR com `requireActivePerson()` (padrão de `(app)/consentimentos/page.tsx`).
- `src/modules/persons/components/candidate-form.tsx`: React Hook Form + `zodResolver(candidateSchema)`, shadcn/ui + Tailwind, textos PT-BR.
  - Checkbox de aceite `PORTAL_ACCESS` + `JOB_APPLICATION` → **bloqueia submit** sem aceite.
  - Submit → `activateCandidateRole` → trata `ActionResult` (toast PT-BR sucesso/erro).
  - Botão "Enviar para moderação" → `submitCandidateForModeration`; reflete status (DRAFT → IN_MODERATION).
  - Placeholder para o componente de upload/extração de CV (USP-040).

## 6. Contratos confirmados (não reinventar)

| Símbolo | Path | Assinatura |
|---|---|---|
| `ActionResult<T>` / `ActionError` | `src/shared/errors.ts` | `{ok:true,data} \| {ok:false,error:{code,message,fieldErrors?}}` |
| `requirePermission` | `src/modules/identity/server/require-permission.ts` | `(permission, {scopeArea?}) → ActionResult<{person}>` (barrel `@/modules/identity`) |
| `requireActiveConsent` | `src/modules/consents/server/require-active-consent.ts` | `(personId, purpose, client=prisma) → ConsentCheck` |
| `grantConsent` | `@/modules/consents` (barrel) | action + `grantConsentSchema` |
| `withAudit` | `src/modules/audit/withAudit.ts` | `<T>(event: AuditEventName, fn:(tx,audit)=>Promise<T>, ctx?) → Promise<T>` |
| `transitionContent` | `@/modules/moderation` (`actions/transition-content.ts`) | `({contentKind, contentId, to, trigger, justification?, actorPersonId}) → ActionResult<{from,to}>` — **já audita** a transição |
| `ContentKind` / `ContentStatus` | `@/modules/moderation` (`domain/content-status.ts`) | `ContentKind`: JOB/CV/SERVICE (**add CANDIDATE_PROFILE**) · `ContentStatus`: DRAFT…INACTIVATED (no schema) |
| `ContentStatusRepository` + token | `@/modules/moderation` (`ports/content-status.port.ts`) | `loadStatus(kind,id)` · `updateStatus(tx,kind,id,from,to)→boolean` · `CONTENT_STATUS_REPOSITORY_TOKEN` |
| Eventos | `src/modules/audit/events.ts` | `CONTENT_SUBMITTED_TO_MODERATION` ✅ (emitido por `transitionContent`) · `CANDIDATE_ROLE_ACTIVATED` **a adicionar** (GAP-2, só ativação) |
| Finalidades | `src/modules/consents/.../purposes.ts` | `PORTAL_ACCESS`, `JOB_APPLICATION`, `CV_AI_EXTRACTION` ✅ existem |
| Página `(app)` | `src/app/(app)/consentimentos/page.tsx` | padrão `force-dynamic` + `requireActivePerson()` |
| Teste integração | `src/modules/companies/__tests__/create-company.int.test.ts` | vitest, mock `next/headers` + `identity/server/session`, cleanup cascata |

## 7. Riscos

- **R1 (médio):** o despacho do `ContentStatusRepository` por `ContentKind` exige refatorar o `container.ts` (hoje singleton único sobre `_moderation_fixture`). Risco de regressão para JOB/CV/SERVICE se o dispatch não preservar o adapter de fixture como default. Mitigar com teste de integração do dispatch e mantendo a fixture como fallback dos kinds ainda não aterrissados.
- **R2 (baixo):** `CandidateProfile` é o **primeiro** conteúdo real a sair da fixture; as transições de `CANDIDATE_PROFILE` em `TRANSITIONS` precisam espelhar corretamente as comuns (devolução/rejeição exigem justificativa) para a fila do coordenador funcionar.
- **R3 (baixo):** taxonomia de escolaridade/áreas como `String?` no DB pode gerar dado inconsistente se a UI não restringir — mitigado pelo enum no domain + Zod.

> **Resolvido:** o risco de dependência de `moderation` inexistente (era R1 na versão anterior) deixou de existir — USP-016 mergeada em 2026-06-10.

> 💡 Diagramas inline em mermaid. Para renderização/validação (SVG/PNG, temas), considere instalar a skill `mermaid-studio`.
