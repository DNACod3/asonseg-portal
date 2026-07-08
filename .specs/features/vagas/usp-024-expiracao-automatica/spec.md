# USP-024 — Expiração automática de vaga — Specification

> **Fonte da verdade upstream (adaptar, não re-derivar).** Os requisitos funcionais vivem nos artefatos ICE —
> `docs/IDSD/ice-portal-asonseg/intents/intent-USP-024.md` + `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-024.md`
> (card da `matriz-conexoes.md`). Os IDs **E-001..E-004 / P-001..P-005 / L-001..L-003 / D-001..D-005** são
> **canônicos e verbatim** — esta spec **não os re-deriva**; ela os traduz para o formato bravi e resolve os
> pontos abertos em modo autônomo. IDs locais `U24-*` cobrem só material que o upstream não expressa
> (must-nots formais, tarefas).
>
> **Nota sobre ADRs citados.** Intent/expectations citam ADR-0026 (defesa em profundidade da expiração),
> ADR-0010 e ADR-0015. Só ADR-0010 (`0010-visibilidade-conservadora-view-models.md`) tem arquivo físico;
> ADR-0026 é débito de documentação do projeto (ADRs 0018–0030 são referenciados sem arquivo). A política
> canônica desta spec vem das **expectations** + do código real + dos ADRs com arquivo (0004 auditoria
> append-only, 0011 máquina de estados de moderação, 0013 ISR) e das decisões de projeto **AD-009/AD-011/AD-012**
> (`.specs/project/STATE.md`).

- **Épico:** 5 — Vagas · **Fase:** 2 · **Prioridade:** Must (P1) · **PRD:** USP-024 / AC-024-1..3
- **Deps (ROADMAP):** USP-020 (vaga tem `validUntil`). **Downstream:** USP-021/022 (já ocultam por on-read), USP-044 (e-mail D-3).
- **Módulos:** `src/modules/jobs` (+ `moderation` via `transitionContent`) · **Infra nova:** rota de cron + Vercel Cron.

## Problem Statement

Uma vaga publicada tem `validUntil` (USP-020, teto 180 dias). Quando essa data passa, a vaga deve deixar de
existir na superfície pública — hoje a busca (USP-021, AD-011) e o detalhe (USP-022, AD-012) já filtram
`status='ACTIVE' AND validUntil >= hoje(America/Sao_Paulo)` **on-read**, então a vaga vencida some da view
mesmo que seu `status` persistido continue `ACTIVE`. Falta o outro lado da defesa em profundidade: **materializar**
o estado terminal `EXPIRED` no banco por um job periódico, para que o status persistido reflita a realidade
(painéis internos, relatórios, auditoria) e a vaga vencida não fique "ACTIVE fantasma" indefinidamente. O job
precisa ser idempotente, correto no timezone `America/Sao_Paulo`, observável (falha visível) e nunca apagar
dados históricos.

## Goals

- [ ] **G1** — Um **job periódico** (rota de cron autenticada + Vercel Cron) transiciona toda vaga
      `ACTIVE` com `validUntil < hoje(America/Sao_Paulo)` para `EXPIRED` via `transitionContent()`
      (`SYSTEM_JOB`), auditando cada expiração — idempotente e seguro para re-execução.
- [ ] **G2** — Preservar/confirmar a **defesa em profundidade on-read**: vaga vencida nunca aparece na busca
      pública nem no detalhe navegável, **mesmo que o job atrase ou falhe** (a query já é a fonte da verdade da
      visibilidade — AD-011/AD-012).
- [ ] **G3** — Correção de **timezone**: "data de validade atingida" é determinística em `America/Sao_Paulo`
      (`date-fns-tz`), na fronteira, tanto no job quanto na query on-read (reusa `hojeSaoPaulo()`).
- [ ] **G4** — **Observabilidade**: o job loga início/fim + contagem (pino) e falha de forma visível (retorno
      de erro HTTP + log de erro) para alerta operacional (RNF 6.6 / L-003), sem apagar nada (P-005).
