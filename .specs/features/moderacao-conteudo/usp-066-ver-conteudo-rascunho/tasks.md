# USP-066 — Ver conteúdo integral do rascunho na fila de moderação — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tasks com o skill de execução spec-driven do projeto: **ative-o pelo nome (`bravi-spec-driven`) e siga seu Execute flow e Critical Rules.** Não busque arquivos de skill por caminho. O skill é a fonte da verdade do fluxo (ciclo por-task, delegação a sub-agentes, adequacy review, Verifier, sensor de discriminação).

**Se o skill não puder ser ativado, PARE e avise — não prossiga sem ele.**

**Contrato inviolável (spec + premissas):** sem mudança de arquitetura (leitura por adapter-por-`ContentKind` no `shared/container.ts` espelhando `DispatchingContentStatusRepository`; status **só** por `transitionContent`; RBAC `requirePermission`; `audit_log` append-only; View Models por papel — ADR-0010); **sem entidade/tabela nova**, **sem migração**, **sem dependência nova**; PT-BR; **a query da lista `viewModerationQueue` NÃO ganha campos de conteúdo (P-004)**; preservar `transitionContent`/`TRANSITIONS`, o `VerificationPanel`/checklist da USP-017 e o gating por `viewerModeratableKinds` da USP-056; suíte de moderação existente permanece verde (com as atualizações intencionais de T9 documentadas na spec). 1 commit atômico por task.

---

