# USP-054 — Ciclo de vida da vaga no painel (Specification)

> **Unidade da Fase 8 — Remediação do UAT** · épico `ajustes-uat` · achados **EMP-2 (P1)**,
> **MOD-3 (P1)**, **EMP-3 (P1)**, **MOD-5 (P2)**.
> **Risk sizing floor = Large** (carrega must-nots + toca a máquina de estados de moderação +
> cache público de alto raio de impacto): spec com IDs de requisito + fase Tasks formal, Verifier
> independente obrigatório. Não é auto-dimensionável para Small/Medium.
> **Modo autônomo:** ambiguidades viram assumptions (owner `agent`); sem gate de confirmação.

## Source of truth (adaptar, não re-derivar)

Os requisitos já existem em specs/ADRs/dossiê upstream. Esta unidade **cumpre** o que specs
vizinhas já prometeram mas o código não entregou — **não re-deriva** nem inventa regra.

| Fonte upstream | O que fixa (canônico) | Âncora |
| --- | --- | --- |
| Dossiê UAT — **EMP-2** | Rascunho órfão: o painel não oferece editar/submeter p/ `DRAFT`/`AWAITING_ADJUSTMENTS`; a correção mínima é ligar as ações (a action `submitJobForModeration` já existe) | `.specs/features/ajustes-uat/uat-findings-2026-07-11.md:48` |
| Dossiê UAT — **MOD-3** | `AWAITING_ADJUSTMENTS` é beco sem saída p/ o autor: motivo da devolução invisível e sem reenvio; a transição já está declarada na FSM | `uat-findings-2026-07-11.md:49` |
| Dossiê UAT — **EMP-3** | Pausar/arquivar/editar não revalidam o cache público; `revalidate=1800` diverge do ISR 10min | `uat-findings-2026-07-11.md:50` |
| Dossiê UAT — **MOD-5** | "Válida até" exibida com −1 dia (DATE date-only convertido UTC→America/Sao_Paulo) | `uat-findings-2026-07-11.md:51` |
| **USP-023** spec — painel AC1 | "`DRAFT`/`AWAITING_ADJUSTMENTS` → **editar/submeter**"; ações contextuais por status na rota `(app)/empresa/[empresaId]/vagas` | `.specs/features/vagas/usp-023-editar-vaga/spec.md:194` |
| **USP-016** spec — **E-003** + Out of Scope | Devolver p/ ajustes exige motivo significativo (≥20), transiciona p/ `AWAITING_ADJUSTMENTS` e o autor deve receber o motivo; a transição `AWAITING_ADJUSTMENTS→IN_MODERATION` (reenvio) está declarada na FSM e pertence à "US de edição do conteúdo" | `.specs/features/moderacao-conteudo/usp-016-moderar-rascunho/spec.md:65,53` |
| **ADR-0013** / CLAUDE.md | ISR + on-demand revalidation via `transitionContent`; CLAUDE.md fixa "(public)/ — ISR 10min" p/ home/vagas/servicos (ver A-6) | `docs/arch/0013-isr-on-demand-revalidation.md`, `CLAUDE.md` (Route Groups) |
| **ADR-0011 / AD-011** | Máquina de estados de moderação; `transitionContent()` é a **única via** de mudança de status; `revalidateAfterTransition` é o side-effect de cache | `src/modules/moderation/**`, `revocation`/`next-cache-invalidation` adapter |
| CLAUDE.md — timezone | `timestamptz` (UTC) convertido com `date-fns-tz` na borda (`America/Sao_Paulo`); **campos DATE date-only NÃO passam por fuso** (premissa inviolável do brief) | `CLAUDE.md` (Conventions) |

**IDs canônicos:** achados **EMP-2/MOD-3/EMP-3/MOD-5** (dossiê), realizando USP-023 AC1 (painel) e
USP-016 E-003 (superfície in-app do motivo/reenvio). Decompostos localmente em `USP054-NN` (AC) e
`USP054-MN-NN` (must-nots). Não se cria ID paralelo para requisito já ancorado upstream.

