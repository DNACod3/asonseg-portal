# USP-042 — Relatórios operacionais do Portal (Tasks)

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the **`idsd-spec-driven`** skill: **activate it by name** and follow its
Execute flow and Critical Rules. Do not search for skill files by filesystem path. The skill is the
source of truth (per-task cycle, gate, atomic commit, must-not/negative tests, discrimination sensor,
Verifier). **If the skill cannot be activated, STOP and report — do not proceed without it.** In ICE
mode the RED facts are produced by **`skill-tdad`** from the ACs/must-nots; the `Tests` field names the
target files and asserts — the implementer does not invent tests.

Non-negotiable per task: tests derive from spec ACs/must-nots; the gate decides done; one atomic commit
per task; never weaken/skip/delete tests; every **must-not** is owned by a task and proven by a green
**negative test** a mutation would flip.

---

**Spec**: `.specs/features/indicadores-relatorios/usp-042-relatorios-operacionais/spec.md`
**Design**: `.specs/features/indicadores-relatorios/usp-042-relatorios-operacionais/design.md`
**Status**: Draft
**Módulo dono**: `reporting` · **Sem migração de schema**; catálogo de auditoria ganha `REPORT_EXPORTED` (`audit/events.ts`).
**Depende de**: USP-041 (funda `reporting/domain/metrics.ts` + barrel).

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Guards de papel (`domain/report-access.ts`) | unit | ≥90%; todos os ramos (coord/BOARD→ops; AS/BOARD→social; voluntário/anônimo→false; R5 via MODERATE_*+delegação) | `src/modules/reporting/__tests__/*.test.ts` | `npm run test` |
| Calculadoras puras (`referral-outcomes`, `moderation-time`, `csv`) | unit | ≥90%; MP9+noResult; média envio→decisão; RFC-4180+watermark; `total=0`→"—" | `src/modules/reporting/__tests__/*.test.ts` | `npm run test` |
| Queries de relatório (`report-*.ts`) | integration | ≥80%; `where` período/status/categoria real; agregados; `take`; período vazio→vazio | `src/modules/reporting/__tests__/*.int.test.ts` | `npm run test:integration` |
| View social R6 (`social-report.view.ts`) | integration | AS/BOARD full + `SENSITIVE_FIELD_VIEWED`; **MN-05** coordenador stripped | `src/modules/reporting/__tests__/*.int.test.ts` | `npm run test:integration` |
| `exportReport` action | integration | happy CSV/PDF; **MN-01/03/06/07** | `src/modules/reporting/__tests__/*.int.test.ts` | `npm run test:integration` |
| Componentes (`report-view.tsx`, `report-pdf.tsx`) | unit (component) | render lista/filtros; **MN-04** MP9 com "sem resultado" ao lado | `src/modules/reporting/__tests__/*.test.tsx` | `npm run test` |
| Rotas `(app)/relatorios/*` | e2e + page test | **MN-02/03/05** gate de sessão/papel; happy coordenador | page: `src/**/__tests__/*.test.tsx` · e2e: `e2e/**/*.spec.ts` | `npm run test` · `npm run test:e2e` |

> **Sem migração de schema de negócio.** A única mudança fora do módulo é `REPORT_EXPORTED` em `src/modules/audit/events.ts` (catálogo fechado).
> **E2E autenticado** limitado ao gate de sessão/papel (L-007/AD-019 — sem seed de sessão Supabase no Playwright); RBAC/privacidade/export têm cobertura autoritativa em **integração/componente**.

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation | Evidence |
|---|---|---|---|
| unit (`*.test.ts`) | Yes | Puro / sem store | `reporting/__tests__/access-report.test.ts` |
| component (`*.test.tsx`) | Yes | Testing Library, DOM por teste | (novo) |
| integration (`*.int.test.ts`) | **No** | Postgres compartilhado + cleanup global | `vitest.integration.config.ts` |
| e2e (`*.spec.ts`) | No | Servidor/estado compartilhado | `e2e/` |

**Consequência:** tasks de integração (T5..T11) rodam **sequenciais** entre si (Postgres compartilhado), mesmo sem dep de código. Unit/component (T1..T4, T12-component) podem ser `[P]`.

