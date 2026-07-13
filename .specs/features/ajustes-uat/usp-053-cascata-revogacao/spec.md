# USP-053 — Cascata de revogação de JOB_APPLICATION (Specification)

> **Unidade da Fase 8 — Remediação do UAT** · épico `ajustes-uat` · achado **CAND-7 (P1)**.
> **Risk sizing floor = Large** (carrega must-nots + toca privacidade/LGPD + integridade de
> transição de estado + operação append-only): spec com IDs de requisito + fase Tasks formal,
> Verifier independente obrigatório. Não é auto-dimensionável para Small/Medium.

## Source of truth (adaptar, não re-derivar)

| Fonte upstream | O que fixa (canônico) | Âncora |
| --- | --- | --- |
| Dossiê UAT — achado **CAND-7** | O defeito e a correção mínima: aplicar os `artifactEffects` declarados **na mesma tx da revogação** | `.specs/features/ajustes-uat/uat-findings-2026-07-11.md:47` |
| **Matriz de cascata (domínio)** | A **política já aprovada** (DPO+jurídico, 2026-06-03): `JOB_APPLICATION` → candidaturas-ativas = **ENCERRAR+MARCAR**; perfil-candidato-visível-empregadores = **OCULTAR**; dados-já-vistos = **MANTER** | `src/modules/consents/domain/revocation-cascade.ts:111-134` |
| Vocabulário de efeitos | `MANTER` / `MARCAR` (flag histórica) / `OCULTAR` (some das visões dali p/ frente) / `ENCERRAR` (sai do fluxo ativo, preserva histórico) / `ANONIMIZAR` | `revocation-cascade.ts:26-38` |
| USP-026 — cancelar candidatura | Mecânica de cancelamento reusável: soft-cancel `cancelledAt`, `updateMany where cancelledAt:null` otimista, `APPLICATION_CANCELLED` (sem justification) | `src/modules/jobs/actions/cancel-application.ts`, `.specs/features/candidaturas-busca-candidatos/usp-026-cancelar-candidatura/spec.md` |
| USP-028 — busca ativa de candidatos | O gate on-read que realiza o OCULTAR: `cp.publication_status='ACTIVE' AND p.status='ATIVO'`; exclui todo estado não-ACTIVE | `src/modules/persons/queries/search-candidates.ts`, `.specs/features/candidaturas-busca-candidatos/usp-028-empresa-buscar-candidatos/spec.md` |
| ADR-0025 | Mecanismo da cascata (matriz declarativa + `requireActiveConsent` on-read + registro append-only); revogação cascateia o papel `CANDIDATE` | `src/modules/consents/actions/revoke-consent.ts` |
| ADR-0010 | View Models controlam visibilidade por papel; a nota de OCULTAR aponta a ADR-0010 | matriz `revocation-cascade.ts:126` |
| ADR-0008 / ADR-0023 | Não-exclusão (inativar preserva dados) / `audit_log` append-only — sustentam o MARCAR e o MANTER | matriz `revocation-cascade.ts:105`, CLAUDE.md |

**IDs canônicos:** achado **CAND-7** (dossiê) realizando a política declarada do domínio. Decompostos
localmente em `USP053-NN` (AC) e `USP053-MN-NN` (must-nots). Não se cria ID paralelo para requisito que
já tem âncora upstream — os efeitos são os da matriz.

## Problem Statement

Revogar o consentimento `JOB_APPLICATION` hoje cumpre **só** o mecanismo do ADR-0025 (preenche
`revokedAt`/`revokedReason` no consentimento e cascateia o `PersonRoleGrant` `CANDIDATE` → `REVOKED`),
mas **não aplica os `artifactEffects` que a própria política do domínio já declara** em
`revocation-cascade.ts`. Consequência observada no UAT (CAND-7): após a revogação, **as candidaturas
ativas do titular seguem no pipeline ativo do empregador** e **o perfil do candidato segue encontrável na
busca ativa de empresas** — o titular retirou o consentimento mas seus artefatos continuam em circulação.
A matriz `REVOCATION_CASCADE_MATRIX` é, hoje, **dado declarativo sem consumidor**: nenhum código lê
`artifactEffects` para `JOB_APPLICATION`. Esta USP faz o código **cumprir a política já declarada** — não
inventa regra nova.