## Problem Statement

O ciclo de vida da vaga tem quatro defeitos de fluxo/UX na superfície do painel e no cache público,
todos ancorados em specs já existentes e **sem exigir mudança de arquitetura**:

1. **EMP-2** — Uma vaga em `DRAFT` ou `AWAITING_ADJUSTMENTS` fica **órfã**: o painel "Minhas vagas"
   não oferece editar nem submeter. O view-model do painel devolve **todas** as ações `false` para
   esses status (o `canSubmit` existe no tipo mas nunca é `true`), embora `submitJobForModeration` já
   exista e a USP-023 AC1 mande "editar/submeter" para eles.
2. **MOD-3** — Quando o coordenador **devolve** a vaga (`→AWAITING_ADJUSTMENTS`) com um motivo, esse
   motivo **não aparece** na UI do autor e **não há ação de reenvio** — o autor não sabe o que
   corrigir nem como reenviar, apesar de a FSM já prever `AWAITING_ADJUSTMENTS→IN_MODERATION`.
3. **EMP-3** — Pausar/arquivar/editar uma vaga **não revalida** o cache público: o adapter de cache
   só revalida quando a transição **entra** em `ACTIVE`/`INATIVADA`, nunca quando **sai** de `ACTIVE`
   (o próprio comentário do arquivo diz "entra OU SAI de ACTIVE"). Uma vaga pausada/arquivada segue
   listada em `/vagas`. Embutido: o `export const revalidate` da página de vagas está `1800`,
   divergente do "ISR 10min" (600s) que CLAUDE.md documenta.
4. **MOD-5** — "Válida até" é exibida com **−1 dia**: `validUntil` é `@db.Date` (date-only) e é
   formatada via conversão UTC→`America/Sao_Paulo`, que desloca a data um dia para trás.

## Goals

- [x] **G1 (EMP-2)** — O responsável ativo vê e usa, no painel, as ações **editar** e
      **submeter/reenviar** para vagas `DRAFT` e `AWAITING_ADJUSTMENTS`; editar reusa o `JobForm`.
- [x] **G2 (MOD-3)** — O painel do autor **exibe o motivo** da última devolução de uma vaga
      `AWAITING_ADJUSTMENTS` e oferece **reenviar para moderação** via a transição da FSM
      (`AWAITING_ADJUSTMENTS→IN_MODERATION`, `transitionContent`). O e-mail ao autor é **USP-057** (fora).
- [x] **G3 (EMP-3)** — Transições que **saem** de `ACTIVE` (pausar, arquivar, editar→`DRAFT`, inativar,
      expirar) revalidam `/vagas` e `/vagas/[id]`, como já ocorre ao **entrar** em `ACTIVE`. A página
      de vagas alinha `revalidate` a 600s (ISR 10min, CLAUDE.md).
- [x] **G4 (MOD-5)** — Campos DATE date-only (`validUntil`) são exibidos como a data-calendário
      armazenada, **sem** conversão de fuso — sem o −1 dia.
- [x] **G5** — Nenhuma mudança de arquitetura: FSM via `transitionContent`, View Models, adapters e
      ADR-0013 preservados; sem dep nova, sem migração; testes existentes preservados (ver Out of Scope).

## Out of Scope

