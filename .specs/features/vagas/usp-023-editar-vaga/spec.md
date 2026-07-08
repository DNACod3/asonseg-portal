# USP-023 — Editar vaga (pausar, arquivar, renovar) — Specification

> **Fonte da verdade upstream (adaptar, não re-derivar).** Os requisitos funcionais vivem nos artefatos ICE —
> `docs/IDSD/ice-portal-asonseg/intents/intent-USP-023.md` + `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-023.md`
> (card da `matriz-conexoes.md`). Os IDs **E-001..E-005 / P-001..P-006 / L-001..L-003 / D-001..D-006** são
> **canônicos e verbatim** — esta spec **não os re-deriva**; traduz para o formato bravi e resolve os pontos
> abertos em modo autônomo. IDs locais `U23-*` cobrem só material que o upstream não expressa (guardas de
> arquitetura, tasks).
>
> **Nota sobre ADRs citados.** Intent/expectations citam ADR-0024 (preserva `published_at`) e ADR-0015 (edição
> volta a moderação). **Nenhum dos dois corresponde a um arquivo físico com esse conteúdo**: `0015-*.md` é
> "Empresa entidade sem login"; ADR-0024 não tem arquivo (ADRs 0018–0030 são referenciados sem arquivo —
> débito de doc do projeto). A política canônica vem das **expectations** + do código real + dos ADRs com
> arquivo (0004 auditoria append-only, 0011 máquina de estados de moderação) e das decisões de projeto
> **AD-009/AD-011/AD-012** (`.specs/project/STATE.md`).

- **Issue/board:** Épico 5 — Vagas · **Fase:** 2 · **Prioridade:** Must (P1) · **PRD:** USP-023 / AC-023-1..4
- **Deps (ROADMAP):** USP-020 (vaga publicável existe). **Downstream consumido:** USP-016 (re-moderação).
- **Módulos:** `src/modules/jobs` (+ `moderation` via `transitionContent`) · **UI:** `(app)/empresa/[empresaId]/vagas`.

## Problem Statement

Uma vaga publicada (`ACTIVE`) hoje não tem gestão de ciclo de vida: a Pessoa-responsável não consegue
corrigir o conteúdo, pausar temporariamente, arquivar ao encerrar o recrutamento, nem prorrogar a validade.
Só existem `createJobDraft` + `submitJobForModeration` (USP-020) e não há sequer uma tela onde a empresa veja
suas próprias vagas. A máquina de estados de moderação (`@/modules/moderation`, AD-009/ADR-0011) **já declara**
as transições necessárias (`ACTIVE↔PAUSED`, `ACTIVE→DRAFT`, `ACTIVE→ARCHIVED`), mas nenhuma action as dirige e
o resolvedor de evento de auditoria (`eventTypeFor`) devolve `null` para todas elas — travando qualquer
transição de ciclo de vida com `INTERNAL`. Além disso, `Job.publishedAt` nunca é gravado, então "preservar a
data de publicação original ao re-aprovar" (anti-manipulação de ranking) ainda não funciona.

## Goals

- [ ] **G1** — A Pessoa-responsável **ativa** da Empresa dona pode **editar** os campos informativos de uma vaga
      `ACTIVE`: o sistema move para `DRAFT`, grava log antes/depois e a vaga exige nova moderação (USP-016)
      antes de voltar a `ACTIVE` (E-001).
- [ ] **G2** — Pode **pausar** (`ACTIVE→PAUSED`) e **despausar** (`PAUSED→ACTIVE`) sem re-moderação; a vaga
      pausada some da busca e, no detalhe por URL, exibe "vaga temporariamente pausada" com "candidatar-se"
      desabilitado (E-002/P-003).
- [ ] **G3** — Pode **arquivar** (`ACTIVE→ARCHIVED`, terminal): a vaga sai de qualquer listagem pública e não
      pode ser reativada como `ACTIVE` (E-003/P-006); histórico de candidaturas preservado.
