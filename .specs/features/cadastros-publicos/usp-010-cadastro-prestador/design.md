# USP-010 — Cadastro de prestador de serviço — Design

> **Modo ICE — adaptador.** Resolve os ponteiros técnicos do card (TD §3.2/§4.4/§4.5/§4.6,
> ADRs, runbooks). Não inventa contrato. Deriva de [`spec.md`](./spec.md).
> **Padrão de referência:** USP-009 (candidato). **Revisão 2026-06-10 (ADR-0031):** CNPJ MEI fora
> da USP-010 — redireciona ao fluxo USP-012; `ProviderProfile` sem CNPJ.

## 1. Decisão central de arquitetura

A ativação do papel é **idêntica em mecânica à USP-006/USP-009**: papel + consentimento são ativados
pela action **genérica** `activateAdditionalRole` (USP-006), e uma action **específica** do perfil cria/atualiza
o `ProviderProfile`. **Diferenças vs. USP-009:** (a) sem máquina de estados de moderação — papel ativo
imediatamente (ADR-0015); (b) **CNPJ MEI não é coletado aqui** — declarar MEI redireciona ao fluxo USP-012
(ADR-0031).

Sequência canônica (TD §3.2, verbatim resolvido):
```
P clica "Ativar como Prestador"
 → activateRole('PROVIDER')            [activateAdditionalRole, USP-006]
   → INSERT person_role_grant (AWAITING_CONSENT)
   → needs consent SERVICE_OFFERING
 → exibe termo service-offering@v1.0   [P-004: "agora você OFERECE serviços"]
 → aceita termo
   → BEGIN TX
     → INSERT consent (termContentHash, IP, userAgent)   [P-003: mesma TX]
     → UPDATE person_role_grant SET status=ACTIVE
     → INSERT audit (CONSENT_GRANTED + ROLE_GRANT_ACTIVATED)
   → COMMIT
 → tela de configuração do perfil de prestador
   → activateProviderRole(profile)      [específica — cria ProviderProfile DRAFT + audit PROVIDER_ROLE_ACTIVATED]
 → E-003: redireciona p/ "publicar primeiro serviço" (USP-029)
 → (opcional) "registrar meu MEI" → redirect ao fluxo USP-012 (cadastrar Empresa MEI)  [ADR-0031]
```

## 2. Schema

### 2.1 `ProviderProfile` (TD §4.5, contrato verbatim — INALTERADO)

```prisma
model ProviderProfile {
  personId          String        @id @map("person_id") @db.Uuid
  headline          String?
  description       String?       @db.Text
  photoStoragePath  String?       @map("photo_storage_path") // GAP-B: upload difere p/ Fase 4 (bucket provider-photos)
  regionId          String?       @map("region_id") @db.Uuid
  publicationStatus ContentStatus @default(DRAFT) @map("publication_status")
  createdAt         DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime      @updatedAt @map("updated_at") @db.Timestamptz

  person            Person        @relation(fields: [personId], references: [id], onDelete: Cascade)
  region            Region?       @relation(fields: [regionId], references: [id])
  @@map("provider_profiles")
}
```
- **Sem campo de CNPJ** (ADR-0031). Bate exatamente com o TD §4.5 — nenhum desvio.
- `Region` **já existe** (`prisma/schema.prisma:58`) — adicionar relação reversa `providerProfiles ProviderProfile[]`.
- `Person` — adicionar relação reversa `providerProfile ProviderProfile?`.

### 2.2 Expansão de `CompanyType` (ADR-0031, decisão 2026-06-10)

```prisma
enum CompanyType {
  MEI
  SIMPLES_NACIONAL
  LUCRO_PRESUMIDO
  LUCRO_REAL
  SA
  @@map("company_type")
}
```
- Hoje: `{CNPJ_REGULAR, MEI}` com default `CNPJ_REGULAR`. Migration mapeia os registros existentes `CNPJ_REGULAR` → novo conjunto (provável `LUCRO_PRESUMIDO` como neutro, **confirmar mapeamento com o Tech Lead na migration**) e ajusta o default.
- Habilita o regime tributário em `companies` para a USP-012 (a UI de escolha do regime é da USP-012). Para a USP-010 basta que `MEI` exista (o redirect já funciona).

## 3. Domain + Schema Zod (espelha USP-009 — simplificado, sem CNPJ)

- `src/modules/persons/schemas/provider.ts` — `providerProfileSchema`:
  - Campos **opcionais**: `headline?`, `description?`, `regionId?` (UUID). **Sem `cnpjMei`** (ADR-0031).
  - Mensagens PT-BR (convenção USP-009).
- `src/modules/persons/domain/provider.ts` — só o necessário (sem validação de CNPJ). Pode nem ser preciso se não houver regra pura; nesse caso, omitir o arquivo.