| Feature | Reason |
| --- | --- |
| E-mail ao autor na devolução/decisão de moderação (NOT-03/04/05) | **USP-057** (dep na USP-056). MOD-3 aqui é **só a superfície in-app** (motivo visível + reenvio). O dossiê separa explicitamente o e-mail (REL-1/MOD-4) da superfície in-app (MOD-3). |
| Re-moderação de conteúdo **`ACTIVE`** editado (rebaixar a `DRAFT`) | **Já entregue** pela USP-023 (`editJob`, `ACTIVE→DRAFT`). Esta unidade **não** toca esse fluxo; edita apenas vagas **não-ACTIVE** (`DRAFT`/`AWAITING_ADJUSTMENTS`), o que **evita** a questão aberta H-5 da Fase 9 (edição de conteúdo ACTIVE re-modera?). |
| Novos valores no enum `ContentStatus` ou novas arestas na FSM | `DRAFT`, `AWAITING_ADJUSTMENTS`, `IN_MODERATION` e as arestas `DRAFT→IN_MODERATION` / `AWAITING_ADJUSTMENTS→IN_MODERATION` **já existem** (USP-016). Nada a migrar. |
| Alinhar `revalidate` das páginas de **serviços** (`/servicos`, `/servicos/[id]`) a 600s | EMP-3 é sobre **vagas**; serviços não estão nos achados desta unidade. Divergência análoga fica como follow-up documentado, fora do escopo. |
| Novo evento de auditoria / nova query pesada | Reusa os eventos e as queries já existentes (leitura do motivo vem do registro de moderação/`audit_log` já gravado por USP-016). |
| Migração de `validUntil` para `timestamptz` | O campo é `@db.Date` **por design** (date-only). A correção é de **formatação na borda**, não de schema. |

---

## Assumptions & Open Questions

Modo autônomo: ambiguidades resolvidas como assumptions (owner `agent`) e registradas aqui. Todos os
mecanismos abaixo foram **confirmados contra o código** (investigação de superfície) — os parênteses
**(confirmado em código: …)** citam o fato exato. Nenhum item ficou pendente de decisão.

| # | Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- | --- |
| A-1 | **Editar vaga não-ACTIVE não transiciona** | agent | Editar uma vaga `DRAFT`/`AWAITING_ADJUSTMENTS` **atualiza os campos informativos in-place, preservando o status** (sem `transitionContent`, sem re-moderação automática). Submeter/reenviar é ação **separada**. **(confirmado em código: `editJob` recusa não-ACTIVE com `CONFLICT` e seu int-test asserta `DRAFT→CONFLICT` → NÃO estender `editJob`; criar action nova `updateJobDraft` que grava só campos, `status` inalterado — passa na guarda U23-MN-07 pois o `status` fica no `where`, nunca no `data`.)** | O conteúdo ainda **não foi publicado**; editá-lo não é "edição pós-aprovação" (H-5, Fase 9) — é preparar o rascunho. USP-023 AC1 lista **editar** e **submeter** como ações **distintas** para esses status. Auto-submeter no editar puliria a decisão do autor. | y |
| A-2 | **Reenvio usa a transição declarada na FSM** | agent | Submeter (`DRAFT`) e reenviar (`AWAITING_ADJUSTMENTS`) chamam **`submitJobForModeration({ jobId })`** → `transitionContent(to=IN_MODERATION, AUTHOR_ACTION)`. **(confirmado em código: `submitJobForModeration` NÃO guarda status na app — a FSM já declara `DRAFT→IN_MODERATION` E `AWAITING_ADJUSTMENTS→IN_MODERATION` (`AUTHOR_ACTION`); submeter e reenviar são a MESMA action, ZERO mudança de backend. O gap é 100% UI: `actionsForStatus` e a fiação do botão.)** | Premissa inviolável do brief: reenvio **não** burla a máquina de estados. USP-016 Out-of-Scope diz que a aresta de reenvio já está no `TRANSITIONS` e pertence "à US de edição do conteúdo" — esta é ela. | y |
| A-3 | **De onde ler o motivo da devolução** | agent | Do **registro append-only já gravado por USP-016** ao devolver. **(confirmado em código: NÃO existe tabela de moderação/transição — o motivo vive só em `AuditLog.justification`, `action='CONTENT_RETURNED_FOR_ADJUSTMENTS'`, `entityType='JOB'`, `entityId=jobId`. Padrão de leitura idêntico ao `companies/queries/list-company-rejections.ts` (que já lê `CONTENT_REJECTED` por empresa via `prisma.auditLog.findMany` + `orderBy occurredAt desc` + `take`).)** Nova query **owner-scoped** (só sobre os `jobId` da própria Empresa), mais recente primeiro. | USP-016 E-003/AC5/L-003 gravam o motivo na mesma tx da decisão (auditoria imutável). Reusar essa fonte evita coluna nova/migração. Owner mandou "investigue de onde lê-la: provavelmente do registro de transição/moderação". | y |
| A-4 | **Revalidar quando `from === ACTIVE`** | agent | O adapter `next-cache-invalidation` passa a revalidar `/vagas` e `/vagas/[id]` **também** quando `from === ACTIVE`, além do já-existente `to ∈ {ACTIVE, INACTIVATED}`. **(confirmado em código: o port `CacheInvalidationTarget` hoje carrega só `{contentKind, contentId, to}` — SEM `from`; a correção adiciona `from: ContentStatus` ao port e o passa no call site `transition-content.ts:109` — `from` já está em escopo ali. Guarda vira `if (to!==ACTIVE && to!==INACTIVATED && from!==ACTIVE) return;`. `eventTypeFor` já emite os eventos JOB de PAUSED/ARCHIVED/etc — nada a mudar lá.)** | O próprio comentário do arquivo diz "entra **OU SAI** de ACTIVE"; o early-return é o bug. Reusa o mecanismo existente — zero nova infra de cache (ADR-0013 preservado). | y |
| A-5 | **Escopo do alinhamento `revalidate=600`** | agent | Alinhar **as duas páginas públicas de vagas** — `(public)/vagas/page.tsx` (listagem) **e** `(public)/vagas/[id]/page.tsx` (detalhe) — de `1800`→`600`. Serviços ficam fora (ver Out of Scope). | Ambas são "vagas públicas" e ambas divergem do "vagas = 10min" da CLAUDE.md; a listagem e o detalhe precisam refletir o ciclo de vida no mesmo TTL. O brief cita "a página de vagas"; o detalhe é a mesma superfície do achado (MOD-5 também aparece no detalhe). | y |
| A-6 | **CLAUDE.md × ADR-0013 sobre o TTL de vagas** | agent | Seguir **CLAUDE.md + dossiê** (vagas = 600s). Registrar que **ADR-0013 §"Páginas de listagem e detalhe" documenta `1800`** — logo esta unidade **supersede** aquele fragmento para as páginas de vagas. Débito de doc: reconciliar ADR-0013 (flag, **não** bloqueia — decisão de doc, não de produto). | Conflito real entre duas fontes canônicas. CLAUDE.md "OVERRIDES any default behavior" e o dossiê da Fase 8 **manda** 600s. Não é decisão de owner externo (é reconciliação de doc que o dossiê já resolveu). Sinalizar para o orquestrador considerar um `AD-NNN` de supersessão. | y |
| A-7 | **Util de formatação date-only** | agent | Novo helper `formatDateOnly(d: Date)` em `@/shared/lib/time.ts` = `formatInTimeZone(d, 'UTC', 'dd/MM/yyyy')`; trocar `formatDate`→`formatDateOnly` nos **2 sites** que exibem `validUntil`. **(confirmado em código: hoje ambos usam `formatDate` de `@/shared/lib/time.ts`, que passa o `Date` cru ao `date-fns/format` → renderiza no fuso **local do runtime** → −1 dia. Sites: `src/modules/jobs/components/company-job-list.tsx:49` ("Válida até") e `src/modules/jobs/components/job-detail.tsx:133-139` (detalhe público). NÃO alterar `formatDate` global — outros callers dependem do comportamento atual.)** | Prisma lê `@db.Date` como meia-noite **UTC**; converter p/ `America/Sao_Paulo` (UTC−3) joga p/ o dia anterior. Date-only não carrega instante → não deve passar por fuso (premissa inviolável do brief). Precedente: `jobs/domain/validade.ts` já lê `validUntil` com `formatInTimeZone(..., 'UTC', ...)`. | y |
| A-8 | **Autorização das ações novas** | agent | Editar/submeter/reenvio de `DRAFT`/`AWAITING_ADJUSTMENTS` herdam o **gate de responsável ativo** (P-005/D-005) já usado pelas ações de ciclo de vida da USP-023 (`submitJobForModeration` já o aplica); a rota do painel já responde `notFound()` a não-responsável. | Consistência com USP-023 (todas as 5 actions negam não-responsável). Nenhuma ação nova pode abrir brecha de autorização. | y |