- [ ] **G4** — Pode **prorrogar a validade** de uma vaga `ACTIVE` (nova `validUntil` futura ≤ teto) **sem**
      re-moderação — prorrogação é metadata, a vaga segue `ACTIVE` (E-004).
- [ ] **G5** — Toda ativação (1ª aprovação **e** re-aprovação pós-edição) **preserva o `published_at` original**
      (grava só na 1ª vez) — vaga editada não ressurge ao topo da busca (E-005/P-001/D-006).
- [ ] **G6** — Todas as operações são restritas ao responsável ativo (P-005/D-005) e cada transição é auditada
      com responsável, data/hora e motivo opcional (L-003).
- [ ] **G7** — Superfície de gestão em `(app)/empresa/[empresaId]/vagas`: lista das vagas da Empresa (todos os
      status) com ações contextuais + tela de edição, com o Design System (AD-014) onde há primitivo.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Adicionar valores ao enum `ContentStatus` ou arestas à FSM | **Já existem** — `PAUSED/ARCHIVED/DRAFT` no enum e `ACTIVE↔PAUSED`, `ACTIVE→DRAFT`, `ACTIVE→ARCHIVED` em `TRANSITIONS[JOB]`. Nada a migrar na FSM. |
| Migração para `published_at` | A coluna **já existe** (`jobs.published_at`, nullable). O trabalho é gravá-la no adapter na 1ª ativação — não há migração. |
| USP-016 (moderar/re-moderar) | Consumida como downstream (`submitJobForModeration` já existe); a decisão do coordenador é da USP-016, não implementada aqui. |
| USP-024 (expiração automática / `EXPIRED`) | USP separada (mesma unidade Fase 2); só compartilha a correção do `eventTypeFor` kind-aware. |
| Notificar candidatos na re-moderação por edição (P-004) | **Resolvido pelo dono (N/A):** candidaturas seguem sem atrito, sem notificação. |
| Teto de nº de prorrogações / alerta (P-002) | **Resolvido pelo dono (N/A):** prorrogação livre. A data ainda respeita o teto de validade (`MAX_VALIDADE_DIAS=180`, USP-020). |
| A **ação** de candidatar-se e sua rejeição a vaga não-ativa (parte de P-003 "candidatura silenciosa via API") | A action de candidatura é **USP-025** (não existe). P-003 é enforced on-read aqui; a defesa na action de escrita é must-not **herdado** pela USP-025. |
| Novos primitivos de DS (Dialog/Select/Toast/AlertDialog) | Não existem em `@/shared/ui`; criá-los é foundation work fora do escopo. A UI reusa o padrão in-repo (controles nativos + tokens; confirmação destrutiva hand-rolled como em `EditCompanyForm`). |

---

## Assumptions & Open Questions

