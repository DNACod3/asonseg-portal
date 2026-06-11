# USP-010 — Cadastro de prestador de serviço — Tasks

> Deriva de [`design.md`](./design.md). 1 task = 1 PR (squash). Estimate total = **15h** (= 3+6+6, bate com o board).
> Status do board (2026-06-10): #112 **Ready** · #114/#116 **Backlog**.
> **Padrão de referência:** USP-009 (gêmeo). **Diferenças centrais:** (1) sem integração com `moderation` (papel ativo imediatamente, ADR-0015); (2) CNPJ MEI fora da US — redireciona ao fluxo USP-012 (**ADR-0031**).

## Grafo de dependências

```
#112 (schema ProviderProfile + CompanyType) ──▶ #114 (action + schema/domain + consent) ──▶ #116 (UI /prestador + redirect MEI)
```

Cadeia linear; cada task desbloqueia a próxima ao fechar (cascade OpenWolf regra 5).
Sem dependência externa pendente: `Region`, papel `PROVIDER`, consent `SERVICE_OFFERING` (termo `service-offering@v1.0`), `activateAdditionalRole` e o fluxo de Empresa (USP-012) **já existem**.

---

## T1 — #112 · feat(persons): model ProviderProfile + expandir CompanyType + migration · 3h · Ready

- **What:** model Prisma `ProviderProfile` (contrato **verbatim** do TD §4.5, **sem CNPJ**) + relações reversas + **expandir enum `CompanyType`** (ADR-0031) + migration.
- **Where:** `prisma/schema.prisma`; migration `prisma/migrations/20260610XXXXXX_usp010_provider_profile_and_company_type/`.
- **Depends on:** fundação `Person`/`Role`/`Region`/`ContentStatus`/`Company` (já existem).
- **Reuses:** `Person`, `Region` (`schema.prisma:58`), `enum ContentStatus`, `enum CompanyType`; contrato verbatim `design.md §2`.
- **Done when:**
  - [ ] Model `ProviderProfile` com `personId` PK, `headline?`, `description? @db.Text`, `photoStoragePath?`, `regionId?`→`Region`, `publicationStatus ContentStatus @default(DRAFT)`, timestamps, `@@index([publicationStatus])`. **Sem campo de CNPJ** (ADR-0031).
  - [ ] Relações reversas: `Person.providerProfile ProviderProfile?` e `Region.providerProfiles ProviderProfile[]`.
  - [ ] `CompanyType` expandido para `{ MEI, SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL, SA }`; migration mapeia registros `CNPJ_REGULAR` existentes (**confirmar destino com Tech Lead**) e ajusta o default.
  - [ ] Código de `companies`/USP-012 que referencia `CompanyType` continua compilando (ajustar usos do valor removido `CNPJ_REGULAR`).
  - [ ] Migration aplica em DB limpo; `prisma generate` sem erro.
- **Tests:** N/A direto — validação por migration + typecheck. Smoke `supabase db reset`.
- **Gate:** `npm run typecheck` ✓ · migration aplica em DB limpo ✓ · sem regressão em `companies`/USP-012.

## T2 — #114 · feat(persons): ativar prestador + schema/domain + consentimento · 6h · Backlog

- **What:** Zod `providerProfileSchema` (sem CNPJ) + Server Action `activateProviderRole` (perfil DRAFT) + evento de auditoria. Reusa `activateAdditionalRole` (USP-006) para papel+consent `SERVICE_OFFERING`.
- **Where:** `src/modules/persons/schemas/provider.ts`, `src/modules/persons/actions/activate-provider-role.ts`, `__tests__/`, barrel `index.ts`; edita `src/modules/audit/events.ts`. (`domain/provider.ts` só se houver regra pura — sem CNPJ, pode não ser necessário.)
- **Depends on:** #112. Externos (existem): `@/modules/consents` (`requireActiveConsent`, `SERVICE_OFFERING`), `@/modules/audit` (`withAudit`), `@/modules/identity` (`activateAdditionalRole`, `ROLE_PURPOSE_MAP.PROVIDER`).
- **Reuses:** `getCurrentPerson`, `requireActiveConsent`, `withAudit`, `ActionResult`, `activateAdditionalRole`. Espelha `activate-candidate-role.ts`.
- **Done when:**
  - [ ] `providerProfileSchema`: campos opcionais (`headline?`, `description?`, `regionId?`); mensagens PT-BR. **Sem `cnpjMei`**.
  - [ ] `activateProviderRole`: sequência canônica (Zod → `getCurrentPerson` P-005 → `requireActiveConsent` PORTAL_ACCESS + SERVICE_OFFERING → idempotência → `withAudit('PROVIDER_ROLE_ACTIVATED', upsert DRAFT)`). Retorno `ActionResult`; nunca `throw`; nunca model cru. Reativar não duplica.
  - [ ] Evento `PROVIDER_ROLE_ACTIVATED` no catálogo `@/modules/audit/events` (sem `justification`).
  - [ ] **Sem** `transitionContent`/`ContentKind` e **sem** coleta de CNPJ (fora do escopo — design §8).
  - [ ] Export via barrel `@/modules/persons`.