**Entry Gate (Tasks §0):** nenhum item com owner **externo** não resolvido. A questão de produto
sobre re-moderação (H-5, Fase 9) é **evitada por construção** (editamos só vagas não-ACTIVE). O conflito
CLAUDE.md×ADR-0013 (A-6) é reconciliação de doc que o dossiê **já** resolveu — não é decisão de produto
nova. **Entry Gate ABERTO.**

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Ações de ciclo de vida para DRAFT / AWAITING_ADJUSTMENTS no painel ⭐ MVP (EMP-2)

**User Story**: Como Pessoa-responsável ativa da Empresa, quero **editar** e **submeter** minhas vagas
em `DRAFT`/`AWAITING_ADJUSTMENTS` a partir do painel "Minhas vagas", para que um rascunho não fique
órfão sem caminho de avanço.

**Why P1**: Fecha o achado P1 EMP-2. Sem isso, uma vaga salva como rascunho (ou devolvida) é um
beco sem saída — a USP-023 AC1 já prometia essas ações, mas o view-model as devolve todas `false`.

**Acceptance Criteria**:

1. `USP054-01` — WHEN o responsável ativo abre o painel "Minhas vagas" e uma vaga está em `DRAFT`
   THEN o sistema SHALL oferecer as ações **Editar** e **Submeter para moderação** (o view-model do
   painel devolve `canEdit=true` e `canSubmit=true` para `DRAFT`).
2. `USP054-02` — WHEN a vaga está em `AWAITING_ADJUSTMENTS` THEN o sistema SHALL oferecer **Editar** e
   **Reenviar para moderação** (view-model devolve `canEdit=true` e `canSubmit=true`), além do motivo
   (US P1 MOD-3).
3. `USP054-03` — WHEN o responsável ativo aciona **Editar** numa vaga `DRAFT`/`AWAITING_ADJUSTMENTS`
   THEN o sistema SHALL abrir o `JobForm` pré-preenchido e, ao salvar, **persistir os campos
   informativos preservando o status** (sem transição de FSM, sem re-moderação automática).
4. `USP054-04` — WHEN o responsável ativo aciona **Submeter/Reenviar** THEN o sistema SHALL
   transicionar a vaga para `IN_MODERATION` **via `transitionContent`** (`submitJobForModeration`), e a
   vaga SHALL deixar de exibir as ações de "editar/submeter do autor" (passa a estar em moderação).
5. `USP054-05` — WHEN uma Pessoa **sem** vínculo responsável ativo tenta editar/submeter/reenviar
   THEN o sistema SHALL negar (`FORBIDDEN` na action / `notFound()` na rota), sem escrita (P-005).
6. `USP054-06` — WHEN a vaga está em `ARCHIVED`/`EXPIRED`/`INATIVADA` THEN o painel SHALL **não**
   oferecer submeter/reenviar (sem ressurreição de estado terminal — preserva USP-023 P-006).

**Independent Test**: E2E/RTL — responsável vê Editar+Submeter numa vaga `DRAFT` e Editar+Reenviar numa
`AWAITING_ADJUSTMENTS`; editar salva sem mudar status; submeter leva a `IN_MODERATION`; terminal sem
ações de reenvio; não-responsável → 404/`FORBIDDEN`.

---

