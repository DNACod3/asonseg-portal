# USP-017 — Validar Empresa na primeira vaga — Design

> 🧬 **ICE mode — adapter, não arquitetura re-derivada.** Pointers do card USP-017 resolvidos contra o
> código vigente. Fonte: `technical-design.md` §4.4/§4.5/§4.6 (seq. linha 629-634), ADR-0024 (aprovação-vaga
> + verificação-Empresa **atômicas**), ADR-0023, ADR-0020, ADR-0014/0015. Runbooks: `runbook-moderation-transition`,
> `runbook-audit-log`. Deriva de [`spec.md`](./spec.md).

## 1. Ponto de partida: a infra já está cabeada (legado da USP-016/USP-020)

O caminho do efeito colateral **já existe** — falta a implementação real. Mapeado no kickoff:

| Peça | Estado atual | file:line |
|---|---|---|
| `transitionContent()` chama hook dentro do `tx` quando `to=ACTIVE` | ✅ cabeado (atômico, ADR-0024) | `moderation/actions/transition-content.ts:106-113` |
| `COMPANY_VERIFY_HOOK_TOKEN` (port) | ✅ definido | `moderation/ports/company-verify-hook.port.ts` |
| `StubCompanyVerifyHook` (no-op, só loga) | ✅ stub — **trocar** | `moderation/adapters/stub-company-verify-hook.ts` |
| `AuditEvent.COMPANY_VERIFIED` | ✅ existe no catálogo | `audit/events.ts:46` |
| `Company.isVerified` (default false) | ✅ existe | `prisma/schema.prisma` (model Company) |
| `companyUnverified?` no DTO da fila | ✅ campo declarado, **não populado** | `moderation/views/moderation-queue-item.ts` |
| Fila de moderação (query + UI) | ✅ existe; sem indicador de Empresa | `moderation/queries/moderation-queue.ts`, `components/moderation-queue.tsx` |

**Lacunas (o trabalho real):** campos de auditoria/snapshot/contador na `Company`; adapter real do hook
(detecção de 1ª vaga + marcação + snapshot + idempotência); incremento de rejeição; popular
`companyUnverified`; UI de painel + checklist + histórico de rejeições + diff de edição.

## 2. Modelo de dados (#156 toca schema)

Adicionar à `model Company` (migração Prisma) — nada disso existe hoje:

```prisma
verifiedAt          DateTime?  @map("verified_at")    @db.Timestamptz(6)   // E-002, E-004
verifiedByPersonId  String?    @map("verified_by_person_id") @db.Uuid       // E-002 (responsável)
verificationJobId   String?    @map("verification_job_id")   @db.Uuid       // E-002 (vaga que disparou)
verifiedSnapshot    Json?      @map("verified_snapshot")                     // L-002 (dados vigentes no instante)
rejectionCount      Int        @default(0) @map("rejection_count")           // E-003 / F3
```

- **`verifiedSnapshot`** captura `{ cnpj, legalName, tradeName, address, phone, capturedAt }` — dados
  **vigentes no momento da moderação** (P-004), não do rascunho. Retido por toda a retenção (L-002, ADR-0008).
- **Histórico de rejeições (P-003/D-005)** NÃO precisa de tabela nova: vive no `audit_log` via
  `CONTENT_REJECTED` (entityId = job, com company derivável). `rejectionCount` é o agregado rápido para
  o badge "rejeitada N vezes". A listagem detalhada (quando/quem/motivo) lê o `audit_log`.

## 3. Decisões de arquitetura (AD)

- **AD-1 (ADR-0024 — atomicidade):** verificação da Empresa acontece **dentro do mesmo `tx`** que ativa
  a vaga, via `CompanyVerifyHook.onContentActivated(tx, …)`. Se a verificação falhar, a ativação faz
  rollback. Não é soft-fail (≠ notificação/cache). Já é o contrato do `transition-content.ts:106-113`.
- **AD-2 (E-004 idempotência / "só 1ª vaga"):** o hook só marca quando `contentKind=JOB` **e**
  `company.isVerified=false`. Empresa já verificada → no-op (não regrava `verifiedAt`, não re-snapshota).
  Detecção de "primeira vaga" = `isVerified=false` (a flag É o estado), não contagem de jobs — mais
  barato e correto sob USP-015 (rebaixamento volta `isVerified=false`).
