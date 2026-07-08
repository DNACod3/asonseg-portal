# USP-011 — Cadastro de cliente de serviço (papel) — Tasks (RECONCILIAÇÃO Fase 4)

## Execution Protocol (MANDATORY — do not skip)

Execute com a skill spec-driven do projeto: **ative-a por nome e siga o fluxo Execute + Critical Rules.** Se a skill não puder ser ativada, PARE e avise.

> **Esta unidade é uma RECONCILIAÇÃO, não construção nem refactor.** A fronteira de escopo da USP-011 (schema `ClientProfile` + helper `ensureClientRole` + evento de auditoria) **já está implementada e verde** (ver `spec.md` `## Situação`). USP-011 **não tem UI** → **não há refactor de Design System**. O trabalho de Fase 4 é **verificar a integridade** do que existe e **confirmar por escrito** a decisão de escopo (papel cliente sem cadastro self-service; ativação automática consumida pela USP-033). **Nenhum código novo é esperado** — se a verificação encontrar um gap, aí sim vira task de correção (fix→re-verify, limite 3 iterações).

**Design**: [`design.md`](./design.md) · **Spec**: [`spec.md`](./spec.md)
**Status**: Draft (reconciliação)

---

## §0. Entry Gate — ABERTO ✅

Sem sinais de bloqueio ICE (Q-aberta dono/técnico, ADR Proposed, pré-condição, premissa aberta): a matriz aponta `Q-abertas: —`; a Q-aberta de assinatura do helper foi **RESOLVIDA** (design §2). D-002 (termo jurídico da finalidade 4) é gate de **go-live** verificado na USP-033/release, não de desenvolvimento. → entra em verificação.

## Estado da implementação (reconciliado 2026-07-08)

