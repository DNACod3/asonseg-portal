# USP-021 — Buscar vagas (pública) — Tasks

> Deriva de [`design.md`](./design.md). 1 task = 1 PR (squash). Estimate revisada = **~22h** (AD-011 cresceu o escopo
> do board original de 12h, ao estender o schema). Board (2026-06-20): #169 **In progress** (kickoff) · #170/#171 **Backlog**.
> **Board ajustado (2026-06-20):** subtask T1 criada (**#274**, Ready, 8h); #170→8h, #171→6h (ambas Blocked); #169=22h; Épico #6=163h.
> **Padrões de referência:** `jobs/queries/list-approved-job-areas.ts` (query), `reporting/views/access-report.view.ts`
> (View Model async), `moderation/adapters/next-cache-invalidation.ts` (revalidação `/vagas` já cabeada),
> `identity/server/session.ts` (`getCurrentPerson`), USP-020 (model `Job` + migration + `JobForm`).

## Grafo de dependências

```
T1 (schema +unaccent +seed +JobForm) ──▶ T2 (#170 searchJobs + View Models) ──▶ T3 (#171 UI /vagas ISR)
```

Cadeia linear; cada subtask destrava a próxima ao fechar (cascade OpenWolf regra 5).
**Já existem (não recriar):** `model Job` (USP-020), `Region` (taxonomia), `Company.isVerified` (USP-017),
enum `ContentStatus`, `listApprovedJobAreas`, `getCurrentPerson`, `NextCacheInvalidation` (`/vagas` já mapeado),
helpers de tempo em `shared/lib/time.ts`, rate limiting no middleware (`RATE_LIMIT_DISABLED`).

---

## T1 — #274 · feat(jobs): estender schema Job (TD §4.5) + unaccent + seed + form · 8h · Ready

- **What:** migração estendendo `Job` ao contrato do TD §4.5 (`design.md §1`) + extensão `unaccent`/`pg_trgm` e índice funcional (`design.md §2`) + backfill no seed + atualizar `JobForm` (USP-020) p/ coletar os campos novos.
- **Where:** `prisma/schema.prisma`; `prisma/migrations/20260620XXXXXX_usp021_job_search_fields/`; `prisma/seed.ts` (backfill); `src/modules/jobs/schemas/publish-job.schema.ts` (campos novos no submit); `src/modules/jobs/components/job-form.tsx`; barrel `jobs/index.ts`.
- **Depends on:** `Region`, `Company.isVerified`, `model Job` (existem).
- **Reuses:** padrão de migration da USP-020 (`..._usp020_job`); `educationLevel String?` de `CandidateProfile` (mesmo estilo freetext); índice parcial via SQL bruto (padrão `job_dedup_alive`).
- **Done when:**
  - [ ] `Job` ganha `educationLevelRequired?`, `contractType?`, `salaryMin?`/`salaryMax?` (`Decimal(10,2)`), `salaryVisible Boolean @default(true)`, `regionId?` + relação `region Region?`; reversa `Region.jobs Job[]` (AD-1: nullable p/ não quebrar seed).
  - [ ] `@@index([status, validUntil])` e `@@index([areaId, regionId, status])` (L-001/RP-009).
  - [ ] Migração SQL bruto: `CREATE EXTENSION unaccent`, `CREATE EXTENSION pg_trgm`, wrapper `immutable_unaccent(text) IMMUTABLE`, índice GIN trgm `job_search_trgm` (`design.md §2`).
  - [ ] `publishJobSchema`/`submitJobSchema` exigem `contractType` + `regionId` no submit (rascunho continua parcial); `educationLevelRequired`/`salaryMin/Max`/`salaryVisible` opcionais.
  - [ ] `JobForm` coleta os campos novos (select de Região via `Region` ativas; select/input contrato; faixa salário + toggle "exibir salário").
  - [ ] `seed.ts` backfilla vagas existentes com `contractType`/`regionId` válidos (ou cria vagas de exemplo completas p/ a busca pública).
  - [ ] Migração aplica em DB limpo (`supabase db reset`); `prisma generate` + `npm run typecheck` ✓.
- **Tests:** validação por migration + typecheck; smoke `supabase db reset`; teste de regressão do `JobForm` (USP-020 não quebra). Facts do skill-tdad p/ os campos novos no submit.
- **Gate:** `npm run typecheck` ✓ · migração aplica em DB limpo ✓ · índice `unaccent` criado · suíte da USP-020 sem regressão.
- **Commit:** `feat(jobs): estende schema Job + unaccent p/ busca (USP-021)`

## T2 — #170 · feat(jobs): searchJobs (query on-read) + View Models por papel · 8h · Backlog

- **What:** query `searchJobs` (filtro on-read + 6 filtros AND + busca `unaccent` + paginação) + View Models `viewJobForVisitor` (anonimização anônimo vs. autenticado) + query auxiliar `listActiveRegions`.
- **Where:** `src/modules/jobs/queries/search-jobs.ts`, `src/modules/jobs/queries/list-active-regions.ts`, `src/modules/jobs/views/job-list-item.view.ts`, `src/modules/jobs/__tests__/search-jobs.int.test.ts`, `src/modules/jobs/__tests__/job-list-item.view.spec.ts`, `shared/lib/time.ts` (`hojeSaoPaulo()`), barrel `jobs/index.ts`.
- **Depends on:** T1 (colunas + índice unaccent). Externos: `prisma`, `getCurrentPerson` (`@/modules/identity`), helpers de tempo.
- **Reuses:** `list-approved-job-areas.ts` (forma de query read-only + `take`); `access-report.view.ts` (View Model async com recorte); runbook-search-pagination + runbook-view-model-visibility **verbatim**.
- **Done when:**
  - [ ] `searchJobs(filters, viewer)`: on-read `status=ACTIVE AND validUntil >= hojeSP() AND company.isVerified=true` (E-001/P-003/P-005); todos os filtros em AND (E-002); busca textual `unaccent` sobre título+desc+requisitos via `$queryRaw` parametrizado (E-003, AD-2); `orderBy publishedAt desc`; `take`+`skip` (L-002); `select` explícito (sem vazar entidade/Empresa).
  - [ ] `viewJobForVisitor(row, viewer)`: anônimo → `displayName="Empresa do setor de X"`, `isAnonymized=true`, **nunca** `company.name` (E-004/P-001/P-004); autenticado → nome real (E-005); `salaryVisible=false` → `salary=null` (edge).
  - [ ] `hojeSaoPaulo()` em `shared/lib/time.ts` (data em America/Sao_Paulo).
  - [ ] `listActiveRegions()` (id+name, `isActive`, `take`).
  - [ ] Exports via barrel; `npm run typecheck` + `lint` ✓.
- **Tests:** facts do skill-tdad. Integração (`*.int.test.ts`): só `ACTIVE`+não-expirada+Empresa verificada aparece (E-001/P-003/P-005); vaga expirada por validade vencida some mesmo com status persistido `ACTIVE` (P-003/D-004); filtros AND combinados; busca "padaria" acha "padária" e "PADARIA" (E-003); paginação. View (`*.view.spec.ts`): **anônimo NÃO vê `company.name` em nenhum campo** (E-004/P-001/D-002), autenticado vê (E-005), `salaryVisible=false` oculta salário.
- **Gate:** `npm run typecheck` ✓ · `lint` ✓ · `vitest` (int + view) verdes.
- **Commit:** `feat(jobs): searchJobs on-read + View Models por papel (USP-021)`

## T3 — #171 · feat(jobs): UI busca pública /vagas (ISR + filtros) · 6h · Backlog

- **What:** rota pública `(public)/vagas` (ISR) + UI de filtros (2-3 prioritários + expansível) + lista de cards anonimizados + paginação.
- **Where:** `src/app/(public)/vagas/page.tsx`, `src/modules/jobs/components/job-search-filters.tsx`, `src/modules/jobs/components/job-card.tsx`, `src/modules/jobs/components/job-list.tsx`, barrel.
- **Depends on:** T2 (`searchJobs` + View Models). Externos: shadcn/ui, `getCurrentPerson`, `listApprovedJobAreas`/`listActiveRegions`.
- **Reuses:** padrão de Server Component público (`(public)/page.tsx` — `export const revalidate`); `NextCacheInvalidation` já revalida `/vagas` (não tocar); mapeamento de `JobListItem` → card.
- **Done when:**
  - [ ] `export const revalidate = 1800` na page; Server Component lê `searchParams`, chama `getCurrentPerson()` + `searchJobs` e renderiza.
  - [ ] Filtros via searchParams (`?area=&regime=&regiao=&q=&pagina=`); URL compartilhável; **P-002:** área + regime/região visíveis, restante (escolaridade/contrato/faixa salário) em "Mais filtros" expansível; mobile-first.
  - [ ] Cards: título, área, região, regime, salário (se visível), Empresa (anonimizada p/ anônimo, real p/ autenticado), data; link p/ detalhe (rota USP-022, placeholder ok).
  - [ ] Estado vazio + paginação; sem nome de Empresa em metadados da lista (E-004).
  - [ ] `npm run typecheck` + `lint` ✓.
- **Tests:** facts do skill-tdad. E2E (Playwright, top-flow descoberta): anônimo abre `/vagas`, vê vagas ativas anonimizadas; aplica filtro (área+região) → lista reduz; busca textual sem acento acha vaga; (D-002) inspeciona HTML e não acha nome real da Empresa.
- **Gate:** `npm run typecheck` ✓ · `lint` ✓ · E2E do fluxo de busca pública verde.
- **Commit:** `feat(jobs): UI busca pública de vagas (ISR) (USP-021)`

---

## Ajuste de board (OpenWolf regra 3 — Estimate pai = soma dos subs) — ✅ aplicado 2026-06-20

- **#274** (T1) criada, filha de #169, Estimate 8h, Status **Ready**.
- **#170** (T2) Estimate 6h→8h, **Blocked by #274**. **#171** (T3) Estimate 6h, **Blocked by #170**.
- **#169** Estimate 12h→**22h** (= 8+8+6). Épico **#6** 153h→**163h** (Δ +10h).
- Cascade: ao fechar #274 → #170 vai a Ready; ao fechar #170 → #171 vai a Ready (regra 5).

## Facts (skill-tdad) — a gerar na fase Execute

Rodar `skill-tdad` sobre `expectations-USP-021.md` (E-001..E-005, P-001..P-005, L-002/L-004) para produzir:
- `.feature` Gherkin PT-BR (tags `@e-001`…`@p-005`), Vitest RED (int de `searchJobs` + view specs), Playwright E2E (top-flow descoberta), matriz de rastreabilidade AC→fact.
- Cobertura alvo: **E-001, E-002, E-003, E-004/P-001, E-005, P-003, P-004, P-005, L-002, L-004**.
- Fora desta US (verificam em USP-022/024): OG/JSON-LD por vaga (E-004 no detalhe), expiração por cron (USP-024), D-001/D-003/D-005 (UAT/carga pós-merge).
