# ADR-0008 (Técnico) — Pessoa unificada + papéis compostos com tabela de grants explícita

- **Status:** Aceito
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO
- **Tags:** modelagem | identidade | dados | release-2-friendly

## Contexto e Problema

ADR-0011 de negócio estabelece **Pessoa como entidade fundamental** do sistema ASONSEG, com login único e papéis compostos livremente — uma mesma Pessoa pode ser simultaneamente candidata, prestadora de serviço, cliente, empresa-responsável, voluntária e (no Release 2) beneficiária e responsável de família.

ADR-0012 de negócio determina que Beneficiário deixa de ser entidade separada e vira papel social da Pessoa, com Família estruturada vindo no Release 2. ADR-0013 de negócio determina que consentimentos LGPD são por finalidade — frequentemente alinhados a papéis específicos.

A escolha de modelagem aqui irradia em todo o schema (consentimentos, audit log, queries, visibilidade) e tem impacto direto em três fluxos sensíveis:

1. **Ativar/revogar papel** — auditável? rastreável? consistente com revogação de consentimento?
2. **Consultar permissões efetivas** — qual a query padrão para "que papéis ativos a Pessoa tem agora"?
3. **Evolução para Release 2** — quando Beneficiário e Família entrarem, o modelo aceita sem refactor?

## Drivers de Decisão

- Pessoa pode acumular N papéis simultâneos (PRD §2)
- Ativação e revogação de papel devem ser eventos auditáveis (ADR-0011 de negócio + ADR-0004 técnico)
- Revogação de consentimento (ADR-0013 de negócio) desativa o papel correspondente — exige modelo de "papel ativo" explícito, não apenas "Pessoa tem perfil de"
- Pessoa pode estar **sem credencial** (USP-002) — modelo precisa suportar Pessoa sem login que ainda tem papel (ex.: encaminhada para vaga, ativando candidato sem login)
- Release 2 introduz papéis novos sem alterar a estrutura base

## Opções Consideradas

### Opção A — Flags booleanas na tabela `persons`

`persons` com colunas `is_candidate`, `is_provider`, `is_client`, `is_company_responsible`, `is_volunteer`, etc.

- **Prós:** simples; queries fáceis (`WHERE is_candidate = true`)
- **Contras:**
  - Mistura "tem perfil de" com "papel ativo" — perde a granularidade
  - Quando flag muda, perdemos histórico de quando ativou/desativou (sem auditoria estruturada além do `audit_log` genérico)
  - Adicionar papel novo no Release 2 = migration de schema na tabela central
  - Não modela `status` de cada papel (ex.: papel ativo mas com perfil em moderação)

### Opção B — Tabela `person_role_grants` (uma linha por papel) + tabelas de perfil por papel (escolhida)

Tabela `persons` com dados de identidade básicos (nome, CPF, e-mail, supabase_user_id). Tabela `person_role_grants` com uma linha por papel ativo, contendo `activated_at`, `revoked_at`, `status`. Tabelas adicionais por papel para dados de perfil específicos (`candidate_profiles`, `provider_profiles`, etc.).

- **Prós:**
  - Ativação e revogação de papel são INSERT/UPDATE explícitos — audit-friendly
  - Permite revogar consentimento de finalidade (e desativar papel) sem perder dados do perfil — basta marcar `status = REVOKED` e preservar o registro
  - Histórico de ativações/revogações vive no próprio modelo (não só no `audit_log`)
  - Papel novo no Release 2 (`BENEFICIARY`, `FAMILY_RESPONSIBLE`) = INSERT em catálogo de Role + nova tabela de perfil, sem migration na tabela central
  - Modelo natural para `status` ricos (`ACTIVE`, `REVOKED`, `AWAITING_CONSENT`, `INACTIVE`)
- **Contras:**
  - Mais verboso (mais uma tabela para consultar)
  - Queries que precisam de "todos os papéis ativos" exigem JOIN — mitigado por índice composto e por helper `getCurrentUser()` centralizando a montagem

### Opção C — Single Table Inheritance com JSONB

`persons` com campo `roles JSONB` contendo array de objetos `{role, status, activated_at, ...}`.

- **Prós:** flexível
- **Contras:** perde tipagem forte do Prisma; queries por papel ativo viram filtros JSONB complexos; testes ficam pobres; revisão de schema mais difícil

## Decisão

Adotamos a **Opção B — `person_role_grants` + perfis por papel**.

### Schema canônico