## Goals

- [x] Ao revogar `JOB_APPLICATION`, **encerrar (`ENCERRAR`) e marcar (`MARCAR`)** todas as candidaturas
      **ativas** do titular, **dentro da mesma transação `withAudit(CONSENT_REVOKED)`** da revogação,
      reusando a mecânica de cancelamento da USP-026 (soft-cancel + `APPLICATION_CANCELLED`).
- [x] Ao revogar `JOB_APPLICATION`, **ocultar (`OCULTAR`)** o perfil do candidato das buscas/listagens
      ativas de empresas — rebaixando `CandidateProfile.publicationStatus` de `ACTIVE` para um estado
      não-listável **já existente** (sem migração), na mesma transação.
- [x] Preservar **integralmente** o histórico (append-only, ADR-0008/0023): nenhuma linha de candidatura
      ou campo do perfil é apagado/anonimizado; só muda o estado de fluxo ativo (`MANTER` dados-já-vistos).
- [x] Aplicar a cascata **atomicamente**: falha em qualquer passo faz rollback total (consentimento
      permanece ativo, sem efeitos parciais).
- [x] Preservar todo o comportamento atual do `revokeConsent` (idempotência, `NOT_FOUND`,
      `UNAUTHENTICATED`, cascata de papel) e os testes de `revoke-consent` e `search-candidates`.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Cascata das **demais finalidades** (`SERVICE_OFFERING`, `SERVICE_HIRING`, `COMPANY_REPRESENTATION`, `SOCIAL_*`, `CV_AI_EXTRACTION`) | CAND-7 é **só `JOB_APPLICATION`**. Cada finalidade tem seus efeitos aplicados por USP do seu módulo (intenção da própria matriz, `revocation-cascade.ts:16-20`). Fora desta unidade. |
| Coluna estrutural de motivo/origem de cancelamento em `applications` (migração) | O `MARCAR` declarado ("flag histórica") é satisfeito pelo `audit_log` append-only (ver Assumptions A-1). Só viraria migração se o DPO exigir flag na própria linha → **Fase 9** (não bloqueia esta unidade). |
| Retomada do perfil ao **re-conceder** `JOB_APPLICATION` (PAUSED→ACTIVE) | `reGrantRequiresNewConsent` (cross-cutting); a retomada é o fluxo existente de re-ativação/re-moderação. CAND-7 é a direção **revogação**. Fora do escopo. |
| Aviso na UI do painel de consentimentos ("revogar encerra candidaturas e oculta o perfil") | O painel já confirma a revogação (USP-043). Transparência extra é UX, não a política do domínio; sem AC que a exija. Follow-up opcional, não Fase 9. |
| Notificar empregadores sobre a retirada | A matriz fixa `notifyThirdParties: false` (`revocation-cascade.ts:81`). Candidatura é silenciosa (USP-026). |

---

## Assumptions & Open Questions

Modo autônomo: ambiguidades resolvidas como assumptions (owner `agent`) e registradas aqui.

| # | Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- | --- |
| A-1 | **Como realizar o `MARCAR` sem coluna nova** | agent | Cada candidatura encerrada emite `APPLICATION_CANCELLED` **na tx da revogação** com marcador distintivo em `after` (`via:'consent_revoke'`, `reason:'retirada por revogação de consentimento'`). O `cancelledAt` é a data "DD/MM" e o evento append-only é a "flag histórica". **Sem migração.** | `applications` **não tem** coluna de motivo/status (só `cancelledAt`); o `MARCAR` é definido como "flag histórica (ADR-0008)" e o `audit_log` é exatamente o registro append-only (ADR-0023). **Precedente idêntico:** a cascata de papel de hoje marca o motivo só no evento (`ROLE_GRANT_REVOKED after:{via:'consent_revoke'}`, `revoke-consent.ts:114`), sem coluna. Owner mandou "evite migração". | y |
| A-2 | **Como realizar o `OCULTAR`** | agent | Rebaixar `CandidateProfile.publicationStatus` de `ACTIVE`→`PAUSED` (valor **já existente** do enum `ContentStatus`) na tx da revogação. A busca (`search-candidates`) já filtra só `publication_status='ACTIVE'` → o perfil some **sem tocar a query**. | Menos invasivo e mais fiel que gatear a busca: `OCULTAR` = "some de **todas** as visões dali p/ frente" (busca, catálogo, listagens — `revocation-cascade.ts:32`), não só da busca. O flip cobre busca **e** o indicador MP1 (contagem de `CandidateProfile ACTIVE`, USP-041) num único ponto; gatear só a busca deixaria o MP1 contando o revogado. Preserva a linha e os dados (`OCULTAR` = registro preservado). Alternativa (join de papel/consent na query) mudaria `search-candidates` e quebraria seus testes (perfis semeados sem grant sumiriam). | y |
| A-3 | **Qual estado não-listável** para o `OCULTAR` | agent | `PAUSED` (não `ARCHIVED`/`INACTIVATED`). | `PAUSED` é o estado "oculto mas preservado" mais reversível (retorno via `PAUSED→ACTIVE` no re-aceite/re-moderação); `ARCHIVED`/`INACTIVATED` carregam semântica terminal/coordenação. `PAUSED` é justamente o que a busca já exclui (int-test de USP-028 prova exclusão de não-ACTIVE). | y |
| A-4 | **Escrita direta de `publicationStatus` (fora do FSM `transitionContent`)** | agent | O efeito é aplicado por um participante de tx **no módulo `persons`** (dono da tabela) com `updateMany` direto — **não** via `transitionContent`. | `transitionContent` abre a **própria** `withAudit` (não aninhável na tx da revogação — CAND-7 exige "mesma tx") e `PAUSED` via FSM é inalcançável p/ `CANDIDATE_PROFILE` (`eventTypeFor`→null). A nota da matriz p/ `JOB_APPLICATION` **não** manda usar FSM (só cita View Models/ADR-0010), ao contrário de `SERVICE_OFFERING` que diz "sem update direto". **Precedente:** `activate-candidate-role.ts`/`ensure-candidate-role.ts` já escrevem `publicationStatus` direto, dentro de `persons`; sem guard estático proibindo. | y |
| A-5 | **Onde vivem os efeitos e como o `consents` os invoca sem ciclo** | agent | Efeitos como **participantes de tx** nos módulos donos (`jobs` p/ candidaturas, `persons` p/ perfil), consumidos via **port no container** (`REVOCATION_EFFECTS_TOKEN`), resolvido lazy pelo `revokeConsent`. `consents` **não** importa `@/modules/jobs`/`@/modules/persons`. | Respeita a intenção da matriz ("a aplicação de cada efeito em seu módulo", `revocation-cascade.ts:16-20`) e a propriedade de tabela por módulo. Evita o ciclo de barrel (`jobs→consents` e `persons→consents` já existem). **Precedente exato:** `COMPANY_RESPONSIBILITY_TOKEN` — port definido no consumidor, adapter ligado no `container.ts` por deep-import (feito justamente "para evitar dependência circular", `container.ts:59`), resolvido por `container.resolve`. Bônus: mantém o unit test do `revokeConsent` isolado (mocka o applier). | y |
| A-6 | **Escopo do disparo** | agent | A cascata de artefatos roda **somente** quando `purpose === 'JOB_APPLICATION'` **e** houve consentimento vigente revogado (`revoked.count > 0`). | CAND-7 é `JOB_APPLICATION`; outras finalidades fora do escopo (A-Out). Não rodar em no-op preserva a idempotência (nenhuma auditoria espúria — `revoke-consent.ts:60-75`). | y |
| A-7 | **Auditoria do resultado da cascata** | agent | Resultado agregado (`applicationsEnded`, `profileHidden`) registrado no `after` do evento primário `CONSENT_REVOKED`; **um** `APPLICATION_CANCELLED` por candidatura encerrada (via `recordAuditEvent`, precedente `create-referral.ts:166`). Sem evento de catálogo novo. | O catálogo de eventos é fechado (novo exige ADR/nota). `CONSENT_REVOKED.after` já carrega o resumo da cascata (`revoke-consent.ts:125`); estendê-lo é aditivo. Não há evento de "perfil oculto" — capturado no `after` primário. | y |

