# Design — USP-014: Remover responsável de uma Empresa

> **ICE Design-adapter.** Não re-deriva arquitetura: resolve os ponteiros do card da matriz
> (`docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` → USP-014). Fonte da verdade:
> `technical-design.md` §4.4/§4.5/§4.6 + ADRs + runbooks + spec.md (AC-014-1..3 + edges).

## 0. Card resolvido (entrada única)

| Ponteiro do card | Resolve para |
|---|---|
| **Schemas** | `company_responsibles` (TD §4.5) → no código `PersonCompanyGrant`; remoção = `revokedAt`/`revokedBy` (append-only) **+ nova coluna `revokeReason`**. Invariante ≥1 responsável **ACTIVE**. `audit_log`. |
| **Endpoints** | `companies.removerResponsavel` (TD §4.4) |
| **Eventos** | `COMPANY_RESPONSIBLE_REMOVED` (audit, **já catalogado** — `audit/events.ts:49`) · `email.responsible_removed` (outbox) (TD §4.6) |
| **ADRs técnicos** | ADR-0014 (Empresa sem login, N:N), ADR-0023 (log append-only), ADR-0030 (revalidação de permissão por requisição — cobre a auto-remoção) |
| **Runbooks** | runbook-server-action, runbook-audit-log |
| **Fase** | Fase 2 (TD §5) |
| **Gate** | — (sem Q-aberta; o gate jurídico D-001 da USP-013 não se aplica à remoção) |

## 1. Decisões de design (divergências resolvidas)

**D-014-A — Remoção é `revokedAt`/`revokedBy`, não `endedAt`/`endedBy`.**
O body da issue #135 cita `endedAt`/`endedBy`/`endReason`. O schema **implementado**
(`prisma/schema.prisma:369-389`) já modela remoção append-only via `revokedAt`/`revokedBy`.
**Resolução:** reusar `revokedAt`/`revokedBy` (não criar `endedAt`/`endedBy`). `status` permanece
`ACTIVE`/`PENDING`; a remoção é marcada por `revokedAt != null` (comentário do schema em `:338`).

**D-014-B — "motivo" (reason) é coluna de negócio `revokeReason` no grant, NÃO no audit_log.**
O motivo é um **atributo de negócio do ciclo de vida do vínculo** (junto de quando/quem da remoção),
consumível por relatórios/consultas do módulo `reporting`. Guardá-lo só no `audit_log` exigiria filtrar a
tabela forense por `event_type + entityId` e extrair de campo JSON, **invertendo a dependência** (reporting →
auditoria) e fragmentando o modelo (`revokedAt`/`revokedBy` já são colunas; só o "porquê" ficaria fora).
**Resolução:** adicionar coluna nullable **`revokeReason String?`** ao `PersonCompanyGrant` (migração pequena,
sem backfill — grants já revogados ficam `null`), completando o trio quando/quem/porquê na mesma linha. O
`audit_log` continua registrando o **evento** `COMPANY_RESPONSIBLE_REMOVED` (rastro forense); o motivo de
negócio vive com a entidade. Preserva histórico (VPE-06) e mantém relatórios desacoplados da auditoria.

**D-014-C — Invariante por-Empresa via regra pura.** A query de contagem já existe no adapter
`PrismaCompanyResponsibilityAdapter.companiesLeftWithoutResponsible` (chaveada por Pessoa, p/ USP-007).
Para a remoção precisamos do recorte por-grant: "remover ESTE grant deixaria a Empresa com 0 responsáveis
ACTIVE?". **Resolução:** regra pura `wouldLeaveCompanyWithoutResponsible(activeGrantIds, grantId)` em
`domain/grants.ts` (sem IO); a action conta os grants `RESPONSIBLE`+`ACTIVE`+`revokedAt=null` da Empresa e
aplica a regra. Vínculos `PENDING` não contam (consistente com USP-013).

**D-014-D — Auto-remoção sem invalidar sessão.** Remover o próprio vínculo com outro ativo é permitido;
o ator perde acesso de gestão. Pela ADR-0030 a permissão é revalidada **a cada requisição**, então o acesso
cai naturalmente na próxima navegação — sem necessidade de invalidar sessão ativamente.

