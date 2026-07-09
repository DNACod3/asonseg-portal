# USP-034 — Tasks (todas NET-NEW)

Gate por task: `npm run typecheck && npm run lint` + testes do campo Tests. Commits atômicos `feat(services):`.

---

### T1 — Regra pura `canCancelInterest` + schema
- **What:** Adicionar `canCancelInterest` a `domain/service-interest-rules.ts` (design §D2) e `cancelInterestSchema` a `schemas/service-interest.schema.ts`. Export no barrel.
- **Where:** `src/modules/services/domain/service-interest-rules.ts`, `src/modules/services/schemas/service-interest.schema.ts`, `index.ts`.
- **Depends on:** USP-033 T1/T2 (modelo + arquivos criados).
- **Reuses:** `jobs/domain/application-rules.ts::canCancelApplication`.
- **Done when:** regra pura testada; schema exportado.
- **Tests:** unit `service-interest-rules.spec.ts` (ativa ⇒ ok; cancelada ⇒ ALREADY_CANCELLED).
- **Gate:** typecheck + lint + unit.

### T2 — Server Action `cancelInterest`
- **What:** `actions/cancel-interest.ts` (`'use server'`), sequência do design §D1 (owner+existência foldados; idempotência pré-tx; `updateMany` optimistic; nunca lança). Export no barrel.
- **Where:** `src/modules/services/actions/cancel-interest.ts`, `index.ts`.
- **Depends on:** T1.
- **Reuses:** `jobs/actions/cancel-application.ts` (estrutura), `consents/actions/revoke-consent.ts` (pré-decisão de idempotência antes da tx).
- **Done when:** cancela ativa própria (audit `INTEREST_CANCELLED`); já-cancelada ⇒ ok idempotente sem audit; terceiro ⇒ NOT_FOUND.
- **Tests:** int matrix em T4.
- **Gate:** typecheck + lint.

### T3 — Botão de cancelar + wiring no detalhe
- **What:** `components/cancel-interest-button.tsx` (`'use client'`, design §D3). Ligar no bloco autenticado-com-interesse do `ServiceDetailView` (seam preparado na USP-033 T6). Export no barrel.
- **Where:** `src/modules/services/components/cancel-interest-button.tsx`, `components/service-detail.tsx`, `index.ts`.
- **Depends on:** T2, USP-033 T6.
- **Reuses:** `jobs/components/cancel-application-button.tsx`.
- **Done when:** cliente com interesse ativo vê "cancelar manifestação"; após cancelar+`router.refresh()`, detalhe volta a "entrar em contato" e o contato some.
- **Tests:** component `cancel-interest-button.spec.tsx`.
- **Gate:** typecheck + lint + component.

### T4 — Testes de integração
- **What:** `__tests__/cancel-interest.int.test.ts`: happy (soft-cancel + audit); idempotência (recancelar ⇒ ok, sem 2º audit — AC-034-3); ownership NOT_FOUND sem vazar (SVC034-MN-01); não revoga consent/papel (SVC034-MN-02); some da lista do prestador (checar via `listProviderInterests` da USP-035, ou asserção de `cancelledAt` + where ativo); re-manifestar após cancelar cria nova linha (interação com USP-033).
- **Where:** `src/modules/services/__tests__/cancel-interest.int.test.ts`.
- **Depends on:** T2 (e USP-035 T1 para o caso "some da lista", opcional cruzado).
- **Reuses:** `jobs/__tests__/cancel-application.int.test.ts`.
- **Done when:** matriz verde; sensor de ownership mata a mutação (remover o filtro `clientPersonId` ⇒ cancela de terceiro ⇒ teste falha).
- **Gate:** `npm run test`.

---

## Matriz de rastreio AC → teste

| AC / MN | Teste |
|---|---|
| AC-034-1 | cancel-interest.int :: happy (cancelledAt preenchido + INTEREST_CANCELLED) |
| AC-034-2 | cancel-interest.int :: cancelada ausente de `listProviderInterests` (where cancelledAt:null) |
| AC-034-3 | cancel-interest.int :: recancelar ⇒ ok idempotente, sem 2º audit |
| SVC034-MN-01 | cancel-interest.int :: interesse de terceiro ⇒ NOT_FOUND, linha intacta |
| SVC034-MN-02 | cancel-interest.int :: consent SERVICE_HIRING + papel CLIENT seguem ativos; re-manifestar ok |
