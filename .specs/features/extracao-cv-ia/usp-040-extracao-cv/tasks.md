# Extração de CV via IA Generativa (USP-040) Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tasks com o skill **`idsd-spec-driven`** (a esteira do Portal usa esse tail para a fase Execute): **ative-o pelo nome** e siga o fluxo Execute + Critical Rules. Não busque arquivos de skill por caminho. O skill é a fonte da verdade do fluxo (ciclo por-task, delegação por sub-agente, revisão de adequação, Verifier, sensor de discriminação). Testes derivam dos ACs da spec e asseveram resultados definidos na spec — nunca espelham a implementação. Uma tarefa só está pronta quando o gate (test runner) passa; **um commit atômico por task**; nunca enfraquecer/pular/deletar testes.

**Se o skill não puder ser ativado, PARE e avise — não prossiga sem ele.**

---

**Design**: `.specs/features/extracao-cv-ia/usp-040-extracao-cv/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada do codebase (`vitest.config.ts`, `vitest.integration.config.ts`, `playwright.config.ts`, `package.json`) + `CLAUDE.md` (Testing Requirements) + spec. Guidelines encontrados: `CLAUDE.md` (§Testing Requirements — Server Action deve cobrir happy/Zod/permissão/consentimento/concorrência; unit 90% em domínio; integração 80% em Server Actions sensíveis), `vitest.config.ts`, `vitest.integration.config.ts`, `playwright.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Domínio puro (`domain/*.ts`: mime, extracted-fields, cost, rate-limit) | unit | Todos os ramos; 1:1 aos ACs/edge cases relevantes (MIME real, unknown-keys, malformado, boundary do rate limit, fronteira de dia SP) | `src/modules/cv-extraction/**/__tests__/*.test.ts` | `npm test` |
| Schemas Zod (`schemas/*.ts`) | unit | Aceita válido / rejeita inválido por campo | `src/modules/cv-extraction/**/__tests__/*.test.ts` | `npm test` |
| Adapters (`adapters/anthropic-cv-extractor.ts`, `fake-cv-extractor.ts`) | unit | Adapter Anthropic com SDK **mockado** (`vi.mock('@anthropic-ai/sdk')`): PDF→document, DOCX→texto, mapeia usage, `ok:false` em erro/malformado. Fake: retorna configurado | `src/modules/cv-extraction/**/__tests__/*.test.ts` | `npm test` |
| Guarda estática (import do SDK) | unit | Falha se `@anthropic-ai/sdk` importado fora do adapter allowlistado | `src/modules/cv-extraction/__tests__/no-external-llm-sdk.test.ts` | `npm test` |
| Server Actions (`actions/*.ts`) | integration | Happy + Zod + consentimento ausente + consentimento revogado + rate-limit 4º + falha-fallback + no-persist-sem-confirmar + storage-falha (Postgres real, fake do extractor via container) | `src/modules/cv-extraction/**/*.int.test.ts` | `npm run test:integration` |
| Migração Prisma (`CvUploadAttempt`) | integration | Aplica limpa; insert/count; cascade on delete | `src/modules/cv-extraction/**/*.int.test.ts` (ou `prisma/__tests__/*.integration.test.ts`) | `npm run test:integration` |
| Evento de auditoria (`events.ts`) | unit | `CV_UPLOADED` presente e **não** justification-required | `src/modules/audit/__tests__/*.test.ts` | `npm test` |
| Componente UI (`CvUploadForm.tsx`) + página | unit (component) | Renderiza; marca prefill "IA"; mostra fallback em `{fallback:true}`; guarda de sessão da página | `src/modules/cv-extraction/**/__tests__/*.test.tsx`, `**/page.test.tsx` | `npm test` |
| Fluxo E2E | e2e | Happy (upload→prefill→confirmar) + fallback (extração falha) via seam do fake | `e2e/cv-extraction/*.spec.ts` | `npm run test:e2e` |
| Port / tipos / config do container | none | — (build gate; exercitado pelas integrações) | — | build gate |

