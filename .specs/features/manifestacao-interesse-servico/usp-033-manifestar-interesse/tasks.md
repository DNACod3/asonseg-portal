# USP-033 — Tasks (todas NET-NEW)

Sequência: migração → domínio/schema → e-mail → action → queries/View Model → wiring da página → testes.
Gate por task: `npm run typecheck && npm run lint` sempre; testes conforme o campo Tests.
Commits atômicos por task (`feat(services):` salvo onde indicado). Convenção de scopes: CLAUDE.md.

---

### T1 — Migração `ServiceInterest` + relações + índice único parcial
- **What:** Adicionar `model ServiceInterest` (design §D2), relações `Service.interests` e `Person.serviceInterests`, e migração com o SQL bruto `uq_service_interest_active`.
- **Where:** `prisma/schema.prisma`; `prisma/migrations/<ts>_usp033_service_interest/migration.sql`.
- **Depends on:** —
- **Reuses:** padrão de `uq_application_active` (`migrations/20260708134240_usp025_applications_write/migration.sql`).
- **Done when:** `npx prisma migrate dev` aplica limpo do zero; `npx prisma generate` ok; índice parcial existe (`\d service_interests` mostra o `WHERE cancelled_at IS NULL`).
- **Tests:** migração aplica limpa (gate) + int test de unicidade em T7.
- **Gate:** typecheck (Prisma Client regenerado) + migrate dev limpo.

### T2 — Domínio (regra pura) + schema Zod
- **What:** `domain/service-interest-rules.ts` com `isServiceOpenForInterest({status, authorInactivatedAt}, )` (espelha `application-rules.isJobOpenForApplication`; ACTIVE + autor ativo). `schemas/service-interest.schema.ts` com `manifestInterestSchema = z.object({ serviceId: z.string().uuid('Serviço inválido.'), consentAccepted: z.boolean().optional() })`.
- **Where:** `src/modules/services/domain/`, `src/modules/services/schemas/`, export no barrel `index.ts`.
- **Depends on:** T1.
- **Reuses:** `src/modules/jobs/domain/application-rules.ts`.
- **Done when:** regra pura testada (unit); schema exportado no barrel.
- **Tests:** unit `service-interest-rules.spec.ts` (ACTIVE/PAUSED/DRAFT/autor-inativo).
- **Gate:** typecheck + lint + unit.

### T3 — Template de e-mail `service-interest-notification`
- **What:** 3 edições do design §D7 (port union arm + template + case no render switch).
- **Where:** `src/shared/lib/email/email-sender.port.ts`, `src/shared/lib/email/templates/service-interest-notification.ts`, `src/shared/lib/email/resend-email-sender.ts`. Scope `feat(infra):` ou `feat(services):`.
- **Depends on:** —
- **Reuses:** `templates/application-confirmation.ts` + `templates/layout.ts`.
- **Done when:** `render()` cobre o novo template (switch exaustivo compila); `EmailMessage` aceita o novo braço.
- **Tests:** unit do render do template (assunto/HTML/text contêm nome do serviço + cliente).
- **Gate:** typecheck + lint + unit.

### T4 — Server Action `manifestInterest`
- **What:** `actions/manifest-interest.ts` (`'use server'`), sequência do design §D4. Import `ensureClientRole` de `@/modules/persons`, `requireActiveConsent`/`loadTerm` de `@/modules/consents`, `withAudit`/`AuditEvent` de `@/modules/audit`. Retorna `ok({interestId, providerContact})`.
- **Where:** `src/modules/services/actions/manifest-interest.ts`; export no barrel.
- **Depends on:** T1, T2, T3, T5 (usa `viewProviderContactForClient`).
- **Reuses:** `src/modules/jobs/actions/apply-to-job.ts` (estrutura, P2002→CONFLICT, Outbox in-tx); `activate-additional-role.ts` (headers/ip/userAgent + loadTerm).
- **Done when:** happy path persiste + enfileira Outbox + audita `INTEREST_MANIFESTED` e `PROVIDER_CONTACT_REVEALED`; nunca lança.
- **Tests:** int matrix em T7 (happy, Zod, unauth, NOT_FOUND, precondição serviço/autor, self-service próprio serviço, consent-absent→CONSENT_REQUIRED, consent-ativo→sem novo aceite, concorrência P2002, e-mail enfileirado).
- **Gate:** typecheck + lint.

### T5 — Queries de leitura + View Model de contato
- **What:** `queries/get-my-service-interest.ts` (`getMyActiveServiceInterest`); `queries/get-provider-contact.ts` (`getProviderContactForService` — só SELECTa contato se houver interesse ativo, design §D5); `views/provider-contact.view.ts` (`viewProviderContactForClient` + tipo `ProviderContact`). Exports no barrel.
- **Where:** `src/modules/services/queries/`, `src/modules/services/views/`, `index.ts`.
- **Depends on:** T1.
- **Reuses:** `jobs/queries/get-my-application.ts`; `services/views/provider-display.ts` (`providerDisplayName`).
- **Done when:** sem interesse ativo, `getProviderContactForService` retorna null **sem** carregar phone/email (verificável no teste de não-vazamento).
- **Tests:** int `get-provider-contact.int.test.ts` (com/sem interesse ativo); unit do View Model (SVC033-MN-01 — shape sem contato quando não-entitled).
- **Gate:** typecheck + lint + unit/int.