## Gate Check Commands

| Gate Level | When | Command |
|---|---|---|
| Quick | Após tasks só unit/component | `npm run test` |
| Full | Após tasks de integração | `npm run test && npm run test:integration` |
| Build | Após tasks de rota + E2E | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` (E2E: `npm run test:e2e`) |

---

## Execution Plan

### Phase 1: Domínio puro (unit, [P])
```
T1 (RBAC guards) [P]   T2 (REPORT_EXPORTED + metrics/schema) [P]   T3 (calc puras) [P]   T4 (csv) [P]
```
### Phase 2: Queries de relatório (Sequential — int Postgres compartilhado)
```
T5 (R1 vagas) ─ T6 (R2 candidaturas) ─ T7 (R3 serviços) ─ T8 (R4 encaminhamentos) ─ T9 (R5 fila) ─ T10 (R6 social)
```
### Phase 3: Export (integration + component)
```
(T2,T4,T5..T10) ──> T11 (exportReport action + PDF)
```
### Phase 4: UI/rotas (Sequential)
```
(T5..T11) ──> T12 (rotas + report-view + E2E)
```

---

## Task Breakdown

### T1: Guards de papel `report-access.ts` (RBAC dos relatórios) [P]

**What**: Guards puros de autorização por papel — a decisão de RBAC do design §3.
**Where**: `src/modules/reporting/domain/report-access.ts` (+ barrel) · teste `src/modules/reporting/__tests__/report-access.test.ts`
**Depends on**: None
**Reuses**: forma de `canManageSocioeconomicRecord` (AD-022); `checkPermission` (`@/modules/identity`) para R5
**Requirement**: **E-001**, **REL42-MN-02**, **REL42-MN-03**, **REL42-MN-05** (parte de autorização)

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `canViewOperationalReports(roles: readonly string[])` → `roles ∩ {COORDINATOR,BOARD} ≠ ∅`; `canViewSocialReports(roles)` → `∩ {SOCIAL_ASSISTANT,BOARD}`; `canViewModerationQueueReport(person, grants)` → `checkPermission(...MODERATE_JOB|CV|SERVICE)` OR `BOARD`.
- [ ] **Negative test (MN-02/03):** voluntário/candidato/`[]`/anônimo → todos `false`; coordenador/BOARD → ops `true`; AS/BOARD → social `true`; voluntário **com** `MODERATE_JOB` delegado → fila `true`, **sem** delegação → `false`. Mutação `∩`→`∪`/troca de papel fica vermelha.
- [ ] Exportado no barrel; `npm run test` verde. Test count registrado.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(reporting): role guards for operational reports (USP-042)`

---

### T2: Evento `REPORT_EXPORTED` + extensão de `metrics.ts` + schemas de filtro [P]

