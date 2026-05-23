# ADR-0015 (Técnico) — Empresa como entidade sem login e toggle "atuar como" na sessão

- **Status:** Aceito
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO
- **Tags:** modelagem | identidade | sessao | autorizacao

## Contexto e Problema

ADR-0014 de negócio determina que **Empresa não tem login próprio** — toda operação em nome de uma Empresa é realizada por uma Pessoa-responsável vinculada via N:N (`person_company_grants`). Toda Empresa precisa ter pelo menos uma responsável ativa.

Implicações técnicas que este ADR resolve:

1. **Como representar a Empresa no schema** sem confundir com Pessoa
2. **Como representar "atuar como Empresa X" na sessão** — quando uma Pessoa-responsável publica uma vaga, em nome de qual Empresa? Se ela representa 3 empresas, precisa escolher.
3. **Como o `audit_log` registra essas operações** mantendo rastreabilidade individual (a Pessoa) + contexto institucional (a Empresa)
4. **Como `requirePermission` lida com permissões scoped a uma Empresa específica** (ex.: editar dados de Empresa X exige ser responsável ativo de X)
5. **Mecânica da flag "Empresa verificada"** após primeira vaga aprovada

## Drivers de Decisão

- Rastreabilidade individual obrigatória (ADR-0014 de negócio) — log nunca registra "a Empresa fez X"
- UX clara para Pessoa que representa múltiplas Empresas — toggle visível na UI
- Coerência com ADR-T-0008 (Pessoa unificada) — Empresa não é um papel da Pessoa, mas o papel `COMPANY_RESPONSIBLE` qualifica o vínculo
- Edição sensível de dados da Empresa rebaixa `is_verified` (USP-015 AC-015-2) — modelo precisa capturar isso

## Opções Consideradas

### Opção A — Empresa como atributo da Pessoa (descartada já no ADR-0014 de negócio)

Sem entidade Empresa explícita; Pessoa-responsável tem campos "razão social", "CNPJ", etc. Inviável para N:N.

### Opção B — Empresa como entidade + vínculo N:N + toggle de sessão server-side (escolhida)

Tabela `companies` separada; vínculo via `person_company_grants` com `started_at`/`ended_at`. Sessão da Pessoa carrega flag `actingAsCompanyId` (opcional) que indica que a Pessoa está operando em nome dessa Empresa. Toggle controlado server-side via cookie HttpOnly (não confiamos em estado vindo do cliente).

### Opção C — Sessões separadas por Empresa (descartada)

Pessoa precisaria fazer logout/login para alternar — UX ruim. Descartada.

## Decisão

Adotamos a **Opção B**.

### Schema

```prisma
model Company {
  id                String   @id @default(uuid()) @db.Uuid
  legalName         String   @map("legal_name")             // razão social
  tradeName         String?  @map("trade_name")             // nome fantasia
  cnpj              String   @unique
  sector            String?
  description       String?
  address           String?
  phone             String?
  isVerified        Boolean  @default(false) @map("is_verified")
  status            CompanyStatus @default(ACTIVE)
  createdByPersonId String   @map("created_by_person_id") @db.Uuid
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz

  grants            PersonCompanyGrant[]
  jobs              Job[]
  services          Service[]
  @@map("companies")
}

enum CompanyStatus {
  ACTIVE
  ARCHIVED
}

model PersonCompanyGrant {
  id           String    @id @default(uuid()) @db.Uuid
  personId     String    @map("person_id") @db.Uuid
  companyId    String    @map("company_id") @db.Uuid
  type         CompanyGrantType @default(RESPONSIBLE)
  startedAt    DateTime  @default(now()) @map("started_at") @db.Timestamptz
  startedBy    String    @map("started_by") @db.Uuid          // Pessoa que adicionou o vínculo
  endedAt      DateTime? @map("ended_at") @db.Timestamptz
  endedBy      String?   @map("ended_by") @db.Uuid
  endReason    String?   @map("end_reason")

  person       Person    @relation(fields: [personId], references: [id])
  company      Company   @relation(fields: [companyId], references: [id])

  @@unique([personId, companyId, type, startedAt])
  @@index([personId, endedAt])                                // grants ativas da Pessoa
  @@index([companyId, endedAt])                               // responsáveis ativos da Empresa
  @@map("person_company_grants")
}

enum CompanyGrantType {
  RESPONSIBLE                                                  // único tipo no MVP; V2 pode adicionar 'CONTACT_ONLY' etc.
}
```

