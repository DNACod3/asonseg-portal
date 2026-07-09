# USP-033 — Design

Precedente-espelho: **agregado `Application` de `jobs` (AD-017)** — `applyToJob`, índice único
parcial de linha ativa, self-service sem RBAC, Outbox in-tx. Todas as decisões abaixo são
"ADR-worthy" (candidata **AD-020** — caminho de escrita de `ServiceInterest`).

## D1 — Propriedade do módulo (candidata AD-020)

`ServiceInterest` vive em **`@/modules/services`** (pai = `Service`), exatamente como
`Application` vive em `jobs` (AD-017). Não se cria módulo `manifestacoes` (o `src/` é fechado —
módulo novo exigiria RFC). `referrals` é Fase 5 (encaminhamento) e **não** é isto.

## D2 — Modelo `ServiceInterest` + migração incremental

Materializa o §2.6 do `technical-design.md`, com **uma divergência declarada** (idêntica à de
AD-017 para `Application`): o TD prescreve `@@unique([serviceId, clientPersonId, interestedAt])`,
que **não** garante unicidade da linha ativa sob corrida. Supersedemos por **índice único parcial**
(SQL bruto — Prisma não expressa índice parcial no schema).

Migração `usp033_service_interest` (timestamp na criação):

```prisma
model ServiceInterest {
  id             String    @id @default(uuid()) @db.Uuid
  clientPersonId String    @map("client_person_id") @db.Uuid
  serviceId      String    @map("service_id") @db.Uuid
  cancelledAt    DateTime? @map("cancelled_at") @db.Timestamptz(6) // null = ATIVA (soft-cancel)
  interestedAt   DateTime  @default(now()) @map("interested_at") @db.Timestamptz(6)
  message        String?   @db.Text // opcional; NÃO coletado no CTA MVP (col. barata p/ evitar re-migração)

  client  Person  @relation(fields: [clientPersonId], references: [id])
  service Service @relation(fields: [serviceId], references: [id])

  @@index([serviceId, cancelledAt]) // lista ativa do prestador (USP-035)
  @@map("service_interests")
}
```
Relações incrementais (a migração as adiciona; nascem sem `interests` em U2 de propósito):
- `Service` → `interests ServiceInterest[]`
- `Person` → `serviceInterests ServiceInterest[]`

SQL bruto na mesma migração (**a garantia real** de SVC033-MN-03):
```sql
CREATE UNIQUE INDEX "uq_service_interest_active"
  ON "service_interests" ("client_person_id", "service_id")
  WHERE "cancelled_at" IS NULL;
```
Permite re-manifestar após cancelar (linha cancelada sai do índice) — espelha `uq_application_active`.

## D3 — Consentimento `SERVICE_HIRING` + ativação automática do papel (o nó do fluxo)

Finalidade confirmada no catálogo LGPD: **`SERVICE_HIRING`** (`purpose-role-map.ts` → papel
`CLIENT`; `ensure-client-role.ts` já grava esse consent). **Não** existe `SERVICE_INTEREST`.

Invariante fechado pela cascata: `revokeConsent('SERVICE_HIRING')` **cascateia** o grant `CLIENT`
para `REVOKED` na mesma tx (`revoke-consent.ts`). Logo, para os casos alcançáveis no MVP vale
**consent-inativo ⟺ papel-CLIENT-não-ACTIVE** (ABSENT/REVOKED). Isso torna correto **delegar**
role+consent ao helper `ensureClientRole` (que só (re)grava o consent quando ATIVA o papel).

**Gate de consentimento em `manifestInterest` (pré-tx):**
`const c = await requireActiveConsent(person.id, 'SERVICE_HIRING')`
- `c.active` ⇒ não exige novo aceite (papel já ATIVE por invariante); `ensureClientRole` será no-op.
- `!c.active` ⇒ exige `input.consentAccepted === true`; senão `fail('CONSENT_REQUIRED', …)` (a CTA
  exibe o termo carregado por `loadTerm` — responsabilidade do caller/página, P-002). Com aceite,
  carrega o termo server-side (`loadTerm('SERVICE_HIRING')` → `{version, hash}`) e passa a
  `ensureClientRole`.

`ensureClientRole(tx, { personId, term: {version, hash}, ip, userAgent })` (import via barrel
`@/modules/persons` — server-only, ok num `'use server'`; **não** puxar o barrel de client
componentes, ver lição do bundle AD-019) faz, em ordem: idempotência → PORTAL_ACCESS check →
grant `AWAITING_CONSENT` → **Consent SERVICE_HIRING** → `ClientProfile` upsert → grant `ACTIVE` →
audit `CLIENT_ROLE_ACTIVATED`. Satisfaz AC-033-2 e SVC033-MN-02.

