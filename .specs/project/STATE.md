# State

**Last Updated:** 2026-06-15
**Current Work:** USP-013 (Adicionar responsável a uma Empresa, #129) — **Execute em andamento** (2026-06-15). Branch `feat/usp-013-adicionar-responsavel`. **Backend #130 (T1–T4) CONCLUÍDO** com testes verdes (24 testes companies + 10 e-mail) e commits atômicos: T1 schema status+UNIQUE parcial (4f413bc), T2 evento+template+Outbox (617dc68), T3 `adicionarResponsavel` (0fec67f), T4 `aceitarVinculoResponsavel` (74377fa). **Pendente:** abrir PR #130; depois UI #131 (T5 form adicionar + T6 aceitar + E2E). Ver blocker de deploy B-003 (gate D-001) e AD-007 (outbox).

**Histórico recente:** USP-016 (Moderar rascunho, #117) concluída e mergeada (fundação `moderation`).

**Parked:** USP-009 (Cadastro de candidato, #31) — só kickoff feito (timer parado em 1.0h, 2026-06-10). Será retomada **somente após a conclusão da USP-016** (a 016 entrega `moderation.transitionContent`, que destrava o #44 da 009 — GAP-1 da USP-009).

---

## Recent Decisions (Last 60 days)

### AD-007: USP-013 — tabela `Outbox` mínima nesta USP; dispatcher fica na USP-044 (2026-06-15)

**Decision:** O design (ADR-0020/TD §4.6) pede `tx.outbox.create()` para o e-mail de aceite (E-003), mas não existe tabela outbox no código (nem a USP-012 envia e-mail). Criei a model Prisma **`Outbox`** mínima (`topic`/`payload`/`processedAt`/`attempts`/`lastError`) + migration, e `adicionarResponsavel` **enfileira** a linha na mesma transação. O **envio assíncrono real** (dispatcher que consome a fila e chama o `EmailSender`) é da **USP-044** — não foi implementado aqui.
**Reason:** É o que o design literalmente especifica (`tx.outbox.create()`), satisfaz o fact E-003 ("e-mail enfileirado") e respeita a atomicidade do ADR-0020, sem invadir o escopo de envio da USP-044. A pergunta foi levada ao usuário; o tool de decisão falhou tecnicamente e o usuário pediu "continue" → adotado o default mais fiel ao design e de menor risco.
**Trade-off:** O e-mail de aceite não é efetivamente enviado até a USP-044 entregar o dispatcher; no MVP a Pessoa aceita pelo painel (T6). Sem e-mail cadastrado, o vínculo PENDING é criado mas nenhuma linha de outbox é enfileirada.
**Impact:** USP-044 deve consumir `topic='email'` do `Outbox`, despachar via `ResendEmailSender`, marcar `processedAt`/`attempts`/`lastError`, e cobrir retentativa.

### AD-006: USP-013 — modelo pendente+aceite (não criação imediata) (2026-06-12)

**Decision:** O vínculo Pessoa↔Empresa criado por `adicionarResponsavel` nasce **`PENDING`** e só vira **`ACTIVE`** após **aceite explícito** da Pessoa adicionada (`aceitarVinculoResponsavel`). Busca por CPF/e-mail é **binária sem PII** (P-001), restrita a responsável ativo (P-005), com rate limit anti-enumeração (L-002). Schema: adicionar enum `CompanyGrantStatus (PENDING|ACTIVE)` + `pendingAt`/`acceptedAt` ao `PersonCompanyGrant` (hoje append-only sem status) + UNIQUE parcial `WHERE revoked_at IS NULL`. Sub-issues #130/#131 **expandidas** (sem nova sub-issue) para cobrir o fluxo de aceite (action + UI + e-mail).
**Reason:** As ACs originais do PRD/issue ("criação imediata") são vetor LGPD (fracasso de resultado F2 — adição não consentida). A fonte da verdade ICE (intent/expectations + technical-design §4.4/4.5/4.6) já resolveu isso exigindo aceite explícito (P-002). ICE > redação do PRD.
**Trade-off:** Mais escopo que as 2 sub-issues originais previam (action de aceite + UI de aceite + template de e-mail); PRs maiores. `createCompany` (USP-012) passa a gravar `status: ACTIVE` e a invariante "≥1 responsável ativo" conta só `ACTIVE`.
**Impact:** T1 (migration) toca USP-012 e `companiesLeftWithoutResponsible`. Gate jurídico D-001 vira pré-condição de deploy (B-003).

### AD-005: USP-016 — GAP-8 (acesso a status via port + fixture) e GAP-5 (alerta de fila diferido) (2026-06-10)

**Decision:** (1) **GAP-8** — como nenhum model real de conteúdo (`Job`/`Service`/`CandidateProfile`) existe ainda (só `Company`), `transitionContent` e a fila acessam a coluna `status` atrás do port `ContentStatusRepository`, com um adapter Prisma sobre a tabela transitória `_moderation_fixture` (`_`-prefix de infra, cf. `_health_check`) — o "1º tipo a aterrissar". Cada conteúdo real assume seu adapter na própria USP. (2) **GAP-5** — o alerta operacional de fila (>10 pendentes ou item >48h, E-005/P-001) fica **diferido**: sem SLA formal no MVP (TD §8.3).
**Reason:** Entregar a fundação `moderation` agora (destrava USP-009/017/018) sem criar models de conteúdo prematuros que colidiriam com as migrations das USPs donas. O alerta de fila não tem requisito de SLA no MVP.
**Trade-off:** A fila e `transitionContent` operam hoje sobre `_moderation_fixture` (vazio em produção até as USPs de conteúdo popularem via submissão); os adapters reais por tipo são trabalho futuro. Atomicidade real (status+audit na mesma tx) é exercitada nos testes de integração contra a fixture.
**Impact:** Ao desenvolver Job/Service/CandidateProfile, registrar o adapter concreto de cada tipo no `ContentStatusRepository` (despacho por `ContentKind`) e migrar a fila para unir as fontes reais; remover/aposentar `_moderation_fixture`. GAP-3 (e-mail real, USP-044) e GAP-4 (flag `isVerified`, USP-017) trocam os stubs no-op pelos adapters reais.

### AD-004: USP-009 pausada (só kickoff) até a USP-016 concluir (2026-06-10)

**Decision:** A USP-009 (#31) teve **apenas kickoff** (timer = 1.0h, parado). O desenvolvimento da USP-016 (#117) ocorre **antes**; a USP-009 só é retomada após a 016 estar concluída.
**Reason:** A USP-016 entrega `moderation.transitionContent()` + a máquina de estados — exatamente o GAP-1 (bloqueio) do #44 da USP-009. Desenvolver a 016 primeiro destrava a 009 naturalmente.
**Trade-off:** Troca de contexto; o timer da #31 foi parado para não poluir horas/tokens da 009 enquanto se trabalha na 016.
**Impact:** Ao retomar a 009, reiniciar o timer da #31; o kickoff (1.0h) está preservado no comentário da issue.

### AD-001: Estrutura spec-driven derivada da documentação existente (2026-05-23)

**Decision:** Criar `.specs/` a partir dos docs em `docs/` (PRD `prd-asonseg-portal-mvp.md`, `docs/arch/*`, protótipo). 13 épicos → 13 features; faseamento da arquitetura (Fase 0–6 + Lançamento) → milestones do ROADMAP.
**Reason:** Projeto greenfield (sem código) com documentação rica e canônica já existente — o spec-driven formaliza o WHAT/HOW rastreável sobre essa base.
**Trade-off:** Specs por épico geram alguma sobreposição com o PRD; mitigado mantendo specs focadas em ACs testáveis (WHEN/THEN/SHALL) + IDs rastreáveis, não em re-narrar o PRD.
**Impact:** Design.md e tasks.md NÃO foram gerados em massa — serão criados por feature no momento de execução (auto-sizing), quando TESTING.md e decisões de ferramentas existirem.

### AD-003: GitHub Project #3 populado com hierarquia Épico→US→Task (2026-05-23)

**Decision:** Board `DNACod3/asonseg-portal` (project #3) populado a partir do spec-driven: 8 Épicos (1 por fase, #4–#11), 55 User Stories (44 USP do PRD + 11 sintéticas: 4 infra Fase 0, 1 auditoria Fase 1, 2 hardening/LGPD Fase 6, 4 lançamento), 155 Tasks (PRs por camada do módulo). Issue types nativos da org (Epic/User Story/Task), sub-issues para hierarquia, Status=Backlog, Estimate em horas com rollup US=Σtasks e Épico=ΣUS (total **805h**).
**Reason:** Pedido do usuário; alinha o backlog executável ao protocolo OpenWolf (cascade Task→US→Épico).
**Trade-off:** `gh project` (GraphQL) tem rate limit baixo; `set_estimate` via `item-list --limit 800` é caro (~247 pts) — rollup foi centralizado em 1 passada (`/tmp/wolf_rollup.py`) em vez de por-agente.
**Impact:** Cada Task tem corpo agent-ready (objetivo, arquivos, passos, padrões, DoD, testes, commit). Tasks ainda em Backlog; ao iniciar uma, aplicar o protocolo `openwolf-task-protocol-asonseg-portal` (timer + Status In Progress).

### AD-002: Escopo do spec-driven = Portal (Release 1), não Frente 4 (2026-05-23)

**Decision:** O spec-driven cobre o Portal de Empregabilidade e Serviços (`prd-asonseg-portal-mvp.md`). Os PRDs/ADRs de `docs/prd/` sobre beneficiários, famílias e fito (`prd-asonseg-frente4-v2.md`, `prd-asonseg-mvp.md`) são Release 2 e ficam em Future Considerations.
**Reason:** CLAUDE.md define o Portal como o projeto canônico; os 11 módulos de domínio mapeiam ao Portal.
**Trade-off:** A fundação compartilhada (Pessoa unificada, LGPD, auditoria) entregue no MVP serve aos dois releases — registrado em PROJECT.md como meta.
**Impact:** Papéis BENEFICIARY/FAMILY_RESPONSIBLE existem no enum mas estão fora do escopo de implementação do MVP.

---

## Active Blockers

### B-001: DPO não designado (bloqueante para go-live)

**Discovered:** 2026-05-23 (D-001 do PRD)
**Impact:** LGPD exige DPO designado antes do go-live; bloqueia o Lançamento, não o desenvolvimento.
**Workaround:** Desenvolver normalmente; designação deve ocorrer antes da Fase 6 / cutover.
**Resolution:** Sponsor/diretoria designa DPO formalmente.

### B-002: `moderation.transitionContent()` inexistente bloqueava USP-009 #44 — ✅ RESOLVIDO (2026-06-10)

**Discovered:** 2026-06-10 (GAP-1 do design da USP-009)
**Resolved:** 2026-06-10 — USP-016 mergeada entregou `@/modules/moderation` (`transitionContent`, `ContentKind`, `ContentStatus`, `ContentStatusRepository`). O trio da USP-009 foi atualizado (spec/design/tasks/tests).
**Trabalho herdado pela #44 (não é mais bloqueio, é integração — ver AD-005):** adicionar `ContentKind.CANDIDATE_PROFILE` + transições; adapter `PrismaCandidateProfileStatusRepository`; despacho por `ContentKind` no `container.ts`. Resta GAP-2 (evento `CANDIDATE_ROLE_ACTIVATED`) — a submissão já é auditada por `transitionContent` (`CONTENT_SUBMITTED_TO_MODERATION`).

---

### B-003: Gate jurídico D-001 da USP-013 (bloqueia deploy, não merge)

**Discovered:** 2026-06-12 (D-001 de `expectations-USP-013.md`)
**Impact:** Antes da USP-013 ir para **produção**, diretoria + jurídico devem decidir **por escrito** o modelo de aceite (explícito por aceite no painel vs. notificação a posteriori). O design já implementa "aceite explícito" (AD-006), então é confirmação formal, não mudança técnica. Não bloqueia desenvolvimento nem merge.
**Workaround:** Desenvolver e mergear normalmente o modelo pendente+aceite; obter o sign-off antes do cutover/deploy da feature.
**Resolution:** Diretoria/jurídico assinam a decisão do modelo de aceite.

---

## Lessons Learned

_(nenhuma registrada ainda)_

---

## Quick Tasks Completed

| #   | Description | Date | Commit | Status |
| --- | ----------- | ---- | ------ | ------ |

---

## Deferred Ideas

- [ ] Triagem de moderação assistida por LLM (reduzir carga de moderação humana — risco RP-004) — Captured during: bootstrap, mitigação V2
- [ ] Kanban de status de candidatura — Captured during: bootstrap (fora do MVP)
- [ ] Busca semântica/FTS de vagas e serviços — Captured during: bootstrap (MVP usa match exato)

---

## Todos

- [ ] Definir TESTING.md (tipos de teste, comandos de gate, matriz de cobertura) antes de criar tasks.md de qualquer feature — o stack de teste já está definido (Vitest + Playwright) mas a matriz por camada/módulo precisa ser formalizada.
- [ ] Confirmar metas absolutas dos indicadores MP1–MP10 com o sponsor (QP-007 / D-004).
- [ ] Ao iniciar cada feature: gerar design.md (se Large/Complex) e tasks.md, e atualizar status no ROADMAP (PLANNED → IN PROGRESS).

---

## Preferences

**Model Guidance Shown:** never