### Regra de pelo menos um responsável ativo

Server Action de remoção/inativação de responsável faz check:

```typescript
// src/modules/companies/actions/removeResponsible.ts
const activeResponsibles = await prisma.personCompanyGrant.count({
  where: { companyId, type: 'RESPONSIBLE', endedAt: null },
})
if (activeResponsibles <= 1) {
  return { ok: false, error: { code: 'CANNOT_REMOVE_LAST_RESPONSIBLE' } }
}
```

Mesma regra aplicada na inativação de Pessoa (USP-007 AC-007-3): se Pessoa é único responsável de alguma Empresa, sistema exige designação de outro antes de permitir inativação.

### Toggle "atuar como Empresa X"

**Sessão estendida server-side** — armazena `actingAsCompanyId` em cookie HttpOnly assinado, separado do cookie de autenticação do Supabase. Helpers:

```typescript
// src/modules/identity/actions/setActingAsCompany.ts
'use server'
export async function setActingAsCompany(companyId: string) {
  const user = await getCurrentUser()
  // Verifica que Pessoa tem grant ativa para essa Empresa
  const hasGrant = user.companyGrants.some(g => g.companyId === companyId && !g.endedAt)
  if (!hasGrant) return { ok: false, error: { code: 'NOT_AUTHORIZED_FOR_COMPANY' } }

  cookies().set('asonseg.acting_as', signCookie({ companyId }), {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 12, // 12h sessão
  })
  return { ok: true }
}

export async function clearActingAsCompany() {
  cookies().delete('asonseg.acting_as')
  return { ok: true }
}
```

`getCurrentUser()` lê o cookie e popula campo `actingAsCompany` na estrutura retornada:

```typescript
export type CurrentUser = {
  personId: string
  fullName: string
  roleGrants: ActiveRoleGrant[]
  companyGrants: ActiveCompanyGrant[]
  delegatedPermissions: PermissionId[]
  actingAsCompany: ActingAsCompany | null      // ← campo central deste ADR
}

export type ActingAsCompany = {
  companyId: string
  legalName: string
  tradeName: string | null
  isVerified: boolean
}
```

### UX do toggle

UI exibe (em todas as páginas autenticadas, no header):

- Se Pessoa tem 0 empresas: nenhum toggle (UI default — operação como Pessoa)
- Se Pessoa tem 1 empresa: badge mostrando "Atuando como [Empresa X]" + botão "Operar como eu"
- Se Pessoa tem N>1 empresas: dropdown "Atuando como: [Empresa selecionada ▾]" com opção "Como eu"

### Server Actions de criação de vaga/serviço usam o toggle

```typescript
// src/modules/jobs/actions/createJobDraft.ts
'use server'
export async function createJobDraft(input: unknown) {
  await requirePermission('CREATE_JOB')  // qualquer empresa-responsável pode criar
  const user = await getCurrentUser()

  // Vaga SEMPRE vinculada a uma Empresa — exige "atuar como"
  if (!user.actingAsCompany) {
    return { ok: false, error: { code: 'MUST_ACT_AS_COMPANY', message: 'Selecione a empresa que está publicando a vaga' } }
  }

  // ... persistir com companyId = user.actingAsCompany.companyId
}
```

Serviço de prestador pode ser PF (sem "atuar como") **ou** em nome de Empresa (com "atuar como" ativo). Server Action de criação de serviço lê o estado do toggle e persiste `service.companyId` apropriadamente.

### Audit log capturando rastreabilidade dupla

Todo evento dispara audit com:

```typescript
await audit('JOB_PUBLISHED', {
  entityType: 'job',
  entityId: jobId,
  actorUserId: user.supabaseUserId,           // SEMPRE a Pessoa
  context: {
    actingAsCompanyId: user.actingAsCompany?.companyId,   // a Empresa que ela representa
    companyName: user.actingAsCompany?.legalName,
  },
})
```

