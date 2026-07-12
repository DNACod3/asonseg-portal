# USP-057 — E-mails de decisão de moderação — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tarefas com a skill **`idsd-spec-driven`**: **ative-a pelo nome** e siga o fluxo Execute + as Critical Rules (ciclo por task, gate, commit atômico, sub-agentes, Verifier independente, sensor de discriminação). Os testes-fonte (facts red) derivam dos ACs via **`skill-tdad`** (ative pelo nome na fase de teste de cada task). Não busque arquivos de skill por caminho.

**Se a skill não ativar, PARE e avise — não prossiga sem ela.**

---

**Design**: `.specs/features/ajustes-uat/usp-057-emails-moderacao/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes do Execute. Guidelines encontradas: `CLAUDE.md` (§Testing Requirements: happy/validation/permission/consent/concurrency; unit domínio 90%; integração 80% em Server Actions sensíveis), `vitest.config.ts` + `vitest.integration.config.ts`, `package.json` scripts. Padrão do módulo: `src/modules/moderation/**/__tests__/` e `src/shared/lib/email/__tests__/`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Template de e-mail (render puro) | unit | Todos os ramos: assunto/corpo PT-BR, `escapeHtml`, **motivo** presente em returned/rejected e ausente em approved, sem PII/moderador | `src/shared/lib/email/__tests__/moderation-*.test.ts` | `npm run test` |
| Registro/roteamento de template (união + `render()` switch + `KNOWN_TEMPLATES`) | unit | Os 3 templates: passthrough no resolver + renderização no sender | `src/shared/lib/email/__tests__/resend-email-sender.test.ts`, `src/shared/lib/outbox/__tests__/resolve-outbox-email.test.ts` | `npm run test` |
| Orquestração `transitionContent` (port threading + soft-fail) | unit | Assinatura `(tx, notice)`; `notify` chamado 1×/decisão; **R2 soft-fail** preservado | `src/modules/moderation/actions/__tests__/transition-content.test.ts` | `npm run test` |
| Adapter `OutboxModerationNotification` (regra de negócio) | unit | Todos os ramos: 3 decisões enfileiram payload correto; gating (não-decisão→sem linha); no-op (sem e-mail/CV); usa `tx` (não `prisma`); não chama `EmailSender`; payload sem moderador/PII | `src/modules/moderation/adapters/__tests__/*.test.ts` | `npm run test` |
| Enqueue ponta a ponta (`transitionContent` + adapter real + Postgres) | integration | Happy por decisão (linha `Outbox` correta + `to` + motivo); gating (não-decisão→sem linha); passthrough `resolveOutboxEmail` | `src/modules/moderation/__tests__/*.int.test.ts` | `npm run test:integration` |

## Parallelism Assessment

> Gerada de codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit (templates/registro) | Yes | Renderers puros / mocks; sem store compartilhado | `referral-notification.test.ts`, `resolve-outbox-email.test.ts` |
| unit (port/adapter moderação) | Yes | `container.register` + `tx` fake por teste; vitest isola por arquivo | `transition-content.test.ts` (per-test `container.register` + `vi.mock`) |
| integration | No | Postgres compartilhado + cleanup de tabelas; `describe.skipIf(!hasDb)` | `transition-content.int.test.ts`, `dispatch-outbox.int.test.ts` |

## Gate Check Commands

> Gerada de codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tasks só com testes unit (T1, T2, T3) | `npm run test` |
| Full | Após tasks com integração (T4) | `npm run test && npm run test:integration` |
| Build | Fim da fase / verificação final | `npm run typecheck && npm run lint && npm run test && npm run build` (+ `npm run test:integration` com DB) |

---

## Execution Plan

### Phase 1: Fundações (Paralelo — subsistemas distintos)

```
T1 [P]  (subsistema de e-mail)
T2 [P]  (port + call-site de moderação)
```

### Phase 2: Adapter real (Sequencial)

```
T1, T2 ──→ T3
```

### Phase 3: Integração (Sequencial)

```
T1, T3 ──→ T4
```

3 fases → execução inline (sem oferta de sub-agente por fase; o pipeline usa 1 Implementer).

---

## Task Breakdown

### T1: Templates de decisão de moderação (3) + registro no subsistema de e-mail [P]

**What**: Criar os 3 renderers PT-BR (`moderation-approved`/`-returned`/`-rejected`), suas Data interfaces + membros da união `EmailMessage`, os 3 `case` no `ResendEmailSender.render()` e as 3 entradas no `KNOWN_TEMPLATES` do resolver do Outbox. (Coeso e junto por causa do `switch(message.template)` exaustivo — separar quebraria o build.)
**Where**:
- `src/shared/lib/email/templates/moderation-approved.ts`, `moderation-returned.ts`, `moderation-rejected.ts` (novos)
- `src/shared/lib/email/email-sender.port.ts` (3 Data interfaces + 3 membros da união)
- `src/shared/lib/email/resend-email-sender.ts` (3 `case` + imports)
- `src/shared/lib/outbox/resolve-outbox-email.ts` (3 entradas em `KNOWN_TEMPLATES`)
**Depends on**: None
**Reuses**: `templates/referral-notification.ts` (aprovação), `templates/password-reset.ts` (CTA/`ctaButton`), `templates/layout.ts` (`wrapHtml`/`escapeHtml`/`ctaButton`)
**Requirement**: USP057-01, USP057-02, USP057-03, USP057-09, USP057-MN-04, USP057-MN-05

**Tools**:
- MCP: NONE
- Skill: `skill-tdad` (derivar os facts red dos ACs)

**Done when**:
- [ ] 3 renderers retornam `RenderedEmail` (assunto+html+text PT-BR); `escapeHtml` em todos os interpolados; devolução/rejeição exibem o **motivo**; approved **sem** motivo; CTA "área do autor" com `areaUrl`
- [ ] União `EmailMessage` tem os 3 novos membros; `render()` cobre os 3; `KNOWN_TEMPLATES` inclui os 3 (passthrough)
- [ ] Testes unit dos 3 templates + extensão de `resend-email-sender.test.ts` e `resolve-outbox-email.test.ts` (passthrough) — asserção negativa: saída **não** contém CPF/campos sensíveis nem identidade do moderador (USP057-MN-04)
- [ ] Nenhuma dep nova; nenhum ramo `kind` novo no resolver (só `KNOWN_TEMPLATES`) — USP057-MN-05
- [ ] Gate quick passa: `npm run test`
- [ ] Test count: +N testes verdes (sem deleção silenciosa)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(moderation): templates PT-BR de decisão de moderação (NOT-03/04/05) + registro no Outbox`

---

### T2: Threadar `tx` pelo `ModerationNotificationPort` (refactor build-green, comportamento preservado) [P]

**What**: Adicionar `tx` como 1º parâmetro de `sendModerationDecision`, atualizar o stub (segue no-op) e o call-site em `transitionContent` para passar `tx` — **mantendo** o `runSoftFail`. Sem troca de binding ainda (stub continua ativo) → comportamento idêntico; apenas o `tx` passa a fluir.
**Where**:
- `src/modules/moderation/ports/moderation-notification.port.ts` (assinatura `sendModerationDecision(tx, notice)`)
- `src/modules/moderation/adapters/stub-moderation-notification.ts` (assinatura; segue só logando)
- `src/modules/moderation/actions/transition-content.ts:98-107` (passar `tx` ao port, dentro do `runSoftFail`)
- `src/modules/moderation/actions/__tests__/transition-content.test.ts` (fakes → assinatura `(tx, notice)`, asserções preservadas)
**Depends on**: None
**Reuses**: `CompanyVerifyHookPort.onContentActivated(tx, …)` (mesmo padrão de threading), `AuditTx` (`@/modules/audit`)
**Requirement**: USP057-05 (threading do tx), USP057-08, USP057-MN-06

**Tools**:
- MCP: NONE
- Skill: `skill-tdad`

**Done when**:
- [ ] `sendModerationDecision(tx, notice)` na porta; stub e call-site atualizados; **`runSoftFail` mantido** (USP057-MN-06)
- [ ] `transition-content.test.ts` verde **sem** enfraquecer asserções; o teste "R2: falha de notificação é soft-fail" continua provando decisão `ok` (USP057-08/MN-06)
- [ ] `typecheck` verde (sem call-site/implementador desalinhado)
- [ ] Gate quick passa: `npm run test`
- [ ] Test count: suíte de `transition-content.test.ts` verde (contagem preservada)

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(moderation): threadar tx pelo ModerationNotificationPort (prep enqueue na tx)`

---

### T3: Adapter `OutboxModerationNotification` + troca do binding no container

**What**: Implementar o adapter real que resolve autor+título por `ContentKind`, aplica o gate das 3 decisões, monta o `EmailMessage` e **enfileira** via `tx.outbox.create`; exportar no barrel; trocar o binding `container.ts:138` (stub → adapter). Sem enviar nada (só enfileirar).
**Where**:
- `src/modules/moderation/adapters/outbox-moderation-notification.ts` (novo)
- `src/modules/moderation/index.ts` (export do adapter)
- `src/shared/container.ts:138` (binding → `new OutboxModerationNotification()`)
- `src/modules/moderation/adapters/__tests__/adapters.test.ts` (ou novo `__tests__/outbox-moderation-notification.test.ts`)
**Depends on**: T1, T2
**Reuses**: shape de payload de `apply-to-job.ts:110-121`; mapa tipo/autor/área de `moderation-queue.ts` + USP-056; `NEXT_PUBLIC_SITE_URL`
**Requirement**: USP057-01, USP057-02, USP057-03, USP057-04, USP057-05, USP057-06, USP057-07, USP057-MN-01, USP057-MN-02, USP057-MN-03, USP057-MN-04

**Tools**:
- MCP: NONE
- Skill: `skill-tdad`

**Done when**:
- [ ] Adapter implementa `sendModerationDecision(tx, notice)`; gate `from===IN_MODERATION && to∈{ACTIVE,AWAITING_ADJUSTMENTS,REJECTED}` (USP057-MN-01)
- [ ] Resolve autor+título por `ContentKind` (JOB/SERVICE/CANDIDATE_PROFILE); CV/sem e-mail → no-op logado (USP057-07)
- [ ] Enfileira `{ topic:'email', payload: EmailMessage }` via **`tx.outbox.create`** (nunca `prisma` global — USP057-MN-02); template correto por `to`; motivo em returned/rejected
- [ ] Container liga o adapter real; stub preservado (ainda usado por testes)
- [ ] Testes unit (tx fake): 3 decisões → payload correto (USP057-01..04); **negativos**: não-decisão → sem `tx.outbox.create` (MN-01); usa `fakeTx.outbox.create` e não `prisma.outbox.create` (MN-02); `EMAIL_SENDER_TOKEN` nunca resolvido (MN-03); `payload.data` sem `actorPersonId`/moderador/PII (MN-04); sem e-mail → sem linha (07)
- [ ] Gate quick passa: `npm run test`
- [ ] Test count: +N testes verdes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(moderation): enfileirar e-mail de decisão no Outbox (substitui StubModerationNotification)`

---

### T4: Integração ponta a ponta — enqueue na tx da decisão (real Postgres)

**What**: Teste de integração com o container real (adapter real): semear `Person` (com `emailLogin`) + `CandidateProfile` `IN_MODERATION`; `transitionContent` aprovar/devolver/rejeitar → asserir a linha `Outbox topic='email'` correta (template + `to` + motivo); uma transição não-decisão → **nenhuma** linha; `resolveOutboxEmail(payload)` devolve `EmailMessage` válido (passthrough AC-044-D2).
**Where**:
- `src/modules/moderation/__tests__/outbox-moderation-notification.int.test.ts` (novo; ou estender `transition-content.int.test.ts` sem quebrar o `notifySpy` existente)
**Depends on**: T1, T3
**Reuses**: harness de `transition-content.int.test.ts` (seed + `describe.skipIf(!hasDb)`); asserção de payload de `apply-to-job.int.test.ts`/`create-referral.int.test.ts`; `PrismaCandidateProfileStatusRepository` (USP-056) para `CANDIDATE_PROFILE`
**Requirement**: USP057-05, USP057-06, USP057-MN-02, USP057-MN-05

**Tools**:
- MCP: NONE
- Skill: `skill-tdad`

**Done when**:
- [ ] Aprovar/devolver/rejeitar um `CANDIDATE_PROFILE` real grava 1 linha `Outbox` com `payload.template` = `moderation-approved`/`-returned`/`-rejected`, `payload.to` = `emailLogin`, e o motivo em devolução/rejeição (USP057-05)
- [ ] Transição não-decisão (ex.: pausar/despausar via FSM aplicável) **não** grava linha (USP057-06/MN-01 ponta a ponta)
- [ ] `resolveOutboxEmail(payload)` retorna `EmailMessage` válido para as 3 (passthrough — sem ramo `kind` novo, USP057-MN-05)
- [ ] O `transition-content.int.test.ts` existente (com `notifySpy`) permanece verde (não regredir)
- [ ] Gate full passa: `npm run test && npm run test:integration`
- [ ] Test count: +N testes de integração verdes

**Tests**: integration
**Gate**: full
**Commit**: `test(moderation): integração e2e do enqueue de e-mail de decisão na tx (USP-057)`

---

## Parallel Execution Map

```
Phase 1 (Paralelo):
    ├── T1 [P]  (e-mail: templates + registro)
    └── T2 [P]  (moderação: threading do tx)

Phase 2 (Sequencial):
    T1, T2 ──→ T3  (adapter real + container)

Phase 3 (Sequencial):
    T1, T3 ──→ T4  (integração e2e)
```

`[P]` = sem dependência inter-task (T1 e T2 tocam subsistemas distintos; ambos unit parallel-safe).

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: templates + registro de e-mail | 3 templates + 3 pontos de registro (coeso; junto por `switch` exaustivo) | ✅ Coeso |
| T2: threading do `tx` | 1 assinatura + stub + call-site (refactor coeso) | ✅ Granular |
| T3: adapter + container | 1 adapter + barrel + 1 binding | ✅ Granular |
| T4: integração e2e | 1 arquivo de teste | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagram mostra | Status |
|---|---|---|---|
| T1 | None | raiz (Phase 1) | ✅ Match |
| T2 | None | raiz (Phase 1) | ✅ Match |
| T3 | T1, T2 | T1→T3, T2→T3 | ✅ Match |
| T4 | T1, T3 | T1→T4, T3→T4 | ✅ Match |

- Toda aresta do diagrama tem `Depends on` correspondente e vice-versa. T1/T2 marcadas `[P]` não dependem uma da outra. ✅

---

## Test Co-location Validation

| Task | Camada criada/modificada | Matriz exige | Task diz | Status |
|---|---|---|---|---|
| T1 | Template + registro de e-mail | unit | unit | ✅ OK |
| T2 | Orquestração `transitionContent` (port/call-site) | unit | unit | ✅ OK |
| T3 | Adapter (regra de negócio) | unit | unit | ✅ OK |
| T4 | Enqueue ponta a ponta (action + adapter + Postgres) | integration | integration | ✅ OK |

- Nenhum `Tests: none`; nenhum teste diferido para outra task. ✅

---

## 💠 Must-Not Ownership

| Must-Not | Owning task(s) | Teste negativo (Done when) |
|---|---|---|
| **USP057-MN-01** (só as 3 decisões enfileiram) | T3 (unit) + T4 (int) | notice não-decisão → nenhum `tx.outbox.create` / nenhuma linha |
| **USP057-MN-02** (usa `tx`, não `prisma` global — sem órfão) | T3 (unit) + T4 (int) | `fakeTx.outbox.create` chamado, `prisma.outbox.create` não; int: linha na mesma tx |
| **USP057-MN-03** (não despachar/enviar sincronamente) | T3 (unit) | `EMAIL_SENDER_TOKEN` nunca resolvido; só enfileira |
| **USP057-MN-04** (sem PII indevida/moderador) | T1 (unit) + T3 (unit) | saída do template sem CPF/sensível; `payload.data` sem `actorPersonId`/moderador |
| **USP057-MN-05** (sem migração/dep/dispatch novo; reusa Outbox) | T1, T2, T3, T4 | diff sem migração/dep; passthrough via `KNOWN_TEMPLATES` (sem ramo `kind` novo) |
| **USP057-MN-06** (enqueue não-crítico — não reverte a decisão) | T2 | `transition-content.test.ts` "R2: soft-fail" verde (decisão `ok`) |

- Todo must-not do spec tem task dono + teste negativo. ✅

---

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate`. Cada `Done when` é binário e referencia o comando de gate. Contagem de testes esperada por task previne deleção silenciosa. Após a última task, o **Verifier independente** roda automaticamente (autor ≠ verificador): checagem spec-anchored por AC + sensor de discriminação + verificação dos 6 must-nots (evidência-ou-zero), gravando `validation.md`.