- [ ] **G5** *(P2)* — **Seam de aviso D-3**: enfileirar na `Outbox` (padrão AD-007) o lembrete "expira em 3
      dias" à Empresa-responsável, de forma idempotente; a **entrega** do e-mail é da USP-044 (downstream).
- [ ] **G6** *(P2)* — **Sinal visual no portal**: badge "expira em N dias" no painel de gestão de vagas da
      Empresa (introduzido pela USP-023), para não depender só do e-mail (P-003).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Criar o filtro on-read `validUntil >= hoje` na busca/detalhe | **Já existe** (AD-011 `search-jobs.ts`, AD-012 `getActiveJobDetail`). Esta USP só o **confirma** como must-not (G2/P-001) e reusa `hojeSaoPaulo()`. |
| Adicionar valor `EXPIRED` ao enum ou a aresta `ACTIVE→EXPIRED` à FSM | **Já existem** — `ContentStatus.EXPIRED` (domínio + Prisma `content_status`) e `TRANSITIONS[JOB]` já contêm `ACTIVE→EXPIRED (SYSTEM_JOB)`. Nada a migrar/mudar na FSM. |
| Entrega efetiva do e-mail D-3 (SMTP/Resend, dispatcher da `Outbox`) | Downstream **USP-044**. Aqui só o **enqueue** na `Outbox` (o dispatcher que consome `topic='email'` é da USP-044 — AD-007). |
| Bloqueio da **ação** de candidatar-se a vaga expirada (escrita) | A ação de candidatura é **USP-025** (não existe ainda). P-004 é garantido hoje pela ausência da rota de escrita + on-read; a defesa na própria action fica com a USP-025 (must-not herdado, ver Traceability). |
| Dashboard de saúde da operação / indicador "vagas expiradas hoje" + "última execução do job" (D-005) | Relatórios operacionais são **USP-042** (Fase 6). Aqui a observabilidade é via logs estruturados + logs de execução do Vercel Cron + Sentry (RNF 6.6). |
| Alterar `revalidate`/ISR ou a ordenação da busca | Fora do escopo; a expiração só muda status/visibilidade por dado, não o cache/ordenação. |

---

## Assumptions & Open Questions