### T6 — Wiring da página de detalhe (substitui o seam U2) + botão
- **What:** Client component `components/manifest-interest-button.tsx` (design §D6). Substituir `ManifestInterestCta` em `components/service-detail.tsx` pelos 3 caminhos (anônimo / autenticado-sem-interesse / autenticado-com-interesse→contato+cancelar). Estender `service-detail.view.ts`/`ServiceDetail` com `myInterestId?`/`providerContact?` **ou** passar como props separadas do page. Ajustar `src/app/(public)/servicos/[id]/page.tsx` para buscar interesse+contato quando `viewer!=null` e carregar o termo `SERVICE_HIRING` (`loadTerm`) p/ o fluxo de aceite.
- **Where:** `src/modules/services/components/`, `src/modules/services/views/service-detail.view.ts`, `src/app/(public)/servicos/[id]/page.tsx`; export do botão no barrel.
- **Depends on:** T4, T5.
- **Reuses:** `jobs/components/apply-to-job-button.tsx`, `job-detail.tsx` (`ApplyCta` — decisão apply/cancel via id).
- **Done when:** detalhe autenticado com interesse ativo mostra contato + botão cancelar; sem interesse mostra "entrar em contato"; anônimo mostra link `/cadastro`. `CONSENT_REQUIRED` exibe termo + checkbox e re-submete.
- **Tests:** component `manifest-interest-button.spec.tsx`; render do `ServiceDetailView` nos 3 estados (SVC033-MN-01: contato ausente do DOM/props quando sem interesse).
- **Gate:** typecheck + lint + component.

### T7 — Testes de integração do write path (matriz) + concorrência + E2E do gate
- **What:** `__tests__/manifest-interest.int.test.ts` cobrindo a matriz (T4 Tests). Teste de **concorrência** do índice parcial (2 inserts simultâneos ⇒ 1 ok + 1 CONFLICT, SVC033-MN-03). Teste SVC033-MN-02 (consent ausente + sem aceite ⇒ nada persistido: 0 rows, papel não ativado). Teste de não-vazamento de contato (SVC033-MN-01). E2E: gate de sessão na CTA do detalhe (anônimo vê link `/cadastro`) — spec **real**, não `.fixme` (L-007); fluxo autenticado **deferido** à integração/componente (padrão AD-019 — repo sem seed de sessão Supabase no Playwright).
- **Where:** `src/modules/services/__tests__/`, `e2e/servico-detalhe-cta.spec.ts` (ou estender o E2E de detalhe existente).
- **Depends on:** T4, T5, T6.
- **Reuses:** `jobs/__tests__/apply-to-job.int.test.ts`, `application-rules.spec.ts`; padrão de teste de concorrência da USP-025.
- **Done when:** matriz verde; sensor de concorrência mata a mutação (remover o índice/pré-check ⇒ 2 linhas ativas ⇒ teste falha); E2E do gate roda em `npm run test:e2e`.
- **Gate:** `npm run test` (unit+int) + `npm run test:e2e` (gate anônimo) + build `NODE_ENV=production`.

---

## Matriz de rastreio AC → teste

| AC / MN | Teste (arquivo :: caso) |
|---|---|
| AC-033-1 | manifest-interest.int :: happy (persiste + Outbox + audit + retorna contato) |
| AC-033-2 | manifest-interest.int :: cliente sem papel ⇒ CLIENT ACTIVE + CLIENT_ROLE_ACTIVATED |
| AC-033-3 | manifest-interest.int :: 2 serviços diferentes coexistem ativos |
| AC-033-4 / SVC033-MN-02 | manifest-interest.int :: consent ausente sem aceite ⇒ CONSENT_REQUIRED, 0 rows, papel não ativo |
| AC-033-5 / SVC033-MN-01 | get-provider-contact.int + provider-contact.view.spec + service-detail render :: contato só com interesse ativo; ausente do payload/DOM sem interesse |
| SVC033-MN-03 | manifest-interest.int :: concorrência 2 inserts ⇒ 1 ok + 1 CONFLICT |
| SVC033-MN-04 | manifest-interest.int :: autor manifesta no próprio serviço ⇒ PRECONDITION_FAILED |
| SVC033-MN-05 | service-interest-rules.spec + manifest-interest.int :: serviço PAUSED/autor inativo ⇒ PRECONDITION_FAILED |
| Edge NOT_FOUND/Zod/termo | manifest-interest.int :: serviço inexistente / serviceId inválido / loadTerm falha |
| Gate de sessão | e2e servico-detalhe-cta :: anônimo vê link `/cadastro` |
