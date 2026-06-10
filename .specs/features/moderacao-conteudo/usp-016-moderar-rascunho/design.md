# USP-016 — Moderar rascunho (vaga, CV ou serviço) — Design

> Deriva de [`spec.md`](./spec.md). Fonte canônica: ADR-0011 (máquina de estados de moderação), `technical-design.md` §2.5/§3.3/§4, card ICE USP-016 (ADRs técnicos 0024/0023/0020).

## 1. Visão geral da arquitetura

Três camadas, uma por sub-task, em cadeia linear:

```
#121 domain/ (puro, sem IO)          #122 actions/ports/adapters            #123 actions decisão + fila (UI)
┌───────────────────────────┐        ┌───────────────────────────────┐     ┌────────────────────────────────┐
│ ContentStatus (enum)      │        │ transitionContent(input)      │     │ approveContent / returnFor…    │
│ ContentKind (enum)        │  ───▶  │  1. loadContentStatus         │ ──▶ │  rejectContent  (Server Actions)│
│ TransitionTrigger         │        │  2. validateTransition (#121) │     │ → chamam transitionContent     │
│ TRANSITIONS table         │        │  3. requiresJustification     │     │                                │
│ validateTransition()      │        │  4. requirePermission(trigger)│     │ queries/viewModerationQueue    │
│ requiresJustification()   │        │  5. withAudit(tx):            │     │  (IN_MODERATION, ordenado,     │
│  (regras puras)           │        │     update + side effects     │     │   autor≠moderador)             │
└───────────────────────────┘        │   ports: Notification, Cache, │     │ schemas/ (motivo ≥20)          │
                                      │          CompanyVerifyHook    │     │ app/(app)/moderacao/page.tsx   │
                                      └───────────────────────────────┘     └────────────────────────────────┘
```

**Fluxo de uma decisão (aprovar):** UI → `approveContent(contentKind, contentId)` → `requirePermission` → `transitionContent({to: ACTIVE, trigger: MODERATOR_ACTION})` → valida `IN_MODERATION→ACTIVE` contra `TRANSITIONS` → `withAudit('CONTENT_APPROVED', tx => { update status; sendEmail; revalidate; companyHook })` → `ActionResult`.

**Invariante (AC6 / P-006):** nenhuma camada faz `prisma.<model>.update({ status })`. A coluna `status` só muda dentro de `transitionContent`. Reforço: lint custom + revisão (ADR-0011 R1).

## 2. Modelo de dados (#121 toca schema; demais reusam)

`ContentStatus` é coluna em cada tabela de conteúdo (`jobs`, `services`, `candidate_profiles`) — modelo type-specific, **não** tabela genérica (ADR-0011). Histórico de transições vive no `audit_log` (já existe), não em tabela própria.

```prisma
enum ContentStatus {
  DRAFT
  IN_MODERATION
  AWAITING_ADJUSTMENTS
  ACTIVE
  REJECTED
  PAUSED
  EXPIRED          // só JOB
  ARCHIVED
  INACTIVATED
  @@map("content_status")
}
```

✅ **GAP-2 (verificado 2026-06-10):** o enum **não existe** no schema — a #121 é a **owner** que o declara (domínio TS + Prisma). USP-009/#36 e demais USPs de conteúdo passam a **reusar**, não redeclarar.

⚠ **GAP-8 (verificado 2026-06-10):** **nenhum** model de conteúdo (`Job`/`Service`/`CandidateProfile`) existe ainda — só `Company`. A coluna `status` que a máquina de estados governa ainda não tem tabela. Ver §4 (acesso via `ContentStatusRepository` port).

`audit_log` (já existe, append-only — ADR-0008): cada decisão grava `action` (evento), `actorPersonId`, `entityType` (`JOB`/`CV`/`SERVICE`), `entityId`, `before`/`after` (status), `justification` (motivo). `REVOKE UPDATE, DELETE` garante imutabilidade (L-003).

## 3. Domain & regras puras (#121)

`src/modules/moderation/domain/content-status.ts`:

```typescript
export enum ContentStatus { DRAFT, IN_MODERATION, AWAITING_ADJUSTMENTS, ACTIVE, REJECTED, PAUSED, EXPIRED, ARCHIVED, INACTIVATED }
export enum ContentKind { JOB = 'JOB', CV = 'CV', SERVICE = 'SERVICE' }
export type TransitionTrigger = 'AUTHOR_ACTION' | 'MODERATOR_ACTION' | 'SYSTEM_JOB' | 'COORDINATOR_INACTIVATION'

export interface TransitionRule {
  from: ContentStatus; to: ContentStatus; trigger: TransitionTrigger; requiresJustification: boolean
}

export const TRANSITIONS: Record<ContentKind, TransitionRule[]> = {
  JOB: [ /* DRAFT→IN_MODERATION, IN_MODERATION→{ACTIVE,AWAITING_ADJUSTMENTS*,REJECTED*}, AWAITING_ADJUSTMENTS→IN_MODERATION,
            ACTIVE→{PAUSED,DRAFT,ARCHIVED,EXPIRED(SYSTEM_JOB),INACTIVATED*(COORDINATOR_INACTIVATION)}, PAUSED→ACTIVE  (* = requiresJustification) */ ],
  CV:      [ /* idem JOB, sem EXPIRED */ ],
  SERVICE: [ /* idem CV */ ],
}
```

`src/modules/moderation/domain/transition-rules.ts` — **funções puras** (sem IO, testáveis isoladamente):

```typescript
// retorna a regra casada ou null — não lança
export function findTransition(kind: ContentKind, from: ContentStatus, to: ContentStatus, trigger: TransitionTrigger): TransitionRule | null
// true se a transição existe na tabela
export function isValidTransition(kind, from, to, trigger): boolean
// true se a regra casada exige justificativa
export function requiresJustification(kind, from, to, trigger): boolean
```

Estas três funções são o coração do AC6 e o alvo principal dos testes unitários (cada transição válida/inválida coberta — TD §5 testes da Fase 2).

## 4. `transitionContent` — função canônica (#122)

`src/modules/moderation/actions/transition-content.ts` ('use server' no nível de quem chama; aqui é helper de domínio com IO injetado via ports).

```typescript
export async function transitionContent(input: {
  contentKind: ContentKind; contentId: string; to: ContentStatus;
  trigger: TransitionTrigger; justification?: string; actorPersonId: string;
}): Promise<ActionResult<{ from: ContentStatus; to: ContentStatus }>> {
  const current = await loadContentStatus(input.contentKind, input.contentId)        // 1
  if (!isValidTransition(input.contentKind, current, input.to, input.trigger))       // 2 (#121)
    return { ok: false, error: { code: 'INVALID_TRANSITION', from: current, to: input.to } }
  if (requiresJustification(...) && !meaningful(input.justification))                 // 3 (P-003)
    return { ok: false, error: { code: 'JUSTIFICATION_REQUIRED' } }
  return withAudit(eventTypeFor(input), async (tx) => {                               // 5
    await updateContentStatus(tx, input.contentKind, input.contentId, current, input.to, input.justification)
    //   UPDATE ... WHERE status = current  → concorrência otimista (ADR-0011 R3)
    await notification.sendModerationDecision(input, current)   // port — soft-fail (R2)
    await cache.revalidateForContent(input)                     // port — ADR-T-0013
    await companyVerify.onContentActivated(tx, input)           // port/hook — USP-017 (GAP-4)
    return { ok: true, data: { from: current, to: input.to } }
  })
}
```

**Ports (interfaces, DI via `shared/container.ts`):**

| Port | Método | Adapter desta US | Owner real |
|---|---|---|---|
| `ContentStatusRepository` | `loadStatus(kind, id)` / `updateStatus(tx, kind, id, from, to, just?)` | adapter por `ContentKind`; **GAP-8** — só `Company` existe hoje | adapter concreto chega com a US de cada conteúdo (JOB/CV/SERVICE) |
| `NotificationPort` | `sendModerationDecision(input, from)` | **stub** no-op logado (pino) | USP-044 (Resend + templates) — GAP-3 |
| `CacheInvalidationPort` | `revalidateForContent(input)` | `next-cache` (`revalidatePath`/`revalidateTag`) | esta US (para JOB/SERVICE públicos) |
| `CompanyVerifyHookPort` | `onContentActivated(tx, input)` | **stub** no-op | USP-017 (flag `isVerified`) — GAP-4 |

> **GAP-8 (ordenação):** `loadContentStatus`/`updateContentStatus` do `transitionContent` dependem de tabela de conteúdo com coluna `status`, que ainda não existe (nem `Job`/`Service`/`CandidateProfile`). Por isso o acesso é abstraído no `ContentStatusRepository` (port), resolvido por `ContentKind`. #122 entrega o port + **um** adapter concreto mínimo (o primeiro tipo a aterrissar) e/ou uma tabela de fixture para os testes de integração; os demais adapters chegam com suas USPs. A #121 (domínio puro) não é afetada.

**Side effects soft-fail (ADR-0011 R2):** falha de e-mail/revalidação é logada (Sentry/pino), **não** aborta a transição. Auditoria e mudança de status são o núcleo transacional.