### P1: Motivo da devolução visível + reenvio para AWAITING_ADJUSTMENTS ⭐ MVP (MOD-3)

**User Story**: Como autor de uma vaga devolvida para ajustes, quero **ver o motivo** da devolução e
**reenviar** para moderação, para saber o que corrigir e não ficar num beco sem saída.

**Why P1**: Fecha o achado P1 MOD-3. USP-016 E-003 manda o motivo chegar ao autor; hoje ele é gravado
na moderação mas **invisível** na UI, e não há reenvio.

**Acceptance Criteria**:

1. `USP054-07` — WHEN uma vaga do responsável está em `AWAITING_ADJUSTMENTS` e houve devolução com
   motivo THEN o painel/detalhe da vaga SHALL **exibir o motivo** da devolução (a `justification`
   registrada na transição de devolução por USP-016).
2. `USP054-08` — WHEN houve **mais de uma** devolução THEN o sistema SHALL exibir o motivo da devolução
   **mais recente**.
3. `USP054-09` — WHEN o autor aciona **Reenviar para moderação** THEN o sistema SHALL transicionar
   `AWAITING_ADJUSTMENTS→IN_MODERATION` via `transitionContent`, e o motivo SHALL deixar de ser exibido
   como pendência (a vaga voltou à fila).
4. `USP054-10` — WHEN a vaga não está em `AWAITING_ADJUSTMENTS` (ou nunca foi devolvida) THEN o sistema
   SHALL **não** exibir motivo de devolução (nada a mostrar).

**Independent Test**: integração/RTL — semear uma vaga devolvida com `justification` conhecida; o painel
do autor mostra exatamente esse texto (o mais recente quando há vários); reenviar → `IN_MODERATION` e o
motivo some da pendência; vaga nunca devolvida → sem bloco de motivo.

---

### P1: Revalidação de cache ao SAIR de ACTIVE + alinhamento do TTL ⭐ MVP (EMP-3)

**User Story**: Como visitante do site público, quero que uma vaga pausada/arquivada **suma** da
listagem, para não ver nem me candidatar a vagas que não estão mais ativas.

**Why P1**: Fecha o achado P1 EMP-3. Hoje o adapter só revalida ao **entrar** em `ACTIVE`; sair de
`ACTIVE` deixa a vaga "presa" no cache público até o TTL expirar.

**Acceptance Criteria**:

1. `USP054-11` — WHEN uma vaga transiciona **de** `ACTIVE` para `PAUSED`/`ARCHIVED`/`DRAFT` (via
   `editJob`)/`INATIVADA`/`EXPIRED` THEN o adapter de invalidação SHALL revalidar `/vagas` **e**
   `/vagas/[id]` (mesmos `revalidatePath`/`revalidateTag` do caminho de entrada em `ACTIVE`).
2. `USP054-12` — WHEN uma vaga transiciona **para** `ACTIVE` (aprovação/despausa) THEN a revalidação
   SHALL continuar ocorrendo (comportamento existente **preservado**, sem regressão).
3. `USP054-13` — WHEN a página pública de vagas declara `export const revalidate` THEN o valor SHALL
   ser `600` (ISR 10min, CLAUDE.md), na listagem `(public)/vagas/page.tsx` e no detalhe
   `(public)/vagas/[id]/page.tsx`.

**Independent Test**: unit do adapter — `from=ACTIVE, to=PAUSED` chama `revalidatePath('/vagas')` e a
revalidação do detalhe; `from=ACTIVE, to=ARCHIVED` idem; `to=ACTIVE` continua revalidando; grep de
`export const revalidate = 600` nas duas páginas de vagas.

---

### P2: "Válida até" sem −1 dia (DATE date-only sem fuso) (MOD-5)

**User Story**: Como responsável, quero ver a data de validade correta da minha vaga, sem um dia a
menos, para confiar na informação exibida.