**What**: Adicionar o evento de auditoria de export ao catálogo; estender o catálogo puro de métricas; Zod dos filtros/janela.
**Where**: `src/modules/audit/events.ts` (+ teste do catálogo), `src/modules/reporting/domain/metrics.ts`, `src/modules/reporting/domain/report-window.ts`, `src/modules/reporting/schemas/report-filters.ts` (+ barrel) · testes `src/modules/reporting/__tests__/report-window.test.ts`, `src/modules/audit/__tests__/events.test.ts`
**Depends on**: None
**Reuses**: bloco/convenção de `AuditEvent`; `metrics.ts` (USP-041); `date-fns-tz` (`America/Sao_Paulo`)
**Requirement**: **E-003** (evento), **E-001** (filtros), **E-005** (janela)

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `AuditEvent.REPORT_EXPORTED = 'REPORT_EXPORTED'` no catálogo fechado (bloco "Relatórios"), **sem** `justification` obrigatória; nota ancorada no card/TD §4.6 no comentário/commit.
- [ ] `metrics.ts` estendido com descritores puros MP3/MP5/MP6/MP7/MP8/MP9/MP10 (id/label/unit); sem runtime Prisma.
- [ ] `report-window.ts`: parse/validação de `{from,to}` em `America/Sao_Paulo` (boundary UTC); janela vazia/invertida tratada; **sem recusa por tamanho** (E-005, MVP).
- [ ] `report-filters.ts`: Zod para `período/status/categoria/região`.
- [ ] **Unit:** `events.test.ts` confirma `REPORT_EXPORTED` presente e não em `JUSTIFICATION_REQUIRED_EVENTS`; `report-window` converte boundaries corretamente.
- [ ] Exportado no barrel; `npm run test` verde. Test count registrado.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(audit,reporting): REPORT_EXPORTED event + report filters/window (USP-042)`

---

### T3: Calculadoras puras `referral-outcomes` (MP9) + `moderation-time` (MP10) [P]

**What**: MP9 (sucesso + "sem resultado") e MP10 (média envio→decisão) como funções puras.
**Where**: `src/modules/reporting/domain/referral-outcomes.ts`, `src/modules/reporting/domain/moderation-time.ts` (+ barrel) · testes `src/modules/reporting/__tests__/referral-outcomes.test.ts`, `moderation-time.test.ts`
**Depends on**: None
**Reuses**: enum `ReferralResult`; eventos de moderação (`CONTENT_SUBMITTED_TO_MODERATION`/`CONTENT_APPROVED`/`CONTENT_REJECTED`/`CONTENT_RETURNED_FOR_ADJUSTMENTS`)
**Requirement**: **E-004**, **REL42-MN-04** (referral-outcomes); MP10 (moderation-time)

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `referralOutcomeRates(counts): { total, withResult, withoutResult, successRate, noResultRate }` com `successRate = HIRED/withResult`, `noResultRate = withoutResult/total`; `total=0` → taxas `null` ("—").
- [ ] **Negative test (MN-04):** o retorno **sempre** inclui `noResultRate` junto de `successRate`; caso com `HIRED=17,NOT_SELECTED=3,null=5` → `successRate=17/20`, `noResultRate=5/25`. Mutação que omite/zera `noResultRate` fica vermelha.
- [ ] `moderationAvgHours(pairs: {submittedAt,decidedAt}[]): number|null` = média das diferenças em horas; par sem decisão ignorado (ou em `withoutDecision`); lista vazia → `null`.
- [ ] Exportado no barrel; `npm run test` verde. Test count registrado.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(reporting): pure MP9 outcome rates + MP10 moderation-time calculators (USP-042)`

---

### T4: Serializer CSV puro + watermark LGPD [P]

**What**: CSV RFC-4180 com injeção de watermark quando o export tem PII.
**Where**: `src/modules/reporting/domain/csv.ts` (+ barrel) · teste `src/modules/reporting/__tests__/csv.test.ts`
**Depends on**: None
**Reuses**: nenhuma dep externa (serializer próprio)
**Requirement**: **E-002**, **REL42-MN-01**

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `toCsv(rows, columns, opts?: { watermark?: string }): string` com escaping RFC-4180 (aspas duplas, `;`/`,` separador, quebras de linha) e **1ª linha watermark** quando `opts.watermark` presente.
- [ ] `WATERMARK_PII = 'Dados pessoais — uso restrito conforme LGPD'` (+ "exportado por <nome> em <data>") — helper de composição.
- [ ] **Negative test (MN-01):** export com `watermark` → 1ª linha é o watermark; célula com `"`/`;`/`\n` é escapada; período vazio → só cabeçalhos (sem erro). Mutação que remove a linha de watermark fica vermelha.
- [ ] Exportado no barrel; `npm run test` verde. Test count registrado.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(reporting): RFC-4180 CSV serializer with LGPD watermark (USP-042)`

---

### T5: Query R1 — relatório de vagas (MP4) por período/status

**What**: Agregado de vagas por status dentro da janela.
**Where**: `src/modules/reporting/queries/report-jobs.ts` (+ barrel) · teste `src/modules/reporting/__tests__/report-jobs.int.test.ts`
**Depends on**: T2 (filtros/janela)
**Reuses**: `Job.status`/`publishedAt`/`createdAt`; `report-window`/`report-filters` (T2)
**Requirement**: **E-001**, **E-005**, AC-042-3 (MP4)

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `reportJobs(filters): Promise<JobReportRow[]>` via `job.groupBy({by:['status'], where:{ createdAt/publishedAt ∈ janela, status? }, _count})`; agrega no DB, sem carregar linhas em memória.
- [ ] **Integration:** seed com vagas em ACTIVE/DRAFT/EXPIRED dentro/fora da janela → contagens por status corretas; filtro `status` estreita; **período vazio → `[]`** sem erro.
- [ ] Exportado no barrel; Gate `npm run test && npm run test:integration` verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(reporting): jobs report query MP4 (USP-042)`