Modo autônomo — ambiguidades resolvidas como decisões de spec (owner `agent`), ancoradas nas expectations, no
código real e em AD-009/AD-011/AD-012. Nada segue silenciosamente indefinido.

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| **Editar vaga ACTIVE força re-moderação.** Qualquer edição de campo informativo → `DRAFT` → nova moderação antes de `ACTIVE` (E-001/AC-023-1). Prorrogar validade **não** força (metadata, E-004); pausar/despausar/arquivar não tocam conteúdo → sem re-moderação. | agent | Edição de conteúdo re-modera; prorrogação/pausa/arquivar não. | Fiel a E-001/E-004 e ao comentário `// editar` da FSM (`ACTIVE→DRAFT`). Preserva curadoria. | y |
| **`editJob` é atômico (campos + status numa tx), fora do `transitionContent`.** `transitionContent` não expõe hook para mutar campos da entidade; então `editJob` faz, dentro de **um** `withAudit(JOB_EDITED_AFTER_APPROVAL)`, `tx.job.updateMany({where:{id,status:ACTIVE},data:{...campos,status:DRAFT,lastStatusChangeAt}})` (concorrência otimista por `status=ACTIVE`), gravando before/after. | agent | Exceção arquitetural documentada + testada (guarda de arquitetura). A UI encadeia `editJob`→`submitJobForModeration`. | Conteúdo+status devem cair na mesma tx (E-001/L-003); a precondição `status=ACTIVE` é o guard da transição (única origem legal de edição). | y |
| **Edição NÃO exige justificativa.** Remover `JOB_EDITED_AFTER_APPROVAL` de `JUSTIFICATION_REQUIRED_EVENTS` (hoje está lá) — senão `withAudit` bloquearia a edição. | agent | Editar sem motivo obrigatório; motivo é opcional (L-003). | Intent F4 = sem atrito; E-001 pede só log antes/depois. | y |
| **`published_at` preservado no adapter.** `PrismaJobStatusRepository.updateStatus`, quando `to=ACTIVE`, grava `published_at = COALESCE(published_at, now())` (SQL raw, mesma concorrência otimista `WHERE id AND status=from`). | agent | Correção no único ponto de escrita de status; vale p/ 1ª ativação (USP-020) e re-aprovação (USP-023). | Qualquer caminho de ativação herda E-005/P-001/D-006 sem código no fluxo de edição. Hoje `published_at` nunca é gravado (gap confirmado). | y |
| **`eventTypeFor` kind-aware + `from`.** Tornar `eventTypeFor(contentKind, from, to, trigger)`; mapear, para `JOB`: `PAUSED→JOB_PAUSED`, `ARCHIVED→JOB_ARCHIVED`, `(from=PAUSED)ACTIVE→JOB_UNPAUSED`. Adicionar evento `JOB_UNPAUSED` ao catálogo (JOB_PAUSED/ARCHIVED já existem). Atualizar o call site em `transition-content.ts`. | agent | Assinatura kind-aware; ramo JOB; novo evento `JOB_UNPAUSED`. | `eventTypeFor` hoje devolve `null` p/ PAUSED/ARCHIVED e p/ ACTIVE não-moderador → trava a transição com `INTERNAL`. `from` distingue unpause (PAUSED→ACTIVE) de aprovação (IN_MODERATION→ACTIVE). | y |
| **`extendJobValidity` fora do `transitionContent`.** Não há transição de status (vaga segue `ACTIVE`); é `withAudit(JOB_VALIDITY_EXTENDED)` com `updateMany({where:{id,status:ACTIVE},data:{validUntil,...}})`, validando `validadeStatus` (futura ≤ 180d). Adicionar evento `JOB_VALIDITY_EXTENDED`. | agent | Prorrogação é metadata; sem FSM. Novo evento de auditoria. | E-004: prorrogação não muda conteúdo nem status. Reusa `validadeStatus`/`MAX_VALIDADE_DIAS`. | y |
| **Gate de responsável compartilhado.** Extrair `isActiveResponsible(personId, companyId)` (hoje local em `submit-job-for-moderation.ts`) para `jobs/server/require-active-responsible.ts`, exportar via barrel, reusar nas 5 actions + refatorar o submit. Erro `FORBIDDEN` **antes** de qualquer persistência. | agent | Um gate único P-006 p/ as 5 actions. | P-005/D-005 (anti-bypass) precisam de um ponto único e testável; evita divergência. | y |
| **Detalhe de vaga PAUSED.** `getActiveJobDetail` continua retornando `null` para não-`ACTIVE` (preserva U22-MN-03). O **page** do detalhe, quando recebe `null`, consulta uma nova query leve `getPausedJobNotice(id)` para distinguir "vaga temporariamente pausada" (PAUSED, empresa verificada) de "vaga encerrada" (demais). | agent | Query aditiva; página decide a mensagem; sem tocar o contrato testado de `getActiveJobDetail`. | P-003 pede mensagem específica p/ PAUSED sem quebrar a anonimização/on-read da USP-022. | y |
| **Lista de gestão = nova query owner-scoped.** Não existe query "minhas vagas". Criar `listCompanyJobs(companyId, viewer)` retornando as vagas da Empresa (todos os status) para o responsável ver a própria org (dado próprio → sem anonimização), com `take` obrigatório. | agent | Query owner-scoped + view model leve `viewCompanyJobRow`. | Painel de gestão precisa ver DRAFT/PAUSED/ARCHIVED/etc.; é dado da própria Empresa (CLAUDE.md permite acesso ao próprio dado). | y |
| **UI sem novos primitivos de DS.** Reusar `Button`/`Card`/`Badge`/`Input`/`Textarea` de `@/shared/ui`; selects/date nativos com classes de token (padrão `JobForm`); confirmação de arquivar hand-rolled (padrão `EditCompanyForm`, `role="dialog" aria-modal`). | agent | Sem Dialog/Select/Toast/AlertDialog novos. | Não existem no barrel; criar é foundation fora do escopo (AD-014/AD-015 realidade). | y |

