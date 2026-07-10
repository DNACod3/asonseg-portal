# USP-042 — Relatórios operacionais do Portal (Design)

> **ICE mode — thin design adapter.** Resolves the card's technical pointers (TD §4.4/§4.5/§4.6, ADRs
> 0022/0023/0017/0008, runbooks) and records the decisions/assumptions the card leaves open (RBAC,
> report set D-005, MP10 computation, CSV/PDF deps, DPO gate). Does not re-derive architecture.

**Status:** Draft · **Módulo dono:** `reporting` (estende a base da USP-041) · **Migração:** **nenhuma** de schema de negócio; **catálogo de auditoria** ganha `REPORT_EXPORTED` (mudança em `audit/events.ts`, não em `prisma/schema.prisma`).
**Depende de:** USP-041 (funda `reporting/domain/metrics.ts` + barrel) e de todas as USPs operacionais (todas em master).

## 1. Shape — extensão do módulo `reporting`

```
src/modules/reporting/
├── domain/
│   ├── metrics.ts          # ESTENDE (USP-041): descritores puros MP3/MP5/MP6/MP7/MP8/MP9/MP10.
│   ├── report-access.ts    # NOVO — guards puros de papel (RBAC dos relatórios) — ver §3.
│   ├── referral-outcomes.ts# NOVO — calculadora pura MP9 + taxa "sem resultado" (E-004/REL42-MN-04).
│   ├── moderation-time.ts  # NOVO — média pura envio→decisão a partir de pares de eventos (MP10).
│   ├── csv.ts              # NOVO — serializer CSV puro (RFC-4180) + injeção de watermark LGPD.
│   └── report-window.ts    # NOVO — parse/validação de janela (período) em America/Sao_Paulo.
├── queries/
│   ├── report-jobs.ts          # NOVO — R1 MP4 vagas por período/status
│   ├── report-applications.ts  # NOVO — R2 MP6 candidaturas por período
│   ├── report-services.ts      # NOVO — R3 MP5/MP7 serviços + manifestações por período/categoria
│   ├── report-referrals.ts     # NOVO — R4 MP8/MP9 encaminhamentos + outcome rates
│   └── report-moderation-queue.ts # NOVO — R5 MP10/MP3 fila + tempo médio (audit_log)
├── views/
│   └── social-report.view.ts   # NOVO — R6 view model social por região (AS/BOARD full; coordenador stripped) — REL42-MN-05
├── schemas/
│   ├── report-filters.ts   # NOVO — Zod: período/status/categoria/região
│   └── export-report.ts    # NOVO — Zod: reportType + filtros + format(CSV|PDF) + acknowledgePII(boolean)
├── actions/
│   └── export-report.ts    # NOVO — Server Action: RBAC → ciência(P-008) → withAudit('REPORT_EXPORTED') → CSV|PDF
├── components/
│   ├── report-view.tsx     # NOVO — lista filtrável + botões export (client)
│   └── report-pdf.tsx      # NOVO — documento @react-pdf/renderer
└── index.ts                # barrel estendido
```
Rotas `(app)` (autenticadas, `force-dynamic`): `src/app/(app)/relatorios/` (índice + `[tipo]/page.tsx`) e a
rota de download do export. Import sempre via barrel `@/modules/reporting`.

## 2. MP1–MP10 → agregados concretos (campos verificados no schema)

| MP | Definição (PRD §4) | Agregado |
|---|---|---|
| MP1 | candidatos ativos | `candidateProfile.count({where:{publicationStatus:'ACTIVE'}})` |
| MP2 | empresas verificadas | `company.count({where:{isVerified:true}})` |
| MP3 | prestadores ativos c/ ≥1 serviço aprovado | `service.groupBy({by:['authorPersonId'],where:{status:'ACTIVE'}})` → distinct count |
| MP4 | vagas publicadas/aprovadas | `job.groupBy({by:['status'],where:{publishedAt/createdAt ∈ janela}, _count})` (R1 por status) |
| MP5 | serviços publicados/aprovados | `service.groupBy({by:['status','categoryId'], where:{...janela}, _count})` (R3) |
| MP6 | candidaturas realizadas | `application.count({where:{appliedAt ∈ janela}})` (R2; "realizadas" = todas criadas) |
| MP7 | manifestações de interesse | `serviceInterest.count({where:{interestedAt ∈ janela}})` (R3) |
| MP8 | encaminhamentos criados | `referral.count({where:{createdAt ∈ janela}})` (R4) |
| MP9 | % encaminhamentos com resultado positivo | `referral.groupBy({by:['result']})` → `referralOutcomeRates()` (§4) (R4) |
| MP10 | tempo médio moderação (envio→decisão) | pares de `audit_log`: `CONTENT_SUBMITTED_TO_MODERATION` → 1ª de `CONTENT_APPROVED`/`CONTENT_REJECTED`/`CONTENT_RETURNED_FOR_ADJUSTMENTS`, por `entityId` (§5) (R5) |