Modo autônomo — ambiguidades resolvidas como decisões de spec (owner `agent`), ancoradas nas expectations,
no código real e nas decisões AD-007/AD-009/AD-011/AD-012. Nada segue silenciosamente indefinido.

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| **Mecanismo do job** = uma **Route Handler** Next.js (`app/api/cron/expire-jobs/route.ts`) autenticada por `CRON_SECRET`, agendada por **Vercel Cron** (`vercel.json`), clonando o padrão já existente de `auth-attempts-retention`. | agent | Route Handler + Vercel Cron (não script avulso, não Edge Function externa). | É o mecanismo de cron **já em uso** no projeto (ADR-0002 Vercel); clonar reduz risco e reusa a autenticação por `CRON_SECRET` + o `runbook`. | y |
| **Frequência do cron.** L-001 exige transição ≤ 1h da validade no timezone local. Rodar **de hora em hora** (`0 * * * *`). | agent | `0 * * * *` (hourly). | Atende L-001 (janela ≤1h) com custo trivial; a defesa on-read cobre o intervalo entre execuções. | y |
| **Lote/limite por execução.** O job pagina (`take` obrigatório, project-guideline) e transiciona em loop, uma transição por vaga (cada uma sua tx via `transitionContent`), continuando até esgotar. | agent | Processa em lotes de `take` fixo até acabar; sem transação global. | `transitionContent` é por-item (concorrência otimista); volume MVP é pequeno (<30 vagas). Uma tx global travaria e perderia idempotência por-item. | y |
| **Idempotência da expiração.** Reexecução é segura sem coluna nova: `transitionContent(ACTIVE→EXPIRED)` só casa `updateMany WHERE status=ACTIVE`; vaga já `EXPIRED` não é re-selecionada (query filtra `status=ACTIVE`) e uma corrida devolve `INVALID_TRANSITION` (tratado como no-op). | agent | Sem coluna de controle p/ a expiração; idempotência pela FSM + filtro da query. | A concorrência otimista do `PrismaJobStatusRepository` (`count===1`) já é o mecanismo (ADR-0011 R3). | y |
| **Ator do `SYSTEM_JOB`.** `transitionContent` exige `actorPersonId`. Usar um **ator de sistema** (Person de sistema seedado ou constante `SYSTEM_ACTOR_ID`) para a auditoria da expiração. | agent | `actorPersonId = SYSTEM_ACTOR_ID` (ator de sistema); se não houver Person de sistema, seedar um em `seeds/reference.ts`. | `withAudit` grava `actorPersonId`; expiração não tem Pessoa humana. Ator de sistema mantém a trilha coerente (ADR-0004). | n |
| **Escopo do E-003 (e-mail D-3).** Incluído como **seam de enfileiramento** (P2): grava linha `Outbox` `topic='email'` idempotente por vaga; entrega fica na USP-044. Idempotência via nova coluna `Job.expiryReminderSentAt`. | agent | Enqueue idempotente na `Outbox`; delivery = USP-044. Migração mínima: `Job.expiryReminderSentAt DateTime?`. | Fiel a AD-007 (`Outbox` existe; dispatcher é da USP-044). Sem a coluna, cada execução horária re-enfileiraria o lembrete. | y |
| **Escopo do E-004 (badge "expira em N dias").** Incluído como P2, renderizado no **painel de gestão de vagas da Empresa** que a **USP-023** introduz, via função pura `diasAteExpiracao(validUntil)` no `domain/validade.ts`. | agent | Badge no painel da USP-023; dep de UI soft sobre USP-023. Sem USP-023 mergeada, o cálculo puro existe e é testado, mas não há superfície onde pintar. | P-003 exige sinal in-portal; o painel natural é o da USP-023 (mesma unidade Fase 2). O cálculo é dado puro, testável isolado. | y |
| **Alerta de falha do job (L-003 / RNF 6.6).** Falha ⇒ retorno HTTP 500 + `log.error` estruturado; o alerta operacional apoia-se nos logs de execução do Vercel Cron + Sentry (já provisionados, Fase 0). Sem tabela de heartbeat nesta USP. | agent | Erro visível por HTTP/log + monitores de plataforma; heartbeat/dashboard = USP-042. | Evita infra sobre-dimensionada; o indicador "última execução" (D-005) é relatório (USP-042). | y |
| **P-004 (candidatura a vaga expirada).** A **ação** de candidatar-se não existe (USP-025). Esta USP garante P-004 pela via de leitura (detalhe de vaga expirada → "vaga encerrada", sem botão) e registra P-004 como must-not **herdado** que a USP-025 deve honrar na action de escrita. | agent | Enforce on-read agora; anotar o dever da action p/ USP-025. | Não há rota de escrita a proteger hoje; criar uma seria fora de escopo. | y |

**Open questions:** o ator de sistema para a auditoria (`SYSTEM_ACTOR_ID`) precisa existir/ser seedado — item
`agent`, resolvido no design (seed em `seeds/reference.ts`); não bloqueia (owner interno, sem decisão externa).

---

## User Stories

### P1: Expiração automática materializada por job periódico ⭐ MVP

**User Story**: Como **sistema** (em nome do coordenador responsável pela higiene da lista), quero mudar
automaticamente para `EXPIRED` toda vaga cuja validade passou, para que a lista pública reflita sempre vagas
vigentes e o status persistido não fique "ACTIVE fantasma".

**Why P1**: É o núcleo da USP e o único entregável que precisa de código novo (a ocultação on-read já existe).
Independentemente demonstrável: ajustar `validUntil` para ontem, disparar a rota de cron, ver `status=EXPIRED`
+ evento `JOB_EXPIRED` na auditoria.

**Acceptance Criteria** (E-001, E-002, P-001, P-002, P-005, L-001):

1. QUANDO a rota de cron executa ENTÃO o sistema DEVE selecionar as vagas com `status='ACTIVE'` e
   `validUntil < hoje(America/Sao_Paulo)` (via `hojeSaoPaulo()`) e, para cada uma, chamar
   `transitionContent({ contentKind: JOB, contentId, to: EXPIRED, trigger: 'SYSTEM_JOB', actorPersonId: SYSTEM })`.