**Coverage Expectation** segue as guidelines do `CLAUDE.md` (domínio 90%/1:1; Server Actions sensíveis: happy, Zod, permissão/ownership, consentimento, concorrência/precondição).

## Parallelism Assessment

> Gerada do codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit (`*.test.ts(x)`) | Yes | jsdom isolado por arquivo; Prisma/SDK mockados; container inline | `vitest.config.ts` (default), `persons/__tests__/candidate-actions.test.ts` |
| integration (`*.int.test.ts`) | **No** | Postgres único compartilhado + container DI singleton; cleanup delete-then-create | `vitest.integration.config.ts` → `fileParallelism: false` |
| e2e (`*.spec.ts`) | No | App real + Postgres provisionado; `RATE_LIMIT_DISABLED` | `playwright.config.ts` |

## Gate Check Commands

> Gerada do codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tasks só com testes unit | `npm run typecheck && npm test` |
| Full | Após tasks com testes de integração | `npm run typecheck && npm test && npm run test:integration` |
| Build | Fim de fase / tasks config/entity-only / migração | `npm run typecheck && npm run lint && npm test && npm run test:integration && npm run build` (migração: `npm run db:migrate`) · E2E: `npm run test:e2e` |

---

## Execution Plan

### Phase 1: Foundation (Sequential)
```
T1 → T2 → T3
```

### Phase 2: Domínio puro (Parallel OK)
```
T3 ──┬→ T4 [P]
     ├→ T5 [P]
     └→ T6 [P]
```

### Phase 3: Adapters + DI + guarda (parcialmente paralelo)
```
T3,T5,T6 → T8
T3 ──────→ T7 [P]
T7,T8 ───→ T9
T8 ──────→ T10 [P]
```

### Phase 4: Server Actions (Sequential — integração não é parallel-safe)
```
T3 → T11 → T12 → T13 → T14
```

### Phase 5: UI + E2E (Sequential)
```
T12,T13,T14 → T15 → T16
```

---

## Task Breakdown

### T1: Adicionar evento de auditoria `CV_UPLOADED`
**What**: Acrescentar `CV_UPLOADED: 'CV_UPLOADED'` ao `AuditEvent` (seção "Extração de CV (ADR-0012)"), fora de `JUSTIFICATION_REQUIRED_EVENTS`.
**Where**: `src/modules/audit/events.ts` (modify); `src/modules/audit/__tests__/*.test.ts`
**Depends on**: None
**Reuses**: catálogo/convenção existente + `requiresJustification`
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] `AuditEvent.CV_UPLOADED === 'CV_UPLOADED'`; comentário cita ADR-0012.
- [ ] Teste unit assevera presença no catálogo e `requiresJustification('CV_UPLOADED') === false`.
- [ ] Gate quick passa: `npm run typecheck && npm test`.
**Tests**: unit · **Gate**: quick
**Commit**: `feat(audit): adiciona evento CV_UPLOADED (USP-040)`

### T2: Modelo Prisma `CvUploadAttempt` + migração
**What**: Model `CvUploadAttempt` (id, personId, createdAt, `@@index([personId, createdAt])`, `@@map("cv_upload_attempts")`) + relação inversa em `Person` + migração; `prisma generate`.
**Where**: `prisma/schema.prisma` (modify); `prisma/migrations/*`; teste `*.int.test.ts`
**Depends on**: None
**Reuses**: padrão `AuthAttempt` / `auth_attempts`
**Tools**: MCP: `context7` (Prisma se preciso) · Skill: NONE
**Done when**:
- [ ] Migração aplica limpa (`npm run db:migrate`), sem arrastar drift pré-existente.
- [ ] Teste de integração: insert + count por `personId`/janela; `onDelete: Cascade` verificado.
- [ ] Gate full passa.
**Tests**: integration · **Gate**: build (inclui migração)
**Commit**: `feat(persons): tabela cv_upload_attempts p/ rate limit de CV (USP-040)`