Consulta "quem publicou esta vaga": JOIN do `audit_log` por `entity_id` mostra a Pessoa real **e** a Empresa.

### Verificação manual da Empresa (USP-017, USP-019)

A flag `companies.is_verified` é controlada pela máquina de estados de moderação (ADR-T-0011):

- Inicialmente `false` quando Empresa é cadastrada
- Quando a **primeira vaga** da Empresa transiciona de `IN_MODERATION → ACTIVE`, o moderador segue a checklist de inspeção da Empresa (ADR-T-0011) e marca a checkbox "Empresa validada" — sistema executa `companies.is_verified = true` + audit `COMPANY_VERIFIED`
- USP-015 AC-015-2: editar CNPJ, razão social ou nome fantasia rebaixa `is_verified = false` + audit `COMPANY_UPDATED_VERIFICATION_RESET`. Próxima vaga publicada volta a exigir checklist do moderador.

### Edição de Empresa por responsável

Permissão `EDIT_COMPANY` é implícita a qualquer responsável ativo da Empresa-alvo. `requirePermission('EDIT_COMPANY', { companyId })` verifica:

```typescript
const isResponsible = user.companyGrants.some(
  g => g.companyId === companyId && !g.endedAt
)
if (!isResponsible) throw new ForbiddenError(...)
```

### Reivindicação de Empresa "abandonada"

Se a última Pessoa-responsável for inativada via USP-007 (sem designar substituto), a regra bloqueia. Caso edge: AS ou diretoria pode forçar reativação via fluxo administrativo dedicado (não escopo MVP — papel da AS pode atribuir nova responsável após verificação externa). Documentar como runbook operacional.

## Consequências

**Positivas:**
- Rastreabilidade dupla (Pessoa + Empresa) em todo log e em todo conteúdo gerado
- N:N Pessoa-Empresa funciona naturalmente — Pessoa representa N, Empresa tem N representantes
- Toggle server-side previne ataques de manipulação de UI client-side
- Empresa sem responsável é estado **impossível por construção** (regra obrigatória de ≥1 ativo)
- Verificação manual da Empresa fica acoplada à máquina de estados de moderação (sem caminho paralelo)

**Negativas (trade-offs aceitos):**
- UX precisa educar usuários — "atuar como" é conceito não trivial; mitigado por design claro (badge visível, dropdown contextual)
- Sem convite por e-mail no MVP — Pessoa precisa estar pré-cadastrada para virar responsável (decisão de negócio mantida)
- Edição de dados da Empresa rebaixar verificação cria UX de "preciso entrar em moderação de novo" — comunicação clara mitiga

**Neutras / a monitorar:**
- Se na prática Pessoas raramente representarem >1 Empresa, simplificar UI; se >50% representarem 2+, investir mais no toggle

## Riscos e Mitigações

**Risco 1 — Pessoa esquece que está "atuando como Empresa X"** e publica conteúdo PF em nome dela sem perceber. **Mitigação:** badge persistente em todas as telas; formulários de criação mostram em destaque "Publicando como: [Empresa X]".

**Risco 2 — Cookie de toggle persiste após Pessoa perder a grant.** Ex.: Pessoa P era responsável da Empresa C, vínculo foi terminado, mas cookie ainda diz `actingAsCompanyId = C`. **Mitigação:** `getCurrentUser` revalida a grant em cada chamada; se não houver grant ativa, ignora o cookie e remove silenciosamente.

**Risco 3 — Duas pessoas responsáveis publicam vagas simultaneamente** com dados conflitantes. **Mitigação:** não há lock — última edição vence; audit log mostra quem fez o quê. Aceitável para o MVP; conflito sério é raro.

## Referências

- ADR-0014 de negócio (Empresa sem login)
- ADR-T-0008 (Pessoa unificada)
- ADR-T-0003 (RBAC aplicacional)
- ADR-T-0004 (audit log — context com `actingAsCompanyId`)
- ADR-T-0011 (máquina de estados — verificação de Empresa)
- PRD MVP Portal USP-012 a USP-015, USP-017, USP-019, USP-020, USP-027, USP-029
- Lentes do arquiteto: Acoplamento & Coesão, Observability by Design