2. QUANDO uma vaga é expirada ENTÃO o sistema DEVE gravar o evento de auditoria `JOB_EXPIRED` (before
   `{status:ACTIVE}` / after `{status:EXPIRED}`) na mesma transação da mudança de status (E-001/L-003).
3. QUANDO o cron roda novamente sobre uma vaga já `EXPIRED` ENTÃO o sistema NÃO DEVE re-expirar nem duplicar
   auditoria — a query não a re-seleciona (`status=ACTIVE`) e uma corrida devolve `INVALID_TRANSITION` tratada
   como no-op (idempotência).
3. QUANDO o job atrasa ou falha ENTÃO a busca pública (USP-021) e o detalhe (USP-022) DEVEM continuar ocultando
   a vaga vencida — o filtro on-read `validUntil >= hoje` é a fonte da verdade da visibilidade (P-001, E-002).
4. QUANDO "hoje" é calculado ENTÃO o sistema DEVE usar `America/Sao_Paulo` (`date-fns-tz`), de modo que uma
   vaga válida até 31/12 23:59 (BRT) expire à 00:00 do dia seguinte no fuso local, não em UTC (P-002).
5. QUANDO uma vaga expira ENTÃO o sistema NÃO DEVE apagar fisicamente a vaga nem suas candidaturas — só muda o
   status; o histórico é preservado (P-005, ADR-0004/ADR-0008).

**Independent Test**: `expire-jobs` (integração) — seed com 1 vaga `ACTIVE` vencida + 1 `ACTIVE` vigente + 1 já
`EXPIRED`; executar o handler → a vencida vira `EXPIRED` com `JOB_EXPIRED`; a vigente e a já-expirada ficam
inalteradas; segunda execução não muda nada (idempotência).

---

### P1: Rota de cron autenticada + agendamento Vercel Cron ⭐ MVP

**User Story**: Como operador da plataforma, quero uma rota de cron protegida por segredo e agendada, para que
só o agendador do Vercel dispare a expiração, e a execução seja observável.

**Why P1**: Sem a rota autenticada + o agendamento, a expiração não roda em produção. Espelha exatamente o
padrão `auth-attempts-retention`.

**Acceptance Criteria** (L-001, L-003, RNF 6.6):

1. QUANDO uma requisição chega à rota de cron sem o `Authorization: Bearer ${CRON_SECRET}` esperado ENTÃO o
   sistema DEVE responder `401` e não executar nenhuma expiração (mesma checagem de `auth-attempts-retention`).
2. QUANDO a rota executa com sucesso ENTÃO o sistema DEVE responder JSON com o resumo (`{ expired: N, scanned: M }`)
   e logar início/fim + contagem (pino).
3. QUANDO ocorre erro na execução ENTÃO o sistema DEVE responder `500` e logar `log.error` estruturado, de modo
   que os logs de execução do Vercel Cron + Sentry sirvam de alerta operacional (L-003 / RNF 6.6).
4. O agendamento DEVE estar declarado em `vercel.json` (`crons`), apontando para a rota, com cadência ≤ 1h
   (`0 * * * *`) para satisfazer L-001.

**Independent Test**: chamada sem/`com` `CRON_SECRET` → `401`/`200`; `vercel.json` contém a entrada de cron
apontando para a rota; teste do handler cobre 401, resumo 200 e caminho de erro → 500.

---

### P2: Seam de aviso "expira em 3 dias" (enqueue Outbox) + badge no painel

**User Story**: Como **Pessoa-responsável da Empresa**, quero ser avisada — por e-mail e por sinal visual no
portal — que minha vaga expira em breve, para ter chance de prorrogar (USP-023/E-004) antes de perder o funil.

**Why P2**: Depende de superfícies downstream — entrega de e-mail é USP-044; o painel é introduzido pela
USP-023. O **seam** (enqueue idempotente + cálculo puro do badge) é entregável agora; a materialização final
acompanha essas USPs.