**Open questions:** none — todas resolvidas ou registradas acima. Nenhum item de owner externo → **entry gate limpo**.

---

## User Stories

### P1: Editar vaga ativa → rascunho + re-moderação, preservando published_at ⭐ MVP

**User Story**: Como Pessoa-responsável ativa da Empresa, quero editar os campos de uma vaga publicada, para
corrigir o anúncio — sabendo que ela volta a rascunho e passa por nova moderação antes de reaparecer.

**Why P1**: É o coração da US (AC-023-1) e onde mora a proteção anti-ranking (E-005/P-001).

**Acceptance Criteria** (E-001, E-005, P-001, P-005, L-003):

1. QUANDO o responsável ativo edita qualquer campo informativo de uma vaga `ACTIVE` ENTÃO o sistema DEVE, numa
   única transação, gravar os campos novos, mudar `status` para `DRAFT`, gravar auditoria
   `JOB_EDITED_AFTER_APPROVAL` com `before`/`after`, e retornar `ActionResult` `{ jobId, status: 'DRAFT' }`.
2. QUANDO a vaga editada é re-submetida (`submitJobForModeration`) e re-aprovada (coordenador, `→ACTIVE`) ENTÃO
   o sistema DEVE **preservar o `published_at` original** (não sobrescrever) — a vaga não sobe na ordenação da
   busca (E-005/P-001/D-006).
3. QUANDO a 1ª ativação de uma vaga ocorre (`published_at` ainda nulo) ENTÃO o sistema DEVE gravar
   `published_at = now()`.
4. QUANDO uma Pessoa **sem** vínculo `RESPONSIBLE` ativo tenta editar ENTÃO o sistema DEVE retornar `FORBIDDEN`
   sem qualquer escrita (P-005/D-005).
5. QUANDO a vaga não está `ACTIVE` (já `DRAFT`/`PAUSED`/`ARCHIVED`) ENTÃO `editJob` DEVE recusar (precondição/
   conflito), sem escrita — só vaga ativa é editável por este fluxo.

**Independent Test**: integração — responsável edita descrição de vaga `ACTIVE` → `DRAFT` + `JOB_EDITED_AFTER_APPROVAL`
before/após; fluxo completo edit→submit→approve preserva `published_at`; edição de 1 caractere não muda a data
(D-006); não-responsável → `FORBIDDEN`.

---

### P1: Pausar / despausar vaga (sem re-moderação) ⭐ MVP

**User Story**: Como responsável, quero pausar uma vaga quando não tenho capacidade de processar candidaturas e
despausá-la depois, sem passar por nova moderação.

**Why P1**: AC-023-2; operação leve de rotina.

**Acceptance Criteria** (E-002, P-003, P-005):

1. QUANDO o responsável ativo pausa uma vaga `ACTIVE` ENTÃO o sistema DEVE transicionar `ACTIVE→PAUSED` via
   `transitionContent` (`AUTHOR_ACTION`), gravar `JOB_PAUSED`, e a vaga DEVE sumir da busca pública (a query já
   filtra `status='ACTIVE'`).