**Resíduo documentado (assunção A-CONSENT):** o caso `OUTDATED` (papel ACTIVE + consent numa
versão major antiga de termo) **não é alcançável no MVP** (`SERVICE_HIRING` tem termo único). Se
ocorrer no futuro, o pré-check retorna `!active` → `CONSENT_REQUIRED`, e o re-aceite acontece pelo
painel de consentimentos (`grantConsent`, USP-043, que reativa o grant — P-006), depois re-manifesta.
Não duplicamos a criação de consent dentro de `manifestInterest`. **Se** um bump major de termo
exigir auto-cura in-line, revisitar (registrar consent in-tx antes de `ensureClientRole`).

## D4 — `manifestInterest` (Server Action) — espelha `applyToJob`

Arquivo `src/modules/services/actions/manifest-interest.ts` (`'use server'`).
Schema `manifestInterestSchema = z.object({ serviceId: uuid, consentAccepted: z.boolean().optional() })`
— **sem** `personId` (P-002/P-003, opera só sobre a Pessoa da sessão). Retorno `ActionResult<…>`,
**nunca lança**.

Sequência (self-service, **sem `requirePermission`** — não há PermissionId de manifestação; A-4/AD-017):
1. Zod → `VALIDATION`.
2. `getCurrentPerson()` → `UNAUTHENTICATED`.
3. Carrega o serviço: `findUnique({ where:{id}, select:{ id, status, authorPersonId, author:{ select:{ inactivatedAt, fullName, phone, emailLogin } }, company:{ select:{ nomeFantasia } }, title } })`. `null` ⇒ `NOT_FOUND`. **O contato do autor é SELECTado aqui**, mas só é **retornado** no sucesso (o cliente torna-se entitled ao persistir) — nunca antes.
4. Regra pura `isServiceOpenForInterest({status, authorInactivatedAt})` (espelha `isJobOpenForApplication`; mesma semântica on-read de `getActiveServiceDetail`: `status==='ACTIVE' && author.inactivatedAt==null`). Falha ⇒ `PRECONDITION_FAILED` (SVC033-MN-05).
5. `if (service.authorPersonId === person.id) ⇒ PRECONDITION_FAILED` (SVC033-MN-04).
6. Gate de consent (§D3). `!active && consentAccepted!==true` ⇒ `CONSENT_REQUIRED`. Termo via `loadTerm` (erro ⇒ `PRECONDITION_FAILED`).
7. Pré-check UX de duplicidade: `serviceInterest.findFirst({ where:{ serviceId, clientPersonId, cancelledAt:null } })` ⇒ `CONFLICT` (só UX; a garantia é o índice parcial).
8. `withAudit(AuditEvent.INTEREST_MANIFESTED, async (tx, audit) => { … }, { actorUserId, actorPersonId, context:{serviceId} })`:
   - `await ensureClientRole(tx, { personId, term, ip, userAgent })` (ativa papel + consent se preciso).
   - `tx.serviceInterest.create({ data:{ serviceId, clientPersonId }, select:{id} })` — `try/catch` P2002 ⇒ `ManifestConflictError` (SVC033-MN-03).
   - Outbox (guardado por `service.author.emailLogin` presente): `message: EmailMessage = { to: author.emailLogin, template:'service-interest-notification', data:{ prestadorNome, servicoTitulo, clienteNome } }; tx.outbox.create({ data:{ topic:'email', payload: message } })` (AD-007; espelha `applyToJob`).
   - Audit de revelação: `tx.auditLog.create({ action: PROVIDER_CONTACT_REVEALED, actorPersonId, entityType:'service', entityId: serviceId, ip, userAgent, after:{ interestId } })` (o instante único da revelação — não re-audita a cada reload).
   - `audit.entityType='SERVICE_INTEREST'; audit.entityId=created.id; audit.after={serviceId, clientPersonId}`.
9. Sucesso ⇒ `ok({ interestId, providerContact })`, onde `providerContact = viewProviderContactForClient(service)` (nome público + phone/email do autor). Falha P2002/`ManifestConflictError` ⇒ `CONFLICT`; erro genérico ⇒ `INTERNAL`.

`ip`/`userAgent` capturados via `headers()` + `clientIp` (espelha `activate-additional-role`).

Eventos de auditoria: `INTEREST_MANIFESTED` e `PROVIDER_CONTACT_REVEALED` **já existem** no
catálogo (`src/modules/audit/events.ts:96,98`) — não adicionar.

## D5 — Revelação de contato (o núcleo de privacidade)

