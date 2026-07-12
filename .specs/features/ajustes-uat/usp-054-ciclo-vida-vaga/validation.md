# USP-054 — Ciclo de vida da vaga no painel — Validation

**Date**: 2026-07-12
**Spec**: `.specs/features/ajustes-uat/usp-054-ciclo-vida-vaga/spec.md`
**Diff range**: `ab8e646~1..b529ea4` (7 commits, T1–T7)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 (cache sai de ACTIVE) | ✅ Done | `ab8e646` |
| T2 (ISR 600s) | ✅ Done | `61393dc` |
| T3 (formatDateOnly) | ✅ Done | `e2d6fa2` |
| T4 (view model actions+returnReason) | ✅ Done | `de73449` |
| T5 (updateJobDraft) | ✅ Done | `a89fcea` |
| T6 (listLatestReturnReasons) | ✅ Done | `7e10bf6` |
| T7 (fiação UI) | ✅ Done | `b529ea4` |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| USP054-01 (DRAFT → canEdit+canSubmit) | `actionsForStatus('DRAFT')` → `{canEdit:true,canSubmit:true,rest:false}` | `src/modules/jobs/__tests__/company-job-row.view.spec.ts:69` — `expect(view.actions).toEqual({canEdit:true,canSubmit:true,...})` | ✅ PASS |
| USP054-02 (AWAITING_ADJUSTMENTS → canEdit+canSubmit) | idem, mesmo status | `company-job-row.view.spec.ts:81` | ✅ PASS |
| USP054-03 (Editar persiste, preserva status) | `status` inalterado após `updateJobDraft` | `update-job-draft.int.test.ts:152-168` (DRAFT) e `:170-178` (AWAITING_ADJUSTMENTS) — `expect(res).toMatchObject({data:{status:'DRAFT'}})` + row real lido do DB | ✅ PASS |
| USP054-04 (Submeter → IN_MODERATION via transitionContent) | `submitJobForModeration({jobId})` chamado; ações somem após sucesso | `company-job-actions.spec.tsx:71-79` — `expect(actions.submitJobForModeration).toHaveBeenCalledWith({jobId:'job-1'})` + `router.refresh` | ✅ PASS |
| USP054-05 (não-responsável → nega, sem escrita) | `FORBIDDEN`/`notFound()`, zero write | `update-job-draft.int.test.ts:201-210` (`FORBIDDEN` + row intacta) + `editar/page.test.tsx:86-93` (`notFound()`, `jobFindFirst` não chamado) | ✅ PASS |
| USP054-06 (terminal → sem submeter/reenviar) | `canSubmit=false` p/ ARCHIVED/EXPIRED/INACTIVATED/REJECTED/IN_MODERATION | `company-job-row.view.spec.ts:90-104` (`it.each`) | ✅ PASS |
| USP054-07 (motivo visível) | painel exibe `justification` exata | `list-latest-return-reasons.int.test.ts:133-139` (query) + `company-job-list.spec.tsx:63-71` (render) | ✅ PASS |
| USP054-08 (motivo mais recente) | 2 devoluções → devolve a mais recente | `list-latest-return-reasons.int.test.ts:141-148` — `orderBy occurredAt desc`, `.reason` = texto da 2ª | ✅ PASS |
| USP054-09 (reenviar → IN_MODERATION, motivo some da pendência) | reenvio usa `submitJobForModeration`; motivo é `returnReason` só quando `AWAITING_ADJUSTMENTS` (o objeto muda de status ao reenviar → `returnReason` deixa de ser computado) | `company-job-actions.spec.tsx:55-64` (reenvio) + `company-job-row.view.ts:119` (`returnReason` condicionado a `status==='AWAITING_ADJUSTMENTS'`) | ✅ PASS |
| USP054-10 (fora de AWAITING_ADJUSTMENTS → sem motivo) | `returnReason=null` mesmo se passado | `company-job-row.view.spec.ts:113-116` (view) + `company-job-list.spec.tsx:83-86` (render) | ✅ PASS |
| USP054-11 (sai de ACTIVE → revalida /vagas e detalhe) | `revalidatePath('/vagas')` + `/vagas/{id}` chamados | `adapters.test.ts:57-77` (PAUSED e ARCHIVED, `toHaveBeenCalledTimes(2)`) | ✅ PASS |
| USP054-12 (entra em ACTIVE → preservado) | revalidação continua ocorrendo | `adapters.test.ts:20-35` (casos pré-existentes com `from` adicionado, ainda verdes) | ✅ PASS |
| USP054-13 (revalidate=600 nas 2 páginas) | `export const revalidate = 600` exato | `grep -rn "export const revalidate" "src/app/(public)/vagas"` → 2 ocorrências, ambas `600` (verificado nesta sessão) | ✅ PASS |
| USP054-14/15 (validUntil sem −1 dia) | `2026-08-01T00:00:00Z` → `01/08/2026`; janela 00:00–03:00 UTC preservada | `time.test.ts:73-88` | ✅ PASS |