**Entry Gate (Tasks §0):** nenhum item com owner externo não resolvido. A "validação PO/DPO" citada no
dossiê é **afinar** o efeito — mas o domínio **já nomeia** ENCERRAR+MARCAR+OCULTAR (política aprovada
2026-06-03), então segue-se a letra da política. Nenhum sub-efeito é ambíguo a ponto de exigir decisão
**nova** de produto → **nada vai para a Fase 9**. Entry Gate **ABERTO**.

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Cascata de revogação de JOB_APPLICATION fiel à política do domínio ⭐ MVP

**User Story**: Como titular que revoga o consentimento `JOB_APPLICATION`, quero que minhas candidaturas
ativas sejam encerradas e meu perfil saia das buscas de empresas — na mesma operação da revogação — para
que retirar o consentimento realmente retire meus artefatos de circulação (LGPD), sem apagar meu histórico.

**Why P1**: Fecha o achado P1 CAND-7 do UAT; é o cumprimento de uma política de LGPD **já aprovada e
declarada** no domínio, hoje inerte. Sem isso, a revogação é enganosa (papel revogado, artefatos ativos).

**Acceptance Criteria**:

1. `USP053-01` — WHEN o titular revoga `JOB_APPLICATION` e possui candidaturas **ativas** (`cancelledAt IS NULL`)
   THEN o sistema SHALL, **dentro da mesma `withAudit(CONSENT_REVOKED)`** da revogação, preencher
   `cancelledAt` em **todas** essas candidaturas (**ENCERRAR**, reusando o `updateMany where cancelledAt:null`
   otimista da USP-026), excluindo-as do pipeline ativo do empregador, e registrar **um** `APPLICATION_CANCELLED`
   por candidatura encerrada, marcado como revogação (**MARCAR**: `after.via='consent_revoke'`).
2. `USP053-02` — WHEN o titular revoga `JOB_APPLICATION` e possui `CandidateProfile` com `publicationStatus = ACTIVE`
   THEN o sistema SHALL, na mesma transação, rebaixar `publicationStatus` para `PAUSED` (**OCULTAR**), de modo
   que o perfil **não** retorne mais na busca ativa de candidatos (`search-candidates`) nem em listagens
   `ACTIVE`, **preservando** a linha do perfil e todos os seus campos.
3. `USP053-03` — WHEN a cascata é aplicada THEN o sistema SHALL registrar o resultado agregado
   (`applicationsEnded`, `profileHidden`) no `after` do `CONSENT_REVOKED`, e SHALL **não** apagar nem
   anonimizar nenhuma linha de candidatura ou campo do perfil (**MANTER** dados-já-vistos — não-retroativo,
   ADR-0008).
4. `USP053-04` — WHEN qualquer passo da transação de revogação falha THEN o sistema SHALL **desfazer toda a
   cascata atomicamente** (consentimento, papel, candidaturas e perfil), retornando `{ ok:false }` e deixando
   o consentimento `JOB_APPLICATION` **ativo** — sem efeito parcial.
