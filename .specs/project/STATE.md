# State

**Last Updated:** 2026-06-20
**Current Work:** USP-022 (Ver detalhe da vaga, #172) — **KICKOFF** (timer rodando, Status=In Progress, gate de entrada ICE ✅). Spec/design/tasks gerados em `.specs/features/vagas/usp-022-detalhe-vaga/` (4 tasks, ~20h, AD-012). Plano **aprovado** pelo Dev Sênior; board em 4 sub-issues (#276/#173/#277/#278). Próximo: Execute da T1 (#276). Branch `feat/usp-022-detalhe-vaga` (a partir do master, USP-021 já mergeada).

**Hist. anterior:** USP-017 (Validar Empresa na 1ª vaga, #155) — **DEV COMPLETO** (não commitado). #156 (backend) + #157 (UI) implementados. Gates verdes: typecheck ✓, lint ✓, 665 unit ✓, 192 integração ✓ (Postgres local). **Pendente:** branch/PR + protocolo OpenWolf de fechamento. ⚠️ Mudanças estão na working tree do branch `feat/usp-020-publicar-vaga` (USP-020 ainda NÃO mergeada em master) — USP-017 depende do model `Job` da USP-020, então a PR de USP-017 deve **empilhar** sobre a branch da USP-020 (ou ser desenvolvida após o merge da 020).

**Resumo da entrega USP-017:** #156 — migração `Company` (+`verifiedAt/By/JobId`, `verifiedSnapshot Json`, `rejectionCount`); `PrismaCompanyVerifyHook` real (substitui o stub) com `onContentActivated` (verifica 1ª vaga: marca+snapshot dentro do tx + `COMPANY_VERIFIED`) e `onContentRejected` (incrementa contador); snapshot lido dentro do tx (P-004); idempotência via `isVerified` (E-004/AD-2); `recordAuditEvent` extraído do `withAudit` p/ evento secundário no mesmo tx; guard estático P-005/D-004 (`no-external-verify.test.ts`). #157 — `viewModerationQueue` une vagas reais (`jobs`) ao fixture e popula `companyUnverified`/`companyId`; `CompanyVerificationContext` (View Model + diff D-006); `listCompanyRejections` (histórico via audit_log); `VerificationPanel` (banner, dados, checklist P-001 que bloqueia aprovar, separação P-002, histórico P-003, estado verificado E-004, diff D-006) integrado à `ModerationQueue` + página. Checklist com itens de fonte configurável (`verification-checklist.ts`, R3); conteúdo definitivo = D-001 (gate de produção).

**Histórico USP-013:** concluída e mergeada (backend #266/#268, UI #131/#268). Schema `status`, invariante, outbox/e-mail entregues.

**Histórico recente:** USP-016 (Moderar rascunho, #117) concluída e mergeada (fundação `moderation`).

**Parked:** USP-009 (Cadastro de candidato, #31) — só kickoff feito (timer parado em 1.0h, 2026-06-10). Será retomada **somente após a conclusão da USP-016** (a 016 entrega `moderation.transitionContent`, que destrava o #44 da 009 — GAP-1 da USP-009).

---

## Recent Decisions (Last 60 days)

### AD-012: USP-022 — introduzir a tabela `applications` (só contagem) + materializar must-nots sub-especificados (kickoff 2026-06-20)

**Decision:** USP-022 (#172) entrega o detalhe da vaga. Gate de entrada ICE **passou** (sem Q-aberta/ADR Proposed/premissa aberta; upstream USP-021 em master). Classificada **Large** (ICED + must-nots P-001..P-005). A tabela `applications` do TD §4.5 **não existe** — `#162` (schema USP-020) criou só `Job`/`JobArea`/`Region`/`ContentStatus`; `JOB_APPLICATION` é só valor de enum de auditoria. Como a USP-022 é a **primeira** que precisa contar candidaturas (E-003), ela **introduz a tabela `applications` mínima** (id, candidatoId→Person, jobId→Job, `cancelledAt DateTime?` null=ativa, createdAt, `@@index([jobId, cancelledAt])`). O caminho de **escrita** (candidatar/cancelar), o índice único parcial de unicidade e o vínculo de encaminhamento (FK `Referral`, model inexistente) ficam para **USP-025/044**. Detalhe filtra **on-read** reusando o `where` de `search-jobs.ts` (`ACTIVE AND validUntil>=hojeSP AND company.isVerified`) → retorna `null` se não casa (estado "vaga encerrada", E-005/P-004/P-005). `viewJobDetail` é a **única fonte de anonimização** (ADR-0022), consumida pela página **e** pelo `generateMetadata`/JSON-LD (P-002 em todos os canais). Contador só com N≥3 (`APPLICATION_COUNTER_THRESHOLD`, P-001).
**Reason:** O card aponta `applications (contador)` como schema da USP-022 (TD §4.5); contar sem a tabela seria fabricação. Mesmo padrão de AD-011 (USP-021 estendeu o `Job` que a USP-020 criou) — a US que precisa primeiro cria a infra mínima. O board `#173` (6h, single task) sub-especificou: faltavam schema, limiar do contador (P-001), anonimização de metadados/JSON-LD (P-002), estados não-ativos (E-005) e CTA "ativar candidato" (E-004).
**Trade-off:** Cresce de 6h (#173) para ~20h (4 tasks: schema applications, query+view, página+estados+CTAs, metadados). Épico #6 163h→~177h. USP-025 terá de **estender** `applications` (re-migração aceita e explícita). T3/T4 compartilham `page.tsx` → sequenciais.
**Impact:** Desbloqueia USP-025 (candidatar-se, downstream). Forma de `applications` definida aqui passa a vincular a USP-025. Spec/design/tasks em `.specs/features/vagas/usp-022-detalhe-vaga/`. **Status:** plano aguarda aprovação do Dev Sênior antes do Execute (ICE must-not).

### AD-011: USP-021 — estender o schema `Job` ao contrato canônico do TD §4.5 + busca `unaccent` (kickoff 2026-06-20)

**Decision:** USP-021 (#169) entrega os **6 filtros** dos expectations (E-002): área, escolaridade, tipo de contrato, regime, faixa de salário, região. O `Job` implementado na USP-020 divergiu do TD §4.5 (simplificou para `salary`/`location`/`workRegime` freetext, sem escolaridade/contrato/faixa-salário/região-FK/`salaryVisible`). Decisão do dono (2026-06-20): **estender o schema AGORA** — migração adicionando `educationLevelRequired?`, `contractType`, `salaryMin?`/`salaryMax?`/`salaryVisible`, `regionId`+relação `Region` (taxonomia já existe no schema), preservando colunas existentes/nullable (padrão rascunho da USP-020). Reabre o `JobForm` da USP-020 (#165) para coletar os novos campos. Busca textual sem acento (E-003) via **extensão Postgres `unaccent`** + índice funcional (GIN/trigram), filtrando no DB sobre `título+descrição+requisitos` (runbook-search-pagination). `salaryVisible=false` omite salário no View Model anônimo e autenticado.
**Reason:** O card aponta TD §4.5 como fonte; entregar só 4 filtros deixaria a USP fora do contrato. `unaccent` no DB respeita paginação obrigatória (não filtra em memória) e escala além do volume MVP (<30 vagas). Region já está modelada — só faltava a FK no Job.
**Trade-off:** Cresce além das 12h do board (migração + backfill + reabertura do form da USP-020). Estimativa revisada ~22h; board precisa de subtask extra (migração/seed) além de #170 (query+view) e #171 (UI). Vagas existentes (seed) precisam de backfill dos novos campos NOT NULL → tornar `contractType`/`regionId` opcionais ou backfillar no seed.
**Impact:** Marca o vetor de descoberta (suporte a MP6); desbloqueia USP-022 (detalhe) e USP-025 (candidatura). Anonimização no serializer (ADR-0022) cobre F1/P-001. Spec/design/tasks em `.specs/features/vagas/usp-021-buscar-vagas-publica/`.

### AD-010: USP-017 — verificação de Empresa reusa a infra já cabeada pela USP-016 (kickoff 2026-06-19)

**Decision:** USP-017 (#155) NÃO cria caminho novo de efeito colateral — o `transitionContent` já chama `COMPANY_VERIFY_HOOK_TOKEN.onContentActivated(tx, …)` dentro do `tx` quando `to=ACTIVE` (`moderation/actions/transition-content.ts:106-113`, legado da USP-016/GAP-4), o evento `COMPANY_VERIFIED` já existe (`audit/events.ts:46`), `Company.isVerified` já existe e o DTO da fila já tem `companyUnverified?`. O trabalho real: (#156) migração com `verifiedAt`/`verifiedByPersonId`/`verificationJobId`/`verifiedSnapshot Json`/`rejectionCount`, adapter real `PrismaCompanyVerifyHook` (substitui o stub), idempotência via `isVerified=false` (AD-2, sem contar jobs), snapshot lido **dentro do tx** (P-004), incremento de rejeição (AD-5), guard P-005; (#157) painel+checklist+histórico de rejeições+diff de edição. Atomicidade aprovação-vaga↔verificação por ADR-0024. Spec/design/tasks/facts em `.specs/features/moderacao-conteudo/usp-017-validar-empresa-primeira-vaga/`.
**Reason:** A USP-016 deixou o hook como stub explicitamente para a USP-017 (GAP-4). Detectar "1ª vaga" pela própria flag `isVerified` (não por `count(jobs)`) é mais barato e correto sob rebaixamento da USP-015 (volta a `false`). Histórico de rejeições vive no `audit_log` (ADR-0023) — sem tabela nova; `rejectionCount` é só o agregado p/ o badge.
**Trade-off:** Caminho de rejeição pode exigir estender o hook com `onContentRejected` (R2/AD-5) — confirmar em #156.
**Impact:** Marca MP2; desbloqueia exibição de Empresa verificada (USP-027/028/041). Entry gate de DEV aberto; D-001 (conteúdo da checklist) é gate só de produção (ver B-004).

### AD-009: USP-020 — `Job` segue padrão `CandidateProfile` (status na entidade), não `content_items` do TD §4.5 (2026-06-16)

**Decision:** O model `Job` (USP-020 / #162) tem coluna `status ContentStatus @default(DRAFT)` na própria tabela (espelhando `CandidateProfile.publicationStatus`), **NÃO** as tabelas `content_items`/`content_transitions` do TD §4.5 — que **nunca foram implementadas** (USP-009 já divergiu; histórico vive em `audit_log`, ADR-0023). A FSM (`@/modules/moderation`) já suporta `ContentKind.JOB` e `TRANSITIONS[JOB]` (inclui `DRAFT→IN_MODERATION`); falta só registrar um `PrismaJobStatusRepository` no `byKind` do `DispatchingContentStatusRepository` (parte de #164). Dedup exata (P-003/ADR-0021) via índice parcial SQL `WHERE status IN (estados vivos)`. `JobArea`/`Region`/`ContentStatus` já existem (taxonomia US #111). Spec/design/tasks em `.specs/features/vagas/usp-020-publicar-vaga/`.
**Reason:** O schema implementado é a fonte da verdade sobre o TD doc (que descreve o supertipo `content_items` abandonado). Replicar o padrão `CandidateProfile` mantém coerência com o 1º conteúdo real que aterrissou na FSM.
**Trade-off:** Cada conteúdo (Job, Service) carrega seu próprio adapter de status + registro no container — duplicação controlada, mas a FSM/transições permanecem centralizadas.
**Impact:** Vale para todas as USPs de vagas downstream (021–024) e para serviços (029+): mesmo padrão de adapter por `ContentKind`. Fronteira da USP-020 = rascunho + submit→`IN_MODERATION`; verificação atômica da 1ª vaga (P-001) e filtro on-read (P-002/P-007) são USP-016/017/021/024.

### AD-008: USP-014 — remoção reusa `revokedAt`/`revokedBy` + nova coluna `revokeReason`; entrega em PR único (2026-06-16)

**Decision:** A remoção de responsável (USP-014) reusa `revokedAt`/`revokedBy` (não cria `endedAt`/`endedBy` como o body da #135 sugere — `schema.prisma:369-389`, comentário em `:338`). O **motivo** opcional vira **coluna de negócio `revokeReason String?`** no `PersonCompanyGrant` (migração pequena, sem backfill), NÃO um campo no audit_log. O `audit_log` registra o **evento** `COMPANY_RESPONSIBLE_REMOVED` (já catalogado — `audit/events.ts:49,125`). Invariante "≥1 ACTIVE" via regra pura `wouldLeaveCompanyWithoutResponsible` em `domain/grants.ts` (espelha `PrismaCompanyResponsibilityAdapter`). **Toda a US num único PR** (`feat/usp-014-remover-responsavel`) fechando #135 e #137.
**Reason:** O motivo é **atributo de negócio** do ciclo do vínculo (consumível por `reporting`), ao lado de quando/quem. Guardá-lo só no audit_log inverteria a dependência (reporting → auditoria forense) e exigiria extração de JSON numa tabela de alto volume — decisão revista a pedido do usuário (impacto em relatórios/consultas). Coluna nullable é estável, indexável e mantém relatórios desacoplados da auditoria. "Evitar migração" era argumento fraco — o projeto migra de rotina.
**Trade-off:** +1 coluna e +1 migração vs. a proposta inicial; em troca, motivo consultável por `select` e modelo coerente (quando/quem/porquê na mesma linha). Auto-remoção não invalida sessão: ADR-0030 revalida permissão por requisição (acesso cai na próxima navegação).

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

### B-004: Gate de produção D-001 da USP-017 — conteúdo da checklist de verificação (bloqueia go-live, não merge)

**Discovered:** 2026-06-19 (D-001 de `expectations-USP-017.md`, kickoff #155)
**Impact:** Antes da USP-017 ir para **produção**, a **checklist de verificação de Empresa** (critérios objetivos que o coordenador segue p/ aprovar/rejeitar) precisa estar validada **por escrito** (sponsor + coordenador + Bravi PO) e testada com voluntários. Sem ela, RP-005 (empresa-fantasma) fica desprotegido. É o entregável de **Fase 0** `seed-taxonomia-checklists` (AC-111-2).
**Workaround:** Desenvolver/mergear normalmente o **mecanismo** da checklist (P-001 RESOLVIDO — itens marcáveis + dispensa com motivo), lendo os itens de fonte configurável (seed), não hard-coded (R3 do design). O conteúdo é seedado depois sem redeploy.
**Resolution:** Sponsor+coordenador+Bravi PO assinam os itens da checklist; seed populado antes do cutover.

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