2. QUANDO o responsável ativo despausa uma vaga `PAUSED` ENTÃO o sistema DEVE transicionar `PAUSED→ACTIVE` via
   `transitionContent`, gravar `JOB_UNPAUSED`, **sem** nova moderação, e a vaga volta à busca.
3. QUANDO alguém abre por URL o detalhe de uma vaga `PAUSED` (empresa verificada) ENTÃO a página DEVE exibir
   "vaga temporariamente pausada" e **não** exibir o botão "candidatar-se" ativo (P-003).
4. QUANDO uma Pessoa sem vínculo responsável ativo tenta pausar/despausar ENTÃO o sistema DEVE retornar `FORBIDDEN`.

**Independent Test**: integração — pausa → `PAUSED`+`JOB_PAUSED`, some de `searchJobs`; despausa → `ACTIVE`+`JOB_UNPAUSED`;
E2E/integração de detalhe: URL de vaga `PAUSED` → mensagem "temporariamente pausada", sem botão candidatar.

---

### P1: Arquivar vaga (terminal) ⭐ MVP

**User Story**: Como responsável, quero arquivar uma vaga quando o cargo foi preenchido, para tirá-la do ar
permanentemente sem apagar o histórico.

**Why P1**: AC-023-3; encerramento do ciclo.

**Acceptance Criteria** (E-003, P-006, P-005):

1. QUANDO o responsável ativo arquiva uma vaga `ACTIVE` ENTÃO o sistema DEVE transicionar `ACTIVE→ARCHIVED` via
   `transitionContent`, gravar `JOB_ARCHIVED`, e a vaga DEVE sair de qualquer listagem pública.
2. QUANDO se tenta reativar uma vaga `ARCHIVED` para `ACTIVE` (direto) ENTÃO o sistema DEVE recusar com
   `INVALID_TRANSITION` — arquivamento é terminal (P-006; a FSM não tem aresta `ARCHIVED→*`).
3. QUANDO uma vaga é arquivada ENTÃO o histórico de candidaturas DEVE ser preservado (nada apagado).
4. QUANDO uma Pessoa sem vínculo responsável ativo tenta arquivar ENTÃO o sistema DEVE retornar `FORBIDDEN`.

**Independent Test**: integração — arquiva → `ARCHIVED`+`JOB_ARCHIVED`; tentativa `ARCHIVED→ACTIVE` → `INVALID_TRANSITION`;
candidaturas intactas; não-responsável → `FORBIDDEN`.

---

### P1: Prorrogar validade (sem re-moderação) ⭐ MVP

**User Story**: Como responsável, quero estender a data de validade de uma vaga ainda ativa, para continuar
recrutando sem refazer o anúncio.

**Why P1**: AC-023-4; ajuste rápido.

**Acceptance Criteria** (E-004, P-005, L-002 N/A):

1. QUANDO o responsável ativo prorroga a validade de uma vaga `ACTIVE` com uma data futura ≤ `MAX_VALIDADE_DIAS`
   (`America/Sao_Paulo`) ENTÃO o sistema DEVE atualizar `validUntil`, manter `status=ACTIVE` (sem transição),
   gravar `JOB_VALIDITY_EXTENDED`, e retornar sucesso — **sem** re-moderação.
2. QUANDO a nova data é passada ou excede o teto ENTÃO o sistema DEVE retornar `VALIDATION` (reusa `validadeStatus`).
3. QUANDO o responsável prorroga várias vezes seguidas ENTÃO o sistema DEVE aceitar todas (prorrogação livre,
   sem teto de quantidade — P-002 N/A).
4. QUANDO uma Pessoa sem vínculo responsável ativo tenta prorrogar ENTÃO o sistema DEVE retornar `FORBIDDEN` (D-005).

**Independent Test**: integração — prorroga `ACTIVE` com data futura → `validUntil` novo, status `ACTIVE`,
`JOB_VALIDITY_EXTENDED`; data passada/>180d → `VALIDATION`; 3 prorrogações seguidas OK; não-responsável → `FORBIDDEN`.

---