**Why P2**: Fecha o achado P2 MOD-5. Defeito objetivo de exibição; menor severidade que os P1.

**Acceptance Criteria**:

1. `USP054-14` — WHEN "Válida até" (`validUntil`, `@db.Date` date-only) é exibida (painel "Minhas
   vagas" e/ou detalhe) THEN o sistema SHALL formatar a **data-calendário armazenada** (ex.:
   `2026-08-01` → `01/08/2026`), **sem** conversão de fuso — sem deslocamento de −1 dia.
2. `USP054-15` — WHEN uma data date-only cai numa janela sensível a fuso (armazenada como meia-noite
   UTC) THEN a formatação SHALL preservar o dia (não pode virar o dia anterior por UTC−3).

**Independent Test**: unit do formatador — `new Date('2026-08-01T00:00:00.000Z')` (leitura típica de
`@db.Date`) formata como `01/08/2026` (não `31/07/2026`); cobre o horário 00:00–03:00 UTC que expõe o bug.

---

## Edge Cases

- `USP054-E1` — WHEN a vaga está em `IN_MODERATION` THEN o painel SHALL **não** oferecer submeter/reenviar
  (já está na fila); editar por este fluxo não se aplica (não é `DRAFT`/`AWAITING_ADJUSTMENTS`).
- `USP054-E2` — WHEN uma vaga `AWAITING_ADJUSTMENTS` **não** tem registro de motivo (ex.: devolução legada
  sem justification) THEN o painel SHALL exibir um fallback neutro ("sem motivo registrado"), sem quebrar
  a renderização (defende contra o padrão EMP-1: nunca abortar a render por dado ausente).
- `USP054-E3` — WHEN duas submissões/edições concorrem sobre a mesma vaga THEN a guarda otimista
  existente (`updateMany where status=from`, `count===1`) SHALL fazer só uma casar; a outra recebe
  conflito, sem escrita parcial.
- `USP054-E4` — WHEN `revalidatePath`/`revalidateTag` falha THEN a transição **não** SHALL falhar
  (resiliência do ADR-0013 preservada — cache best-effort, nunca trava a moderação).
- `USP054-E5` — WHEN uma transição é entre dois status **não-ACTIVE** (ex.: `DRAFT→IN_MODERATION`,
  `IN_MODERATION→AWAITING_ADJUSTMENTS`) THEN o adapter SHALL manter o comportamento atual para essas
  (não precisa revalidar `/vagas` porque a vaga não é/era pública) — a mudança é aditiva a `from===ACTIVE`.

---

## Must-Nots (world-level prohibitions)

Cada um exige um teste negativo asseverando que o resultado proibido não ocorre.