---

### T6: Query R2 — relatório de candidaturas (MP6) por período

**What**: Contagem de candidaturas realizadas na janela.
**Where**: `src/modules/reporting/queries/report-applications.ts` (+ barrel) · teste `src/modules/reporting/__tests__/report-applications.int.test.ts`
**Depends on**: T2
**Reuses**: `Application.appliedAt`
**Requirement**: **E-001**, AC-042-4 (MP6)

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `reportApplications(filters): Promise<ApplicationReportRow[]>` via `application.count`/`groupBy` por janela (opcional: por dia/semana); "realizadas" = todas criadas (independe de `cancelledAt`).
- [ ] **Integration:** candidaturas dentro/fora da janela → só as de dentro contam; período vazio → 0/`[]`.
- [ ] Exportado no barrel; Gate full verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(reporting): applications report query MP6 (USP-042)`

---

### T7: Query R3 — relatório de serviços + manifestações (MP5/MP7) por período/categoria

**What**: Serviços por status/categoria (MP5) + manifestações de interesse (MP7) na janela.
**Where**: `src/modules/reporting/queries/report-services.ts` (+ barrel) · teste `src/modules/reporting/__tests__/report-services.int.test.ts`
**Depends on**: T2
**Reuses**: `Service.status`/`categoryId`/`publishedAt`; `ServiceInterest.interestedAt`
**Requirement**: **E-001**, AC-042-5 (MP5, MP7)

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `reportServices(filters): Promise<ServiceReportRow[]>` = `service.groupBy({by:['status','categoryId'], where:{...janela, categoryId?}})` + `serviceInterest.count({where:{interestedAt ∈ janela}})` (MP7).
- [ ] **Integration:** serviços em categorias A/B, ACTIVE/DRAFT → contagens por status+categoria; filtro `categoryId` estreita; manifestações na janela contadas; período vazio → vazio.
- [ ] Exportado no barrel; Gate full verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(reporting): services+interests report query MP5/MP7 (USP-042)`

---

### T8: Query R4 — relatório de encaminhamentos (MP8/MP9) por período