**Catálogo de eventos (GAP-1):** `eventTypeFor` mapeia trigger+destino → `CONTENT_APPROVED` | `CONTENT_RETURNED_FOR_ADJUSTMENTS` | `CONTENT_REJECTED` | `CONTENT_SUBMITTED_TO_MODERATION`. Adicionar ao catálogo `@/modules/audit/events`.

## 5. Actions de decisão + fila (#123)

**Server Actions** (sequência canônica do CLAUDE.md — Zod → `requirePermission` → preconditions → `transitionContent`):

```typescript
// src/modules/moderation/actions/decide.ts  ('use server')
approveContent({ contentKind, contentId })                       // → transitionContent(to: ACTIVE)
returnForAdjustments({ contentKind, contentId, justification })  // → to: AWAITING_ADJUSTMENTS (motivo obrigatório)
rejectContent({ contentKind, contentId, justification })         // → to: REJECTED (motivo obrigatório)
```

Cada uma: valida com Zod, `requirePermission(MODERATE_<KIND>)` (P-007), delega a `transitionContent`. Retorno `ActionResult`; nunca `throw`.

**Schemas (#123) — P-003:**

```typescript
// src/modules/moderation/schemas/decision.ts
const justification = z.string().trim().min(20, 'O motivo deve ter ao menos 20 caracteres descritivos.')
  .refine(v => !/^[\s\-—.x]+$/i.test(v), 'Descreva o motivo de forma significativa.')
export const returnForAdjustmentsSchema = z.object({ contentKind: z.nativeEnum(ContentKind), contentId: z.string().uuid(), justification })
export const rejectSchema = returnForAdjustmentsSchema
export const approveSchema = z.object({ contentKind: z.nativeEnum(ContentKind), contentId: z.string().uuid() })
```

**Query da fila (#123) — E-001 + P-005:**

```typescript
// src/modules/moderation/queries/moderation-queue.ts
viewModerationQueue({ viewerPersonId }): Promise<ModerationQueueItem[]>
//  SELECT de jobs/services/candidate_profiles com status=IN_MODERATION
//  WHERE authorPersonId <> viewerPersonId            ← P-005 (ADR-0024)
//  ORDER BY submittedAt ASC                          ← E-001
//  take: 100 (paginação obrigatória), select explícito (L-001)
```

Item da fila: `{ contentKind, contentId, title, authorName, submittedAt, companyUnverified? }`. O `companyUnverified` é só um **flag de exibição** aqui; o painel de verificação é USP-017 (P-002, fora de escopo).

**UI (#123):** `src/app/(app)/moderacao/page.tsx` — rota autenticada `force-dynamic`, `requireActivePerson()` + guard de permissão. Lista a fila (Server Component) com indicador de tipo; cada item tem ações aprovar/devolver/rejeitar (client component com RHF+Zod para o motivo, toast PT-BR no `ActionResult`).

## 6. Contratos confirmados (símbolos externos reusados)

| Símbolo | Path | Uso |
|---|---|---|
| `ActionResult<T>` | `@/shared/errors` | retorno de toda action |
| `withAudit(event, tx => …)` | `@/modules/audit` | transação + audit log (AC5, L-003) |
| catálogo de eventos | `@/modules/audit/events` | + 4 eventos novos (GAP-1) |
| `requirePermission(perm)` | `@/modules/identity` | P-007 (GAP-7: IDs do catálogo) |
| `requireActivePerson()` | `@/modules/persons/server` | guard da rota (app) |
| Prisma singleton | `@/shared/lib` | `loadContentStatus`/`updateContentStatus` |
| `ContentStatus` enum | `prisma` / `@/modules/...` | GAP-2 (owner a confirmar) |

## 7. Riscos

- **R1 (bypass da máquina de estados):** dev faz `prisma.job.update({status})` direto. → Mitigação: `transitionContent` única via + lint custom + revisão (ADR-0011 R1). Teste: AC6 garante INVALID_TRANSITION em caminho não declarado.
- **R2 (side effect falha):** e-mail Resend cai. → soft-fail logado, não aborta transição (ADR-0011 R2). Como o adapter é stub nesta US (GAP-3), o risco real chega na USP-044.
- **R3 (concorrência):** dois moderadores decidem o mesmo item. → `UPDATE WHERE status = current` (otimista); 2ª chamada falha por `INVALID_TRANSITION` (ADR-0011 R3). Teste de integração cobre.
- **R4 (enum duplicado — GAP-2):** redeclarar `ContentStatus` colide com migration da USP-009. → checar schema antes; reusar.
- **R5 (permissão imprecisa — GAP-7):** catálogo de permissões de moderação (D-006) ainda aberto. → usar constante nomeada e marcar TODO até D-006 fechar; não bloqueia dev, bloqueia go-live (gate D-001 do intent).