| ID | WHEN … THEN system SHALL NOT … | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| `USP054-MN-01` | WHEN submeter/reenviar uma vaga `DRAFT`/`AWAITING_ADJUSTMENTS` THEN SHALL NOT escrever `Job.status` **fora** de `transitionContent` (nenhum `job.update*`/raw grava status no caminho de submit/reenvio) | Bypass silencioso da FSM / mudança de status não auditada (premissa inviolável) | T-submit | guarda estática + int: o reenvio muda status **apenas** via `transitionContent`; `IN_MODERATION` alcançado só pela aresta declarada |
| `USP054-MN-02` | WHEN editar uma vaga `DRAFT`/`AWAITING_ADJUSTMENTS` THEN SHALL NOT transicionar o status (não vira `IN_MODERATION`/`ACTIVE` nem re-modera automaticamente) | Pular a moderação / auto-submeter sem decisão do autor; colidir com a questão H-5 (Fase 9) | T-edit | int: editar campos de vaga `DRAFT` mantém `status=DRAFT`; editar `AWAITING_ADJUSTMENTS` mantém o status; nenhuma transição gravada |
| `USP054-MN-03` | WHEN uma Pessoa **sem** vínculo responsável ativo aciona editar/submeter/reenvio ou tenta ler o motivo de vaga de outra Empresa THEN SHALL NOT executar nem revelar (retorna `FORBIDDEN`/`notFound()`, zero escrita, zero vazamento cross-tenant) | Ação/leitura sobre vaga de outra Empresa (P-005/D-005, ADR-0014) | T-view, T-submit, T-edit | int: não-responsável → `FORBIDDEN`/404 e nada escrito; motivo de vaga de outra Empresa não retorna |
| `USP054-MN-04` | WHEN uma vaga **sai** de `ACTIVE` (pausar/arquivar/editar→DRAFT/inativar/expirar) THEN SHALL NOT deixar `/vagas` ou `/vagas/[id]` servindo a vaga como se ainda `ACTIVE` (cache obsoleto) | Núcleo do EMP-3: vaga pausada/arquivada segue listada publicamente | T-cache | unit: cada transição saindo de `ACTIVE` dispara os `revalidate*` de `/vagas` e do detalhe; mutação que restaura o early-return é morta |
| `USP054-MN-05` | WHEN um campo DATE date-only (`validUntil`) é formatado para exibição THEN SHALL NOT ser deslocado em ±1 dia por conversão de fuso (UTC↔`America/Sao_Paulo`) | Núcleo do MOD-5: data exibida difere da armazenada | T-date | unit: `@db.Date` de meia-noite UTC formata a **mesma** data-calendário; nenhum caminho de exibição da validade passa `validUntil` por `America/Sao_Paulo` |

---

## Requirement Traceability

| Requirement ID | Story / origem | Phase | Status |
| --- | --- | --- | --- |
| EMP-2 (dossiê) → USP-023 AC1 | P1 Ações DRAFT/AWAITING | Tasks | Done |
| MOD-3 (dossiê) → USP-016 E-003 | P1 Motivo + reenvio | Tasks | Done |
| EMP-3 (dossiê) → ADR-0013 | P1 Revalidação/TTL | Tasks | Done |
| MOD-5 (dossiê) → CLAUDE.md tz | P2 Data date-only | Tasks | Done |
| USP054-01..06 | P1 EMP-2 | Tasks | Done |
| USP054-07..10 | P1 MOD-3 | Tasks | Done |
| USP054-11..13 | P1 EMP-3 | Tasks | Done |
| USP054-14..15 | P2 MOD-5 | Tasks | Done |
| USP054-E1..E5 | Edge cases | Tasks | Done |
| USP054-MN-01..05 | Must-nots | Tasks | Done |

**ID format:** `USP054-NN` (AC), `USP054-MN-NN` (must-nots). IDs de achado (EMP-2/MOD-3/EMP-3/MOD-5) e
de spec vizinha (USP-023 AC1, USP-016 E-003) são canônicos upstream.
**Coverage:** 25 itens rastreados (15 AC + 5 edge + 5 must-not); todos mapeados a tasks em `tasks.md`
(0 unmapped).

---

## Success Criteria

- [ ] Painel oferece **editar + submeter/reenviar** para `DRAFT`/`AWAITING_ADJUSTMENTS`; editar salva
      sem transicionar; submeter/reenvio vai a `IN_MODERATION` via `transitionContent`.
- [ ] Motivo da última devolução **visível** no painel do autor; reenvio funciona; sem motivo → fallback
      neutro (não quebra a render).
- [ ] Transições **saindo** de `ACTIVE` revalidam `/vagas` e `/vagas/[id]`; entrar em `ACTIVE`
      preservado; `revalidate=600` nas duas páginas de vagas.
- [ ] "Válida até" exibe a data-calendário correta (sem −1 dia).
- [ ] Os 5 must-nots têm teste negativo verde; gates `typecheck`, `lint`, `test` (unit + `*.int.test.ts`),
      `build` verdes; **zero migração, zero dep nova**; testes de `company-job-row.view`,
      `next-cache-invalidation`, `editJob`/`submitJobForModeration` **preservados/estendidos** (não deletados).