- **AD-3 (P-005 — rota única):** marcação de `isVerified=true` só ocorre dentro do hook resolvido por
  `COMPANY_VERIFY_HOOK_TOKEN`, jamais por `prisma.company.update` espalhado. Reforço: nenhum action de
  `companies` expõe set de `isVerified`; teste negativo D-004 garante que não há rota externa.
- **AD-4 (P-004 — dados vigentes):** o snapshot é montado lendo a `Company` **dentro do `tx`** no
  momento da ativação (read-then-write na mesma transação), garantindo dados pós-USP-015.
- **AD-5 (E-003 — rejeição):** incremento de `rejectionCount` ocorre quando uma vaga de Empresa
  **não verificada** transita para `REJECTED`. Implementado simetricamente: hook no caminho de rejeição
  (ou extensão do `onContentActivated` para um `onContentRejected`) — decisão de impl. em #156, dentro
  do mesmo `withAudit('CONTENT_REJECTED', tx)`.
- **AD-6 (P-002 — separação visual):** a UI separa "Verificação da Empresa" (checklist) de "Decisão da
  vaga" (aprovar/rejeitar) em dois blocos com confirmações conscientes distintas. Aprovar exige checklist
  completa (ou dispensa com motivo); são um **ato atômico no backend** mas **dois gestos conscientes na UI**.

## 4. Contratos (resolvidos do TD)

- **§4.4 Endpoints:** sem endpoint novo. Reusa `moderation.transitionContent({to: ACTIVE | REJECTED,
  trigger: MODERATOR_ACTION})` via `approveContent`/`rejectContent` (`moderation/actions/decide.ts`).
  A checklist (itens marcados / dispensa+motivo) viaja como parte do input de aprovação → propagado ao hook.
- **§4.5 Schemas:** `companies` (campos novos da §2) + leitura de `audit_log` (histórico). Sem tabela
  `content_transitions` própria (TD: histórico mora no `audit_log`).
- **§4.6 Eventos:** `COMPANY_VERIFIED` (audit) emitido no `tx` de ativação da 1ª vaga, com
  `after = { isVerified, verifiedAt, verifiedByPersonId, verificationJobId, snapshot }`.

## 5. Camadas por sub-task

```
#156 — backend (side-effect)                          #157 — UI (verificação)
┌──────────────────────────────────────────┐         ┌──────────────────────────────────────────┐
│ prisma: Company +verifiedAt/By/JobId/      │         │ queue query: popular companyUnverified     │
│   Snapshot/rejectionCount (+migração)      │         │   (join jobs→companies.isVerified)         │
│ companies: verifyCompany domain + view     │         │ View Model: dados da Empresa p/ moderador  │
│ moderation: PrismaCompanyVerifyHook (real) │  ──────▶│ painel destaque + banner (E-001)           │
│   onContentActivated: 1ª vaga→marca+snap   │         │ checklist interativa (P-001) + dispensa    │
│   onContentRejected: rejectionCount++ (E-3)│         │ histórico de rejeições (P-003/D-005)       │
│ container: trocar Stub→Prisma adapter      │         │ diff campos editados desde verif. (D-006)  │
│ COMPANY_VERIFIED no after do audit (E-002) │         │ separação aprovar↔verificar (P-002/AD-6)   │
│ guard P-005 (nenhuma outra rota)           │         │ "verificada em DD/MM por X" (E-004)        │
└──────────────────────────────────────────┘         └──────────────────────────────────────────┘
   depende de: USP-016 (transitionContent) ✅              depende de: #156 (campos + flag) + USP-016 UI ✅
```

## 6. Privacidade

Dados da Empresa exibidos ao moderador via **View Model** (`companies/views`), não Prisma direto — embora
moderador seja staff, manter o padrão (CLAUDE.md). Snapshot é dado de auditoria, não exposto a candidatos.

## 7. Riscos / pontos de atenção

- **R1 (P-004):** garantir que o snapshot lê a Company **dentro do `tx`** (não um objeto carregado antes
  do submit). Teste integração com edição USP-015 simulada entre submit e moderação.
- **R2 (rejeição):** o caminho de `REJECTED` hoje não chama hook de company — confirmar no `transition-content.ts`
  se o hook só dispara em `ACTIVE`; #156 precisa estender para o caminho de rejeição (AD-5).
- **R3 (D-001):** conteúdo da checklist é stub até a Fase 0; UI deve ler os itens de uma fonte
  configurável (seed `seed-taxonomia-checklists`), não hard-coded, para não exigir redeploy no go-live.