### T3: Porta `CVExtractor` + tipos + token + skeleton do módulo
**What**: `ports/cv-extractor.port.ts` (interface + `CvExtractionInput/CvExtractedFields/CvExtractionUsage/CvExtractionResult` + `CV_EXTRACTOR_TOKEN = createToken<CVExtractor>('CVExtractor')`) e barrel `index.ts` exportando token/tipos.
**Where**: `src/modules/cv-extraction/ports/cv-extractor.port.ts`, `src/modules/cv-extraction/index.ts`
**Depends on**: None
**Reuses**: shape de `identity/ports/captchaVerifier.ts` + `createToken`
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] Interface + tipos + token compilam; barrel exporta.
- [ ] Gate build passa (`npm run typecheck && npm run build`).
**Tests**: none · **Gate**: build

### T4: `domain/mime.ts` — detecção de MIME real + tamanho `[P]`
**What**: `detectCvMime(bytes): CvMimeType | null` (magic bytes PDF/DOC-OLE2/DOCX-zip+`word/`), `MAX_CV_BYTES`, `CvMimeType`.
**Where**: `src/modules/cv-extraction/domain/mime.ts` + `__tests__/mime.test.ts`
**Depends on**: T3
**Reuses**: —
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] Testes 1:1: PDF real→pdf; `.pdf` com bytes não-PDF→null; DOC OLE2→doc; DOCX (zip+`word/`)→docx; bytes aleatórios/zip genérico→null; boundary de `MAX_CV_BYTES`.
- [ ] Gate quick passa.
**Tests**: unit · **Gate**: quick

### T5: `domain/extracted-fields.ts` — parse/validação dos 5 campos `[P]`
**What**: `parseExtractedFields(raw): CvExtractedFields | null` — Zod, ignora chaves desconhecidas, mapeia só escolaridade/área/experiência/habilidades/cursos; malformado/vazio→null.
**Where**: `src/modules/cv-extraction/domain/extracted-fields.ts` + `__tests__/extracted-fields.test.ts`
**Depends on**: T3
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] Testes: JSON válido→5 campos; chaves extras ignoradas (edge case); JSON malformado→null; objeto vazio→null.
- [ ] Gate quick passa.
**Tests**: unit · **Gate**: quick

### T6: `domain/cost.ts` + `domain/rate-limit.ts` `[P]`
**What**: `estimateExtractionCostUsd(usage, model)` (tabela por modelo) + `DAILY_CV_UPLOAD_LIMIT=3`, `startOfDaySaoPaulo(now)` (date-fns-tz), `isOverDailyLimit(count)`.
**Where**: `src/modules/cv-extraction/domain/{cost,rate-limit}.ts` + `__tests__/*.test.ts`
**Depends on**: T3
**Reuses**: `date-fns-tz` (TZ `America/Sao_Paulo`), regra pura estilo `identity/domain/lockout.ts`
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] Testes: custo (input+output×tarifa); fronteira de dia SP (23:59 vs 00:01 local); `isOverDailyLimit(2)=false`, `(3)=true`.
- [ ] Gate quick passa.
**Tests**: unit · **Gate**: quick

### T7: `adapters/fake-cv-extractor.ts` `[P]`
**What**: `FakeCVExtractor implements CVExtractor` com resultado configurável (ok/fields/usage ou ok:false/reason).
**Where**: `src/modules/cv-extraction/adapters/fake-cv-extractor.ts` + `__tests__/fake-cv-extractor.test.ts`
**Depends on**: T3
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] Teste: retorna resultado configurado (ok e ok:false).
- [ ] Gate quick passa.
**Tests**: unit · **Gate**: quick