**What**: Encaminhamentos criados (MP8) + taxas de resultado (MP9 + "sem resultado") via T3.
**Where**: `src/modules/reporting/queries/report-referrals.ts` (+ barrel) · teste `src/modules/reporting/__tests__/report-referrals.int.test.ts`
**Depends on**: T2, T3
**Reuses**: `Referral.createdAt`/`result`; `referralOutcomeRates` (T3)
**Requirement**: **E-001**, **E-004**, **REL42-MN-04**, AC-042-6 (MP8, MP9)

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `reportReferrals(filters): Promise<ReferralReport>` = `referral.count` (MP8) + `referral.groupBy({by:['result'], where:{createdAt ∈ janela}})` → `referralOutcomeRates(...)`. O tipo `ReferralReport` **carrega `successRate` E `noResultRate`**.
- [ ] **Integration + Negative (MN-04):** encaminhamentos com resultados variados + alguns `result=null` → `successRate` e `noResultRate` corretos e **ambos presentes**; período sem encaminhamento → taxas `null`/"—". Mutação que remove `noResultRate` do retorno quebra o teste.
- [ ] Exportado no barrel; Gate full verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(reporting): referrals report query MP8/MP9 with no-result rate (USP-042)`

---

### T9: Query R5 — relatório de fila de moderação (MP10/MP3) + gate de permissão

**What**: Fila atual + tempo médio de moderação (via T3) + prestadores ativos (MP3); gate `MODERATE_*`.
**Where**: `src/modules/reporting/queries/report-moderation-queue.ts` (+ barrel) · teste `src/modules/reporting/__tests__/report-moderation-queue.int.test.ts`
**Depends on**: T1, T2, T3
**Reuses**: `audit_log` (pares submit→decisão); `moderationAvgHours` (T3); `canViewModerationQueueReport` (T1); `Service.groupBy(authorPersonId, status=ACTIVE)` (MP3)
**Requirement**: **E-001**, **REL42-MN-02**, AC-042-7 (MP10, MP3)

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `reportModerationQueue(filters): Promise<ModerationQueueReport>` = contagem da fila atual (`IN_MODERATION`/`AWAITING_ADJUSTMENTS` por tipo) + `moderationAvgHours` de pares do `audit_log` (`CONTENT_SUBMITTED_TO_MODERATION`→1ª decisão por `entityId`) + MP3 (distinct prestadores ativos).
- [ ] **Integration:** eventos de submit+aprovação/rejeição no `audit_log` → média em horas correta; sem par → ignorado; MP3 = distinct autores ACTIVE.
- [ ] **Negative test (MN-02):** o **acesso** ao R5 é decidido por `canViewModerationQueueReport` (a rota/action o consulta — coberto por T9 no nível de guard e reforçado em T12 na rota): voluntário sem `MODERATE_*` → negado (sem linhas de rascunho retornadas).
- [ ] Exportado no barrel; Gate full verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(reporting): moderation-queue report MP10/MP3, gated (USP-042)`

---

### T10: View R6 — relatório social por região (AS/BOARD full vs coordenador stripped)

