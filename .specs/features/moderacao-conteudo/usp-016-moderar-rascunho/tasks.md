# USP-016 — Moderar rascunho (vaga, CV ou serviço) — Tasks

> Deriva de [`design.md`](./design.md). 1 task = 1 PR (squash). Estimate total = **20h** (= 4+8+8) — aplicado no board em 2026-06-10 (#123=8h, pai #117=20h; GAP-6 resolvido).
> Status do board (2026-06-10): #121 **In Progress** · #122/#123 **Backlog** (aguardando a cadeia).

## Grafo de dependências

```
#121 (domain: máquina de estados) ──▶ #122 (transitionContent) ──▶ #123 (actions de decisão + fila)
                                            │
                                            ├─ ⚠ port de notificação → USP-044 (GAP-3, stub nesta US)
                                            └─ ⚠ hook Empresa verificada → USP-017 (GAP-4, stub nesta US)
```

Cadeia linear: cada task desbloqueia a próxima ao fechar (cascade do protocolo OpenWolf, regra 5).

---

## T1 — #121 · feat(moderation): máquina de estados (TRANSITIONS + regras puras) · 4h · In Progress

- **What:** `ContentStatus`/`ContentKind`/`TransitionTrigger`, tabela declarativa `TRANSITIONS` (JOB/CV/SERVICE) e funções puras de validação. Sem IO.
- **Where:** `src/modules/moderation/domain/content-status.ts`, `.../domain/transition-rules.ts`, barrel `src/modules/moderation/index.ts`.
- **Depends on:** nada (fundação). ✅ GAP-2 verificado (2026-06-10): enum **não existe** — a #121 é a **owner** de `ContentStatus`.
- **Reuses:** contrato verbatim de ADR-0011 (tabela `TRANSITIONS`) e `technical-design.md §2.5`.
- **Done when:**
  - [ ] `TRANSITIONS` cobre todas as transições de ADR-0011 por `ContentKind` (JOB com EXPIRED; CV/SERVICE sem), com `requiresJustification` correto (devolver/rejeitar/inativar = true).
  - [ ] `findTransition` / `isValidTransition` / `requiresJustification` puras, sem IO, sem `throw`.
  - [ ] `ContentStatus` declarado por esta US (domínio TS; enum Prisma quando o 1º model de conteúdo precisar — GAP-8). USP-009/#36 e demais reusam, não redeclaram.
  - [ ] Export via barrel `@/modules/moderation`.
- **Tests:** **unit** — `moderation/__tests__/transition-rules`: cada transição válida ✓ e uma amostra de inválidas ✗ por kind; `requiresJustification` true/false por regra. (red antes da impl — skill-tdad.)
- **Gate:** `npm run typecheck` ✓ · `npm run lint` ✓ · unit verde após impl.

## T2 — #122 · feat(moderation): transitionContent (transação + auditoria + side effects) · 8h · Backlog

- **What:** função canônica `transitionContent` — load → valida (T1) → exige justificativa → `withAudit(tx)` com update de status + side effects via ports. Ports + adapters (notification stub, cache, company-hook stub) + DI.
- **Where:** `src/modules/moderation/actions/transition-content.ts`, `.../ports/{content-status-repository,notification,cache-invalidation,company-verify-hook}.port.ts`, `.../adapters/{*,stub-notification,next-cache,stub-company-verify}.ts`, `__tests__/transition-content.int.test.ts`, registro em `src/shared/container.ts`, eventos em `@/modules/audit/events`.
- **Depends on:** #121. ⚠ **GAP-8:** nenhum model de conteúdo (`Job`/`Service`/`CandidateProfile`) existe ainda (só `Company`) — `loadStatus`/`updateStatus` ficam atrás do `ContentStatusRepository` (port); entregar o port + 1 adapter concreto mínimo (1º tipo a aterrissar) ou tabela de fixture nos testes de integração. **Reuses:** `withAudit` (`@/modules/audit`), `ActionResult` (`@/shared/errors`), Prisma singleton (`@/shared/lib`).
- **Done when:**
  - [ ] `transitionContent` retorna `INVALID_TRANSITION` para caminho não declarado (AC6) e `JUSTIFICATION_REQUIRED` quando motivo ausente/insignificante (P-003).
  - [ ] Update de status + audit log **na mesma transação** `withAudit` (AC5, L-003); `UPDATE ... WHERE status = current` (concorrência otimista, R3).
  - [ ] **Nunca** `prisma.<model>.update({status})` fora desta função (P-006/AC6).
  - [ ] 4 eventos adicionados ao catálogo (GAP-1): `CONTENT_APPROVED`, `CONTENT_RETURNED_FOR_ADJUSTMENTS`, `CONTENT_REJECTED`, `CONTENT_SUBMITTED_TO_MODERATION`.
  - [ ] Ports `Notification`/`CacheInvalidation`/`CompanyVerifyHook` definidos; adapters stub (no-op logado) para notification e company-hook (GAP-3/GAP-4); cache real (`revalidatePath`/`revalidateTag`).
  - [ ] Side effects soft-fail (falha não aborta transição — R2).
- **Tests:** **integração** (`*.int.test.ts`): transição válida (IN_MODERATION→ACTIVE/AWAITING_ADJUSTMENTS/REJECTED) grava audit + chama ports; transição inválida bloqueada; justificativa exigida; concorrência (2ª chamada falha); ports mockados.
- **Gate:** `npm run typecheck` ✓ · `npm run lint` ✓ · integração verde.

## T3 — #123 · feat(moderation): actions de decisão + fila do coordenador · 8h · Backlog

- **What:** Server Actions `approveContent`/`returnForAdjustments`/`rejectContent`, schemas Zod (motivo ≥20), query `viewModerationQueue` (IN_MODERATION, ordenado, autor≠moderador) e a página da fila.
- **Where:** `src/modules/moderation/actions/decide.ts`, `.../schemas/decision.ts`, `.../queries/moderation-queue.ts`, `.../views/`, `.../components/moderation-queue.tsx` + `decision-dialog.tsx`, `src/app/(app)/moderacao/page.tsx`, `__tests__/`.
- **Depends on:** #122. **Reuses:** `requirePermission` (`@/modules/identity`), `requireActivePerson()` (`@/modules/persons/server`), shadcn/ui + RHF + `zodResolver`.
- **Done when:**
  - [ ] Schema rejeita motivo vazio/`"x"`/`"—"`/genérico e exige ≥20 chars significativos com mensagem PT-BR (P-003).
  - [ ] `approve/return/reject`: Zod → `requirePermission(MODERATE_*)` (P-007) → `transitionContent`. Retorno `ActionResult`; nunca `throw`. ⚠ GAP-7: IDs de permissão (D-006) — usar constante nomeada + TODO.
  - [ ] `viewModerationQueue`: status `IN_MODERATION`, `ORDER BY submittedAt ASC` (E-001), `WHERE author <> viewer` (P-005), `take`+`select` explícito (L-001); item com indicador de tipo.
  - [ ] Página `(app)/moderacao` `force-dynamic`, guard de permissão, lista a fila e aciona as 3 decisões (toast PT-BR no resultado).
  - [ ] Indicador "Empresa não verificada" como flag de exibição (painel completo = USP-017, P-002).
- **Tests:** **integração** (actions: happy + Zod fail + permissão negada + motivo insuficiente) · **unit** (query exclui autor==moderador, ordena por data) · **componente** (fila renderiza, diálogo exige motivo).
- **Gate:** `npm run typecheck` ✓ · `npm run lint` ✓ · testes verdes.

---

> **Estado (Fase 2 — restyle):** T1–T3 (comportamento) já estão **implementadas e merged em `master`**.
> Nesta rodada elas são o **baseline de comportamento a preservar** (a suíte
> `src/modules/moderation/**/__tests__/` é o gate de não-regressão). O trabalho novo é **T4** (adoção do
> Design System na fila do coordenador), padrão AD-015. O painel de verificação é restilizado na USP-017.

## T4 — refactor(moderation): restyle da fila + página ao Design System (AD-014) · restyle · Ready

- **What:** substituir paleta crua Tailwind e elementos nativos por primitivos/tokens de `@/shared/ui` na
  fila do coordenador e na página da rota, **preservando 100% do comportamento** (rótulos, fluxos de
  decisão, gating de motivo, remoção do item, erros). Ver mapeamento em `design.md` §8.2–§8.3.
- **Where:**
  - `src/modules/moderation/components/moderation-queue.tsx` (botões→`Button`; textarea→`Textarea`; pills→`Badge`; card→`Card`/tokens; cores→tokens; label→`Label`).
  - `src/app/(app)/moderacao/page.tsx` (header→`FormHeader`/tokens).
  - **novo** `src/shared/__tests__/ds-moderation-parity.test.ts` (guard negativo — DS-16-MN-1).
- **Depends on:** Fundação DS (AD-014, `src/shared/ui` ✅) + baseline T1–T3 ✅. **Reuses:** `Button`,
  `Textarea`, `Badge`, `Card`, `Label`, `FormHeader` de `@/shared/ui`; `cn`.
- **Done when:**
  - [ ] DS-16-01: fila e página usam apenas primitivos/tokens; paridade light/dark via `[data-theme]` (verificar visualmente nos dois temas).
  - [ ] DS-16-MN-1: guard `ds-moderation-parity` verde — zero paleta crua/hex em `moderation-queue.tsx` e `moderacao/page.tsx`.
  - [ ] DS-16-MN-2: comportamento intacto — `components/__tests__/moderation-queue.test.tsx` (e demais RTL) **verdes sem alteração de asserções de comportamento**; ajustes de teste só se um seletor de estilo mudou (documentar).
  - [ ] DS-16-MN-3: sem `dark:`/`prefers-color-scheme`/lib de tema introduzidos.
  - [ ] Nenhum arquivo de `domain/`, `actions/`, `queries/`, `schemas/`, `ports/`, `adapters/`, `views/`, `server/` ou `container.ts` tocado (invariante §8.1).
- **Tests:** **guard estático** — `ds-moderation-parity.test.ts` (must-not DS-16-MN-1). **RTL de regressão** —
  `components/__tests__/moderation-queue.test.tsx` continua verde (comportamento preservado, DS-16-MN-2).
  (skill-tdad gera/atualiza o guard como teste-fonte RED antes do restyle.)
- **Gate:** `npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` verde (guard + RTL) · 1 commit atômico.

---

## Definition of Done (US #117)

- [ ] E-001..E-004, AC5, AC6, P-003, P-005, P-006, P-007, L-001, L-003 implementados e cobertos por testes.
- [ ] **Restyle (T4):** DS-16-01 cumprido e DS-16-MN-1..3 provados (guard `ds-moderation-parity` verde; RTL de regressão verde; sem mudança de comportamento). Camada de servidor intacta (§8.1).
- [ ] Sub-tasks #121/#122/#123 fechadas e PRs merged (squash).
- [ ] Sem regressão em `typecheck`/`lint`/testes; CI build + E2E verdes.
- [ ] Lacunas GAP-1..GAP-8 resolvidas ou explicitamente diferidas com decisão registrada (GAP-2 ✅ #121 owner do enum; GAP-8 `ContentStatusRepository` port; E-005/P-001 → GAP-5 diferido; P-002 → USP-017; P-004 → USP-018; e-mail real → USP-044).
- [x] Estimate do board corrigido (GAP-6, 2026-06-10): #123=8h, Estimate da pai #117=20h = Σ subs (4+8+8).

## Facts (Kickoff Gate)

Testes-fonte a **gerar** via `skill-tdad` a partir de `expectations-USP-016.md` (E-001..E-005, P-001..P-007), todos em status **Red**:
- BDD: [`tests/bdd/usp-016-moderar-rascunho.feature`](./tests/bdd/) — cenários com tags `@e-001..@e-004`, `@p-003`, `@p-005`, `@p-006`, `@p-007`.
- Vitest red: [`tests/unit/usp-016-moderar-rascunho.spec.ts`](./tests/unit/) — regras puras da máquina de estados + validação de motivo (red por `not implemented`).
- E2E (apoio, Top 8 — "publicar vaga + moderar"): [`tests/e2e/usp-016-moderar-rascunho.e2e.ts`](./tests/e2e/) — `test.fixme`.
- Matriz: [`tests/traceability.md`](./tests/traceability.md) — cobertura AC→teste, marcando diferidos (E-005) e cross-US (P-002→017, P-004→018).

Na fase Execute, mover/conectar os facts aos paths-alvo de cada task (`modules/moderation/__tests__/`, `domain/`, `schemas/`).