### T8: `adapters/anthropic-cv-extractor.ts`
**What**: `AnthropicCVExtractor implements CVExtractor` via `@anthropic-ai/sdk`; PDF→bloco `document`; DOCX→texto (`mammoth`); DOC→best-effort; JSON por prompt→`parseExtractedFields`; usage+custo; nunca lança (erro→`ok:false`). Adicionar deps `@anthropic-ai/sdk` + `mammoth` ao `package.json`.
**Where**: `src/modules/cv-extraction/adapters/anthropic-cv-extractor.ts` + `__tests__/anthropic-cv-extractor.test.ts`; `package.json` (modify)
**Depends on**: T3, T5, T6
**Reuses**: `env.ANTHROPIC_API_KEY/MODEL`; adapter thin estilo `turnstileCaptchaVerifier`
**Tools**: MCP: `context7` (SDK Anthropic — usar skill claude-api p/ shape do `document`/`usage`) · Skill: `claude-api`
**Done when**:
- [ ] SDK mockado (`vi.mock('@anthropic-ai/sdk')`): PDF→content block `document`; DOCX→text block; mapeia `usage.input_tokens/output_tokens`→custo; SDK lança→`ok:false PROVIDER_ERROR`; JSON malformado→`ok:false MALFORMED`.
- [ ] É o **único** arquivo de `src/` que importa `@anthropic-ai/sdk`.
- [ ] Gate quick passa.
**Tests**: unit · **Gate**: quick

### T9: Wiring DI no container
**What**: Registrar `CV_EXTRACTOR_TOKEN`→`AnthropicCVExtractor` (prod) e `FakeCVExtractor` sob flag guardada (`CV_EXTRACTOR_FAKE`, ignorada em deploy Vercel real via `VERCEL_ENV`). Adicionar flag a `src/shared/env.ts` se necessário.
**Where**: `src/shared/container.ts` (modify); `src/shared/env.ts` (modify se preciso)
**Depends on**: T7, T8
**Reuses**: padrão de binding lazy + `eslint-disable no-restricted-imports` do container; guarda `RATE_LIMIT_DISABLED`/`VERCEL_ENV`
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] `container.resolve(CV_EXTRACTOR_TOKEN)` retorna Anthropic por padrão; fake sob flag guardada.
- [ ] Guard impede fake em `VERCEL_ENV` real (teste do env).
- [ ] Gate build passa.
**Tests**: none (config; coberto pelas integrações T12–T14) · **Gate**: build

### T10: Guarda estática — proibir import direto do SDK `[P]`
**What**: `no-external-llm-sdk.test.ts` varre `src/` (recursivo, ignora `__tests__`) e assevera que `@anthropic-ai/sdk` só é importado pelo adapter allowlistado (`adapters/anthropic-cv-extractor.ts`); teste-sanity de que o arquivo allowlistado existe.
**Where**: `src/modules/cv-extraction/__tests__/no-external-llm-sdk.test.ts`
**Depends on**: T8
**Reuses**: template `companies/__tests__/no-external-verify.test.ts` + allowlist estilo `jobs/__tests__/no-out-of-band-status-write.test.ts`
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] Guarda verde no HEAD; falharia se outro arquivo importasse `@anthropic-ai`.
- [ ] Sanity: arquivo allowlistado existe.
- [ ] Gate quick passa.
**Tests**: unit · **Gate**: quick — **cobre CVE-MN-05**

### T11: Schema Zod `confirmCvFields` (+ guarda do arquivo no upload)
**What**: `schemas/confirm-cv-fields.schema.ts` (5 campos opcionais, trim/max, `educationLevel` ∈ `EDUCATION_LEVELS`) + tipo input; helper de validação do `File` do upload (presença/tipo).
**Where**: `src/modules/cv-extraction/schemas/*.ts` + `__tests__/*.test.ts`
**Depends on**: T3
**Reuses**: `persons/schemas/candidate.ts`, `persons/domain/candidate.ts` (`EDUCATION_LEVELS`)
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] Testes: aceita input válido; rejeita `educationLevel` inválido / campo acima do limite; upload sem `File`→erro.
- [ ] Gate quick passa.
**Tests**: unit · **Gate**: quick

