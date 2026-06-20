# USP-022 — Ver detalhe da vaga — Design

> **Modo ICE (thin adapter).** Resolve TD §4.4/§4.5/§4.6 + ADRs + runbooks para o concreto do código. Não re-deriva
> arquitetura. Padrões de referência:
> `jobs/queries/search-jobs.ts` (on-read + `select` explícito), `jobs/views/job-list-item.view.ts` (`viewJobForVisitor`
> — anonimização por papel), `identity/server/session.ts` (`getCurrentPerson`), `app/(public)/vagas/page.tsx` (ISR +
> `getCurrentPerson` + query), `moderation/adapters/next-cache-invalidation.ts` (revalidação on-demand de `/vagas`).

## 0. Reconciliação (TD doc × schema implementado)

- **`content_items`/`content_transitions` não existem** — `status` mora na entidade `Job` (`ContentStatus`); histórico em
  `audit_log` (ADR-0023). O detalhe filtra **on-read** sobre `Job.status` direto, igual à USP-021. Ver [[td-content-items-nao-implementado]].
- **A tabela `applications` (TD §4.5) NÃO existe** — `#162` (schema da USP-020) criou só `Job`/`JobArea`/`Region`/`ContentStatus`;
  `JOB_APPLICATION` é só valor do enum de evento de auditoria, não model. **A USP-022 é a primeira que precisa de `applications`**
  (contador E-003). **AD-012 (kickoff 2026-06-20):** introduzir a tabela `applications` **mínima** (capaz de contar) nesta USP;
  o caminho de **escrita** (candidatar/cancelar) e o vínculo de encaminhamento (FK `Referral`, que ainda não existe) ficam na
  USP-025/044. Mesmo padrão de AD-011 (USP-021 estendeu o `Job` que a USP-020 criou).
- **Filtro on-read já existe** em `search-jobs.ts` (`status='ACTIVE' AND valid_until >= hojeSaoPaulo() AND company.is_verified`).
  O detalhe **reusa exatamente** essa cláusula (E-005/P-004/P-005) — uma vaga só é "detalhável" se passaria na busca.
- **Anonimização já existe** em `viewJobForVisitor` (anônimo → `"Empresa do setor de "+setor`, `isAnonymized=true`,
  nunca `company.nomeFantasia`). O `viewJobDetail` **reusa a mesma regra** e a estende com os campos de texto longo.
- **Cache de `/vagas/[id]`:** `NextCacheInvalidation.publicPathsFor(JOB)` hoje revalida `['/vagas']`. O detalhe é ISR
  (`revalidate`); a precisão de invalidar `/vagas/[id]` individual fica como nota de débito (§5) — janela curta de ISR já cobre L-002.

## 1. Modelo de dados — tabela `applications` (mínima, AD-012)

Adicionar à `prisma/schema.prisma` (campos `@map` snake_case; padrão do repo):

```prisma
model Application {
  id                String    @id @default(uuid()) @db.Uuid
  candidatePersonId String    @map("candidate_person_id") @db.Uuid
  jobId             String    @map("job_id")              @db.Uuid
  cancelledAt       DateTime? @map("cancelled_at") @db.Timestamptz  // null = candidatura ativa (soft-cancel)
  appliedAt         DateTime  @default(now()) @map("applied_at") @db.Timestamptz

  candidate Person @relation(fields: [candidatePersonId], references: [id])
  job       Job    @relation(fields: [jobId], references: [id])

  @@index([jobId, cancelledAt])     // contagem on-read do contador (E-003)
  @@map("applications")
}
```

- Reversa: `Job.applications Application[]` e `Person.applications Application[]`.
- **Nomes alinhados ao TD §4.5** (`candidatePersonId`/`candidate_person_id`, `appliedAt`/`applied_at`): aproveita o zero dado em
  prod p/ não forçar rename na USP-025. **Decisão registrada (AD-012).**