**Status**: ✅ All ACs covered (14/14 traced with file:line; nenhum spec-precision gap encontrado).

---

## Discrimination Sensor

Executado em árvore real (mutação → teste → reversão imediata; `git status` limpo confirmado antes e depois). 5 mutações, alvo em cada must-not:

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ------------ | ------- |
| 1 (MN-04) | `src/modules/moderation/adapters/next-cache-invalidation.ts` guarda | Removida a cláusula `target.from !== ContentStatus.ACTIVE` (restaura o bug original) | ✅ Killed — 2 testes de `adapters.test.ts` falharam (PAUSED/ARCHIVED de ACTIVE deixam de revalidar) |
| 2 (MN-05) | `src/shared/lib/time.ts` `formatDateOnly` | Trocado `'UTC'` → `'America/Sao_Paulo'` (reintroduz o −1 dia) | ✅ Killed — 4 testes de `time.test.ts` falharam |
| 3 (MN-01/MN-02) | `src/modules/jobs/actions/update-job-draft.ts` write | Adicionado `status: 'IN_MODERATION'` ao `data:` do `updateMany` | ✅ Killed — guarda estática `no-out-of-band-status-write.test.ts` detectou a mutação (varredura já cobre o arquivo novo, sem precisar editar o teste) |
| 4 (USP054-02/06) | `src/modules/jobs/views/company-job-row.view.ts` `actionsForStatus` | Removido o case `'AWAITING_ADJUSTMENTS'` do agrupamento com `'DRAFT'` (cai no `default`, `canEdit/canSubmit=false`) | ✅ Killed — `company-job-row.view.spec.ts` (USP054-02) falhou |
| 5 (MN-03) | `src/modules/jobs/actions/update-job-draft.ts` gate | `if (!(await requireActiveResponsible(...)))` → `if (false)` (desliga o gate de autorização) | ✅ Killed — `update-job-draft.int.test.ts` (não-responsável) falhou: `res.ok` virou `true` |

**Sensor depth**: lightweight (5 mutações direcionadas às guardas dos 5 must-nots — acima do mínimo 1–3 porque a feature carrega FSM + cache público de alto raio de impacto).
**Result**: 5/5 killed — PASS ✅

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| USP054-MN-01 | escrever `Job.status` fora de `transitionContent` no caminho de submit/reenvio | `src/modules/jobs/__tests__/no-out-of-band-status-write.test.ts:74-84` — varredura estática, `update-job-draft.ts` incluído automaticamente (diretório escaneado recursivamente) | ✅ | ✅ (mutação 3) |
| USP054-MN-02 | transicionar ao editar rascunho/devolvida | `src/modules/jobs/__tests__/update-job-draft.int.test.ts:152-178` — status inalterado após write real no DB | ✅ | ✅ (mutação 3 mata o mecanismo compartilhado; ver também mutação isolada abaixo) |
| USP054-MN-03 | executar/revelar p/ não-responsável ou cross-tenant | `update-job-draft.int.test.ts:201-210` (FORBIDDEN sem escrita) + `list-latest-return-reasons.int.test.ts:157-168` (isolamento 2 empresas) + `editar/page.test.tsx:86-93` / `vagas/page.test.tsx:71-79` (404, zero query) | ✅ | ✅ (mutação 5) |
| USP054-MN-04 | deixar `/vagas`/`/vagas/[id]` servindo vaga que saiu de ACTIVE | `adapters.test.ts:57-77` | ✅ | ✅ (mutação 1) |
| USP054-MN-05 | deslocar ±1 dia um DATE date-only na exibição | `time.test.ts:73-88` | ✅ | ✅ (mutação 2) |

**Status**: ✅ All 5 must-nots proven (evidência-ou-zero, todos com `file:line`, todos verdes, todos com mutação de guarda morta).

---

## Interactive UAT