| Entregável (escopo #118) | Onde | Estado |
|---|---|---|
| `ClientProfile` (PK `personId`, `cityId` nullable **sem FK**, `createdAt`, sem `publicationStatus`) + migration | `prisma/schema.prisma` (model `ClientProfile`), `prisma/migrations/*_usp011_client_profile` | ✅ DONE |
| Relação reversa `Person.clientProfile ClientProfile?` | `prisma/schema.prisma` | ✅ DONE |
| Regra pura `decideClientActivation(roles)` | `src/modules/persons/domain/client.ts` | ✅ DONE (`client-domain.test.ts` verde) |
| Helper transacional `ensureClientRole(tx, {personId, term, ip, userAgent})` idempotente | `src/modules/persons/actions/ensure-client-role.ts` | ✅ DONE |
| Evento `CLIENT_ROLE_ACTIVATED` no catálogo (ADR-0023) | `src/modules/audit/events.ts` | ✅ DONE |
| Exports no barrel (`ensureClientRole`, `decideClientActivation`, tipos) | `src/modules/persons/index.ts` | ✅ DONE |
| Testes de integração (1ª ativação; idempotência; consent na mesma tx; PORTAL_ACCESS ausente aborta) | `src/modules/persons/__tests__/ensure-client-role.int.test.ts` | ✅ DONE (verde) |

## §1.5 Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Domínio puro (`domain/client.ts`) | unit | `decideClientActivation` — `needsActivation` correto (idempotência) | `src/modules/persons/__tests__/client-domain.test.ts` | `npm run test` |
| Helper transacional (`actions/ensure-client-role.ts`) | integration | 1ª ativação cria grant+perfil+consents; 2ª é no-op; consent `SERVICE_HIRING` na mesma tx **antes** de ACTIVE (P-001); `PORTAL_ACCESS` ausente aborta a tx | `src/modules/persons/__tests__/ensure-client-role.int.test.ts` | `npm run test:integration` |
| Prisma schema/migration | none (aplica em DB limpo) | `supabase db reset` aplica sem drift; `prisma generate` OK | `prisma/schema.prisma`, `prisma/migrations/*_usp011_client_profile` | `npm run typecheck` + reset |

## §1.5 Facts (skill-tdad) — nota

Os facts desta US **já existem verdes** (gerados quando #119/#120 foram construídos: `tests/bdd/usp-011-cadastro-cliente.feature`, `tests/unit/usp-011-cadastro-cliente.spec.ts`, `tests/traceability.md`), cobrindo E-001(parte server)/E-002/P-001/P-003 + os 3 ACs do board. **Não** são regenerados nesta reconciliação. P-002/E-001(UI) e D-002 verificam-se na **USP-033/release** (fora desta US).

---

## Task Breakdown

### V1 — Verificar contrato do schema `ClientProfile` + migration  · **NET-NEW (já implementado) — verify-only**

**What**: Confirmar que o model `ClientProfile` e sua migration batem com o contrato ICE (TD §2.2 / ADR-0008) e o comentário do schema — perfil leve, sem moderação.
**Where**: `prisma/schema.prisma` (model `ClientProfile` + relação reversa em `Person`); `prisma/migrations/*_usp011_client_profile`.
**Depends on**: None
**Requirement**: schema `client_profiles` (design §1)

**Tools**: MCP: NONE · Skill: spec-driven (Execute)

**Done when**:
- [ ] `ClientProfile` tem `personId` PK `@db.Uuid`, `cityId String? @db.Uuid` **sem FK** (não há model `City`), `createdAt @db.Timestamptz`, relação `person Person`, `@@map("client_profiles")`; **sem** `publicationStatus`/moderação.
- [ ] Relação reversa `Person.clientProfile ClientProfile?` presente.
- [ ] `npm run typecheck` ✓; migration aplica em DB limpo (`supabase db reset`) sem drift.
- [ ] **Se algum item divergir → task de correção** (não presumir; corrigir só o divergente).

**Tests**: none (build gate) — validação por typecheck + reset.
**TestGate**: build

**Commit**: (nenhum se já conforme) · caso corrija: `fix(persons): ...` conforme o gap.

---

### V2 — Verificar `ensureClientRole` (idempotência, P-001 na tx, auditoria, barrel)  · **NET-NEW (já implementado) — verify-only**

**What**: Confirmar que o helper de ativação automática satisfaz os must-nots P-001/P-003 e a idempotência (E-002), emite `CLIENT_ROLE_ACTIVATED`/`CONSENT_GRANTED` corretamente, e está exportado para a USP-033 consumir.
**Where**: `src/modules/persons/actions/ensure-client-role.ts`, `src/modules/persons/domain/client.ts`, `src/modules/persons/index.ts`, `src/modules/audit/events.ts`, `src/modules/persons/__tests__/{client-domain,ensure-client-role.int}.test.ts`.
**Depends on**: V1 (schema)
**Requirement**: E-002, P-001, P-003 (fronteira do chamador), evento de auditoria (design §2/§3)

**Tools**: MCP: NONE · Skill: spec-driven (Execute)

**Done when**:
- [ ] `ensureClientRole` **recebe `tx`** (não abre `withAudit`/transação própria — ADR-0020) e a assinatura é `(tx, {personId, term, ip, userAgent})` (design §2 RESOLVIDA).
- [ ] **P-001:** o grant CLIENT só vai a `ACTIVE` **após** o `Consent SERVICE_HIRING` persistido na mesma tx (ordem `AWAITING_CONSENT → consent → ACTIVE`); `PORTAL_ACCESS` ausente aborta antes de qualquer escrita — **coberto** por `ensure-client-role.int.test.ts` (verde).
- [ ] **E-002 (idempotência):** 2ª chamada com CLIENT já ativo é no-op (`activated:false`), sem duplicar grant/consent/perfil — coberto (`client-domain.test.ts` + int).
- [ ] `CLIENT_ROLE_ACTIVATED` emitido **só** na ativação real; `CONSENT_GRANTED` junto da criação do consent; ambos no catálogo `audit/events.ts`.
- [ ] `ensureClientRole` + `decideClientActivation` + tipos exportados no barrel `@/modules/persons` (pré-condição de consumo pela USP-033).
- [ ] **P-003 (precisa logar):** confirmar que o contrato deixa a resolução da Pessoa autenticada + exibição/aceite do termo (P-002) ao **chamador** (USP-033) — documentado no JSDoc do helper; **não** é responsabilidade desta US.
- [ ] Gate: `npm run test && npm run test:integration` verdes (suítes de USP-011 passam).
- [ ] **Se algum item divergir → task de correção.**

**Tests**: unit (domínio) + integration (helper) — suítes existentes verdes.
**TestGate**: full

**Commit**: (nenhum se já conforme) · caso corrija: `fix(persons): ...` conforme o gap.

---

## Definition of Done (unidade U1 — reconciliação USP-011)

- [ ] V1/V2 verificadas; estado da implementação confirmado íntegro (ou gaps corrigidos com fix→re-verify).
- [ ] Suítes de USP-011 verdes (`client-domain.test.ts`, `ensure-client-role.int.test.ts`).
- [ ] Decisão de escopo (sem cadastro self-service; ativação automática via USP-033) **fixada** na `spec.md` — nenhuma UI de cliente introduzida.
- [ ] `ensureClientRole` disponível no barrel para a USP-033 (unidade separada da Fase 4) consumir.
- [ ] `npm run typecheck && npm run lint` verdes; sem regressão.

---

## Validação pré-apresentação (Tasks §5)

### Check 1 — Granularidade

| Task | Escopo | Status |
|---|---|---|
| V1: verificar schema `ClientProfile` + migration | 1 model + migration | ✅ Granular |
| V2: verificar `ensureClientRole` + domínio + barrel + auditoria | 1 helper + verificações associadas | ✅ Granular |

### Check 2 — Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama mostra | Status |
|---|---|---|---|
| V1 | None | entrada | ✅ Match |
| V2 | V1 | V1 ▶ V2 | ✅ Match |

### Check 3 — Test Co-location Validation

| Task | Camada verificada | Matriz exige | Task diz | Status |
|---|---|---|---|---|
| V1 | Prisma schema/migration | none (build) | none/build | ✅ OK |
| V2 | Domínio + helper transacional | unit + integration | unit + integration (full) | ✅ OK |

### Check 4 — Must-Not Ownership 💠

| Must-not | Owning task | Negative test | Status |
|---|---|---|---|
| P-001 (consent na mesma tx antes de ACTIVE) | V2 | `ensure-client-role.int.test.ts` (ordem AWAITING_CONSENT→consent→ACTIVE; PORTAL_ACCESS ausente aborta) — verde | ✅ |
| P-003 (precisa logar) | V2 (fronteira) | Verificado no chamador USP-033 (`getCurrentPerson`) — **fora desta US** (documentado) | ✅ (delegado) |
| P-002 (consentimento informado — termo exibido) | — | UI da USP-033 (fora desta US) | ➡️ USP-033 |

Todos os checks ✅ — reconciliação pronta para Execute.