5. `USP053-05` — WHEN `JOB_APPLICATION` já está revogado (ou não existe consentimento vigente) THEN o sistema
   SHALL preservar o comportamento atual (idempotente `alreadyRevoked` / `NOT_FOUND`), **sem** re-executar a
   cascata nem emitir nova auditoria.

**Independent Test**: Semear um titular com papel `CANDIDATE` ativo, 2 candidaturas ativas a vagas distintas e
`CandidateProfile ACTIVE`. Revogar `JOB_APPLICATION` e verificar, num só fluxo: (a) as 2 candidaturas com
`cancelledAt` preenchido e **fora** da contagem ativa/pipeline; (b) 2 `APPLICATION_CANCELLED` com
`via='consent_revoke'`; (c) `publicationStatus = PAUSED` e o titular **ausente** de `searchCandidates`;
(d) papel `CANDIDATE = REVOKED` e `CONSENT_REVOKED.after` com `applicationsEnded:2, profileHidden:true`;
(e) nenhuma linha apagada. Injetar falha no applier e confirmar rollback total (consentimento ainda ativo).

---

## Edge Cases

- `USP053-E1` — WHEN o titular revoga `JOB_APPLICATION` **sem candidaturas ativas** THEN a cascata SHALL
  resultar em `applicationsEnded=0`, **sem** emitir `APPLICATION_CANCELLED`, e ainda assim ocultar o perfil
  se estiver `ACTIVE`.
- `USP053-E2` — WHEN o titular **não tem `CandidateProfile`** ou seu perfil já está em estado **não-ACTIVE**
  (DRAFT/IN_MODERATION/PAUSED/…) THEN o `OCULTAR` SHALL ser no-op (`profileHidden=false`), sem mudar estado
  (perfil não-ACTIVE já não é listável).
- `USP053-E3` — WHEN um cancelamento avulso (USP-026) da mesma candidatura concorre com a revogação THEN
  exatamente **um** preenche `cancelledAt` e emite `APPLICATION_CANCELLED` (guarda otimista `where cancelledAt:null`);
  o outro é no-op — sem duplo evento.
- `USP053-E4` — WHEN o titular tem candidaturas para **múltiplas** vagas THEN **todas** as ativas SHALL ser
  encerradas (o efeito é por titular, não por vaga).

---

## Must-Nots (world-level prohibitions)

| ID | WHEN … THEN system SHALL NOT … | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| `USP053-MN-01` | WHEN `JOB_APPLICATION` é revogado THEN SHALL NOT deixar qualquer candidatura **ativa** (`cancelledAt IS NULL`) do titular no pipeline do empregador | Núcleo do CAND-7: candidaturas do revogado seguem visíveis ao empregador | T2 | int: após revogar, contagem de candidaturas ativas do titular = 0; as encerradas têm `cancelledAt` **preenchido** (não apagadas) |
| `USP053-MN-02` | WHEN `JOB_APPLICATION` é revogado THEN o perfil do candidato SHALL NOT permanecer retornável pela busca ativa (`publicationStatus` não pode continuar `ACTIVE`) | Núcleo do CAND-7: perfil do revogado segue encontrável | T1, T5 | int: `searchCandidates` deixa de retornar o titular; `publicationStatus != ACTIVE` |
| `USP053-MN-03` | WHEN a cascata roda THEN SHALL NOT **apagar** nem anonimizar linhas de candidatura ou campos do `CandidateProfile` | Destruição de dado tratado licitamente (viola ADR-0008/MANTER) | T1, T2, T5 | int: linhas de `applications` persistem (só `cancelledAt` setado); linha e campos do `CandidateProfile` intactos após a cascata |
| `USP053-MN-04` | WHEN um passo da cascata falha THEN SHALL NOT persistir cascata **parcial** (consent/papel revogado com candidaturas/perfil intocados, ou vice-versa) | Estado LGPD inconsistente (papel revogado mas perfil ainda ACTIVE) | T4, T5 | int: injetar erro no applier → tx inteira faz rollback; consentimento ainda ativo, candidaturas ativas, perfil `ACTIVE` |
| `USP053-MN-05` | WHEN a cascata roda THEN SHALL NOT tocar candidaturas ou perfil de **outra** Pessoa | Vazamento da cascata entre titulares | T1, T2, T5 | int: 2º candidato com candidatura ativa/perfil `ACTIVE`; revogar o titular A → B **intocado** |
| `USP053-MN-06` | WHEN se revoga uma finalidade **≠ `JOB_APPLICATION`** THEN SHALL NOT encerrar candidaturas nem ocultar o perfil | Sobre-aplicação dos efeitos de `JOB_APPLICATION` a outras finalidades | T4 | unit: revogar outra finalidade → o applier de `JOB_APPLICATION` **não** é chamado; candidaturas/perfil inalterados |

