# USP-011 — Cadastro de cliente de serviço (papel) — Tasks

> Deriva de [`design.md`](./design.md). 1 task = 1 PR (squash). Estimate total = **7h** (= 3+4, bate com o board #118).
> Status do board (2026-06-11): #119 **In progress** · #120 **Backlog** (depende de #119).
> **Padrão de referência:** `identity/actions/activate-additional-role.ts` (USP-006). **Diferenças centrais:**
> (1) helper que **recebe `tx`** (sem Server Action standalone); (2) sem moderação/`publicationStatus`; (3) ativação automática.

## Grafo de dependências

```
#119 (model ClientProfile + migration) ──▶ #120 (domain client.ts + ensureClientRole + evento auditoria)
```

Cadeia linear; #120 destrava ao fechar #119 (cascade OpenWolf regra 5).
Sem dependência externa pendente: `Person`, `Role.CLIENT`, `ConsentPurpose.SERVICE_HIRING`,
`PURPOSE_ROLE_MAP`, `PersonRoleGrant`, `RoleGrantStatus`, `withAudit`, `requireActiveConsent` **já existem**.

---

## T1 — #119 · feat(persons): schema ClientProfile (perfil cliente de serviço) · 3h · In progress

- **What:** model Prisma `ClientProfile` (contrato **verbatim** do TD §2.2 / ADR-0008) + relação reversa em `Person` + migration.
- **Where:** `prisma/schema.prisma`; migration `prisma/migrations/20260611XXXXXX_usp011_client_profile/`.
- **Depends on:** fundação `Person` (já existe).
- **Reuses:** `Person`; contrato verbatim `design.md §1`. Padrão de migration: `..._usp010_provider_profile_and_company_type`.
- **Done when:**
  - [ ] Model `ClientProfile` com `personId` PK `@db.Uuid`, `cityId String? @db.Uuid` (**sem FK** — não há model `City`), `createdAt @db.Timestamptz`, relação `person Person`, `@@map("client_profiles")`.
  - [ ] Relação reversa `Person.clientProfile ClientProfile?` adicionada (se ainda não existir).
  - [ ] **Não** criar model `City` nem `publicationStatus`/moderação.
  - [ ] Migration gerada, revisada e aplica em DB limpo (`supabase db reset`); `prisma generate` sem erro.
  - [ ] `npm run typecheck` ✓.
- **Tests:** N/A direto — validação por migration + typecheck. Smoke `supabase db reset`.
- **Gate:** `npm run typecheck` ✓ · migration aplica em DB limpo ✓ · sem regressão no schema.
- **Commit:** `feat(persons): schema ClientProfile (perfil cliente de serviço)`

## T2 — #120 · feat(persons): ativacao automatica do papel cliente (ensureClientRole) · 4h · Backlog

- **What:** regra pura de idempotência (`domain/client.ts`) + helper transacional `ensureClientRole(tx, …)` (ativa papel CLIENT + `ClientProfile` + consent `SERVICE_HIRING`/`PORTAL_ACCESS`, idempotente) + evento `CLIENT_ROLE_ACTIVATED`.
- **Where:** `src/modules/persons/domain/client.ts`, `src/modules/persons/actions/ensure-client-role.ts`, `src/modules/persons/__tests__/ensure-client-role.int.test.ts`, barrel `src/modules/persons/index.ts`; edita `src/modules/audit/events.ts`.
- **Depends on:** #119 (`ClientProfile`). Externos (existem): `@/modules/consents`, `@/modules/audit` (`withAudit`), `@/modules/identity` (`ROLE_PURPOSE_MAP`).
- **Reuses:** corpo da transação de `activate-additional-role.ts:128-218` (grant `AWAITING_CONSENT`→`ACTIVE`, consent na mesma tx, reúso de grant/consent existentes via índice parcial). **Diferença:** recebe `tx`, não abre `withAudit`; faz `upsert ClientProfile`.
- **Done when:**
  - [ ] `decideClientActivation(currentRoles)` puro: `needsActivation = !roles.includes('CLIENT')`.
  - [ ] `ensureClientRole`: 1ª chamada ativa grant CLIENT + `ClientProfile` + consent `SERVICE_HIRING` (e garante `PORTAL_ACCESS`) **na `tx` recebida**; promove grant a `ACTIVE` só após o consent (P-001).
  - [ ] Reexecução com papel já ativo é **no-op** idempotente (`activated:false`) — sem duplicar grant/consent/perfil (E-002 / AC #118-3).
  - [ ] Emite `CLIENT_ROLE_ACTIVATED` **só** quando há ativação real; `CONSENT_GRANTED` junto da criação do consent.
  - [ ] `CLIENT_ROLE_ACTIVATED` adicionado ao catálogo `audit/events.ts`; exports via barrel `persons/index.ts`.
  - [ ] **Decisão de assinatura** registrada (ver `design.md §2` Q-aberta) — confirmar `(tx, {personId, term, ip, userAgent})` com Tech Lead.
  - [ ] `npm run typecheck` e `npm run lint` sem erros.
- **Tests:** ver facts gerados por skill-tdad (abaixo). Unit (domain): decisão de idempotência. Integração (`*.int.test.ts`): 1ª ativação cria grant+perfil+consents; 2ª chamada não duplica; consent ausente é criado na mesma tx.
- **Gate:** `npm run typecheck` ✓ · `npm run lint` ✓ · `vitest` dos novos testes verdes.
- **Commit:** `feat(persons): ativacao automatica do papel cliente (ensureClientRole)`

---

## Facts (skill-tdad)

Gerados em `tests/bdd/usp-011-cadastro-cliente.feature` (PT-BR, tag `@ac-…`), `tests/unit/usp-011-cadastro-cliente.spec.ts` (Vitest RED) e `tests/traceability.md` — cobrindo E-001(parte server)/E-002/P-001/P-003 + os 3 ACs do board. P-002/E-001(UI) e D-002 verificam-se na USP-033/release (fora desta US).