**D-014-E — E-mail desacoplado (não reverte).** Notificação à Pessoa removida via `tx.outbox.create()` na
mesma transação (enfileiramento), com despacho assíncrono (USP-044). Falha de **envio** não reverte a
remoção — o edge "falha de e-mail não reverte" é satisfeito pelo desacoplamento do outbox.

## 2. Contrato (TD §4.4) — `companies.removerResponsavel`

`removerResponsavel({ grantId: uuid, motivo?: string })` — `companies/actions/remove-responsible.ts`
Sequência canônica (runbook-server-action):
1. **Zod**: `removeResponsibleSchema` = `{ grantId: uuid, motivo?: string (≤ 280, trim) }`.
2. **getCurrentPerson()** (ADR-0030). Sem sessão → `UNAUTHENTICATED`.
3. **Carregar grant alvo**: existe, `grantType=RESPONSIBLE`, `revokedAt=null`. Resolver `companyId`.
   Se não existe / já revogado → `NOT_FOUND` (idempotência defensiva).
4. **requirePermission (P-005)**: ator é responsável **ACTIVE** + `revokedAt=null` da `companyId` do grant.
   Senão `FORBIDDEN` (não-responsável não remove). Defesa em profundidade (a rota já cobre — page 404).
5. **Pré-condição / invariante (AC-014-2)**: contar grants `RESPONSIBLE`+`ACTIVE`+`revokedAt=null` da
   Empresa. Se o grant alvo é `ACTIVE` e a regra pura indica que é o **único** ativo → `PRECONDITION_FAILED`
   "Designe outro responsável antes de remover o último." (remover um `PENDING` nunca bloqueia).
6. **withAudit(`COMPANY_RESPONSIBLE_REMOVED`)** em transação (ADR-0020/0023): `revokedAt=now`,
   `revokedBy=ator`, **`revokeReason=motivo ?? null`**; `audit.entityId=grant.id`,
   `audit.before={status, revokedAt:null}`, `audit.after={revokedAt, revokedBy, revokeReason}`;
   **outbox** `email.responsible_removed` à Pessoa removida.
7. Retorno `ActionResult`. Nunca `throw`; nunca model cru.

## 3. Eventos (TD §4.6)
- **Audit**: `COMPANY_RESPONSIBLE_REMOVED` — já no catálogo e registrado (`audit/events.ts:49,125`). Nada a criar.
- **Outbox/e-mail**: novo template `responsible-removed` na union discriminada `EmailMessage`
  (`shared/lib/email/email-sender.port.ts`) + render no `ResendEmailSender`. Enfileirado na transação da remoção.

## 4. UI (sub-issue #137)
A página `(app)/empresa/[empresaId]/responsaveis/page.tsx` hoje **só** renderiza o `AddResponsibleForm`
(USP-013) — **não lista** responsáveis. A USP-014 adiciona:
- **Query** `listActiveResponsibles(empresaId)` → responsáveis `ACTIVE` (nome do co-responsável é visível
  entre responsáveis da mesma Empresa; sem outra PII), marcando qual é o do próprio ator.
- **`RemoveResponsibleDialog`** (shadcn): confirmação + motivo opcional → `removerResponsavel`.
- Página renderiza a lista com botão "remover" por linha; trata erro de **último responsável**
  (mensagem para designar outro antes) e **permissão**; auto-remoção → redireciona (ator perde acesso).

## 5. Reuso (anti-fabricação)
| Precisa | Reutilizar de |
|---|---|
| Sequência de Server Action sensível | `companies/actions/add-responsible.ts` (USP-013) |
| Contagem de responsáveis ATIVOS por Empresa | `adapters/prisma-company-responsibility.ts` (molde do `groupBy`) |
| `withAudit` + evento `COMPANY_RESPONSIBLE_REMOVED` | `@/modules/audit` (já catalogado) |
| Outbox + EmailSender + union `EmailMessage` | `shared/lib/email/*` (USP-044) |
| Gate de rota (responsável ativo → 404) | `(app)/empresa/[empresaId]/responsaveis/page.tsx` |
| Form client + Server Action + toast | `components/add-responsible-form.tsx` |