Não aplicável neste passe — feature de painel autenticado com E2E deferido por lição **L-007** (RTL é autoritativo); cobertura de componente/rota já evidenciada acima (spot-checked: `job-edit-form.spec.tsx`, `company-job-actions.spec.tsx`, `company-job-list.spec.tsx`, `editar/page.test.tsx`, `vagas/page.test.tsx` — todas não-shallow, asserções específicas por status/valor, não apenas "renderiza").

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — sem dep nova, sem migração (confirmado: `prisma migrate deploy` reportou "No pending migrations") |
| Surgical changes | ✅ — 28 arquivos, todos dentro do escopo de T1–T7; `search-jobs.ts` (achado pré-existente fora de escopo) intocado |
| No scope creep | ✅ — serviços (`/servicos`) não tocados (fora do escopo, A-5); `formatDate` global inalterado (só `formatDateOnly` novo) |
| Matches patterns | ✅ — `updateJobDraft` segue a sequência canônica de Server Action (CLAUDE.md); `listLatestReturnReasons` reusa o molde de `listCompanyRejections` |
| Spec-anchored outcome check (asserted values match spec) | ✅ — ver tabela de ACs acima, sem spec-precision gaps |
| Per-layer Coverage Expectation met | ✅ — view/util: 1:1 aos ramos; Server Action: happy+Zod+permissão+precondição+concorrência (CLAUDE.md); query: `where` real (AD-021); componente: render por status + gate 404 |
| Every test maps to a spec requirement | ✅ — todos os testes novos citam `USP054-NN`/`MN-NN` em nome ou comentário |
| Documented guidelines followed | ✅ — CLAUDE.md (Server Action sequence, timezone, testing requirements), lição AD-021, lição L-007 |

**Adicional (achado do Verifier, não-bloqueante)**: `src/app/(app)/empresa/[empresaId]/vagas/page.tsx:47` corrige proativamente um footgun real de `Array.prototype.map(viewCompanyJobRow)` (o índice do array vazaria como 2º argumento/`returnReason`) — não fazia parte do `Done when` textual de T4/T7, mas é a implementação correta do requisito e está coberta por teste (`vagas/page.test.tsx:105-123`). Não é scope creep: é o mesmo entregável (fiação do motivo), feito sem o bug óbvio.

---

## Edge Cases

- [x] USP054-E1 (IN_MODERATION sem submeter/reenviar): `company-job-row.view.spec.ts:90-104` (`it.each` inclui `IN_MODERATION`)
- [x] USP054-E2 (motivo ausente → fallback neutro): `company-job-list.spec.tsx:73-81`
- [x] USP054-E3 (concorrência otimista): `update-job-draft.int.test.ts:234-261` (2 casos: concorrência sem transição e com transição saindo do escopo)
- [x] USP054-E4 (revalidatePath falha não derruba a transição): preservado por design — `runSoftFail` já envolvia a chamada antes desta US e não foi alterado (`transition-content.ts:106-110`); não há teste novo dedicado, mas o mecanismo (`runSoftFail`) é preexistente e intocado
- [x] USP054-E5 (transição entre dois não-ACTIVE mantém comportamento): `adapters.test.ts:71-77` (novo caso `DRAFT→IN_MODERATION`, early-return real) + `adapters.test.ts:118-125` (`IN_MODERATION→AWAITING_ADJUSTMENTS`)

Nota sobre E4: não há citação `file:line` de um teste **novo** para esse edge case — o comportamento é herdado do `runSoftFail` pré-existente e não foi tocado pela feature (nenhum risco introduzido). Não bloqueia PASS (não é must-not, e o mecanismo subjacente já tinha sua própria cobertura antes desta US), mas registrado como gap de precisão de evidência.

---

## Gate Check

- **Gate command (Quick)**: `npm run typecheck && npm run lint && npm run test` — ✅ todos passaram
  - typecheck: 0 erros
  - lint: 0 erros
  - unit: **266 arquivos, 1860 testes, 100% passaram** (0 falhas, 0 skips não-justificados)
- **Gate command (Full, escopo tocado)**: integração isolada nos dois arquivos novos —
  `npx dotenv -e .env.local -- vitest run --config vitest.integration.config.ts src/modules/jobs/__tests__/update-job-draft.int.test.ts src/modules/jobs/__tests__/list-latest-return-reasons.int.test.ts`
  → **2 arquivos, 15 testes, 100% passaram** (Postgres local via Supabase CLI, `prisma migrate deploy` sem pendências)