### T12: `actions/upload-cv.ts`
**What**: `uploadCv(formData)` — Zod→ownership→carrega perfil→consentimento→MIME/size→rate-limit→storage→`withAudit('CV_UPLOADED')` (create `CvUploadAttempt` + update `candidate_profiles.cv*`).
**Where**: `src/modules/cv-extraction/actions/upload-cv.ts` + `__tests__/upload-cv.int.test.ts`; barrel
**Depends on**: T1, T2, T4, T6, T9, T11
**Reuses**: `getCurrentPerson`, `requireActiveConsent`, `withAudit`, `createSupabaseStorageClient`, `STORAGE_BUCKETS.CVS`, `ok/fail`
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] Integração: happy (arquivo em `cvs/{personId}/…` + `CV_UPLOADED` + linha `CvUploadAttempt` + colunas `cv*` gravadas).
- [ ] Negativos: MIME inválido→`VALIDATION` **e `storage.upload` NÃO chamado, `cvStoragePath` inalterado** (CVE-MN-02); >5MB→`VALIDATION`; sem consentimento→`CONSENT_REQUIRED` **sem storage** (CVE-MN-03); 4º upload no dia→`PRECONDITION_FAILED` **sem storage** (CVE-MN-04); storage falha→`fail` **sem `CV_UPLOADED`**; sem `candidate_profiles`→`PRECONDITION_FAILED`.
- [ ] Retorno sempre `{ok}|{ok:false,error}` (nunca throw). Test count registrado.
- [ ] Gate full passa.
**Tests**: integration · **Gate**: full — **cobre CVE-01/06/07, CVE-MN-02/03/04**
**Commit**: `feat(cv-extraction): upload de CV com validação MIME/tamanho, consentimento e rate limit (USP-040)`

### T13: `actions/extract-cv.ts`
**What**: `extractCvFromUpload()` — ownership→lê `cvStoragePath`→**consentimento (guarda de revogação)**→download→`CV_EXTRACTION_REQUESTED`→`resolve(CV_EXTRACTOR_TOKEN).extract`→ok:`CV_EXTRACTION_COMPLETED`(metadados)+retorna draft **sem persistir**; falha:`CV_EXTRACTION_FAILED`+fallback sem throw.
**Where**: `src/modules/cv-extraction/actions/extract-cv.ts` + `__tests__/extract-cv.int.test.ts`; barrel
**Depends on**: T3, T5, T9, T12
**Reuses**: `container.resolve`, `withAudit`, storage `.download`, `requireActiveConsent`
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] Integração (fake via `container.register`): happy → `CV_EXTRACTION_REQUESTED`+`CV_EXTRACTION_COMPLETED` com tokens/duração/custo em `after`; retorna `{extracted, fromAi:true}`.
- [ ] **CVE-MN-01**: após extract, colunas estruturadas de `candidate_profiles` **inalteradas** (nada persistido).
- [ ] **CVE-MN-03**: revogar consentimento entre upload e extract → `CONSENT_REQUIRED`, **fake NÃO chamado**, sem `CV_EXTRACTION_COMPLETED`.
- [ ] **CVE-MN-06 / CVE-05**: fake `{ok:false}` → `CV_EXTRACTION_FAILED` + `{ok:true, extracted:null, fallback:true}` **sem throw**.
- [ ] Auditoria guarda **metadados**, nunca valores extraídos; sem `cvStoragePath`→`PRECONDITION_FAILED`.
- [ ] Gate full passa.
**Tests**: integration · **Gate**: full — **cobre CVE-02/03/05/08, CVE-MN-01/03/06**
**Commit**: `feat(cv-extraction): extração via porta CVExtractor com auditoria de custo e fallback (USP-040)`

### T14: `actions/confirm-cv-fields.ts`
**What**: `confirmCvFields(input)` — Zod→ownership→carrega perfil→`withAudit('CV_USER_CONFIRMED_FIELDS')` update dos 5 campos + `cvLastConfirmedAt`. **Único** caminho que grava os campos estruturados.
**Where**: `src/modules/cv-extraction/actions/confirm-cv-fields.ts` + `__tests__/confirm-cv-fields.int.test.ts`; barrel
**Depends on**: T1, T11
**Reuses**: `getCurrentPerson`, `withAudit`, `ok/fail`
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] Integração: persiste os 5 campos + `cvLastConfirmedAt` + `CV_USER_CONFIRMED_FIELDS`.
- [ ] **CVE-MN-01 (companion)**: antes de confirmar, campos inalterados; só este caminho grava.
- [ ] Zod inválido→`VALIDATION`; não autenticado→`UNAUTHENTICATED`; sem perfil→`PRECONDITION_FAILED`.
- [ ] Gate full passa.
**Tests**: integration · **Gate**: full — **cobre CVE-04, CVE-MN-01**
**Commit**: `feat(cv-extraction): confirmação humana persiste campos do CV (USP-040)`