- **Pré-agregação/paginação (E-005/P-005):** todas as queries usam `count`/`groupBy` (agregam no DB, não em
  memória) ou `take` explícito quando listam linhas (runbook-search-pagination). Sem recusa de janela no MVP.

## 3. RBAC — decisão de permissão (a decisão central desta USP)

**Fato verificado no catálogo (`src/modules/identity/domain/permissions.ts` + enum `PermissionId`):** **NÃO existe**
`VIEW_REPORTS`/`VIEW_OPERATIONAL_REPORTS`/`EXPORT_REPORT`. O `PermissionId` tem só as 9 permissões de
moderação/encaminhamento/credencial. **`BOARD` (diretoria) não tem NENHUMA permissão de catálogo** (não está em
`ROLE_PERMISSIONS`); `COORDINATOR` tem as 9; `SOCIAL_ASSISTANT` tem `REFER_PERSON_TO_JOB`/`REGISTER_REFERRAL_RESULT`.

**Decisão (mínima, alinhada a precedente):** **guards puros inline** em `reporting/domain/report-access.ts`,
**sem** adicionar valores ao enum `PermissionId` — seguindo AD-022/USP-036 (`canManageSocioeconomicRecord` = guard
inline para capacidade **intrínseca ao papel, não-delegável**) e AD-015/USP-003 (authz inline quando não há
`PermissionId` de catálogo):

- `canViewOperationalReports(roles)` = `roles ∩ {COORDINATOR, BOARD} ≠ ∅` — R1..R4.
- `canViewSocialReports(roles)` = `roles ∩ {SOCIAL_ASSISTANT, BOARD} ≠ ∅` — R6.
- **R5 (fila de moderação) — a única gated por permissão de catálogo, por exigência do P-006:** acesso sse
  `checkPermission(person,'MODERATE_JOB',grants) || MODERATE_CV || MODERATE_SERVICE` (cobre COORDINATOR inerente
  **e** voluntário com delegação) **ou** `BOARD`. Reusa `checkPermission` existente — é o mecanismo que já modela
  a delegação da USP-008 que o P-006 referencia.

**Alternativa considerada e rejeitada:** adicionar `VIEW_OPERATIONAL_REPORTS`/`VIEW_SOCIAL_REPORTS`/`EXPORT_REPORT`
ao enum `PermissionId`. Rejeitada: exige migração do enum + mudança no catálogo + superfície de delegação; **nenhum
expectation pede que o acesso a relatório seja delegável**, exceto a fila de moderação — que já mapeia às
`MODERATE_*` existentes. Over-engineering para o MVP. *(Se a diretoria pedir delegação futura de relatórios, promover
o guard a `PermissionId` é aditivo — documentado como follow-up.)*

Na Server Action / rota, a sequência canônica usa esses guards no passo "check permission" (substituindo
`requirePermission` por guard inline quando não há `PermissionId` — precedente USP-036).

## 4. MP9 + taxa "sem resultado" (E-004 / REL42-MN-04)

Calculadora **pura** `referralOutcomeRates(counts)` em `domain/referral-outcomes.ts`:
- Entrada: contagem por `ReferralResult` (`HIRED`/`NOT_SELECTED`/`UNDER_REVIEW`/`NO_RESPONSE`) + `null` (sem resultado).
- Saída: `{ total, withResult, withoutResult, successRate, noResultRate }` onde
  `successRate = HIRED / withResult` (MP9) e `noResultRate = null / total`.
- O tipo do relatório de encaminhamentos **carrega ambos** `successRate` e `noResultRate` — impossível renderizar
  MP9 sem a taxa "sem resultado". `total=0` → taxas `null`/"—" (edge). Mutação que zera/omite `noResultRate` quebra o teste.

## 5. MP10 — tempo médio de moderação (assumption documentada)

