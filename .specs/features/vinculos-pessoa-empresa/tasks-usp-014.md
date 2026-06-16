# Tasks — USP-014: Remover responsável de uma Empresa

> ICE mode. Card único: `docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` → USP-014.
> Design-adapter: `design-usp-014.md`. Spec: `spec.md` (AC-014-1..3 + edges, Épico 3).
> **Entrega: PR único** cobrindo toda a US (backend + UI), fechando as sub-issues **#135** e **#137**.

## Entry Gate (kickoff) — ✅ LIBERADO

- USP #133 **Ready**, **sem flag `Blocked`**. Subs #135/#137 em Backlog (movem p/ In Progress no dev).
- Upstream **USP-012** (`createCompany`) e **USP-013** (`adicionarResponsavel`/aceite, schema `status`,
  invariante, outbox/e-mail) **mergeados**. Sem dependência ativa.
- Estimate pai = 10h = #135 (6h) + #137 (4h) ✓.

## Estratégia de entrega (1 PR)

Branch único `feat/usp-014-remover-responsavel`; PR `feat(companies): USP-014 — remover responsável`
fechando **#135 e #137** (`Closes #135`, `Closes #137`). Commits atômicos por task (T1…T9).

## Rastreabilidade (VPE → tasks)

| Req | Origem | Onde | Tasks |
|-----|--------|------|-------|
| VPE-04 | AC-014-1 | Remoção persiste (`revokedAt`/`revokeReason`) + e-mail à Pessoa removida | T4, T5, T6, T8, T9 |
| VPE-05 | AC-014-2 | Bloqueio quando seria o último responsável ativo | T3, T6, T9 |
| VPE-06 | AC-014-3 | Histórico preservado (append-only + audit) | T2, T6 |

---

## Tasks

### T1 — Facts (skill-tdad) — testes RED da USP-014
- **What:** gerar testes-fonte dos AC-014-1..3 + edges: `.feature` (PT-BR, tag `@ac-014-N`), specs Vitest RED
  (action + regra de domínio), esqueleto E2E do fluxo de remoção, matriz de rastreabilidade AC→teste.
- **Where:** `.specs/features/vinculos-pessoa-empresa/tests/bdd/usp-014-remover-responsavel.feature`,
  `tests/unit/usp-014-remover-responsavel.spec.ts`, `tests/e2e/usp-014-remover-responsavel.e2e.ts`,
  atualizar `tests/traceability.md`.
- **Depends on:** —
- **Reuses:** facts da USP-013 (`tests/*/usp-013-*`).
- **Done when:** `.feature` cobre happy (2→1), auto-remoção com outro ativo, bloqueio do último ativo,
  permissão negada, falha de e-mail não reverte; specs Vitest existem e **falham** (RED).
- **Tests:** (produtor de testes — via **skill-tdad**)
- **Gate:** specs RED commitados antes da implementação.

### T2 — Migração: coluna `revokeReason` (AD-008)
- **What:** adicionar `revokeReason String?` ao `PersonCompanyGrant` (motivo opcional de negócio, ao lado de
  `revokedAt`/`revokedBy`). Migração Prisma, sem backfill (grants já revogados ficam `null`).
- **Where:** `prisma/schema.prisma` (model `PersonCompanyGrant`) + nova migration SQL.
- **Depends on:** —
- **Reuses:** padrão de migração da USP-013 (colunas `status`/`pendingAt`/`acceptedAt`).
- **Done when:** `prisma migrate dev` aplica; coluna nullable existe; typecheck verde; sem regressão em
  `createCompany`/`adicionarResponsavel`.
- **Tests:** `__tests__/grant-revoke-reason-migration.int.test.ts` (coluna existe, default null).
- **Gate:** migration idempotente; schema documentado (comentário).

### T3 — Regra pura de invariante + unit
- **What:** `wouldLeaveCompanyWithoutResponsible(activeGrantIds: string[], grantId: string): boolean` —
  verdadeiro sse `grantId` é o único ativo (sem IO).
- **Where:** `src/modules/companies/domain/grants.ts` (novo) + `__tests__/grants.test.ts`.
- **Depends on:** —
- **Reuses:** semântica de contagem do `adapters/prisma-company-responsibility.ts`.
- **Done when:** único→true, ≥2→false, alvo ausente→false; unit verde; exportada via barrel se usada fora.
- **Tests:** `src/modules/companies/__tests__/grants.test.ts` (unit, domain — alvo dos specs RED de T1).
- **Gate:** cobertura domínio ≥90%.

### T4 — Schema Zod de remoção
- **What:** `removeResponsibleSchema` = `{ grantId: uuid, motivo?: string (trim, ≤280) }` + tipos.
- **Where:** `src/modules/companies/schemas/remove-responsible.schema.ts` + export no `index.ts`.
- **Depends on:** —
- **Reuses:** molde de `schemas/add-responsible.schema.ts`.
- **Done when:** valida uuid + motivo opcional; tipos exportados via barrel.
- **Tests:** `__tests__/remove-responsible.schema.test.ts` (ok / uuid inválido / motivo longo).
- **Gate:** typecheck verde.

