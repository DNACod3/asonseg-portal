# State

**Last Updated:** 2026-05-23
**Current Work:** Board do GitHub Project populado a partir do spec-driven (épicos/US/tasks)

---

## Recent Decisions (Last 60 days)

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
