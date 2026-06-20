# USP-022 — Ver detalhe da vaga — Tasks

> Deriva de [`design.md`](./design.md). 1 task = 1 PR (squash). **Status:** Approved — Dev Sênior aprovou o plano + 4 sub-issues
> (2026-06-20). Board (#276/#173/#277/#278) e estimates aplicados (ver "Ajuste de board"). Próximo: Execute da T1 (#276).
> **Estimate revisada = ~20h** — AD-012 cresceu o escopo do board (#173 = 6h, single task) ao (a) introduzir a tabela
> `applications` que #162 nunca criou e (b) materializar P-001/P-002/E-004/E-005 que o board sub-especificou.
> **Padrões de referência (não recriar):** `Job`/`Region`/`ContentStatus`/`Company.isVerified` (existem); `search-jobs.ts`
> (on-read + `select` por papel); `job-list-item.view.ts` (`viewJobForVisitor`); `getCurrentPerson` (`@/modules/identity`);
> `app/(public)/vagas/page.tsx` (ISR); `hojeSaoPaulo()` (`shared/lib/time.ts`); `NextCacheInvalidation` (`/vagas` cabeado);
> rate limit no middleware (`RATE_LIMIT_DISABLED`).

## Grafo de dependências

```
T1 (schema applications + migration + seed)
   └▶ T2 (getActiveJobDetail + viewJobDetail)
        └▶ T3 (página detalhe ISR + estados + CTAs + contador)
             └▶ T4 (generateMetadata + JSON-LD/OG anonimizados — P-002)
```

Cadeia linear (cada uma destrava a próxima — cascade OpenWolf regra 5). **T3 e T4 compartilham `page.tsx` ⇒ sequenciais,
nunca `[P]`.** Nenhuma task é `[P]` (cadeia totalmente linear + arquivo compartilhado).

---

## T1 — #276 · feat(jobs): tabela `applications` (contador) + migration + seed · 4h · Ready

- **What:** introduzir `model Application` mínimo (capaz de contar) + reversas + migration + backfill no seed (AD-012, `design.md §1`).
- **Where:** `prisma/schema.prisma` (`model Application`, reversa em `Job`/`Person`); `prisma/migrations/20260620XXXXXX_usp022_applications/`; `prisma/seed.ts` (backfill).
- **Depends on:** `model Job`, `model Person` (existem). **Reuses:** padrão de migration USP-020/021; índice via Prisma `@@index`.
- **Done when:**
  - [ ] `Application { id, candidatoId→Person, jobId→Job, cancelledAt DateTime?, createdAt }` + `@@map("applications")` + `@@index([jobId, cancelledAt])`.
  - [ ] Reversas `Job.applications` e `Person.applications`.
  - [ ] **Deferido (comentário no schema):** `viaEncaminhamento`/`encaminhamentoId` (FK `Referral`) + índice único parcial → USP-025/044.
  - [ ] `seed.ts`: 1 vaga ACTIVE com **≥ 3** candidaturas ativas (D-005 contador visível) + 1 com **0** (contador oculto).
  - [ ] Migração aplica em DB limpo (`supabase db reset`); `prisma generate` + `npm run typecheck` ✓.
- **Tests:** integração (`applications.int.test.ts`): contagem de candidaturas ativas por vaga ignora `cancelledAt != null`. (`@e-003`)
- **TestGate:** full (`typecheck` + migração em DB limpo + `vitest`).
- **Commit:** `feat(jobs): tabela applications p/ contador de candidaturas (USP-022)`

## T2 — #173 · feat(jobs): getActiveJobDetail (on-read) + viewJobDetail (View Model) · 6h · Backlog (Blocked by #276)

- **What:** query de detalhe on-read com contagem + View Model por papel (anonimização, limiar do contador, flags `canApply`/`showActivateCandidateCta`, salário) (`design.md §2-§3`).
- **Where:** `src/modules/jobs/queries/get-job-detail.ts`, `src/modules/jobs/views/job-detail.view.ts`, `src/modules/jobs/__tests__/get-job-detail.int.test.ts`, `src/modules/jobs/__tests__/job-detail.view.spec.ts`, barrel `jobs/index.ts`.
- **Depends on:** T1 (tabela `applications`). **Externos:** `prisma`, `getCurrentPerson`, `hojeSaoPaulo()`. **Reuses:** `search-jobs.ts` (`where` on-read + `select` condicional ao papel), `viewJobForVisitor` (branch de anonimização).
- **Done when:**
  - [ ] `getActiveJobDetail(id, viewer)`: `where` = `id AND status='ACTIVE' AND validUntil >= hojeSaoPaulo() AND company.isVerified` (E-005/P-004/P-005); **retorna `null`** se não casa; conta `applications` com `cancelledAt = null`; `select` explícito; `nomeFantasia` **só** se `viewer != null` (P-002).
  - [ ] `viewJobDetail(row, viewer)`: anônimo → `companyDisplayName="Empresa do setor de X"`, `isAnonymized=true`, **nunca** `nomeFantasia` (E-001/P-002); autenticado → nome real (E-002); `applicationCount = count>=3 ? count : null` (E-003/P-001); `canApply = roles inclui 'candidato'` (E-002); `showActivateCandidateCta = autenticado && !canApply` (E-004/P-003); `salaryVisible===false ⇒ salary=null`.
  - [ ] `APPLICATION_COUNTER_THRESHOLD = 3` exportada (tunável). Exports via barrel; `typecheck` + `lint` ✓.
- **Tests:** facts do skill-tdad. Integração: vaga não-ACTIVE/expirada/Empresa não-verificada ⇒ `null` (`@e-005`/`@p-004`/`@p-005`); contagem ignora canceladas. View spec: **anônimo NÃO vê `nomeFantasia` em campo algum** (`@e-001`/`@p-002`), autenticado vê (`@e-002`); contador `null` p/ N<3 e número p/ N≥3 (`@e-003`/`@p-001`); `canApply`/`showActivateCandidateCta` por papel (`@e-002`/`@e-004`/`@p-003`); `salaryVisible=false` oculta salário.
- **TestGate:** full (`typecheck` + `lint` + `vitest`).
- **Commit:** `feat(jobs): getActiveJobDetail on-read + viewJobDetail por papel (USP-022)`

## T3 — #277 · feat(jobs): página detalhe `(public)/vagas/[id]` (ISR) + estados + CTAs + contador · 6h · Backlog (Blocked by #173)

- **What:** rota pública de detalhe (Server Component, ISR), estado "vaga encerrada" (E-005), contador (E-003) e CTAs por papel (`design.md §4`).
- **Where:** `src/app/(public)/vagas/[id]/page.tsx` (componente default), `src/modules/jobs/components/job-detail.tsx` (apresentação), barrel.
- **Depends on:** T2 (`getActiveJobDetail` + `viewJobDetail`). **Externos:** shadcn/ui, `getCurrentPerson`. **Reuses:** `(public)/vagas/page.tsx` (`export const revalidate`), mapeamento `JobListItem`→card.
- **Done when:**
  - [ ] `export const revalidate = 1800`; lê `params.id`, chama `getCurrentPerson()` + `getActiveJobDetail` em paralelo.
  - [ ] `row == null` ⇒ "Vaga encerrada / temporariamente indisponível" + CTA `/vagas`, **sem** botão candidatar (E-005/P-005/D-004) — não 404 técnico.
  - [ ] Render dados completos (descrição, requisitos, benefícios, salário se visível, regime, local, validade) + Empresa anonimizada/real conforme View Model.
  - [ ] Contador "N pessoas se candidataram" só quando `applicationCount != null` (E-003/D-005).
  - [ ] CTAs: candidato → botão "candidatar-se" (display; ação USP-025) (E-002); autenticado-sem-papel → "Ativar perfil candidato" → `/candidato` (USP-009) (E-004/P-003); anônimo → "Criar conta para candidatar-se" → USP-001.
  - [ ] `typecheck` + `lint` ✓.
- **Tests:** facts do skill-tdad. E2E (Playwright): anônimo abre `/vagas/[id]` de vaga ACTIVE → vê detalhe anonimizado, sem botão candidatar; vaga pausada/expirada por link direto → "vaga encerrada" + CTA lista (`@e-005`/`@d-004`); contador aparece só na vaga com ≥3 (`@e-003`/`@d-005`).
- **TestGate:** build (`typecheck` + `lint` + E2E do fluxo de detalhe).
- **Commit:** `feat(jobs): UI detalhe da vaga (ISR) + estados + CTAs (USP-022)`

## T4 — #278 · feat(jobs): generateMetadata + JSON-LD/OG anonimizados (P-002) · 4h · Backlog (Blocked by #277)

- **What:** `generateMetadata` + JSON-LD `JobPosting` + OG/Twitter Card no detalhe, **anonimizados em todos os canais** (`design.md §4`, P-002).
- **Where:** `src/app/(public)/vagas/[id]/page.tsx` (`export async function generateMetadata`) + componente `<script type="application/ld+json">`.
- **Depends on:** T3 (compartilha `page.tsx`). **Reuses:** `viewJobDetail` (T2) como **única fonte** de anonimização (ADR-0022).
- **Done when:**
  - [ ] `generateMetadata` renderiza para crawler = **sempre anônimo** ⇒ `title`/description/OG/Twitter usam `companyDisplayName` anonimizado; URL canônica por `id` (sem nome de Empresa).
  - [ ] JSON-LD `JobPosting` com `hiringOrganization` = nome anonimizado por setor; demais campos da vaga (título, descrição, validade) presentes.
  - [ ] vaga não-ACTIVE ⇒ metadados de "vaga indisponível" sem dados sensíveis.
  - [ ] `typecheck` + `lint` ✓.
- **Tests:** facts do skill-tdad. E2E/integração de metadados: para anônimo, **nenhum** canal (HTML/OG/Twitter/JSON-LD/canonical) contém o `nomeFantasia` real (`@p-002`/`@e-001`/`@d-001`).
- **TestGate:** build (`typecheck` + `lint` + E2E de metadados).
- **Commit:** `feat(jobs): metadados + JSON-LD anonimizados no detalhe (USP-022)`

---

## Validação pré-aprovação (3 checks obrigatórios)

### Check 1 — Granularidade

| Task | Escopo | Status |
|---|---|---|
| T1 | 1 model + 1 migration + backfill seed (coeso) | ✅ Granular |
| T2 | 1 query + 1 View Model (coeso, mesma fatia leitura) | ✅ Granular |
| T3 | 1 rota/página + 1 componente de apresentação | ✅ Granular |
| T4 | 1 função `generateMetadata` + JSON-LD (mesmo arquivo) | ✅ Granular |

### Check 2 — Cross-check diagrama × `Depends on`

| Task | Depends on (corpo) | Diagrama | Status |
|---|---|---|---|
| T1 | — (só models existentes) | raiz | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 (arquivo compartilhado) | T3 → T4 | ✅ Match |

Nenhuma task `[P]`; cadeia linear ⇒ sem violação de paralelismo.

### Check 3 — Co-locação de testes (sem TESTING.md — gates inline, padrão USP-021)

| Task | Camada criada | Tipo de teste exigido | Task declara | Status |
|---|---|---|---|---|
| T1 | schema/migration + seed | integração (contagem) | integração | ✅ OK |
| T2 | query + View Model | integração + unit (view) | integração + view spec | ✅ OK |
| T3 | rota pública + UI | e2e | e2e | ✅ OK |
| T4 | metadados/serialização SEO | e2e (P-002) | e2e/integração | ✅ OK |

Nenhuma task difere testes para outra ⇒ sem violação de co-locação. Todo must-not tem task dona:
P-001/E-003→T2(+T1); P-002→T4(+T2); P-003/E-004→T3(+T2); P-004/P-005/E-005→T2(+T3).

## Facts (skill-tdad) — a gerar na fase Execute

Rodar `skill-tdad` sobre `expectations-USP-022.md` (E-001..E-005, P-001..P-005, L-001..L-003) para produzir:
`.feature` Gherkin PT-BR (tags `@e-001`…`@p-005`), Vitest RED (int de `getActiveJobDetail` + view spec de `viewJobDetail`),
Playwright E2E (detalhe + metadados/P-002), matriz AC→fact. Os paths retornados populam o campo **Tests** de cada task.
Fora desta US (UAT pós-merge): D-001..D-005 (ensaios), L-001 (carga p95).

## Ajuste de board (OpenWolf regra 3 — Estimate pai = soma dos subs) — ✅ aplicado 2026-06-20

Dev Sênior aprovou o plano e optou por **4 sub-issues** (2026-06-20):
- **#276** (T1) criada, filha de #172, Estimate 4h, Status **Ready**.
- **#173** (T2) reaproveitada (era "query+view+UI" single task) → Estimate 6h, **Blocked by #276**.
- **#277** (T3) criada, Estimate 6h, **Blocked by #173**. **#278** (T4) criada, Estimate 4h, **Blocked by #277**.
- Cadeia de bloqueio nativa (GitHub dependencies API): #276 → #173 → #277 → #278.
- **#172** Estimate 6h → **20h** (= 4+6+6+4). Épico **#6** 163h → **177h** (Δ +14h).
- Cascade: ao fechar #276 → #173 vai a Ready; ao fechar #173 → #277; ao fechar #277 → #278 (regra 5).