`audit_log` é a fonte da história de moderação (ADR-0023; status vive na entidade, AD-009). MP10 =
média, por conteúdo, de `(ts da 1ª decisão) − (ts do submit)`, onde submit = `CONTENT_SUBMITTED_TO_MODERATION` e
decisão = 1ª de `CONTENT_APPROVED`/`CONTENT_REJECTED`/`CONTENT_RETURNED_FOR_ADJUSTMENTS`, agrupado por `entityId`.
Calculadora pura `moderationAvgHours(pairs)` em `domain/moderation-time.ts`; a query `report-moderation-queue.ts`
extrai os pares do `audit_log`. Volume MVP baixo → sem tabela de pré-agregação. **Fila atual** = conteúdo em
`IN_MODERATION`/`AWAITING_ADJUSTMENTS` (contagem por tipo). MP3 = distinct `Service.authorPersonId` com `status='ACTIVE'`.

## 6. Export CSV/PDF + auditoria (E-002/E-003; REL42-MN-01/06/07)

- **CSV — sem dependência nova:** serializer puro `domain/csv.ts` (escaping RFC-4180: aspas/;/quebra) que
  **injeta a 1ª linha watermark** `"Dados pessoais — uso restrito conforme LGPD — exportado por <nome> em <data SP>"`
  quando `scopePII=true`. Vazio (só cabeçalhos) para período sem dados.
- **PDF — `@react-pdf/renderer`** (TD §5 nomeia explicitamente): **nova dependência** adicionada ao allowlist
  (`report-pdf.tsx`). Mesmo watermark no cabeçalho do documento. *(Flag: 1 dep nova; justificada pelo TD.)*
- **Server Action `exportReport`** (sequência canônica):
  1. Zod (`export-report.ts`): `reportType`, filtros, `format`, `acknowledgePII: boolean`.
  2. **RBAC** (guards do §3 conforme `reportType`; R5 via `MODERATE_*`) — nega → sem arquivo (REL42-MN-03).
  3. **P-008 (REL42-MN-06):** se o relatório contém PII e `acknowledgePII !== true` → `VALIDATION`, **não gera arquivo**.
  4. Executa a query, gera CSV|PDF (watermark se PII — REL42-MN-01).
  5. **`withAudit('REPORT_EXPORTED', tx => {...})`** grava quem/reportType/filtros/escopo-PII (sem valores PII — a
     minimização do `withAudit` redige chaves sensíveis). Falha do audit ⇒ rollback (REL42-MN-07). Retorno
     `ActionResult` com o payload/arquivo; nunca `throw`.
- **Evento `REPORT_EXPORTED`:** adicionar ao catálogo fechado `src/modules/audit/events.ts` (bloco novo
  "Relatórios") com nota ancorada no card/TD §4.6 (a convenção do catálogo exige ADR ou nota em runbooks para
  evento novo — a nota vive no design.md/commit). Não é evento com `justification` obrigatória.

## 7. Privacidade — R6 social + coordenador stripped (REL42-MN-05 / ADR-0022 / P-007)

- `social-report.view.ts` monta o relatório social por região a partir de `SocioeconomicRecord` (persons):
  - viewer **AS/BOARD** (`canViewSocialReports`) → versão **full** (campos sensíveis) + `SENSITIVE_FIELD_VIEWED` (audit-on-read, reusa evento existente).
  - viewer **coordenador** → versão **stripped**: os campos sensíveis (renda/moradia/benefício/composição) **nem
    são SELECIONADOS** na query (barreira estrutural — lição "anonimizar no View Model não basta / RSC-Flight"),
    e o tipo do relatório do coordenador não os contém. Só agregados não-sensíveis (ex.: contagem por região).
- Defesa em 2 barreiras (espelha USP-039/AD-022): (B1) SELECT condicional ao papel; (B2) strip estrutural no tipo.

## 8. Assumptions & deferrals (autonomous mode — sem gate de confirmação)

- **ASSUMP-U1-01 (metas MP deferidas):** metas absolutas MP1–MP10 (QP-007/D-004) **não confirmadas com o sponsor**
  → relatórios mostram **contagens/valores correntes e a taxa MP9**, **não** progresso-vs-meta. *(Flag ao dono.)*