```prisma
model Person {
  id                          String   @id @default(uuid()) @db.Uuid
  supabaseUserId              String?  @unique @map("supabase_user_id") @db.Uuid  // nullable = Pessoa sem credencial
  fullName                    String   @map("full_name")
  cpf                         String?  @unique                                    // nullable = exceção AS (USP-002)
  cpfExceptionJustification   String?  @map("cpf_exception_justification")
  emailLogin                  String?  @unique @map("email_login")                // nullable = Pessoa sem credencial
  phone                       String?
  mustChangePassword          Boolean  @default(true) @map("must_change_password")
  isActive                    Boolean  @default(true) @map("is_active")
  inactivatedAt               DateTime? @map("inactivated_at") @db.Timestamptz
  inactivatedByPersonId       String?  @map("inactivated_by_person_id") @db.Uuid
  inactivationReason          String?  @map("inactivation_reason")
  createdByPersonId           String?  @map("created_by_person_id") @db.Uuid     // null = auto-cadastro público
  createdAt                   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt                   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  roleGrants                  PersonRoleGrant[]
  candidateProfile            CandidateProfile?
  providerProfile             ProviderProfile?
  clientProfile               ClientProfile?
  socioeconomicRecord         SocioeconomicRecord?
  companyGrants               PersonCompanyGrant[]
  consents                    Consent[]

  @@map("persons")
}

model PersonRoleGrant {
  id              String    @id @default(uuid()) @db.Uuid
  personId        String    @map("person_id") @db.Uuid
  role            Role
  status          RoleGrantStatus @default(ACTIVE)
  activatedAt     DateTime  @default(now()) @map("activated_at") @db.Timestamptz
  activatedBy     String?   @map("activated_by") @db.Uuid    // null = auto-ativação pelo próprio titular
  revokedAt       DateTime? @map("revoked_at") @db.Timestamptz
  revokedBy       String?   @map("revoked_by") @db.Uuid
  revocationReason String?  @map("revocation_reason")

  person          Person    @relation(fields: [personId], references: [id])
  @@unique([personId, role, activatedAt])                    // permite re-ativação após revogação
  @@index([personId, status])                                // index para getCurrentUser
  @@index([role, status])                                    // index para "todos os candidatos ativos"
  @@map("person_role_grants")
}

enum Role {
  // Públicos (auto-ativáveis)
  CANDIDATE
  PROVIDER
  CLIENT
  COMPANY_RESPONSIBLE
  // Organizacionais (atribuídos pela ASONSEG)
  VOLUNTEER
  COORDINATOR
  SOCIAL_ASSISTANT
  BOARD
  // Sociais (atribuídos pela ASONSEG)
  BENEFICIARY              // ativável no Release 2
  FAMILY_RESPONSIBLE       // ativável no Release 2
}

enum RoleGrantStatus {
  ACTIVE
  REVOKED                  // titular revogou consentimento ou ASONSEG desativou
  AWAITING_CONSENT         // papel solicitado, aguardando aceite do termo
  INACTIVE                 // Pessoa inativada (cascata) — preserva histórico
}
```

### Perfis por papel — exemplos

```prisma
model CandidateProfile {
  personId             String   @id @map("person_id") @db.Uuid
  headline             String?
  primaryAreaOfInterest String?  @map("primary_area_of_interest")
  educationLevel       String?  @map("education_level")
  educationArea        String?  @map("education_area")
  experienceText       String?  @map("experience_text")
  skillsText           String?  @map("skills_text")
  coursesText          String?  @map("courses_text")
  availability         String?
  cvStoragePath        String?  @map("cv_storage_path")
  cvSha256             String?  @map("cv_sha256")
  cvUploadedAt         DateTime? @map("cv_uploaded_at") @db.Timestamptz
  cvLastConfirmedAt    DateTime? @map("cv_last_confirmed_at") @db.Timestamptz
  publicationStatus    ContentStatus @default(DRAFT) @map("publication_status")
  cityId               String?  @map("city_id") @db.Uuid
  // ... outros campos
  person               Person   @relation(fields: [personId], references: [id])
  @@map("candidate_profiles")
}

model ProviderProfile {
  personId        String   @id @map("person_id") @db.Uuid
  headline        String?
  description     String?
  photoStoragePath String? @map("photo_storage_path")
  regionId        String?  @map("region_id") @db.Uuid
  publicationStatus ContentStatus @default(DRAFT) @map("publication_status")
  // ...
  person          Person   @relation(fields: [personId], references: [id])
  @@map("provider_profiles")
}

model ClientProfile {
  personId        String   @id @map("person_id") @db.Uuid
  cityId          String?  @map("city_id") @db.Uuid
  // ...
  person          Person   @relation(fields: [personId], references: [id])
  @@map("client_profiles")
}

model SocioeconomicRecord {
  personId                  String   @id @map("person_id") @db.Uuid
  incomeRange               String?  @map("income_range")     // enum textual ('<1MIN', '1_2MIN', etc.)
  socialBenefit             String?  @map("social_benefit")
  housingSituation          String?  @map("housing_situation")
  declaredFamilyComposition String?  @map("declared_family_composition")  // texto livre no MVP
  lastUpdatedBy             String   @map("last_updated_by") @db.Uuid
  lastUpdatedAt             DateTime @updatedAt @map("last_updated_at") @db.Timestamptz
  person                    Person   @relation(fields: [personId], references: [id])
  @@map("socioeconomic_records")
}
```