### P1: Painel de gestão de vagas da Empresa (lista + ações) ⭐ MVP

**User Story**: Como responsável, quero uma tela com as vagas da minha Empresa e as ações certas por status,
para gerenciar todo o ciclo num só lugar.

**Why P1**: Sem a superfície, nenhuma das ações acima é alcançável pela empresa (hoje só existe `/vagas/nova`).

**Acceptance Criteria** (E-001..E-004, P-005):

1. QUANDO o responsável ativo abre `(app)/empresa/[empresaId]/vagas` ENTÃO o sistema DEVE listar as vagas da
   Empresa (todos os status) com ações contextuais: `ACTIVE` → editar/pausar/arquivar/prorrogar; `PAUSED` →
   despausar/arquivar/editar; `DRAFT`/`AWAITING_ADJUSTMENTS` → editar/submeter; `ARCHIVED`/`EXPIRED` → sem ações
   de reativação.
2. QUANDO uma Pessoa **não** responsável ativa acessa a rota ENTÃO o sistema DEVE responder `notFound()` (404),
   sem revelar a existência da Empresa (P-005, defesa em profundidade na borda).
3. QUANDO o responsável aciona editar ENTÃO abre `/vagas/[jobId]/editar` (reusa o padrão `JobForm`), cujo submit
   encadeia `editJob` → `submitJobForModeration`; ações leves (pausar/despausar/prorrogar/arquivar) disparam as
   actions de PR-A, com confirmação para arquivar.
4. A UI DEVE usar os primitivos de `@/shared/ui` onde existem (`Button`/`Card`/`Badge`) e o padrão in-repo para
   o resto (sem novos primitivos de DS).

**Independent Test**: E2E — responsável vê suas vagas com ações coerentes ao status; não-responsável → 404;
editar → rascunho → moderação; pausar some da busca e volta ao despausar; arquivar pede confirmação.

---

## Edge Cases

- QUANDO se tenta editar/pausar/prorrogar uma vaga já não-`ACTIVE` ENTÃO a action DEVE recusar
  (precondição/`INVALID_TRANSITION`/conflito otimista `count!==1`) sem escrita parcial.
- QUANDO duas edições/transições concorrem sobre a mesma vaga ENTÃO só uma casa (`updateMany where status=from`,
  `count===1`); a outra recebe conflito → `INVALID_TRANSITION`.
- QUANDO a edição não altera nenhum campo (1 caractere) ENTÃO o fluxo ainda re-modera e **preserva** `published_at`
  ao re-aprovar (D-006).
- QUANDO a vaga `PAUSED` é acessada por URL ENTÃO exibe "temporariamente pausada" (não 404, não "encerrada");
  `ARCHIVED`/`DRAFT` continuam `null`→"vaga encerrada" (contrato USP-022 preservado).