**What**: Relatório social com dado sensível — 2 barreiras de privacidade (MN-05).
**Where**: `src/modules/reporting/views/social-report.view.ts` (+ barrel) · teste `src/modules/reporting/__tests__/social-report.int.test.ts`
**Depends on**: T1
**Reuses**: `SocioeconomicRecord` (persons); `canViewSocialReports` (T1); `SENSITIVE_FIELD_VIEWED` (audit existente); precedente USP-039/AD-022 (2 barreiras)
**Requirement**: **E-001**, **REL42-MN-05**, AC-042 (relatório social)

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `viewSocialReport(filters, viewer:{roles}): Promise<SocialReport | null>`: viewer sem `canViewSocialReports` e sem `canViewOperationalReports` → `null`; **AS/BOARD** → versão **full** (campos sensíveis por região) + `SENSITIVE_FIELD_VIEWED`; **coordenador** → versão **stripped** (só agregados por região; campos sensíveis **nem SELECIONADOS** na query, tipo sem eles, **sem** audit-on-read).
- [ ] **Negative test (MN-05):** viewer `COORDINATOR` + Pessoas com ficha → `getSocioeconomicRecord`/SELECT do sensível **não** ocorre (spy), `JSON.stringify` do retorno **não** casa renda/moradia/benefício/composição, **nenhum** `SENSITIVE_FIELD_VIEWED`; viewer `SOCIAL_ASSISTANT` → full + audit. Mutação que troca o gate `canViewSocialReports`→`canViewOperationalReports` dá a ficha ao coordenador → vermelho.
- [ ] Exportado no barrel; Gate full verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(reporting): social report view, role-scoped sensitive data (USP-042)`

---

### T11: Server Action `exportReport` (RBAC + ciência + auditoria + CSV/PDF)

**What**: A ação de exportação com a sequência canônica de Server Action e os 4 must-nots de export.
**Where**: `src/modules/reporting/actions/export-report.ts`, `src/modules/reporting/schemas/export-report.ts`, `src/modules/reporting/components/report-pdf.tsx` (+ barrel) · teste `src/modules/reporting/__tests__/export-report.int.test.ts`, `report-pdf.test.tsx`
**Depends on**: T2, T4, T5, T6, T7, T8, T9, T10
**Reuses**: `withAudit('REPORT_EXPORTED')`; guards (T1); `toCsv`/watermark (T4); as queries (T5..T10); `@react-pdf/renderer` (nova dep, TD §5)
**Requirement**: **E-002**, **E-003**, **REL42-MN-01**, **REL42-MN-03**, **REL42-MN-06**, **REL42-MN-07**

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `exportReport(input): ActionResult<ExportPayload>` seguindo a sequência: (1) Zod (`reportType`,filtros,`format`,`acknowledgePII`); (2) **RBAC** por `reportType` (guards T1; R5 via `MODERATE_*`) — falha → `{ok:false,error:'FORBIDDEN'}`, **sem arquivo**; (3) **P-008**: se o relatório contém PII e `acknowledgePII!==true` → `{ok:false,error:'VALIDATION'}`, **sem arquivo**; (4) roda a query; gera **CSV** (via T4, watermark se PII) ou **PDF** (`report-pdf.tsx`, watermark no cabeçalho); (5) `withAudit('REPORT_EXPORTED', tx=>{...})` grava quem/reportType/filtros/escopo-PII (sem valores PII — minimização). Nunca `throw`.
- [ ] `@react-pdf/renderer` adicionado às deps (allowlist); `report-pdf.tsx` renderiza o documento com watermark.
- [ ] **Negative tests:** **MN-03** viewer não autorizado → `FORBIDDEN`, `withAudit` não chamado, sem arquivo. **MN-06** PII sem `acknowledgePII` → `VALIDATION`, sem arquivo, sem `REPORT_EXPORTED`. **MN-01** export com PII → arquivo tem watermark. **MN-07** falha simulada do audit → export sofre rollback (nenhum arquivo "válido" retornado sem log). Export de período vazio → arquivo só-cabeçalhos, com `REPORT_EXPORTED` registrado.
- [ ] **Component test (report-pdf):** documento inclui o watermark quando PII.
- [ ] Exportado no barrel; Gate `npm run test && npm run test:integration` verde. Test count registrado.

**Tests**: integration (+ component)
**Gate**: full
**Commit**: `feat(reporting): exportReport action with RBAC, PII ack, watermark, audit (USP-042)`

---

### T12: Rotas `(app)/relatorios/*` + `report-view` + E2E

**What**: Índice de relatórios + página por tipo (lista filtrável + botões export), guardas de rota, E2E de gate.
**Where**: `src/app/(app)/relatorios/page.tsx`, `src/app/(app)/relatorios/[tipo]/page.tsx`, `src/modules/reporting/components/report-view.tsx` · page tests `src/app/(app)/relatorios/__tests__/*.test.tsx` · `e2e/reporting/relatorios.spec.ts`
**Depends on**: T5, T6, T7, T8, T9, T10, T11
**Reuses**: layout `(app)` (`force-dynamic`); `requireActivePerson`/`getCurrentPerson`; guards (T1); queries (T5..T10); `exportReport` (T11); `@/shared/ui` (AD-014)
**Requirement**: **E-001**, **E-004**, **REL42-MN-02**, **REL42-MN-03**, **REL42-MN-05**

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] Índice lista os relatórios acessíveis ao viewer (guards); `[tipo]/page.tsx` (Server Component `force-dynamic`) faz `requireActivePerson()`, aplica o guard do tipo (`notFound()`/403 quando negado — **MN-03**; R5 exige `MODERATE_*` — **MN-02**; R6 ao coordenador vem stripped — **MN-05**), busca a query com os filtros e renderiza `<ReportView/>` com filtros (período/status/categoria) e botões CSV/PDF.
- [ ] `report-view.tsx` renderiza a lista + filtros + export; para R4, exibe MP9 **com** "sem resultado registrado" ao lado (**MN-04** reforçado na UI).
- [ ] **Page test (MN-02):** voluntário sem `MODERATE_*` no R5 → `notFound()`/403, queries não chamadas. **(MN-03):** viewer não autorizado em R1..R4 → negado. **(MN-05):** coordenador no R6 → sem seção sensível.
- [ ] **Page test (happy):** coordenador → R1..R5 renderizam listas filtradas; BOARD → todos.
- [ ] **E2E (spec real, não `.fixme`):** cobre o gate de sessão/papel das rotas de relatório (L-007 — E2E autenticado deferido; asserta redirect/negação sem sessão autorizada).
- [ ] Gate `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` verde; `npm run test:e2e` da spec nova verde/gated. Test count registrado.

**Tests**: e2e (+ page test)
**Gate**: build
**Commit**: `feat(reporting): operational report routes + report view + route guards (USP-042)`

---

## Parallel Execution Map

```
Phase 1 (unit [P]):   T1     T2     T3     T4
Phase 2 (int, seq):   T5 ─ T6 ─ T7 ─ T8 ─ T9 ─ T10
Phase 3 (int):        (T2,T4,T5..T10) ──> T11
Phase 4 (seq):        (T5..T11) ──> T12
```
**Constraint:** T1..T4 unit puros ([P]). T5..T10 independentes em código mas compartilham Postgres → **sequenciais**. T8 usa T3; T9 usa T1/T3; T11 usa T4+queries; T12 usa T11+queries.

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1 | guards de papel | ✅ |
| T2 | evento + catálogo métricas + schemas | ✅ (coeso: "fundação de contrato") |
| T3 | 2 calc puras (MP9, MP10) | ✅ |
| T4 | serializer CSV | ✅ |
| T5..T10 | 1 query/view por task | ✅ Granular |
| T11 | 1 action de export (+PDF doc) | ✅ (coeso: "export") |
| T12 | rotas + view + E2E | ✅ |

## Test Co-location Validation

| Task | Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | domain guard | unit | unit | ✅ |
| T2 | event/domain/schema | unit | unit | ✅ |
| T3 | domain puro | unit | unit | ✅ |
| T4 | domain puro | unit | unit | ✅ |
| T5..T10 | query/view (integration) | integration | integration | ✅ |
| T11 | action (integration) + component | integration/component | integration/component | ✅ |
| T12 | rota + E2E | e2e (+page) | e2e | ✅ |

## Must-Not Ownership

| Must-Not | Owning task(s) | Negative test |
|---|---|---|
| **REL42-MN-01** (PII sem watermark) | T4 (csv), T11 (export) | T4: export com watermark tem a 1ª linha; T11: export PII → arquivo com watermark; mutação removendo watermark = vermelho |
| **REL42-MN-02** (fila sem MODERATE_*) | T1 (gate), T9 (query), T12 (rota) | voluntário sem `MODERATE_*` → negado; delegado → ok; mutação removendo o gate = vermelho |
| **REL42-MN-03** (não autorizado → sem dados/arquivo) | T1, T11 (action), T12 (rota) | anônimo/voluntário → `FORBIDDEN`/`notFound`, `withAudit` não chamado, sem arquivo |
| **REL42-MN-04** (MP9 sem "sem resultado") | T3 (calc), T8 (query), T12 (UI) | retorno sempre com `noResultRate`; mutação que o omite = vermelho |
| **REL42-MN-05** (ficha ao coordenador) | T1, T10 (view), T12 (rota) | coordenador → sensível não SELECIONADO/serializado, sem audit; AS → full+audit; mutação do gate = vermelho |
| **REL42-MN-06** (export PII sem ciência) | T11 (action) | `acknowledgePII!==true` + PII → `VALIDATION`, sem arquivo, sem evento |
| **REL42-MN-07** (export sem `REPORT_EXPORTED`) | T2 (evento), T11 (withAudit) | falha do audit → rollback; export sempre gera `REPORT_EXPORTED` |

✅ Todos os must-nots têm task dona e teste negativo discriminante.

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate` binários. Contagem de testes registrada por task
(anti-deleção silenciosa). O Verifier independente (author ≠ verifier) roda após a última task: checagem
spec-anchored por AC (E-001..E-005), sensor de discriminação por mutação viva e verificação
evidence-or-zero dos must-nots REL42-MN-01..07 (alvos primários: o watermark do CSV/PDF, o gate
`MODERATE_*` da fila, a ciência de PII, o SELECT condicional ao papel do R6, e o `withAudit` do export).