- **Tests:** **unit** — `provider-actions.test.ts`: happy (perfil mínimo) · opcionais · sem sessão (P-005) · consent ausente (P-003) · idempotência. **integração** (`*.int.test.ts`): `activateProviderRole` happy + consent ausente + idempotência com seed real.
- **Gate:** `npm run typecheck` ✓ · `npm run lint` ✓ · unit + integração verdes.

## T3 — #116 · feat(persons): tela de cadastro de prestador (formulário + consentimento + redirect MEI) · 6h · Backlog

- **What:** Página/rota autenticada `/prestador` com form RHF+Zod, aceite do consentimento `SERVICE_OFFERING`, ativação do papel+perfil e CTA de redirect ao fluxo USP-012 para MEI.
- **Where:** `src/app/(app)/prestador/page.tsx`, `src/modules/persons/components/provider-form.tsx`.
- **Depends on:** #114. (Upload de foto → Fase 4 / bucket `provider-photos`. Fluxo de Empresa → USP-012, já existe.)
- **Reuses:** padrão `force-dynamic` + `requireActivePerson()` (`(app)/candidato/page.tsx`); shadcn/ui + Tailwind; `zodResolver` + `providerProfileSchema` (#114); `loadTerm('SERVICE_OFFERING')`.
- **Done when:**
  - [ ] Form valida no cliente (Zod), erros PT-BR. **Sem campo de CNPJ.**
  - [ ] Submit bloqueado sem aceite de `PORTAL_ACCESS` + `SERVICE_OFFERING`.
  - [ ] Se `!alreadyProvider`: chama `activateAdditionalRole({ role:'PROVIDER' })` → depois `activateProviderRole()`; trata `ActionResult` (toast PT-BR).
  - [ ] **P-004:** copy explícita "**agora você OFERECE serviços**" (distinto de contratar/cliente). **D-004**.
  - [ ] **E-002 (ADR-0031):** CTA "**registrar meu MEI / atuar como empresa**" → navega ao fluxo USP-012 (`/empresa` ou equivalente). Sem coletar CNPJ aqui.
  - [ ] **E-003:** após sucesso, CTA "publicar primeiro serviço" (USP-029) ou painel do prestador.
  - [ ] **GAP-B:** placeholder de upload de foto (Fase 4) — anotado/desabilitado.
- **Tests:** **componente** — render do form · bloqueio de submit sem consentimento · presença da copy P-004 · CTA de redirect MEI navega à rota da USP-012. **E2E (apoio)** — confinamento da rota `/prestador`.
- **Gate:** `npm run typecheck` ✓ · `npm run lint` ✓ · testes de componente verdes.

---

## Definition of Done (US #110)

- [ ] E-001, E-002 (redirect), E-003 implementados e cobertos por testes; must-not P-003/P-004/P-005 verificados.
- [ ] Sub-tasks #112/#114/#116 fechadas e PRs merged (squash).
- [ ] Sem regressão em `typecheck`/`lint`/testes (incl. `companies`/USP-012 após expandir `CompanyType`); CI build + E2E verdes.
- [ ] ADR-0031 referenciado nos PRs que tocam CNPJ/CompanyType (#112) e o redirect (#116).
- [ ] D-002 (gate jurídico do termo `service-offering@v1.0`) — pendência de **release**, não de merge.

## Facts (Kickoff Gate)

Testes-fonte **gerados** (skill-tdad, 2026-06-10; revisados pós-ADR-0031) em [`tests/`](./tests/) — todos em status **Red**:
- BDD: [`tests/bdd/usp-010-cadastro-prestador.feature`](./tests/bdd/usp-010-cadastro-prestador.feature) — tags `@e-001`..`@p-005`.
- Vitest red: [`tests/unit/usp-010-cadastro-prestador.spec.ts`](./tests/unit/usp-010-cadastro-prestador.spec.ts) — roda red limpo.
- Matriz: [`tests/traceability.md`](./tests/traceability.md) — E-001/E-002(redirect)/E-003 + P-003/P-004/P-005; P-001/P-002 revogados (ADR-0031).

Na fase Execute, conectar os facts aos paths-alvo (`modules/persons/__tests__/`, `schemas/provider.ts`, `components/__tests__/provider-form.test.tsx`).