### T15: UI `CvUploadForm` + página do candidato
**What**: Componente client orquestrando upload→extração→prefill (RHF, flag "sugerido pela IA")→confirmação; estado de processamento (p95); mensagem amigável de fallback. Página integrada ao fluxo do candidato + export no barrel.
**Where**: `src/modules/cv-extraction/components/CvUploadForm.tsx`, `src/app/(app)/candidato/**` + `__tests__/*.test.tsx`, `**/page.test.tsx`
**Depends on**: T12, T13, T14
**Reuses**: primitivas `@/shared/ui`, React Hook Form + Zod
**Tools**: MCP: NONE · Skill: `frontend-design` (opcional)
**Done when**:
- [ ] Component tests: renderiza; marca prefill como IA (CVE-03); em `{fallback:true}` mostra mensagem amigável + campos vazios editáveis (CVE-MN-06); guarda de sessão da página.
- [ ] Gate full passa.
**Tests**: unit (component) · **Gate**: full — **cobre CVE-03 (UI)**
**Commit**: `feat(cv-extraction): formulário de upload/prefill/confirmação de CV (USP-040)`

### T16: E2E happy + fallback
**What**: `e2e/cv-extraction/*.spec.ts` — fluxo feliz (upload→prefill→confirmar→campos persistidos) e fallback (extração falha → formulário manual sem erro), usando o seam do `FakeCVExtractor` (flag guardada).
**Where**: `e2e/cv-extraction/*.spec.ts`
**Depends on**: T15, T9
**Reuses**: setup Playwright (`RATE_LIMIT_DISABLED`, seed demo)
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] `npm run test:e2e` verde para ambos os cenários.
- [ ] Gate build + E2E passam.
**Tests**: e2e · **Gate**: build (+ `npm run test:e2e`)
**Commit**: `test(cv-extraction): E2E de extração de CV — happy e fallback (USP-040)`

---

## Parallel Execution Map
```
Phase 1 (Sequential):  T1 → T2 → T3
Phase 2 (Parallel):    após T3 → T4 [P], T5 [P], T6 [P]
Phase 3 (misto):       T8 (após T3,T5,T6); T7 [P] (após T3); T9 (após T7,T8); T10 [P] (após T8)
Phase 4 (Sequential):  T11 → T12 → T13 → T14   (integração não parallel-safe)
Phase 5 (Sequential):  T15 → T16
```
`[P]` = sem dependência inter-task na fase; só em tasks com testes **unit** (parallel-safe). Tasks de integração (T12–T14) rodam sequenciais mesmo sem dependência de código: o Postgres compartilhado + container singleton (`fileParallelism:false`) é o gargalo.