**Acceptance Criteria** (E-003, E-004, P-003, L-002):

1. QUANDO o cron encontra uma vaga `ACTIVE` que expira em exatamente 3 dias (America/Sao_Paulo) e ainda **sem**
   `expiryReminderSentAt` ENTÃO o sistema DEVE enfileirar uma linha `Outbox` `topic='email'`
   (payload com `jobId` + responsável) e marcar `expiryReminderSentAt = now()` na mesma passada (idempotência:
   nunca enfileira duas vezes a mesma vaga).
2. QUANDO a `Outbox` recebe o lembrete ENTÃO a **entrega** fica a cargo do dispatcher da USP-044 (fora de
   escopo aqui) — esta USP só garante o enfileiramento (AD-007).
3. QUANDO o painel de gestão de vagas da Empresa (USP-023) renderiza uma vaga `ACTIVE` próxima da validade
   ENTÃO o sistema DEVE exibir um badge "expira em N dias" calculado por `diasAteExpiracao(validUntil)`
   (`domain/validade.ts`, America/Sao_Paulo) — sinal in-portal que não depende do e-mail (P-003).

**Independent Test**: integração — vaga a 3 dias sem `expiryReminderSentAt` → 1 linha `Outbox` + coluna marcada;
segunda execução não enfileira de novo; `diasAteExpiracao` (unit) devolve N correto por fuso.

---

## Edge Cases

- QUANDO não há vagas vencidas ENTÃO o cron DEVE responder `{ expired: 0, ... }` sem erro (nenhuma transição).
- QUANDO uma vaga está `PAUSED`/`DRAFT`/`ARCHIVED` e vencida ENTÃO o cron NÃO DEVE expirá-la — só transiciona a
  partir de `ACTIVE` (a FSM só permite `ACTIVE→EXPIRED`; a query filtra `status=ACTIVE`).
- QUANDO `validUntil` é exatamente hoje (America/Sao_Paulo) ENTÃO a vaga DEVE permanecer visível/`ACTIVE` — a
  regra é `validUntil < hoje` para expirar e `validUntil >= hoje` para exibir (fronteira consistente com AD-011/012).
- QUANDO uma vaga expira concorrentemente (duas execuções sobrepostas) ENTÃO só uma transição casa
  (`updateMany count===1`); a outra recebe `INVALID_TRANSITION` e o cron a conta como no-op, não como erro.
