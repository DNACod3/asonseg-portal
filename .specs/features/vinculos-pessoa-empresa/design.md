# Design — USP-013: Adicionar responsável a uma Empresa

> **ICE Design-adapter.** Este documento NÃO re-deriva arquitetura: resolve os ponteiros do
> card da matriz de conexões (`docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` → USP-013).
> Fonte da verdade: `technical-design.md` §4.4/§4.5/§4.6 + ADRs + runbooks + expectations-USP-013.

## 0. Card resolvido (entrada única)

| Ponteiro do card | Resolve para |
|---|---|
| **Schemas** | `company_responsibles` (TD §4.5) → no código: `PersonCompanyGrant` + **novo campo `status`**; `persons` (busca) |
| **Endpoints** | `companies.adicionarResponsavel`, `companies.aceitarVinculoResponsavel` (TD §4.4) |
| **Eventos** | `COMPANY_RESPONSIBLE_ADDED` + `COMPANY_RESPONSIBLE_LINK_ACCEPTED` (audit) · `email.responsible_link_pending` (outbox) (TD §4.6) |
| **ADRs técnicos** | ADR-0014 (Empresa sem login, N:N), ADR-0017/0022 (visibilidade/resposta binária sem PII), ADR-0020 (atomicidade/outbox), ADR-0021 (unicidade UNIQUE+409), ADR-0029 (rate limit anti-enumeração) |
| **Runbooks** | runbook-server-action, runbook-audit-log, runbook-view-model-visibility, runbook-rate-limit-anti-abuse |
| **Fase** | Fase 2 (TD §5) |
| **Gate** | **D-001 — gate jurídico**: a USP não vai para PRODUÇÃO sem decisão escrita diretoria+jurídico sobre o modelo de aceite. O modelo de design (pendente+aceite) já é a resolução proposta; o sign-off escrito é pré-requisito de **deploy**, não de merge. |

## 1. Decisão de schema (a divergência-chave)

O TD §4.5 descreve `company_responsibles` com `status (pendente|ativo|removido)`. O schema **implementado**
(`prisma/schema.prisma:357-374`) é `PersonCompanyGrant`, **append-only via `revokedAt`, SEM campo `status`**.
USP-012 (`createCompany`) já cria grants sem status (= ativo implícito).

**Resolução:** adicionar `status` ao `PersonCompanyGrant` para suportar o ciclo pendente→ativo→removido,
preservando o padrão append-only (`revokedAt` continua marcando remoção).

```prisma
enum CompanyGrantStatus {
  PENDING   // criado por adicionarResponsavel, aguardando aceite (USP-013/P-002)
  ACTIVE    // aceito (USP-013) ou criação direta no cadastro (USP-012)
  @@map("company_grant_status")
}

model PersonCompanyGrant {
  // ...campos existentes...
  status     CompanyGrantStatus @default(ACTIVE) @map("status")   // NOVO
  pendingAt  DateTime?          @map("pending_at") @db.Timestamptz(6)  // NOVO — quando virou PENDING
  acceptedAt DateTime?          @map("accepted_at") @db.Timestamptz(6) // NOVO — quando virou ACTIVE no aceite
  // revokedAt continua = remoção (USP-014); status REMOVED é representado por revokedAt != null

  // UNIQUE parcial: impede 2 vínculos não-removidos da mesma Pessoa↔Empresa (P-004/ADR-0021)
  @@unique([personId, companyId], name: "uq_person_company_active", map: "uq_person_company_active")
  // NOTA: índice parcial WHERE revoked_at IS NULL via migration SQL raw (Prisma não expressa partial unique)
}
```

**Migração de dados:** grants existentes (USP-012) recebem `status = ACTIVE` (default cobre).
**Impacto cruzado obrigatório:**
- `createCompany` (USP-012, `companies/actions/create-company.ts`) → grava `status: ACTIVE` explicitamente no grant inicial.
- `companiesLeftWithoutResponsible` (`persons/ports/companyResponsibility.ts` + adapter) → conta **apenas `status=ACTIVE` e `revokedAt=null`** (vínculos `PENDING` não contam para a invariante ≥1 responsável — TD §4.5 / USP-014/P-001).
- UNIQUE parcial via SQL raw na migration: `CREATE UNIQUE INDEX uq_person_company_active ON person_company_grants(person_id, company_id) WHERE revoked_at IS NULL;`

## 2. Contratos (TD §4.4) — dois Server Actions