**Sub-agentes (Execute):** 5 fases (>3) → o skill oferece 1 worker por fase (offer-then-confirm). O Verifier independente roda automaticamente após a última task.

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1 evento auditoria | 1 const + teste | ✅ |
| T2 migração `CvUploadAttempt` | 1 model + migração | ✅ |
| T3 porta+tipos+barrel | 1 interface/token | ✅ |
| T4 mime | 1 arquivo domínio | ✅ |
| T5 extracted-fields | 1 arquivo domínio | ✅ |
| T6 cost+rate-limit | 2 arquivos coesos (custo/janela) | ⚠️ OK (coesos, puros) |
| T7 fake adapter | 1 classe | ✅ |
| T8 anthropic adapter | 1 classe + deps | ✅ |
| T9 DI wiring | 1 config | ✅ |
| T10 guarda estática | 1 teste | ✅ |
| T11 schema | 1–2 schemas coesos | ✅ |
| T12 uploadCv | 1 action | ✅ |
| T13 extractCv | 1 action | ✅ |
| T14 confirmCv | 1 action | ✅ |
| T15 UI form+página | 1 componente + página | ⚠️ OK (1 jornada) |
| T16 E2E | 2 specs coesas | ✅ |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | (raiz Fase 1) | ✅ |
| T2 | None | (raiz Fase 1) | ✅ |
| T3 | None | Fase 1 (T1→T2→T3 ordena entrega; sem dep de código real entre T1/T2/T3) | ✅ |
| T4 | T3 | T3→T4 | ✅ |
| T5 | T3 | T3→T5 | ✅ |
| T6 | T3 | T3→T6 | ✅ |
| T7 | T3 | T3→T7 | ✅ |
| T8 | T3,T5,T6 | T3,T5,T6→T8 | ✅ |
| T9 | T7,T8 | T7,T8→T9 | ✅ |
| T10 | T8 | T8→T10 | ✅ |
| T11 | T3 | T3→T11 | ✅ |
| T12 | T1,T2,T4,T6,T9,T11 | (T9,T11→) T12 | ✅ |
| T13 | T3,T5,T9,T12 | T12→T13 | ✅ |
| T14 | T1,T11 | T13→T14 (ordenação) | ✅ |
| T15 | T12,T13,T14 | T12,T13,T14→T15 | ✅ |
| T16 | T15,T9 | T15→T16 | ✅ |

> Nota: T1/T2/T3 na Fase 1 são desenhados sequenciais por **ordenação de entrega** (fundação), não por dependência estrita de código — coerente com os `Depends on: None`. T12 depende de vários da Fase 1–3 (todos concluídos antes da Fase 4).

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Evento auditoria | unit | unit | ✅ |
| T2 | Migração Prisma | integration | integration | ✅ |
| T3 | Port/tipos/barrel | none | none | ✅ |
| T4 | Domínio (mime) | unit | unit | ✅ |
| T5 | Domínio (extracted-fields) | unit | unit | ✅ |
| T6 | Domínio (cost/rate-limit) | unit | unit | ✅ |
| T7 | Adapter (fake) | unit | unit | ✅ |
| T8 | Adapter (anthropic) | unit | unit | ✅ |
| T9 | Config container | none | none | ✅ |
| T10 | Guarda estática | unit | unit | ✅ |
| T11 | Schema Zod | unit | unit | ✅ |
| T12 | Server Action | integration | integration | ✅ |
| T13 | Server Action | integration | integration | ✅ |
| T14 | Server Action | integration | integration | ✅ |
| T15 | Componente UI + página | unit (component) | unit | ✅ |
| T16 | Fluxo E2E | e2e | e2e | ✅ |

## Must-Not Ownership (Check 4)

| Must-Not | Owning task(s) | Negative test no `Done when`? |
|---|---|---|
| CVE-MN-01 (IA não persiste sem confirmar) | T13 (extract), T14 (confirm) | ✅ T13: campos inalterados pós-extract; T14: só confirm grava |
| CVE-MN-02 (arquivo inválido não é armazenado nem invoca LLM) | T12 (upload) | ✅ T12: `storage.upload` não chamado + `cvStoragePath` inalterado |
| CVE-MN-03 (sem/revogado consentimento → sem LLM) | T12, T13 | ✅ T12: sem storage; T13: fake não chamado + `CONSENT_REQUIRED` |
| CVE-MN-04 (4º upload/dia bloqueado) | T12 | ✅ T12: `PRECONDITION_FAILED` + sem storage no 4º |
| CVE-MN-05 (sem import direto do SDK) | T10 (guarda) | ✅ T10: guarda estática verde/discriminante |
| CVE-MN-06 (falha sem erro disruptivo) | T13 | ✅ T13: `{ok:true, fallback:true}` sem throw |

Todos os `[FEAT]-MN-NN` têm owning task + teste negativo → **Check 4 OK**.

---

## Task Verification Standards
Cada task segue `Done when` + `Tests` + `Gate`. Cada `Done when` é binário/testável e referencia o comando de gate. Contagem de testes registrada para prevenir deleções silenciosas. Testes derivam dos ACs/edge cases/must-nots da spec — nunca espelham a implementação.
