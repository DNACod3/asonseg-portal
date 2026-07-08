# USP-034 — Design

Espelha `cancelApplication` (jobs, AD-017) com **uma divergência**: idempotência em vez de erro
ao recancelar (spec §Divergência / AC-034-3).

## D1 — `cancelInterest` (Server Action)

Arquivo `src/modules/services/actions/cancel-interest.ts` (`'use server'`). Schema
`cancelInterestSchema = z.object({ interestId: z.string().uuid('Manifestação inválida.') })`
(sem `personId`; opera só sobre a Pessoa da sessão). Retorno `ActionResult<{ interestId; alreadyCancelled: boolean }>`, **nunca lança**.

Self-service (**sem `requirePermission` nem `requireActiveConsent`** — A-3/AD-017: retirar o
próprio tratamento de dados é sempre permitido ao titular). Sequência:
1. Zod → `VALIDATION`.
2. `getCurrentPerson()` → `UNAUTHENTICATED`.
3. `findFirst({ where:{ id: interestId, clientPersonId: person.id }, select:{ id, cancelledAt } })` — **owner + existência foldados** (SVC034-MN-01): manifestação de terceiro "não existe" para esta sessão. `null` ⇒ `NOT_FOUND` (sem vazar existência, sem `FORBIDDEN`).
4. **Pré-decisão de idempotência antes de abrir tx** (padrão `revokeConsent`): se `cancelledAt != null` ⇒ `ok({ interestId, alreadyCancelled: true })` — sem `withAudit`, para não gravar `INTEREST_CANCELLED` espúrio no log append-only (AC-034-3).
5. `withAudit(AuditEvent.INTEREST_CANCELLED, async (tx, audit) => { … })`:
   - `const r = await tx.serviceInterest.updateMany({ where:{ id: interestId, clientPersonId: person.id, cancelledAt: null }, data:{ cancelledAt: new Date() } })` (optimistic — defesa contra corrida, junto ao pré-check).
   - `if (r.count !== 1) throw new CancelConflictError()` — tratado no `catch` como idempotente `ok({ alreadyCancelled: true })` (a linha foi cancelada por requisição concorrente; sem novo audit).
   - `audit.entityType='SERVICE_INTEREST'; audit.entityId=interestId; audit.before={cancelledAt:null}; audit.after={cancelledAt: <iso>}`.
6. `catch`: `CancelConflictError` ⇒ `ok({ alreadyCancelled:true })`; genérico ⇒ `INTERNAL`.

`INTEREST_CANCELLED` já existe no catálogo (`events.ts:97`). **Não** revoga consent nem papel
(SVC034-MN-02) — o cancelamento só toca a linha `ServiceInterest`.

## D2 — Regra pura

`domain/service-interest-rules.ts` (arquivo criado na USP-033) ganha
`canCancelInterest(i: { cancelledAt: Date|null }): { ok:true } | { ok:false; reason:'ALREADY_CANCELLED' }`
(espelha `canCancelApplication`) — usada no passo 4 para decidir idempotência de forma testável.

## D3 — UI

Client component NET-NEW `components/cancel-interest-button.tsx` (`'use client'`), espelha
`cancel-application-button.tsx`: importa a action por caminho relativo `../actions/cancel-interest`;
`useTransition` + `useState(error)`; on ok → `router.refresh()` (o detalhe volta a mostrar
"entrar em contato"; o contato some — design USP-033 §D6). Renderizado no bloco autenticado-com-interesse
do `ServiceDetailView` (wiring já preparado na USP-033 T6). O prestador (USP-035) **não** cancela.

## Convenções
- Barrel: exportar `cancelInterest` e `CancelInterestButton` em `src/modules/services/index.ts`.
- Nunca `throw` de Server Action; `ActionResult` sempre.