### 2.1 `companies.adicionarResponsavel(empresaId, cpfOuEmail)` — `companies/actions`
Sequência canônica (runbook-server-action):
1. **Zod**: `{ empresaId: uuid, cpfOuEmail: string }` (discrimina CPF vs e-mail por formato).
2. **requirePermission**: ator é responsável **ACTIVE** da `empresaId` (P-005). Negar caso contrário.
3. **Rate limit** anti-enumeração por (ator, rota) — runbook-rate-limit-anti-abuse / ADR-0029.
4. **Busca binária** (P-001/ADR-0022): localizar Pessoa por CPF normalizado **ou** e-mail. Retorno **sem PII** — só `{ encontrada: boolean }` na fase de busca; o `personId` resolvido é usado server-side, nunca devolvido com nome.
5. **Pré-condições**: Pessoa existe (E-002 — senão `NOT_FOUND` + orientar auto-cadastro); não há vínculo `PENDING`/`ACTIVE` (E-edge duplicidade → `CONFLICT 409`).
6. **withAudit(`COMPANY_RESPONSIBLE_ADDED`)**: criar grant `status=PENDING, pendingAt=now`, grantedBy=ator + **outbox** `email.responsible_link_pending` na mesma transação (ADR-0020).
7. Capturar `P2002` (UNIQUE) → `CONFLICT`. Retorno `ActionResult`.

### 2.2 `companies.aceitarVinculoResponsavel(empresaId)` — `companies/actions`
Executada pela **Pessoa adicionada** (sessão = a própria Pessoa do vínculo pendente).
1. **Zod**: `{ empresaId: uuid }`.
2. **requirePermission/sessão**: `getCurrentPerson()` = a Pessoa do vínculo `PENDING` (o link de e-mail aponta para a empresa; a identidade vem da sessão, não do link — link não autentica).
3. **Pré-condição**: existe grant `PENDING` para (person, empresa); senão bloquear (idempotência — já aceito/removido/inexistente).
4. **withAudit(`COMPANY_RESPONSIBLE_LINK_ACCEPTED`)** numa transação (ADR-0020/P-003):
   - grant → `status=ACTIVE, acceptedAt=now`;
   - ativar papel `COMPANY_RESPONSIBLE` na Pessoa (se inativo) — reutilizar padrão `ensureClientRole`/`activateProviderRole`;
   - capturar consent **finalidade 5** (representação de Empresa) — mesmo padrão de `createCompany` (USP-012).
5. Retorno `ActionResult`.

## 3. Eventos (TD §4.6)
- **Audit** (`@/modules/audit/events`): `COMPANY_RESPONSIBLE_ADDED` ✅ já catalogado; **`COMPANY_RESPONSIBLE_LINK_ACCEPTED` → adicionar ao catálogo**.
- **Outbox/e-mail** (USP-044): novo template `responsible-link-pending` no tipo discriminado `EmailMessage` (`shared/lib/email/email-sender.port.ts`) + render no `ResendEmailSender`. Enfileirado via `tx.outbox.create()` dentro da transação de `adicionarResponsavel`. Falha de envio **não** reverte o vínculo (edge — outbox desacopla).

## 4. UI (sub-issue #131, expandida)
- **Adicionar** (painel da Empresa): form de busca por CPF/e-mail → resposta binária ("Pessoa encontrada — confirmar adição" sem nome) → confirmar → toast "convite pendente de aceite". React Hook Form + Zod adapter; Server Action.
- **Aceitar** (painel da Pessoa adicionada): listagem de vínculos pendentes + página/rota de aceite alcançada pelo link do e-mail (rota autenticada em `(app)/`; se deslogada, login→retorna). Botão "Aceitar vínculo" → `aceitarVinculoResponsavel`.

## 5. Reuso (anti-fabricação)
| Precisa | Reutilizar de |
|---|---|
| Sequência de Server Action sensível | `companies/actions/create-company.ts` (USP-012) |
| Ativar papel + consent na mesma tx | `persons/actions/ensure-client-role.ts` (USP-011) / `activate-provider-role.ts` |
| `withAudit` + catálogo de eventos | `@/modules/audit` |
| Outbox + EmailSender | `shared/lib/email/*` (USP-044) |
| Normalização CPF / validação | `persons` (normalização CPF existente) · `companies/domain/cnpj.ts` (molde) |
| View Model sem PII na busca | runbook-view-model-visibility |

## 6. Gate D-001 (não bloqueia merge; bloqueia deploy)
Registrar no fechamento da US um lembrete do gate jurídico: **antes do deploy em produção**, obter decisão
escrita diretoria+jurídico confirmando o modelo "aceite explícito". O design já implementa esse modelo (P-002),
então o gate é uma confirmação formal, não uma mudança técnica. Rastreado em STATE.md.