- **`cancelledAt DateTime?` (null = ativa)** em vez de enum `status (ativa|cancelada)` do TD §4.5: alinha ao corpo do board
  (#173 conta "applications com `cancelledAt = null`") e dá índice parcial limpo para a contagem. **Decisão registrada (AD-012).**
- **Índice único parcial** de candidatura ativa por (candidato, vaga) é **da USP-025** (escrita) — aqui não há escrita, só leitura.
  Criar agora só o índice de contagem `(jobId, cancelledAt)`.
- **Deferido p/ USP-025/044:** `viaEncaminhamento Boolean`, `encaminhamentoId` FK `Referral` (model inexistente), Server Actions
  de candidatar/cancelar, índice único parcial de unicidade.
- **Seed:** backfillar candidaturas de exemplo — uma vaga ACTIVE com **≥ 3** (contador visível, D-005) e outra com **0** (oculto).

## 2. Query — `getActiveJobDetail(id, viewer)`

`src/modules/jobs/queries/get-job-detail.ts` — read-only, espelha o `where` on-read de `search-jobs.ts`.

```ts
export async function getActiveJobDetail(
  id: string,
  viewer: CurrentPerson | null,
): Promise<JobDetailRow | null>
```

- Carrega **uma** vaga por `id` com `select` explícito (sem vazar entidade nem `company.nomeFantasia` para anônimo — a
  projeção do nome real é **condicional ao papel**, como em `search-jobs.ts:55`, P-002 / [[view-model-anonimizacao-nao-basta-rsc-flight]]).
- `where`: `id = $id AND status='ACTIVE' AND valid_until >= hojeSaoPaulo() AND company.is_verified = true` (E-005/P-004/P-005).
  **Retorna `null`** quando não casa → a página renderiza o estado "vaga encerrada" (E-005), nunca 404 técnico.
- Conta candidaturas ativas: `applications` com `cancelledAt = null` para o `jobId` (uma agregação; sem N+1).
- Campos do `select`: título, descrição, requisitos, benefícios, `salaryMin/Max/Visible`, `contractType`, `workRegime`,
  `validUntil`, `area.name`, `region.name`, `company.setor` (sempre), `company.nomeFantasia` (**só se `viewer` autenticado**).

## 3. View Model — `viewJobDetail(row, viewer)`

`src/modules/jobs/views/job-detail.view.ts` — **única fonte de anonimização** (ADR-0022; runbook-view-model-visibility).
Consumido **tanto** pela página **quanto** pelo `generateMetadata` (P-002 — anonimizar uma vez, no serializer).

```ts
export function viewJobDetail(row: JobDetailRow, viewer: CurrentPerson | null): JobDetail
```

Regras:
- **Empresa:** anônimo → `companyDisplayName = "Empresa do setor de "+row.company.setor`, `isAnonymized=true`, **nunca**
  `nomeFantasia` (E-001/P-002). Autenticado → nome real, `isAnonymized=false` (E-002). Reusa `viewJobForVisitor`.
- **Contador (E-003/P-001):** `applicationCount = count >= APPLICATION_COUNTER_THRESHOLD ? count : null` (limiar `3`,
  constante exportada/tunável). `null` ⇒ a UI **não** renderiza o contador.
- **Flags por papel:** `canApply = viewer?.roles.includes('candidato')` (E-002 — botão candidatar); `showActivateCandidateCta =
  viewer != null && !canApply` (E-004/P-003 — CTA ativar candidato); anônimo ⇒ ambos `false` (UI mostra CTA criar conta).
- **Salário:** `salaryVisible === false` ⇒ `salary = null` (edge, independe do papel).

## 4. Rota pública + metadados

`src/app/(public)/vagas/[id]/page.tsx` — Server Component, ISR (`export const revalidate`, alinhado a `/vagas` = 1800s, L-002).

- **`page` (T3):** lê `params.id`, chama `getCurrentPerson()` + `getActiveJobDetail(id, viewer)` em paralelo.
  - `row == null` ⇒ render "Vaga encerrada / temporariamente indisponível" + CTA `/vagas` (E-005/D-004). Sem botão candidatar (P-005).
  - senão ⇒ `viewJobDetail` → render dados completos + Empresa (anonimizada/real) + contador (se presente) + CTA por papel:
    candidato → "candidatar-se" (display; ação USP-025); autenticado-sem-papel → "Ativar perfil candidato" → USP-009 (E-004);
    anônimo → "Criar conta para candidatar-se" → USP-001.
- **`generateMetadata` (T4):** `export async function generateMetadata` no **mesmo arquivo**. Renderiza para
  crawler/social = **sempre anônimo** ⇒ usa o View Model anonimizado: `<title>`/description/OG/Twitter Card +
  JSON-LD `JobPosting` com `hiringOrganization` anonimizado + URL canônica por `id` (sem nome de Empresa). **P-002 em todos
  os canais.** T4 compartilha arquivo com T3 ⇒ sequencial, não paralelo.

## 5. Riscos & débitos

- **RP-009 (tráfego anônimo no detalhe):** mitigado por ISR (L-002) + rate limit (L-003). Sem trabalho novo.
- **Invalidação fina de `/vagas/[id]`:** hoje só `/vagas` é revalidado on-demand; o detalhe depende da janela ISR. Débito
  registrado (não bloqueia — janela curta cobre L-002). Avaliar `revalidatePath('/vagas/[id]')` na USP-023/024.
- **Forma de `applications`:** definida aqui pela USP-022 (leitura); a USP-025 estende com escrita/unicidade/encaminhamento.
  Risco de re-migração é aceito e explícito (AD-012).

## 6. Rastreabilidade ICE → artefato

| ICE | Onde se materializa |
|---|---|
| E-001 / P-002 | `viewJobDetail` (anonimização) + `generateMetadata`/JSON-LD (T4) |
| E-002 | `viewJobDetail.canApply` + botão (T3) |
| E-003 / P-001 | `viewJobDetail.applicationCount` (limiar 3) + count na query (T1+T2) |
| E-004 / P-003 | `viewJobDetail.showActivateCandidateCta` + CTA (T3) |
| E-005 / P-004 / P-005 | `where` on-read da query (retorna null) + estado "vaga encerrada" (T2+T3) |
| L-001/L-002/L-003 | ISR + índices + rate limit middleware |