### T5 — Template de e-mail `responsible-removed`
- **What:** novo membro `responsible-removed` na union `EmailMessage` + render no `ResendEmailSender`.
- **Where:** `src/shared/lib/email/email-sender.port.ts` + `resend-email-sender.ts` (e fakes de teste).
- **Depends on:** —
- **Reuses:** template `responsible-link-pending` (USP-013) como molde.
- **Done when:** payload `{ to, template:'responsible-removed', data:{ empresaNome } }` tipa via `satisfies
  EmailMessage`; render cobre o novo template; build falha p/ union órfã.
- **Tests:** teste de render do sender para o novo template.
- **Gate:** typecheck verde (exaustividade da union).

### T6 — Server Action `removerResponsavel` (+ barrel)
- **What:** `removerResponsavel` seguindo `design-usp-014.md §2`: Zod → sessão → carregar grant + resolver
  `companyId` → permissão (responsável ACTIVE) → invariante (regra de T3) →
  `withAudit(COMPANY_RESPONSIBLE_REMOVED)` setando `revokedAt`/`revokedBy`/**`revokeReason`** + outbox
  `responsible-removed`. `ActionResult`; nunca throw; nunca delete (append-only / VPE-06).
- **Where:** `src/modules/companies/actions/remove-responsible.ts` + export no `index.ts`.
- **Depends on:** T2, T3, T4, T5.
- **Reuses:** `actions/add-responsible.ts` (estrutura, audit, outbox, headers/ip); `audit/events.ts`
  (`COMPANY_RESPONSIBLE_REMOVED` já catalogado — nada a criar).
- **Done when:** grant encerrado com `revokedAt` + `revokeReason` (sem delete); bloqueio do último ativo;
  auto-remoção com outro ativo permitida; `FORBIDDEN` p/ não-responsável; e-mail enfileirado e falha não
  reverte; auditoria na mesma transação; **specs RED de T1 ficam verdes**; typecheck/lint ok.
- **Tests:** `__tests__/remove-responsible.int.test.ts` — happy (2→1), auto-remoção com outro ativo,
  bloqueio do último ativo, permissão negada, falha de e-mail não reverte (materializa T1).
- **Gate:** integração ≥80% na action; sequência canônica completa.

### T7 — Query `listActiveResponsibles`
- **What:** query read-only dos responsáveis `ACTIVE` da Empresa (nome do co-responsável + `grantId` +
  flag `isSelf`); sem PII além do nome (visível entre co-responsáveis).
- **Where:** `src/modules/companies/queries/list-active-responsibles.ts` + export no `index.ts`.
- **Depends on:** —
- **Reuses:** `queries/list-pending-responsible-links.ts` (molde); `take` + `select` explícitos.
- **Done when:** só `ACTIVE`+`revokedAt=null`; marca o grant do próprio ator; paginação com `take`.
- **Tests:** `queries/__tests__/list-active-responsibles.test.ts`.
- **Gate:** sem N+1; `select` explícito.

### T8 — `RemoveResponsibleDialog` (componente)
- **What:** diálogo shadcn de confirmação com motivo opcional; submit chama `removerResponsavel`; trata
  sucesso (atualiza lista) e erros `PRECONDITION_FAILED` (último ativo) / `FORBIDDEN`.
- **Where:** `src/modules/companies/components/remove-responsible-dialog.tsx` + export no `index.ts`.
- **Depends on:** T6.
- **Reuses:** `components/add-responsible-form.tsx` (RHF + Zod adapter + `useTransition` + toast).
- **Done when:** confirmação com motivo opcional funciona; erro de invariante renderiza mensagem para
  designar outro antes; PT-BR.
- **Tests:** `__tests__/remove-responsible-dialog.test.tsx` (confirmação + render do erro de invariante).
- **Gate:** typecheck/lint ok.

### T9 — Integrar na página de responsáveis
- **What:** página renderiza a lista de responsáveis ativos (T7) com botão "remover" (T8) por linha; trata
  erro de último responsável; auto-remoção → redireciona (ator perde acesso, ADR-0030).
- **Where:** `src/app/(app)/empresa/[empresaId]/responsaveis/page.tsx`.
- **Depends on:** T7, T8.
- **Reuses:** gate de rota existente (responsável ativo → 404), `requireActivePerson`.
- **Done when:** remoção com confirmação funciona e a lista atualiza; bloqueio do último responsável exibido;
  auto-remoção redireciona; typecheck/lint ok.
- **Tests:** esqueleto E2E de T1 (remover com 2 ativos; bloquear o último) — top flow.
- **Gate:** E2E do fluxo crítico passa; lint/typecheck ok.

---

## Ordem de execução (PR único)

```
T1 (facts RED)
 → T2 (migração) ∥ T3 (domínio) ∥ T4 (schema) ∥ T5 (e-mail)
 → T6 (action, verde)
 → T7 (query) ∥ T8 (dialog)
 → T9 (página + E2E)
```

- `[P]` paralelizáveis: {T2, T3, T4, T5} (arquivos disjuntos) e {T7, T8}.
- Tudo num **único PR** fechando **#135** (backend: T2–T6) e **#137** (UI: T7–T9).

## DoD da US (#133)
- [ ] Todos os AC (014-1..3) + edges implementados e cobertos (T1 verde)
- [ ] PR único mergeado (squash) fechando #135 e #137
- [ ] Sem regressão em typecheck/lint/testes