### Padrão de operação

**Ativar papel:**
```typescript
// dentro de withAudit('ROLE_GRANT_ACTIVATED', ...)
await tx.personRoleGrant.create({
  data: { personId, role: 'CANDIDATE', status: 'AWAITING_CONSENT', activatedBy: actorId }
})
// → consentimento da finalidade correspondente é solicitado
// → ao aceitar, status muda para ACTIVE
await tx.candidateProfile.create({
  data: { personId, publicationStatus: 'DRAFT' }
})
```

**Revogar papel (via revogação de consentimento):**
```typescript
// dentro de withAudit('ROLE_GRANT_REVOKED', ...)
await tx.personRoleGrant.update({
  where: { id: grantId },
  data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: actorId, revocationReason: '...' }
})
// → perfil é preservado (não apaga); torna-se inacessível por visibilidade
```

**Carregar Pessoa com papéis ativos (`getCurrentUser`):**
```typescript
const person = await prisma.person.findUniqueOrThrow({
  where: { id },
  include: {
    roleGrants: { where: { status: 'ACTIVE' } },
    companyGrants: { where: { endedAt: null } },
  },
})
```

### Convenções

- **Sempre** consultar papéis via `PersonRoleGrant` com filtro `status = ACTIVE` — nunca inferir papel a partir de existência de perfil
- Perfis de papel preservam dados após revogação (não cascade delete); apenas o `grant` muda de status
- Reativação de papel cria **novo registro** em `person_role_grants` (não reabre o antigo) — preserva auditoria temporal

## Consequências

**Positivas:**
- Auditoria temporal natural (todas as ativações/revogações ficam visíveis na tabela)
- Modelo perfeito para revogação de consentimento granular (ADR-T-0009)
- Pessoa sem credencial é cidadã de primeira classe (`supabase_user_id NULL` + papéis ativos)
- Release 2 adiciona enums e tabelas de perfil novos sem refactor estrutural
- Pessoa unificada visível em queries diretas (Person → roleGrants)

**Negativas (trade-offs aceitos):**
- Mais uma tabela para o time absorver — mitigado pela centralização em `getCurrentUser()`
- JOINs adicionais — mitigados por índices apropriados e pelo volume baixo do MVP

**Neutras / a monitorar:**
- Se `person_role_grants` ultrapassar ~100k linhas (cenário improvável no MVP), considerar índices compostos adicionais

## Riscos e Mitigações

**Risco 1 — Código consulta perfil sem verificar papel ativo.** Ex.: `prisma.candidateProfile.findUnique(...)` sem checar `PersonRoleGrant.status = ACTIVE` correspondente. **Mitigação:** convenção no project-guideline para usar helpers `getActiveCandidate(personId)` que fazem o JOIN; revisão de PR; teste de integração que cobre o caso "Pessoa com papel revogado não aparece em buscas".

**Risco 2 — Ativação de papel sem o consentimento correspondente.** **Mitigação:** Server Action `activateRole()` exige que o consentimento da finalidade vinculada exista e esteja ativo antes de marcar status `ACTIVE` (ADR-T-0009).

## Referências

- ADR-0011 de negócio (Pessoa como entidade fundamental)
- ADR-0012 de negócio (Beneficiário como papel social)
- ADR-0013 de negócio (Consentimentos por finalidade)
- ADR-0003 técnico — RBAC aplicacional referencia este modelo
- ADR-T-0009 — consentimentos LGPD por finalidade
- PRD MVP Portal §2 (Personas), USP-001, USP-002, USP-006, USP-007
- Lentes do arquiteto: Acoplamento & Coesão, Observability by Design, Custo de Mudança