## 4. Endpoint — `activateProviderRole` (TD §4.4 `persons.ativarPapel(prestador)`)

`src/modules/persons/actions/activate-provider-role.ts` — **espelha** `activate-candidate-role.ts`.
Sequência canônica (runbook-server-action + runbook-consent-gate + runbook-audit-log):
1. **Zod** `providerProfileSchema.safeParse(rawInput)`.
2. **`getCurrentPerson()`** — P-005 (sessão; sem `personId` no input).
3. **`requireActiveConsent(personId, 'PORTAL_ACCESS')` + `requireActiveConsent(personId, 'SERVICE_OFFERING')`** em paralelo (só valida — a *gravação* do consent é da `activateAdditionalRole`). Ausente → `{ ok:false, error }`.
4. **Idempotência** — perfil já existe? upsert não duplica.
5. **`withAudit('PROVIDER_ROLE_ACTIVATED', async (tx) => …)`** — `tx.providerProfile.upsert` (DRAFT), `after={ publicationStatus, regionId }`, contexto `{ actorPersonId, ip, userAgent, route:'/prestador' }`.
6. Retorno `ActionResult<{ personId, publicationStatus }>`. **Nunca `throw`; nunca model Prisma cru.**

> A ativação do **papel + consentimento** é da `activateAdditionalRole({ role:'PROVIDER', … })` — **já existe** (USP-006), com `ROLE_PURPOSE_MAP.PROVIDER = 'SERVICE_OFFERING'`. Esta action só cuida do **perfil**. **Não** coleta CNPJ.

## 5. Audit — novo evento

Adicionar ao catálogo `src/modules/audit/events.ts`: **`PROVIDER_ROLE_ACTIVATED`** (espelha
`CANDIDATE_ROLE_ACTIVATED`; sem `justification`). `ROLE_GRANT_ACTIVATED` e `CONSENT_GRANTED`
(card: `ROLE_ACTIVATED`/`CONSENT_GIVEN`) já são emitidos pela `activateAdditionalRole`.

## 6. UI — `/prestador` (espelha `/candidato`)

- `src/app/(app)/prestador/page.tsx` — `force-dynamic`; `requireActivePerson()`; carrega `Region` (taxonomia, `take`), termo `SERVICE_OFFERING` via `loadTerm()`, `providerProfile` existente.
- `src/modules/persons/components/provider-form.tsx` — RHF + `zodResolver(providerProfileSchema)`:
  - Se `!alreadyProvider`: chama `activateAdditionalRole({ role:'PROVIDER' })` (papel + consent `SERVICE_OFFERING`).
  - Chama `activateProviderRole()` (perfil DRAFT).
  - **P-004:** copy explícita "**agora você OFERECE serviços**" (vs. contratar/cliente).
  - **E-002 (ADR-0031):** CTA secundária "**registrar meu MEI / atuar como empresa**" → navega para o fluxo USP-012 (`/empresa` ou rota equivalente). **Sem** campo de CNPJ no form do prestador.
  - **GAP-B:** placeholder de upload de foto (Fase 4) — campo desabilitado/anotado.
  - Erros PT-BR.
  - E-003: após sucesso, CTA "publicar primeiro serviço" (USP-029).

## 7. ADRs e runbooks aplicáveis (do card)

| Ref | Uso nesta US |
|---|---|
| ADR-0011 | Pessoa fundamental, papéis compostos via `PersonRoleGrant`. |
| ADR-0013 | Consentimento por finalidade — `SERVICE_OFFERING` (finalidade 3). |
| ADR-0014 | Empresa sem login, responsáveis N:N — destino do CNPJ MEI (via USP-012). |
| ADR-0015 | Papel **não** é moderado (conteúdo é) → sem máquina de estados aqui. |
| ADR-0020 | Atomicidade: papel `ACTIVE` ⇔ consent persistido na mesma TX (P-003). |
| ADR-0023 | Log append-only de auditoria. |
| **ADR-0031** | CNPJ MEI em `companies` via USP-012; `CompanyType` expandido. |
| runbook-server-action / consent-gate / audit-log | Sequência canônica da action. |

## 8. Riscos de implementação

- **Não** introduzir `transitionContent`/`ContentKind.PROVIDER_PROFILE` — fora do escopo do card (spec §5).
- **Não** adicionar campo de CNPJ ao `ProviderProfile` — o CNPJ vai para `companies` (ADR-0031).
- Migration do `CompanyType`: **mapear registros `CNPJ_REGULAR` existentes** antes de remover o valor; confirmar destino com o Tech Lead. Verificar uso do enum no código de `companies` (USP-012) para não quebrar typecheck.
- O redirect E-002 reusa a rota da USP-012; confirmar que a rota/fluxo de cadastro de Empresa aceita entrada a partir do contexto do prestador.