**Design**: `.specs/features/moderacao-conteudo/usp-066-ver-conteudo-rascunho/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes do Execute. Guidelines encontradas: `CLAUDE.md` (§Testing Requirements: happy/Zod/permission/consent/concorrência; unit 90% em domínio; integração em Server Actions sensíveis), `vitest.config.ts` (unit/component, jsdom) + `vitest.integration.config.ts` (`*.int.test.ts`, node), padrões de teste co-locados do módulo `moderation` (mock `vi.hoisted`+`vi.mock('@/shared/lib/prisma')`, `container.register` com fakes, RTL para componentes).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Tipo/port (`moderation-content.ts`, `content-moderation-reader.port.ts`) | none (build gate) | Sem runtime; validado por typecheck/build | — | build gate |
| Adapters de leitura (`prisma-*-moderation-reader.ts`) | unit | Mapeamento de campos por kind + `null` quando não encontrado; candidato: `cvUrl` assinada e degradação a `null` (Prisma/storage mockados) | `src/modules/{jobs,services,persons}/adapters/__tests__/*.test.ts` | `npm run test` |
| Dispatcher (`dispatching-content-moderation-reader.ts`) | unit | Despacha ao adapter do kind; kind sem entrada → `null` (adapters fakes) | `src/modules/moderation/adapters/__tests__/*.test.ts` | `npm run test` |
| Server Action (`open-content.ts`) + schema | unit + integration | Unit: happy JOB/SERVICE/candidato, Zod inválido, **permissão negada → sem PII no payload (P-002)**, `null` → fail (E-006), candidato audita (`withAudit` mockado). Int: DB real — abrir candidato grava `SENSITIVE_FIELD_VIEWED`; **status inalterado (P-005)**; permissão negada não vaza campo | `src/modules/moderation/actions/__tests__/open-content.test.ts` (unit) · `.../open-content.int.test.ts` (int) | `npm run test` · `npm run test:integration` |
| Componente apresentacional (`moderation-content-details.tsx`) | unit (RTL) | Render por kind (campos de E-002/E-003/E-004); **texto longo integral (P-003)**; link de CV presente/ausente; fotos renderizadas | `src/modules/moderation/components/__tests__/moderation-content-details.test.tsx` | `npm run test` |
| Componente client (`moderation-content-panel.tsx`) | unit (RTL) | Clique carrega+renderiza (loaded); erro → aviso+estado error; **não auto-carrega no mount (P-004)** | `.../__tests__/moderation-content-panel.test.tsx` | `npm run test` |
| Componente client (`moderation-queue.tsx`, modificado) | unit (RTL) | **Aprovar desabilitado até conteúdo carregar (P-001)**; carga falha → Aprovar off, devolver/rejeitar on (E-006); **render de N itens não chama a action (P-004)**; casos existentes (aprovar/devolver/rejeitar/erros/checklist/`viewerModeratableKinds`) atualizados/preservados | `.../__tests__/moderation-queue.test.tsx` | `npm run test` |
| Route page (`(app)/moderacao/page.tsx`) | none (build gate) | **Não muda** (conteúdo é client-on-demand); typecheck/build cobrem a fiação | — | build gate |

**Coverage Expectation** — de guidelines primeiro; defaults fortes quando não houver. Domínio/adapters → ramos-chave + erro (unit mock). Server Action sensível → unit (todos os ramos, incl. negativos) + integração no efeito real (audit/status). Componente → happy + edges + testes negativos dos must-nots. Tipo/port/page-wiring → build gate.

## Parallelism Assessment

> Gerada de codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit (adapters, Prisma/storage mockados) | Yes | `vi.mock('@/shared/lib/prisma')` por arquivo; sem estado compartilhado | `src/modules/moderation/adapters/__tests__/adapters.test.ts` |
| unit (dispatcher, fakes em memória) | Yes | Fakes por teste | `dispatching-content-status-repository` (padrão) |
| unit (action, `withAudit`/`container`/`requirePermission` mockados) | Yes | Mock por arquivo | `actions/__tests__/decide.test.ts` |
| component (RTL/jsdom) | Yes | `render` isolado por teste; action mockada | `components/__tests__/moderation-queue.test.tsx` |
| integration (Postgres real) | **No** | DB compartilhado + cleanup em setup/teardown | `queries/__tests__/moderation-queue.int.test.ts` |

→ Tasks com teste **integration** (T6) **não** recebem `[P]`. Tasks unit/component parallel-safe podem ser `[P]` quando **sem dep de código**.

## Gate Check Commands

> Gerada de codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tasks só com unit/component | `npm run test` |
| Full | Após tasks com teste de integração | `npm run test && npm run test:integration` |
| Build | Fim de fase / task com registro no container ou fiação de route/RSC | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` |

---

## Execution Plan

### Phase 1: Contrato (fundação)

```
T1  (tipo ModerationContentView + port + token — build gate)
```

### Phase 2: Readers por ContentKind (paralelos — sem dep entre si, só de T1)

```
        ┌→ T2 [P]  (JOB reader — unit)
T1 ─────┼→ T3 [P]  (SERVICE reader — unit)
        └→ T4 [P]  (CANDIDATE_PROFILE reader + CV assinada — unit)
```

### Phase 3: Wiring de servidor

```
T2,T3,T4 ──→ T5  (dispatcher + registro no container — unit + build)
T5 ──────────→ T6  (Server Action openModerationContent + schema — unit + int)
```

### Phase 4: UI

```
T1 ──→ T7 [P]  (ModerationContentDetails apresentacional — RTL)
T6,T7 ──→ T8   (ModerationContentPanel client — RTL)
T8 ──→ T9      (integração no ModerationQueue + gating de Aprovar — RTL + build)
```

---

## Task Breakdown

### T1: Tipo `ModerationContentView` + port `ContentModerationReader`

**What**: Union discriminada por `ContentKind` do conteúdo de moderação + a porta/token que a resolve.
**Where**: `src/modules/moderation/views/moderation-content.ts` (novo — tipo) · `src/modules/moderation/ports/content-moderation-reader.port.ts` (novo — interface + `CONTENT_MODERATION_READER_TOKEN`)
**Depends on**: None
**Reuses**: shape de `ports/content-status.port.ts`; `createToken` de `@/shared/container`; campos espelham `viewJobDetail`/`viewServiceDetail`/`CandidateProfile`
**Requirement**: base de E-002/E-003/E-004

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `ModerationContentView` exporta as 3 variantes (`JOB`/`SERVICE`/`CANDIDATE_PROFILE`) do design §Data Models.
- [ ] `ContentModerationReader { readContent(kind, contentId): Promise<ModerationContentView | null> }` + `CONTENT_MODERATION_READER_TOKEN = createToken<…>('ContentModerationReader')`.
- [ ] Sem `'use server'`, sem IO (tipo/port puros); `npm run typecheck` verde.
- [ ] Gate build passa: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`.

**Tests**: none (build gate)
**Gate**: build
**Commit**: `feat(moderation): tipo ModerationContentView + port ContentModerationReader (E-002..E-004)`

---

### T2: `PrismaJobModerationReader` (E-002) [P]

**What**: Adapter que lê o conteúdo integral de uma vaga por `id` e devolve a variante `JOB`.
**Where**: `src/modules/jobs/adapters/prisma-job-moderation-reader.ts` (novo) · `src/modules/jobs/adapters/__tests__/prisma-job-moderation-reader.test.ts` (novo)
**Depends on**: T1
**Reuses**: `prisma`; port de `@/modules/moderation` (mesma direção de `PrismaJobStatusRepository`); seleção de campos de `viewJobDetail`
**Requirement**: E-002

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `readContent(_kind, jobId)` faz `prisma.job.findUnique` com `select` explícito de E-002 (`title, description, requirements, salary/salaryMin/salaryMax/salaryVisible, workRegime, contractType, educationLevelRequired, location, area:{name}, region:{name}, company:{razaoSocial, nomeFantasia}`) e mapeia p/ `{ kind:'JOB', … }`; `null` quando não encontrado.
- [ ] Faixa salarial respeita `salaryVisible` (oculta quando `false`); `companyName` = nome fantasia/razão social.
- [ ] Unit (Prisma mockado): mapeia todos os campos de E-002; `findUnique → null` ⇒ retorno `null`; `salaryVisible=false` ⇒ faixa oculta.
- [ ] Gate quick passa: `npm run test`.
- [ ] Test count: casos novos do arquivo (sem deleções).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(jobs): PrismaJobModerationReader lê conteúdo integral da vaga para moderação (E-002)`

---

### T3: `PrismaServiceModerationReader` (E-003) [P]

**What**: Adapter que lê o conteúdo integral de um serviço (incl. fotos) e devolve a variante `SERVICE`.
**Where**: `src/modules/services/adapters/prisma-service-moderation-reader.ts` (novo) · `src/modules/services/adapters/__tests__/prisma-service-moderation-reader.test.ts` (novo)
**Depends on**: T1
**Reuses**: `prisma`; `buildServicePhotoUrl` (`services/domain/photo-url.ts`); port de `@/modules/moderation`; seleção de `viewServiceDetail`
**Requirement**: E-003

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `readContent(_kind, serviceId)` faz `prisma.service.findUnique` com `select` de E-003 (`title, description, category:{name}, region:{name}, availabilityDescription, priceMin/priceMax/priceUnit, photos:{storagePath, position}` com `orderBy position asc`) e mapeia p/ `{ kind:'SERVICE', …, photos: storagePaths.map(buildServicePhotoUrl) }`; `null` quando não encontrado.
- [ ] `serviceArea` = `region.name`; fotos = URLs públicas do CDN (ordem `position`).
- [ ] Unit (Prisma mockado): mapeia campos de E-003 + fotos ordenadas; sem fotos ⇒ `photos: []`; `findUnique → null` ⇒ `null`.
- [ ] Gate quick passa: `npm run test`.
- [ ] Test count: casos novos (sem deleções).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(services): PrismaServiceModerationReader lê conteúdo integral do serviço para moderação (E-003)`

---

### T4: `PrismaCandidateProfileModerationReader` + URL assinada de CV (E-004) [P]

**What**: Adapter que lê o perfil de candidato por `personId` e resolve a URL assinada do CV (TTL 300s), devolvendo a variante `CANDIDATE_PROFILE`.
**Where**: `src/modules/persons/adapters/prisma-candidate-profile-moderation-reader.ts` (novo) · `src/modules/persons/adapters/__tests__/prisma-candidate-profile-moderation-reader.test.ts` (novo)
**Depends on**: T1
**Reuses**: `prisma`; resolução de URL assinada de CV já existente em `persons` (`view-candidate-for-employer` / padrão `resolveCvUrl` de `list-job-applicants.ts`: `createSupabaseStorageClient().from('cvs').createSignedUrl(path, SIGNED_URL_TTL_SECONDS)`); port de `@/modules/moderation`
**Requirement**: E-004

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `readContent(_kind, personId)` faz `prisma.candidateProfile.findUnique` com `select` de E-004 (`headline, educationLevel, educationArea, experienceText, skillsText, coursesText, cvStoragePath`) e mapeia p/ `{ kind:'CANDIDATE_PROFILE', …, cvUrl }`; `null` quando não encontrado.
- [ ] `cvUrl` = URL assinada de `cvStoragePath` com `SIGNED_URL_TTL_SECONDS` (300); `cvStoragePath` nulo ou erro de storage ⇒ `cvUrl: null` (nunca lança).
- [ ] Unit (Prisma + storage client mockados): mapeia campos; `cvStoragePath` presente ⇒ `createSignedUrl` chamado com TTL 300 e `cvUrl` preenchido; `cvStoragePath` nulo ⇒ `cvUrl: null` sem chamar storage; erro de storage ⇒ `cvUrl: null`; `findUnique → null` ⇒ `null`.
- [ ] Gate quick passa: `npm run test`.
- [ ] Test count: casos novos (sem deleções).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(persons): PrismaCandidateProfileModerationReader com CV por URL assinada TTL 5min (E-004)`

---

### T5: `DispatchingContentModerationReader` + registro no container

**What**: Dispatcher por `ContentKind` (espelha `DispatchingContentStatusRepository`) e seu binding no container; kind sem reader → `null`.
**Where**: `src/modules/moderation/adapters/dispatching-content-moderation-reader.ts` (novo) · `src/modules/moderation/adapters/__tests__/dispatching-content-moderation-reader.test.ts` (novo) · `src/shared/container.ts` (registrar) · `src/modules/moderation/index.ts` (export do token/tipo se necessário aos testes/action)
**Depends on**: T2, T3, T4
**Reuses**: registro de `DispatchingContentStatusRepository` (`container.ts:134-145`); imports profundos (padrão do container)
**Requirement**: fundação de E-002..E-004 + E-006 (kind `CV` → `null` gracioso)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `DispatchingContentModerationReader` implementa `ContentModerationReader`; `constructor(byKind: Partial<Record<ContentKind, ContentModerationReader>>)`; `readContent(kind,id)` → `this.byKind[kind]?.readContent(kind,id) ?? null`.
- [ ] `container.register(CONTENT_MODERATION_READER_TOKEN, () => new DispatchingContentModerationReader({ [JOB]: new PrismaJobModerationReader(), [SERVICE]: new PrismaServiceModerationReader(), [CANDIDATE_PROFILE]: new PrismaCandidateProfileModerationReader() }))` — **`CV` sem entrada** (fixture vazio em prod).
- [ ] Unit (adapters fakes): despacha ao adapter correto por kind; kind `CV` (sem entrada) ⇒ `null`.
- [ ] Gate build passa (registro no container é importado no servidor): `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`.
- [ ] Test count: casos novos + suíte do container/adapters intacta.

**Tests**: unit (+ build p/ container)
**Gate**: build
**Commit**: `feat(moderation): DispatchingContentModerationReader despacha leitura por ContentKind (container)`

---

### T6: Server Action `openModerationContent` + schema (P-002, E-005, E-006, P-005)

**What**: Servir o conteúdo sob demanda com gate de permissão por kind, audit-on-read fail-closed p/ candidato e falha graciosa, sem write-path de status.
**Where**: `src/modules/moderation/actions/open-content.ts` (novo, `'use server'`) · `src/modules/moderation/schemas/open-content.ts` (novo) · `src/modules/moderation/index.ts` (export `openModerationContent`) · `actions/__tests__/open-content.test.ts` (novo, unit) · `actions/__tests__/open-content.int.test.ts` (novo, int)
**Depends on**: T5
**Reuses**: sequência de `decide.ts` (`Zod → requirePermission(PERMISSION_BY_KIND[kind]) → …`); `container.resolve(CONTENT_MODERATION_READER_TOKEN)`; `withAudit`/`SENSITIVE_FIELD_VIEWED`; `ActionResult`/`ok`/`fail`; audit-on-read de `list-job-applicants.ts`
**Requirement**: E-005, E-006 · **Must-not**: P-002, P-005

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `openContentSchema` = `{ contentKind: nativeEnum(ContentKind), contentId: string().uuid() }`; inválido ⇒ `fail('VALIDATION', …)`.
- [ ] `requirePermission(PERMISSION_BY_KIND[kind])` **antes** de qualquer leitura; negado ⇒ retorna o erro do authz **sem** nenhum campo de conteúdo (P-002).
- [ ] Reader resolvido do container; `view == null` ⇒ `fail('NOT_FOUND', …)` (E-006).
- [ ] `kind === CANDIDATE_PROFILE` ⇒ `withAudit('SENSITIVE_FIELD_VIEWED', (tx,audit)=>{ audit.entityType='candidate_profile'; audit.entityId=contentId; audit.context={ viewedFields, hasCv } }, { actorPersonId: authz.data.person.id })`; se `withAudit` lançar ⇒ capturar e `fail(...)` (fail-closed, conteúdo não entregue) — E-005.
- [ ] JOB/SERVICE **não** auditam; nenhum caminho escreve `status`/`publicationStatus` (P-005).
- [ ] `export`ada no barrel; retorna `ActionResult<ModerationContentView>`, nunca `throw`.
- [ ] Unit (Prisma/container/`requirePermission`/`withAudit` mockados): happy JOB/SERVICE devolve `view`; candidato chama `withAudit` com `SENSITIVE_FIELD_VIEWED`; **permissão negada → resultado sem PII (P-002, teste negativo)**; `reader→null` ⇒ fail (E-006); `withAudit` lança ⇒ fail sem conteúdo.
- [ ] Int (DB real): abrir candidato `IN_MODERATION` grava 1 linha `SENSITIVE_FIELD_VIEWED` (ator, entityId); **`publicationStatus` inalterado antes/depois (P-005, teste negativo)**; cleanup por ids.
- [ ] Gate full passa: `npm run test && npm run test:integration`.
- [ ] Test count: casos novos; suíte de actions intacta.

**Tests**: unit + integration
**Gate**: full
**Commit**: `feat(moderation): openModerationContent serve conteúdo sob demanda com gate + audit-on-read (E-005/P-002/P-005)`

---

### T7: `ModerationContentDetails` (apresentacional) (E-002..E-004, P-003) [P]

**What**: Componente puro que renderiza o `ModerationContentView` por kind, com texto longo **integral**.
**Where**: `src/modules/moderation/components/moderation-content-details.tsx` (novo) · `components/__tests__/moderation-content-details.test.tsx` (novo)
**Depends on**: T1
**Reuses**: `@/shared/ui`; tokens do DS; layout dos detalhes públicos
**Requirement**: E-002, E-003, E-004 · **Must-not**: P-003

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `switch(view.kind)` renderiza as seções: JOB (E-002), SERVICE (E-003 + `<img>` das fotos), CANDIDATE_PROFILE (E-004 + link de CV `view.cvUrl` em nova aba; ausente ⇒ nota "CV não anexado").
- [ ] Texto longo (`description`/`experience`/…) renderizado por completo (`whitespace-pre-wrap`), **sem** clamp/truncamento silencioso (P-003) — truncar exigiria "ver mais" explícito.
- [ ] Unit (RTL): campos de cada kind presentes; **conteúdo longo (ex.: 5.000 chars) aparece integralmente na saída (P-003, teste negativo)**; `cvUrl` presente ⇒ link; `cvUrl=null` ⇒ nota; fotos renderizadas.
- [ ] Gate quick passa: `npm run test`.
- [ ] Test count: casos novos (sem deleções).

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(moderation): ModerationContentDetails exibe conteúdo integral por tipo (E-002..E-004/P-003)`

---

### T8: `ModerationContentPanel` (client — carga sob demanda) (E-001, E-006, P-004)

**What**: Painel por item que carrega o conteúdo **ao clicar** (não no mount), gerencia estado e reporta prontidão.
**Where**: `src/modules/moderation/components/moderation-content-panel.tsx` (novo, `'use client'`) · `components/__tests__/moderation-content-panel.test.tsx` (novo)
**Depends on**: T6, T7
**Reuses**: `openModerationContent` (import direto no módulo); `ModerationContentDetails`; padrão `useTransition`/estado por item do `ModerationQueue`
**Requirement**: E-001, E-006 · **Must-not**: P-004 (não auto-carregar)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Props `{ contentKind, contentId, onStateChange: (s:'idle'|'loaded'|'error')=>void }`; estado `idle|loading|loaded|error`.
- [ ] Botão "Ver conteúdo" → `openModerationContent({contentKind, contentId})`; `ok` ⇒ guarda `view`, `loaded`, `onStateChange('loaded')`, renderiza `<ModerationContentDetails view/>`; `!ok` ⇒ `error`, aviso PT-BR (`role="alert"`), `onStateChange('error')`; recarga permitida após erro.
- [ ] **NÃO** chama a action em `useEffect`/mount (P-004).
- [ ] Unit (RTL, action mockada): montar o painel **não** chama `openModerationContent` (P-004, teste negativo); clicar carrega e renderiza os campos (loaded) + `onStateChange('loaded')`; action `fail` ⇒ aviso + `onStateChange('error')` + Aprovar-gate informado.
- [ ] Gate quick passa: `npm run test`.
- [ ] Test count: casos novos (sem deleções).

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(moderation): ModerationContentPanel carrega conteúdo sob demanda ao abrir o item (E-001/E-006/P-004)`

---

### T9: Integração no `ModerationQueue` + gating de Aprovar (E-006, P-001, P-004)

**What**: Renderizar o painel por item (bloco `canModerate`) e habilitar **Aprovar** só com o conteúdo carregado, preservando os gates da checklist (USP-017) e de `viewerModeratableKinds` (USP-056); `page.tsx` não muda.
**Where**: `src/modules/moderation/components/moderation-queue.tsx` (modificar) · `components/__tests__/moderation-queue.test.tsx` (atualizar/estender)
**Depends on**: T8
**Reuses**: estado/callback de prontidão do `VerificationPanel` (`verifyReady`/`setReady`, linhas 64-68/228-233); estrutura de render do card
**Requirement**: E-006 · **Must-not**: P-001, P-004

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Novo estado `contentState: Record<string,'idle'|'loaded'|'error'>` + `setContentReady(id,s)` (espelha `setReady`).
- [ ] No ramo `canModerate`, antes dos controles: `<ModerationContentPanel contentKind={row.contentKind} contentId={row.contentId} onStateChange={(s)=>setContentReady(row.contentId,s)} />`.
- [ ] Aprovar: `disabled={rowPending || (needsChecklist && !verifyReady[id]) || contentState[id] !== 'loaded'}` + `title` "Abra o conteúdo antes de aprovar." quando não carregado (P-001).
- [ ] **Devolver/Rejeitar inalterados** (habilitados mesmo em `idle`/`error` — E-006); ramo `!canModerate` (nota "sem permissão") preservado (USP-056).
- [ ] `page.tsx` **não** é alterado para carregar conteúdo (P-004 estrutural).
- [ ] Unit (RTL): **Aprovar desabilitado enquanto `contentState !== 'loaded'` (P-001, teste negativo)**; simular `onStateChange('error')` ⇒ Aprovar off + devolver/rejeitar on (E-006); `onStateChange('loaded')` ⇒ Aprovar habilitado (respeitando o gate da checklist p/ vaga não verificada); **montar a fila com N itens não dispara `openModerationContent` (P-004, teste negativo)**; casos existentes (aprovar/devolver/rejeitar/erros/`verifyReady`/`viewerModeratableKinds`) atualizados p/ o novo AC e verdes.
- [ ] Gate build passa (fiação RSC + suíte): `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`.
- [ ] Test count: casos novos/atualizados; demais intactos.

**Tests**: unit (component)
**Gate**: build
**Commit**: `feat(moderation): fila exibe conteúdo do item e só habilita Aprovar após lê-lo (E-006/P-001/P-004)`

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: tipo + port | 2 arquivos coesos (contrato) | ✅ Granular |
| T2: 1 adapter (jobs) | 1 arquivo + teste | ✅ Granular |
| T3: 1 adapter (services) | 1 arquivo + teste | ✅ Granular |
| T4: 1 adapter (persons) + CV URL | 1 arquivo + teste | ✅ Granular |
| T5: 1 dispatcher + 1 registro | dispatcher + binding coesos | ✅ Granular |
| T6: 1 action + 1 schema | Server Action + schema coesos | ✅ Granular |
| T7: 1 componente apresentacional | 1 arquivo + teste | ✅ Granular |
| T8: 1 componente client | 1 arquivo + teste | ✅ Granular |
| T9: 1 componente (modificação) | 1 arquivo (queue) | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | Phase 1, raiz | ✅ Match |
| T2 | T1 | `T1 → T2` | ✅ Match |
| T3 | T1 | `T1 → T3` | ✅ Match |
| T4 | T1 | `T1 → T4` | ✅ Match |
| T5 | T2, T3, T4 | `T2,T3,T4 → T5` | ✅ Match |
| T6 | T5 | `T5 → T6` | ✅ Match |
| T7 | T1 | `T1 → T7` | ✅ Match |
| T8 | T6, T7 | `T6,T7 → T8` | ✅ Match |
| T9 | T8 | `T8 → T9` | ✅ Match |

`[P]`: T2, T3, T4 (Phase 2 — só dep de T1, unit parallel-safe, arquivos em módulos distintos) e T7 (Phase 4 — só dep de T1, RTL). T5/T6/T9 não `[P]` (T5 depende dos 3 adapters; T6 tem integração sequencial; T9 tem dep única). T8 depende de T6+T7 (não `[P]`).

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Tipo/port | none (build gate) | none, gate build | ✅ OK |
| T2 | Adapter de leitura | unit | unit | ✅ OK |
| T3 | Adapter de leitura | unit | unit | ✅ OK |
| T4 | Adapter de leitura | unit | unit | ✅ OK |
| T5 | Dispatcher (+ container) | unit (+ build) | unit, gate build | ✅ OK |
| T6 | Server Action sensível | unit + integration | unit + integration | ✅ OK |
| T7 | Componente apresentacional | unit (RTL) | unit | ✅ OK |
| T8 | Componente client | unit (RTL) | unit | ✅ OK |
| T9 | Componente client (+ page-wiring inalterado) | unit (RTL) [+ build] | unit, gate build | ✅ OK |

Nenhuma `Tests: none` indevida — T1 é tipo/port (matriz = none/build gate). Sem deferral de teste.

## 💠 Must-Not Ownership

| Must-Not (ICE) | Owning Task | Teste negativo (no `Done when`) |
|---|---|---|
| **P-001** (Aprovar sobre conteúdo não carregado) | T9 | RTL: `contentState !== 'loaded'` ⇒ Aprovar desabilitado; erro ⇒ off + devolver/rejeitar on |
| **P-002** (carregar/transmitir conteúdo de kind sem permissão) | T6 | Unit: permissão negada ⇒ `ActionResult` sem nenhum campo de PII (asserção sobre o payload) |
| **P-003** (truncar/resumir/cachear sem sinalizar) | T7 | RTL: conteúdo longo ⇒ texto integral presente na saída |
| **P-004** (carregar conteúdo de todos os itens no render) | T9 (+ T8) | RTL: montar a fila com N itens ⇒ 0 chamadas de `openModerationContent`; painel não auto-carrega no mount |
| **P-005** (alterar status por via ≠ `transitionContent`) | T6 | Int: abrir conteúdo não altera `status`/`publicationStatus`; a action não tem caminho de escrita de status |

Todos os must-nots têm task dona e teste negativo. ✅ Reforço transversal: o **contrato inviolável** (topo) veda migração/entidade/dep nova e a adição de campos de conteúdo a `viewModerationQueue` (P-004 na lista) — verificado no gate build/diff do PR.

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate`. Cada `Done when` é binário e referencia o comando de gate da seção **Gate Check Commands**. Contagem de testes citada para evitar deleções silenciosas. As atualizações de teste de T9 (gating de Aprovar) são **mudança de AC** (AC-066-5/P-001) — não enfraquecimento —, documentadas na spec §7 e no design §Risks.