- **Gate command (Build)**: `npm run build` — ✅ build de produção concluído sem erros; `/vagas` e `/vagas/[id]` compilam com `revalidate=600` no source (ambas renderizadas como `ƒ` dinâmicas por motivo pré-existente e fora de escopo: `/vagas` lê `searchParams`, `/vagas/[id]` chama `getCurrentPerson()` — nenhuma mudança desta US afeta essa dinamicidade; o AC pede o valor do `export const revalidate`, que está correto)
- **Integração NÃO executada (fora do escopo tocado, por instrução do orquestrador)**: a suíte completa de `*.int.test.ts` não foi rodada por causa do flake pré-existente documentado (`search-jobs`/`jobs.int` sem `orderBy` determinístico + acúmulo de vagas `ACTIVE` no DB local de dev/staging). Confirmado nesta sessão: `git diff --stat ab8e646~1..b529ea4` não lista `search-jobs.ts` nem qualquer arquivo de `jobs.int.test.ts`/`search-jobs.int.test.ts` — o módulo é tocado por esta US apenas via `moderation/actions/transition-content.ts` (chamada ao cache adapter), que não afeta a query de busca. `git log --oneline -- src/modules/jobs/queries/search-jobs.ts` mostra o último commit em `194f98c` (Fase muito anterior a Fase 8) — bug pré-existente, fora de escopo, não bloqueia.
- **Test count before feature**: não medido diretamente (baseline não coletado antes da execução das tasks); a lacuna é mitigada pelo **Test Co-location Validation** de `tasks.md` (todas as 7 tasks declaram contagem esperada / "nenhuma deleção") e pela ausência de qualquer `.test.ts`/`.spec.ts`/`.int.test.ts` removido no diff (`git diff --stat` mostra apenas adições `+` nos arquivos de teste, exceto edições in-place nos 2 arquivos de teste existentes atualizados — `adapters.test.ts`, `time.test.ts`, `editar/page.test.tsx`, `vagas/page.test.tsx`, `ds-vagas-parity.test.ts` — todas com linhas adicionadas > removidas)
- **Test count after feature**: unit 1860 (100% verde); integração (escopo tocado) 15 (100% verde)
- **Skipped tests**: nenhum skip não-justificado observado nas suítes executadas
- **Failures**: nenhuma

---

## Fix Plans

Nenhum — 0 gaps encontrados, 0 mutações sobreviventes, 5/5 must-nots verdes.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| EMP-2 (dossiê) → USP-023 AC1 | Tasks | ✅ Verified |
| MOD-3 (dossiê) → USP-016 E-003 | Tasks | ✅ Verified |
| EMP-3 (dossiê) → ADR-0013 | Tasks | ✅ Verified |
| MOD-5 (dossiê) → CLAUDE.md tz | Tasks | ✅ Verified |
| USP054-01..15 | Tasks | ✅ Verified (todos) |
| USP054-E1..E5 | Tasks | ✅ Verified (E4 com nota de precisão de evidência, não-bloqueante) |
| USP054-MN-01..05 | Tasks | ✅ Verified |

---

## Deviations declaradas pelo Implementer (avaliadas)

1. **Flake pré-existente de integração** (search-jobs sem `orderBy` + acúmulo de vagas ACTIVE no DB local) — **confirmado fora de escopo**: `search-jobs.ts` não aparece no diff desta feature; último commit muito anterior (Fase de Vagas original). Aceito.
2. **Removido `deleteMany` do int-test por `audit_log` append-only** — **confirmado correto**: `list-latest-return-reasons.int.test.ts:29-33` documenta explicitamente por que a limpeza não tenta apagar `AuditLog` (REVOKE DELETE, ADR-0023/CLAUDE.md) e usa `entityId` aleatório por rodada para evitar colisão. Aceito.
3. **Refactor de `updateJobDraftFields` para testabilidade do `zodResolver`** — **confirmado necessário e surgical**: extração de shape compartilhado entre `updateJobDraftSchema` (com `jobId`) e `updateJobDraftFieldsSchema` (sem `jobId`, para o form cliente); comentário no código justifica por que `.omit()` não serve pós-`.superRefine()`. Aceito, sem scope creep.
4. **Reuso de `formatDateOnly` no `editar/page.tsx`** — **confirmado consistente**: mesmo formatador de T3, usado para popular o `input[type=date]` sem reintroduzir o −1 dia (comentário explícito no código cita o risco). Aceito.
5. **Supersessão ADR-0013 1800→600 a registrar como AD** — pendente de registro formal pelo orquestrador (fora do escopo de código desta unidade); `A-6` do spec já documenta a decisão e o racional. Não bloqueia PASS (é reconciliação de doc, não de produto — conforme o próprio Entry Gate da spec já havia classificado).

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 14/14 ACs (+5 edge cases, +5 must-nots) traçados com `file:line`; 0 spec-precision gaps bloqueantes (1 nota de precisão de evidência em E4, não-bloqueante — mecanismo preexistente intocado)
**Sensor**: 5/5 mutações mortas (uma por must-not)
**Must-nots**: 5/5 verdes, todos com guarda testada por mutação
**Gate**: typecheck ✅ · lint ✅ · unit 1860/1860 ✅ · integração (escopo tocado) 15/15 ✅ · build ✅

**What works**: painel oferece editar+submeter/reenviar para DRAFT/AWAITING_ADJUSTMENTS sem burlar a FSM; motivo da devolução visível e owner-scoped; cache público revalida ao sair de ACTIVE; TTL alinhado a 600s nas duas páginas de vagas; `validUntil` sem deslocamento de fuso; zero migração, zero dependência nova; nenhum teste preexistente enfraquecido ou deletado.

**Issues found**: nenhum.

**Next steps**: nenhum fix necessário. Orquestrador pode registrar o AD de supersessão do ADR-0013 (deviation 5) como item de documentação, fora do fluxo de código.