- **ASSUMP-042-02 (D-001/DPO — gate de go-live, não de dev):** a matriz (2026-05-29) registra D-001 **resolvido**
  (DPO = Angélica); o STATE.md B-001 ainda lista DPO pendente como **bloqueador de go-live**. **Ambos concordam que
  não bloqueia desenvolvimento/merge.** Resolução: construir a superfície completa (incl. relatórios com PII); a
  **habilitação em produção dos relatórios com PII** fica condicionada ao sign-off do DPO (B-001), como B-003/B-004
  (gate de cutover). Relatórios agregados sem PII + a home ficam liberados. Os controles de compliance (watermark,
  ciência, audit de export, R6 escopado) são o que torna o PII seguro e **entram no dev**. *(Não bloqueia este Planner/Implementer.)*
- **ASSUMP-U1-03 (report set D-005/QP-005):** o conjunto **R1..R6** e os filtros mínimos (período/status/categoria/
  região) já estão fixados pelos ACs/expectations (E-001..E-005 + epic AC 3..7). Adotado como o MVP set; o
  **refinamento fino de colunas/agrupamentos (QP-005)** fica deferido ao sponsor, **não-bloqueante** — o mecanismo
  (filtrável + exportável + auditado) entrega. *(Flag; D-002 dos expectations é gate de valor pleno, não de dev.)*
- **ASSUMP-042-04 (MP10 do audit_log):** MP10 computado de pares de eventos do `audit_log` (§5); MVP low-volume →
  sem tabela de pré-agregação. Fonte = ADR-0023.
- **ASSUMP-042-05 (deps de export):** CSV = serializer puro no módulo (sem dep). PDF = `@react-pdf/renderer` (TD §5) —
  **nova dep no allowlist** (flag). Ambos dentro dos p95 (10s/20s) dado o volume MVP.
- **ASSUMP-042-06 (Fase reconciliada):** card aponta "Fase 3 (TD §5)"; ROADMAP posiciona na **Fase 6** — adotado o ROADMAP.

## 9. Testing strategy (contrato do repo — project-guideline §12)

| Layer | Test type | Foco |
|---|---|---|
| Guards de papel (`domain/report-access.ts`) | **unit** ≥90% | 1:1 aos ramos: coordenador/BOARD→ops true; AS/BOARD→social true; voluntário/anônimo→false; R5 via MODERATE_* + delegação |
| Calculadoras puras (`referral-outcomes.ts`, `moderation-time.ts`, `csv.ts`) | **unit** ≥90% | MP9+noResult; média envio→decisão; escaping RFC-4180 + watermark; `total=0`→"—" |
| Queries de relatório (`report-*.ts`) | **integration** (Postgres) | `where` de período/status/categoria real; agregados corretos; `take`; período vazio→lista vazia |
| View social R6 (`social-report.view.ts`) | **integration** | AS/BOARD full + `SENSITIVE_FIELD_VIEWED`; **REL42-MN-05** coordenador stripped (sensível não SELECIONADO nem serializado, sem audit) |
| `exportReport` action | **integration** | happy CSV/PDF; **REL42-MN-01** watermark; **REL42-MN-06** sem ciência→sem arquivo; **REL42-MN-07** sem `REPORT_EXPORTED`→rollback; **REL42-MN-03** não autorizado→sem arquivo |
| Componentes (`report-view.tsx`, `report-pdf.tsx`) | **unit (component)** | render de lista/filtros; **REL42-MN-04** MP9 sempre com "sem resultado" ao lado |
| Rotas `(app)/relatorios/*` | **page + e2e** | **REL42-MN-02/03** gate de sessão/papel (voluntário→403/notFound; R5 sem MODERATE_*→negado); happy coordenador |

E2E autenticado limitado ao **gate de sessão/papel** (padrão L-007/AD-019 — sem seed de sessão Supabase no
Playwright); a cobertura autoritativa de RBAC/privacidade/export vive nos testes de **integração/componente**.

## 10. Design references

- Runbooks: `runbook-view-model-visibility`, `runbook-search-pagination`, `runbook-audit-log`
- ADRs: 0022 (ficha fora do coordenador), 0023 (export auditado), 0017 (visibilidade por papel), 0008 (retenção)
- TD §4.4 (endpoints `reporting.relatorio`/`reporting.exportar`), §4.5 (schemas agregados + audit_log), §4.6 (`REPORT_EXPORTED`), §5 (`@react-pdf/renderer`)
- Precedentes: AD-022 (guard inline USP-036), AD-015/USP-003 (authz inline sem PermissionId), USP-039 (2-barreiras de privacidade)