---

## Requirement Traceability

| Requirement ID | Story / origem | Phase | Status |
| --- | --- | --- | --- |
| CAND-7 (dossiê) | política do domínio (matriz) → USP-053 | Execute | Done |
| USP053-01 | P1 AC1 (ENCERRAR+MARCAR) | Execute | Done (T2, T4) |
| USP053-02 | P1 AC2 (OCULTAR) | Execute | Done (T1, T4) |
| USP053-03 | P1 AC3 (MANTER + auditoria) | Execute | Done (T4) |
| USP053-04 | P1 AC4 (atomicidade) | Execute | Done (T4) |
| USP053-05 | P1 AC5 (idempotência preservada) | Execute | Done (T4) |
| USP053-E1..E4 | Edge cases | Execute | Done (T1, T2, T4) |
| USP053-MN-01 | Must-not (candidaturas fora do pipeline) | Execute | Done (T2, T4) |
| USP053-MN-02 | Must-not (perfil oculto) | Execute | Done (T1, T4) |
| USP053-MN-03 | Must-not (append-only/MANTER) | Execute | Done (T1, T2) |
| USP053-MN-04 | Must-not (atomicidade) | Execute | Done (T4) |
| USP053-MN-05 | Must-not (escopo por titular) | Execute | Done (T1, T2) |
| USP053-MN-06 | Must-not (escopo por finalidade) | Execute | Done (T4) |

**ID format:** `USP053-NN` (decompõe CAND-7 + a política declarada); must-nots `USP053-MN-NN`.
**Coverage:** 15 requisitos (5 AC + 4 edge + 6 must-not), todos mapeados a tasks em `tasks.md` (0 unmapped).

---

## Success Criteria

- [x] Revogar `JOB_APPLICATION` com candidaturas ativas: **todas** viram `cancelledAt` preenchido, fora do
      pipeline ativo, com `APPLICATION_CANCELLED` marcado `via='consent_revoke'` — reusando a mecânica USP-026.
- [x] Revogar `JOB_APPLICATION` com perfil `ACTIVE`: perfil vira `PAUSED`, some de `searchCandidates` e das
      contagens `ACTIVE`, com linha e campos preservados.
- [x] Cascata **atômica**: falha → rollback total, consentimento permanece ativo (sem parcial).
- [x] Idempotência, `NOT_FOUND`, `UNAUTHENTICATED` e a cascata de papel **preservados**; testes de
      `revoke-consent` e `search-candidates` continuam verdes.
- [x] **Zero migração**; nenhuma dependência nova; nenhum efeito vaza para outra Pessoa ou outra finalidade.

**Nota de execução (2026-07-12):** Execute concluído (T1-T5, 5 commits atômicos). Verifier
independente executado — `validation.md` PASS (Overall: Ready; 5/5 ACs, 6/6 must-nots, 5/5
mutações mortas pelo sensor; gate typecheck/lint/build/unit/integração todos verdes).