**"Prestador" = a Pessoa autora do serviço.** `Company` **não tem** campos de contato (só
`endereco`); mesmo serviço em nome de Empresa, o contato revelado é `author.phone` + `author.emailLogin`
(nome de exibição já público via `providerDisplayName`).

Condição de revelação **fixada**: o contato é visível ao cliente **enquanto ele tiver manifestação
ATIVA** (não-cancelada) naquele serviço. Ao manifestar (AC-033-1) a action já retorna o contato;
em reloads, a página re-decide via query escopada. Após cancelar (USP-034), o contato **some da UI**
(cliente pode re-manifestar para revê-lo). Isto é coerente com a matriz de cascata
(`contato-ja-revelado-prestador: MANTER` protege a **cópia lícita do prestador**/registro LGPD, não
a continuidade da exibição na tela do cliente).

Artefatos de leitura (NET-NEW):
- `queries/get-my-service-interest.ts` → `getMyActiveServiceInterest(serviceId, clientPersonId): Promise<{id}|null>` (espelha `getMyActiveApplication`; `where:{ serviceId, clientPersonId, cancelledAt:null }`, `select:{id}`).
- `queries/get-provider-contact.ts` → `getProviderContactForService(serviceId, clientPersonId): Promise<ProviderContact|null>`. **Só carrega o contato quando há manifestação ATIVA**: primeiro confirma o interesse escopado; se null, retorna null **sem** SELECT de contato (SVC033-MN-01 — não carregar o campo restrito a não-entitled). Se ativo, SELECTa `author.phone/emailLogin` + `company.nomeFantasia`/`author.fullName` e projeta por `viewProviderContactForClient`.
- `views/provider-contact.view.ts` → `viewProviderContactForClient(row): ProviderContact = { displayName, phone: string|null, email: string|null }`. Materializa o `viewProviderForClient` do TD (§Fase 4). Único ponto de projeção do contato.

## D6 — Wiring da página de detalhe (substitui o seam de U2)

`src/app/(public)/servicos/[id]/page.tsx` já faz `viewer = getCurrentPerson()`. Adicionar (só quando
`viewer != null`): `const mine = await getMyActiveServiceInterest(id, viewer.id)`; `const contact = mine ? await getProviderContactForService(id, viewer.id) : null`. Passar `myInterestId`/`providerContact`
ao `ServiceDetailView`.
- `ManifestInterestCta` (em `components/service-detail.tsx`, hoje botão `disabled "Disponível em breve"`)
  é **substituído**: anônimo → link `/cadastro` (mantém); autenticado sem interesse → `<ManifestInterestButton serviceId=… />`; autenticado com interesse ativo → bloco de contato (`providerContact`) + `<CancelInterestButton interestId=… />` (USP-034).
- Client component NET-NEW `components/manifest-interest-button.tsx` (`'use client'`): importa a action por caminho relativo `../actions/manifest-interest` (exceção documentada do repo, como `apply-to-job-button`); `useTransition` + `useState(error)`; on ok → `router.refresh()` (a página re-renderiza revelando o contato); on `CONSENT_REQUIRED` → exibe o termo `SERVICE_HIRING` (`loadTerm` server-side na página, passado como prop) + checkbox e re-submete com `consentAccepted:true`. **O gate ISR do detalhe permanece** (`revalidate=1800`); o bloco autenticado (contato/CTA) já é decidido por `getCurrentPerson()` — sem cache de contato (a query de contato roda por request quando há interesse).

## D7 — E-mail `service-interest-notification` (NET-NEW)

3 edições (o `switch` exaustivo força o case): (1) `email-sender.port.ts` — nova interface
`ServiceInterestNotificationEmailData { prestadorNome; servicoTitulo; clienteNome }` + braço de união;
(2) `templates/service-interest-notification.ts` — `renderServiceInterestNotificationEmail(data)` (reusa `layout.ts`); (3) `resend-email-sender.ts` — import + `case`. Enfileirado in-tx (D4). **Cliente NÃO
recebe e-mail** (Out-of-Scope do épico; contato revelado on-screen). Dispatch do Outbox é USP-044.

## Regras/convenções aplicadas
- Sequência de Server Action sensível (CLAUDE.md): Zod → sessão → (sem RBAC) → consent → pré-condições → `withAudit`.
- Barrel: novos símbolos exportados em `src/modules/services/index.ts`; imports externos só via `@/modules/services`.
- `take` obrigatório em toda query; `select` explícito; TZ UTC no banco, borda `America/Sao_Paulo`.
- L-004: dois desfechos distintos documentados — `VALIDATION` (input ausente/malformado) vs `CONSENT_REQUIRED` (bem-formado, consent inativo).