- QUANDO se prorroga com a MESMA data atual ENTÃO `validadeStatus` decide (data futura ≤ teto ⇒ OK).

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, por qualquer caminho. Cada um exige um teste negativo asseverando que o resultado
proibido não ocorre. (`P-002` e `P-004` upstream = **N/A**, resolvidos pelo dono — ver Out of Scope.)

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| **P-001** | QUANDO uma vaga editada é re-aprovada ENTÃO o sistema NÃO DEVE alterar o `published_at` original. | Manipulação de ranking via "edição cosmética + re-moderação" (F1 do intent). | T1 (adapter) + T6 (editJob) | Integração: fluxo edit→submit→approve mantém `published_at` igual ao da 1ª ativação (`@e-005`/`@p-001`/`@d-006`). |
| **P-003** | QUANDO o detalhe de uma vaga `PAUSED` é renderizado ENTÃO o sistema NÃO DEVE omitir a mensagem "vaga temporariamente pausada" nem exibir "candidatar-se" ativo; nem aceitar candidatura silenciosa via API. | Candidato confuso via link salvo / candidatura a vaga pausada (F3). | T7 (detalhe) + herdado USP-025 (action) | Integração/E2E: detalhe de vaga `PAUSED` mostra a mensagem, botão candidatar ausente/desabilitado (`@p-003`). |
| **P-005** | QUANDO uma Pessoa **sem** vínculo `RESPONSIBLE` **ativo** da Empresa dona tenta editar/pausar/despausar/arquivar/prorrogar ENTÃO o sistema NÃO DEVE executar a operação — retorna `FORBIDDEN`, sem escrita. | Ação sobre vaga de outra Empresa / bypass de autorização (ADR-0014). | T2 (gate) + T3..T6 | Integração p/ cada action: não-responsável → `FORBIDDEN` e zero escrita (`@p-005`/`@d-005`). |
| **P-006** | QUANDO uma vaga está `ARCHIVED` ENTÃO o sistema NÃO DEVE permitir reativá-la como `ACTIVE` diretamente. | Ressurreição de vaga terminal (F análogo RP-005). | T4 (archive) | Integração: `transitionContent(ARCHIVED→ACTIVE)` → `INVALID_TRANSITION`; a FSM não tem aresta a partir de `ARCHIVED` (`@p-006`). |
| **U23-MN-07** | QUANDO qualquer código do módulo `jobs` (fora do `editJob`) escreve `Job.status` sem `transitionContent` ENTÃO isso NÃO DEVE existir — `editJob` é a única exceção documentada e escreve status só com `where status=ACTIVE`. | Bypass silencioso da FSM / mudança de status não auditada. | T6 (editJob) | Guarda estática (`node:fs`): nenhum `job.update*`/`$executeRaw` grava `status` fora de `PrismaJobStatusRepository`/`editJob`; `editJob` só com `status:ACTIVE` no `where` (`@u23-mn-07`). |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| E-001 / AC-023-1 (upstream) | P1 Editar | Tasks | Pending |
| E-002 / AC-023-2 (upstream) | P1 Pausar | Tasks | Pending |
| E-003 / AC-023-3 (upstream) | P1 Arquivar | Tasks | Pending |
| E-004 / AC-023-4 (upstream) | P1 Prorrogar | Tasks | Pending |
| E-005 (upstream, anti-ranking) | P1 Editar | Tasks | Pending |
| P-001 (upstream) | P1 Editar | Tasks | Pending |
| P-003 (upstream) | P1 Pausar + herdado USP-025 | Tasks | Pending |
| P-005 / D-005 (upstream) | todas | Tasks | Pending |
| P-006 (upstream) | P1 Arquivar | Tasks | Pending |
| L-003 (upstream) | todas | Tasks | Pending |
| U23-MN-07 (local) | P1 Editar (guarda) | Tasks | Pending |
| P-002 / P-004 (upstream) | — | N/A (resolvido pelo dono) | Closed |

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 11 requisitos ativos rastreados (10 upstream + 1 must-not local); 2 upstream N/A. Todos mapeados a tasks no `tasks.md`.

---

## Success Criteria

- [ ] Editar vaga `ACTIVE` → `DRAFT` + `JOB_EDITED_AFTER_APPROVAL` (before/após); re-aprovar preserva `published_at`.
- [ ] Pausar/despausar sem re-moderação (`JOB_PAUSED`/`JOB_UNPAUSED`); vaga pausada some da busca e mostra mensagem no detalhe.
- [ ] Arquivar é terminal (`JOB_ARCHIVED`); `ARCHIVED→ACTIVE` recusado; histórico preservado.
- [ ] Prorrogar mantém `ACTIVE` sem re-moderação (`JOB_VALIDITY_EXTENDED`); data inválida → `VALIDATION`.
- [ ] Todas as 5 actions negam não-responsável com `FORBIDDEN` (gate único).
- [ ] Painel `(app)/empresa/[empresaId]/vagas` lista e opera as vagas da Empresa; 404 para não-responsável.
- [ ] Os 5 must-nots ativos têm teste negativo verde; gates `typecheck`, `lint`, `test` (unit + `*.int.test.ts`), `build`.
</content>