- QUANDO o cálculo de fuso cruza o horário de verão / meia-noite ENTÃO "hoje" DEVE vir de `hojeSaoPaulo()`
  (mesma função da busca) — a expiração e a ocultação usam a MESMA fronteira temporal (P-002).

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, por qualquer caminho. Cada um exige um teste negativo asseverando que o resultado
proibido não ocorre.

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| **P-001** (U24) | QUANDO o job de expiração atrasa ou falha ENTÃO o sistema NÃO DEVE deixar uma vaga vencida (`validUntil < hoje`) visível na busca pública ou no detalhe navegável. | Vaga morta visível / candidato aplica a vaga inexistente (F1 do intent). | T2 (query on-read — confirmação) | Integração: vaga `status=ACTIVE` porém `validUntil` no passado (job NÃO rodou) ⇒ `search-jobs`/`getActiveJobDetail` a excluem (`null`). |
| **P-002** (U24) | QUANDO o sistema decide "validade atingida" ENTÃO NÃO DEVE usar UTC ou outro fuso — só `America/Sao_Paulo` (`hojeSaoPaulo()`/`date-fns-tz`), na mesma fronteira da query. | Vaga expira/aparece em horário errado (F2 do intent). | T3 (cron) + T2 | Unit: com relógio fixo cruzando meia-noite BRT, a vaga expira em 00:00 local, não em 21:00 UTC do dia anterior; `hoje` do job === `hoje` da query. |
| **P-004** (U24) | QUANDO uma vaga está `EXPIRED` (ou vencida on-read) ENTÃO o sistema NÃO DEVE renderizar detalhe navegável com botão "candidatar-se" ativo — deve exibir "vaga encerrada". *(A ação de escrita é USP-025; must-not herdado.)* | Candidatura a vaga expirada por URL salva (F4 do intent). | T2 (detalhe — reusa estado "encerrada" da USP-022) | Integração/E2E: URL direta de vaga expirada ⇒ "vaga encerrada", sem botão candidatar. |
| **P-005** (U24) | QUANDO o job expira uma vaga ENTÃO NÃO DEVE excluir fisicamente a vaga nem candidaturas — só muda `status`. | Perda de histórico / MP6 / ADR-0008. | T3 (cron) | Integração: após expirar, `prisma.job.findUnique` ainda retorna a linha (`status=EXPIRED`); candidaturas intactas. |
| **U24-MN-06** | QUANDO a rota de cron é chamada sem o `CRON_SECRET` correto ENTÃO o sistema NÃO DEVE executar nenhuma expiração — responde `401`. | Disparo não autorizado / abuso do endpoint. | T3 (cron) | Integração do handler: requisição sem/`Bearer` inválido ⇒ `401` e zero transições. |
| **U24-MN-07** | QUANDO o cron roda repetidamente ENTÃO NÃO DEVE enfileirar mais de um lembrete D-3 por vaga nem re-expirar vaga já `EXPIRED`. | Spam de e-mail / auditoria duplicada / não-idempotência. | T3 (cron) + T4 (reminder) | Integração: duas execuções ⇒ 1 `JOB_EXPIRED` por vaga e ≤1 linha `Outbox` por vaga (`expiryReminderSentAt`). |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| E-001 / AC-024-1 (upstream, canônico) | P1 Expiração | Tasks | Pending |
| E-002 / AC-024-2 (upstream) | P1 Expiração (on-read) | Tasks | Pending |
| E-003 / AC-024-3 (upstream) | P2 Aviso D-3 (enqueue) | Tasks | Pending |
| E-004 (upstream) | P2 Badge painel | Tasks | Pending |
| P-001 (upstream) | P1 | Tasks | Pending |
| P-002 (upstream) | P1 | Tasks | Pending |
| P-004 (upstream) | P1 (on-read) + herdado USP-025 | Tasks | Pending |
| P-005 (upstream) | P1 | Tasks | Pending |
| P-003 (upstream) | P2 Badge | Tasks | Pending |
| L-001 (upstream) | P1 Cron (cadência ≤1h) | Tasks | Pending |
| L-002 (upstream) | P2 Aviso D-3 | Tasks | Pending |
| L-003 (upstream) | P1 Cron (observabilidade) | Tasks | Pending |
| U24-MN-06 (local) | P1 Cron auth | Tasks | Pending |
| U24-MN-07 (local) | P1/P2 Idempotência | Tasks | Pending |

> **Nota P-003 upstream:** o upstream tem um "P-003" (não depender só do e-mail) e a spec adiciona must-nots
> locais `U24-MN-06/07`. Para evitar colisão de IDs, os upstream P-00N mantêm o prefixo canônico e os locais
> usam `U24-MN-0N` a partir de 06.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 14 requisitos rastreados (12 upstream + 2 must-nots locais); todos mapeados a tasks no `tasks.md`.

---

## Success Criteria

- [ ] Vaga `ACTIVE` vencida vira `EXPIRED` com `JOB_EXPIRED` ao rodar o cron; re-execução é no-op (idempotente).
- [ ] Vaga vencida nunca aparece na busca/detalhe **mesmo com o job parado** (defesa on-read comprovada por teste).
- [ ] Cálculo de validade determinístico em `America/Sao_Paulo`, idêntico no job e na query.
- [ ] Rota de cron exige `CRON_SECRET` (401 sem ele) e está agendada em `vercel.json` (≤1h).
- [ ] Nenhuma exclusão física; histórico preservado.
- [ ] (P2) Lembrete D-3 enfileirado uma única vez por vaga na `Outbox`; badge "expira em N dias" calculado por função pura.
- [ ] Gates: `typecheck`, `lint`, `test` (unit + `*.int.test.ts`), `build`.
</content>
</invoke>