## 8. Refactor deltas — adoção do Design System (AD-014/AD-015)

> A US já está em `master`. O restyle toca **um** arquivo de apresentação; backend (hook, snapshot,
> `rejectionCount`, guard P-005, queries, View Models) fica **intacto** (§8.1). Regra AD-015: *style-only*.

### 8.1 Invariantes — o que NÃO muda

`adapters/prisma-company-verify-hook.ts`, `actions/transition-content.ts`, `ports/company-verify-hook.port.ts`,
`companies/**` (domain de snapshot, `views/`, `queries/rejection-history`, guard `no-external-verify`),
`shared/container.ts`, `prisma/schema.prisma` (campos de verificação), `domain/verification-checklist.ts`
e `queries/list-verification-checklist.ts` (seed B-004 + fallback). No próprio `verification-panel.tsx`, a
**lógica** permanece byte-a-byte: `initialChecklist`, `isItemResolved`, `ready`/`effectiveReady`,
`onReadinessChange`, `update`, o curto-circuito `if (data.isVerified)` (E-004) e o cálculo `reverification`.

### 8.2 `components/verification-panel.tsx` → tokens + primitivos

Padrão de tint dark-safe: usar `bg-[color-mix(in_srgb,var(--color-*)_NN%,transparent)]` — a mesma técnica
já sancionada no `Badge`/`StepIcon` do DS (DS-MN-02 permite: é token, não hex). Semânticas: **atenção/1ª
vaga** → `--color-cta` (laranja); **verificada** → `--color-success`; **rejeição** → `--color-danger`;
texto neutro → `text-fg`/`text-fg-muted`; superfícies → `bg-surface`/`border-border`.

| Elemento atual (paleta crua) | file:line | Alvo Design System |
|---|---|---|
| bloco "Empresa verificada" `border-green-200 bg-green-50 text-green-800` | `:98-104` | `border-success` + `bg-[color-mix(...success 12%...)]` + `text-success` (**ou** `<Badge variant="green">` com o texto). Mantém `aria-label`. |
| painel "não verificada" `border-amber-300 bg-amber-50` + textos `text-amber-900/800` | `:115-126`, `:163-208` | `border-cta` + `bg-[color-mix(...cta 10%...)]`; textos `text-fg`/`text-cta`. |
| `<dl>` dados da Empresa `text-gray-800`; realce de campo alterado `bg-amber-200` (D-006) | `:129-135`, `:213-219` | `text-fg`; realce `bg-[color-mix(...cta 22%...)]` (mantém a semântica de "alterado"). |
| histórico de rejeições `border-red-200 bg-red-50 text-red-700/800` | `:145-160` | `border-danger` + `bg-[color-mix(...danger 10%...)]` + `text-danger`. Mantém `<details>/<summary>` (a11y). |
| checkbox nativo (marcar / "não se aplica") | `:172-186` | manter `<input type="checkbox">` (o DS **não** tem primitivo Checkbox); adicionar `accent-primary` (padrão do `LgpdCheck`); label via tokens. |
| input de motivo da dispensa `border-gray-300 … text-[11px]` | `:190-198` | `<Input>` de `@/shared/ui` (token + foco primário); mantém `aria-label`/`placeholder`/`value`/`onChange`. |
| textos de ajuda `text-amber-800 / text-gray-600 / [11px]` | `:181`, `:203-207` | `text-fg-muted` / `text-cta`. |

### 8.3 Decisões de consistência a documentar (sem mudança de comportamento)

- **Sem primitivo `Alert`/`Callout` no DS** → os blocos de banner (verde/âmbar/vermelho) usam **classes-token
  + `color-mix`** em vez de um primitivo. Registrar como candidato a incremento futuro do DS (fora de escopo).
- **Sem primitivo `Checkbox` no DS** → manter `<input type="checkbox">` com `accent-primary` (mesma escolha
  do `LgpdCheck` da Fundação). Documentado; não bloqueia.
- Mapeamento **âmbar → `cta`** (não há token `warning` dedicado no DS): é a cor de atenção do sistema.

### 8.4 Teste negativo do restyle

Estender o guard **`src/shared/__tests__/ds-moderation-parity.test.ts`** (criado na USP-016) para incluir
`moderation/components/verification-panel.tsx` no scan de paleta crua/hex — cobre DS-17-MN-1. Se a USP-016
ainda não tiver criado o guard no momento da execução, esta US o cria.
