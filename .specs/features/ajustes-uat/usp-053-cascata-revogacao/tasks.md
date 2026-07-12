# USP-053 — Cascata de revogação de JOB_APPLICATION · Tasks

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tasks com a skill spec-driven do projeto (`bravi-spec-driven` / `idsd-spec-driven`):
**ative-a pelo NOME e siga o fluxo Execute e as Critical Rules.** Não busque arquivos da skill por path.
A skill é a fonte da verdade do fluxo (ciclo por-task, gate, commit atômico, Verifier independente, sensor de
discriminação). **Se a skill não ativar, PARE e avise — não prossiga sem ela.**

Contrato inegociável por task: (1) testes derivam dos ACs da spec e afirmam o resultado definido na spec;
(2) o gate (testes) passa antes do "done"; (3) **um commit atômico por task**; (4) nunca enfraquecer/pular/apagar
testes; (5) todo `USP053-MN-NN` tem dono e um **teste negativo verde**.

**Spec**: `.specs/features/ajustes-uat/usp-053-cascata-revogacao/spec.md`
**Design**: `.specs/features/ajustes-uat/usp-053-cascata-revogacao/design.md`
**Status**: Done (Execute concluído — Verifier não executado nesta rodada, por instrução do orquestrador)

---

## 0. 💠 Entry Gate

Reavaliadas as Assumptions (spec §Assumptions): **todas** com owner `agent` e `Confirmed? = y`. Nenhum item com
owner externo (user/DPO/dependência) não resolvido de que a implementação dependa — a política ENCARRAR+MARCAR+OCULTAR
**já está declarada e aprovada** no domínio (`revocation-cascade.ts`, aprovação 2026-06-03). A "validação PO/DPO"
citada no dossiê é **afinar** o efeito; como o domínio já nomeia os efeitos, segue-se a letra. **Nenhum sub-item vai
para a Fase 9.** → **Entry Gate ABERTO.** Prossegue para breakdown.

---

## Test Coverage Matrix

> Provisional — gerado de amostragem do repo + CLAUDE.md + spec. Guidelines encontradas: `CLAUDE.md`
> (§Testing Requirements: happy/Zod/permission/consent/concorrência; unit 90% domínio; integração 80% Server
> Actions sensíveis), `vitest.config.*`. Modo autônomo → confirmado por `agent`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Participante de tx / Server Action (jobs, persons, consents) | integration (DB) | Caminhos-chave + efeitos reais no DB + erros; toda edge listada + must-nots via DB | `src/modules/**/__tests__/*.int.test.ts` | `npm run test` (com Postgres provisionado: `dotenv -e .env.local -- ...`) |
| Orquestração `revokeConsent` (unit, mock do container) | unit | 1:1 aos ACs de escopo/idempotência/purpose; must-not MN-06 | `src/modules/consents/__tests__/*.test.ts` | `npm run test` |
| Regra pura de domínio (contrato da matriz) | unit | Afirmação da política declarada (drift guard) | `src/modules/consents/__tests__/*.test.ts` | `npm run test` |
| Port (interface/token) + binding de container | none | Só build gate (typecheck/lint/build); comportamento provado no int de T4 | `ports/*.ts`, `shared/container.ts` | build gate |

## Parallelism Assessment

> Gerado do repo. Confirmado por `agent`.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| integration (`*.int.test.ts`) | **No** | DB Postgres compartilhado + cleanup por-suite (TRUNCATE/delete) | STATE (612 integração em DB único); padrão dos `*.int.test.ts` existentes |
| unit (`*.test.ts`) | Yes | Mocks / sem estado global mutável | `revoke-consent.test.ts` mocka `withAudit`/`tx` |

## Gate Check Commands

> Gerado do repo. Confirmado por `agent`.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com unit | `npm run typecheck && npm run lint && npm run test -- <arquivo unit>` |
| Full | Após tasks com integração (DB) | `dotenv -e .env.local -- prisma migrate deploy` (DB pronto) + `npm run test` (unit+int) |
| Build | Fim da unidade / tasks de config-only | `npm run typecheck && npm run lint && npm run test && NODE_ENV=production npm run build` |

---

## Execution Plan

### Phase 1: Participantes de efeito (donos do dado) + contrato

T1 e T2 são independentes em código, mas seus `*.int.test.ts` compartilham o DB → **sequenciais**. T5 é unit → `[P]`.

```
T1 ──→ T2
T5 [P]
```

### Phase 2: Seam (port + binding)

```
(T1, T2) ──→ T3
```

### Phase 3: Wiring da revogação + prova fim-a-fim

```
T3 ──→ T4
```

---

## Task Breakdown

### T1: Participante `hideCandidateProfileForRevocation` (OCULTAR) — módulo `persons`

**What**: Função de participante de tx que rebaixa `CandidateProfile.publicationStatus` `ACTIVE→PAUSED` do titular,
recebendo `tx` (não abre transação própria).
**Where**: `src/modules/persons/actions/hide-candidate-profile-for-revocation.ts` (novo) + export no barrel
`src/modules/persons/index.ts` + `src/modules/persons/__tests__/hide-candidate-profile-for-revocation.int.test.ts` (novo)
**Depends on**: None
**Reuses**: `activate-candidate-role.ts:100-116` (escrita direta de `publicationStatus`); enum `ContentStatus` (`PAUSED`)
**Requirement**: USP053-02, USP053-E2 · **Must-nots**: USP053-MN-02 (perfil), USP053-MN-03 (perfil), USP053-MN-05 (perfil)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `updateMany({ where: { personId, publicationStatus: 'ACTIVE' }, data: { publicationStatus: 'PAUSED', lastStatusChangeAt: new Date() } })`; retorna `{ hidden: count>0 }`
- [x] Int: perfil `ACTIVE` → `PAUSED` e **ausente** de `searchCandidates` (MN-02); perfil não-ACTIVE/ausente = no-op `hidden:false` (E2); demais campos do perfil **intactos** (MN-03); perfil de **outra** Pessoa intocado (MN-05)
- [x] Gate check passa: **full** (DB provisionado)
- [x] Test count registrado (sem deleções silenciosas)

**Tests**: integration · **Gate**: full · **Commit**: `feat(persons): ocultar perfil do candidato na revogação de JOB_APPLICATION (OCULTAR)`

---

### T2: Participante `endJobApplicationsForRevocation` (ENCERRAR+MARCAR) — módulo `jobs`

**What**: Função de participante de tx que encerra (soft-cancel) todas as candidaturas ativas do titular e emite
`APPLICATION_CANCELLED` marcado `via='consent_revoke'` por linha, recebendo `tx`.
**Where**: `src/modules/jobs/actions/end-job-applications-for-revocation.ts` (novo) + export no barrel
`src/modules/jobs/index.ts` + `src/modules/jobs/__tests__/end-job-applications-for-revocation.int.test.ts` (novo)
**Depends on**: None
**Reuses**: `cancel-application.ts:62-79` (guarda otimista `updateMany where cancelledAt:null`); `recordAuditEvent` (`create-referral.ts:166`); `AuditEvent.APPLICATION_CANCELLED`
**Requirement**: USP053-01, USP053-E3, USP053-E4 · **Must-nots**: USP053-MN-01, USP053-MN-03 (candidaturas), USP053-MN-05 (candidaturas)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `findMany` das ativas (`candidatePersonId=personId, cancelledAt:null`) → por id: `updateMany where cancelledAt:null` (otimista); só `count===1` coleta o id e emite **um** `APPLICATION_CANCELLED` com `after={cancelledAt, via:'consent_revoke', reason}`; retorna `{ endedCount, endedApplicationIds }`
- [x] Int: todas as candidaturas ativas (várias vagas) viram `cancelledAt` preenchido e saem da contagem ativa (MN-01/E4); linhas **não** apagadas (MN-03); 1 `APPLICATION_CANCELLED` `via=consent_revoke` por linha; concorrência com cancel avulso (USP-026) = **1** evento (E3); candidaturas de **outra** Pessoa intocadas (MN-05)
- [x] Gate check passa: **full** (DB provisionado)
- [x] Test count registrado (sem deleções silenciosas)

**Tests**: integration · **Gate**: full · **Commit**: `feat(jobs): encerrar+marcar candidaturas ativas na revogação de JOB_APPLICATION (ENCERRAR+MARCAR)`

---

### T5: Contrato da matriz (drift guard) — domínio `consents` [P]

**What**: Teste puro afirmando que `revocationCascadeFor('JOB_APPLICATION').artifactEffects` segue declarando
`candidaturas-ativas → [ENCERRAR, MARCAR]` e `perfil-candidato-visivel-empregadores → [OCULTAR]`.
**Where**: `src/modules/consents/__tests__/revocation-cascade-contract.test.ts` (novo)
**Depends on**: None
**Reuses**: `revocation-cascade.ts` (matriz); `revocation-cascade.test.ts` (padrão de asserção da matriz)
**Requirement**: fidelidade à política declarada (amarra a implementação de T1/T2 ao domínio)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Afirma os efeitos exatos por artefato de `JOB_APPLICATION`; falha se a matriz mudar (drift guard)
- [x] Gate check passa: **quick**
- [x] Test count registrado

**Tests**: unit · **Gate**: quick · **Commit**: `test(consents): contrato da matriz de cascata p/ JOB_APPLICATION`

---

### T3: Port `RevocationEffectsPort` + binding no container (seam sem ciclo) — `consents` + composition-root

**What**: Definir o port + token no `consents` e registrar o adapter que compõe T1+T2 no `container.ts` (deep-imports),
espelhando `COMPANY_RESPONSIBILITY_TOKEN`.
**Where**: `src/modules/consents/ports/revocation-effects.ts` (novo) + export no barrel `consents/index.ts` (se aplicável) + binding em `src/shared/container.ts` (modificar)
**Depends on**: T1, T2
**Reuses**: `persons/ports/companyResponsibility.ts` + `container.ts:15,26,32,59,131` (`createToken`/`register`/deep-import p/ evitar ciclo)
**Requirement**: USP053-01/02 (habilita a aplicação na tx da revogação — A-5)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `revocation-effects.ts` define `RevocationEffectsPort.applyJobApplicationCascade(tx, ctx)`, tipos de ctx/outcome e `REVOCATION_EFFECTS_TOKEN = createToken(...)` — sem IO
- [x] `container.ts` registra factory que chama `endJobApplicationsForRevocation` + `hideCandidateProfileForRevocation` (deep-import, **sem** barrel de jobs/persons) e retorna `{ applicationsEnded, endedApplicationIds, profileHidden }`
- [x] `consents` **não** importa `@/modules/jobs`/`@/modules/persons` (verificar ausência de ciclo)
- [x] Gate check passa: **build** (typecheck/lint/build verdes — sem ciclo de import)

**Tests**: none (camada de config/wiring; comportamento provado no int de T4) · **Gate**: build · **Commit**: `feat(consents): port de efeitos de revogação + binding no container`

---

### T4: Aplicar a cascata em `revokeConsent` (wiring) + prova fim-a-fim + unit estendido — `consents`

**What**: No callback de `withAudit(CONSENT_REVOKED)`, quando `purpose==='JOB_APPLICATION' && revoked.count>0`, resolver
`REVOCATION_EFFECTS_TOKEN` e aplicar a cascata **na mesma tx**, estendendo `audit.after` com `{applicationsEnded, profileHidden}`;
estender o unit existente (mock do applier via `container.register`) e adicionar o int fim-a-fim (container real + rollback).
**Where**: `src/modules/consents/actions/revoke-consent.ts` (modificar) + `src/modules/consents/__tests__/revoke-consent.test.ts` (estender) + `src/modules/consents/__tests__/revoke-consent.int.test.ts` (novo)
**Depends on**: T3
**Reuses**: `revoke-consent.ts:82-134` (tx existente); `container.resolve`; a cascata de papel existente (preservada)
**Requirement**: USP053-01, USP053-02, USP053-03, USP053-04, USP053-05, USP053-E1 · **Must-nots**: USP053-MN-01 (e2e), USP053-MN-02 (e2e), USP053-MN-04 (atomicidade/rollback), USP053-MN-05 (e2e), USP053-MN-06 (purpose scope)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Branch `purpose==='JOB_APPLICATION' && revoked.count>0` chama o applier na tx; `audit.after` inclui `applicationsEnded`/`profileHidden` (USP053-03/A-7); demais finalidades e no-op **não** chamam o applier (MN-06)
- [x] Idempotência (`alreadyRevoked`), `NOT_FOUND`, `UNAUTHENTICATED` e a cascata de papel **preservados** (USP053-05) — asserts existentes seguem verdes (estender, não substituir)
- [x] Unit estendido: applier **chamado** p/ JOB_APPLICATION; **não** chamado p/ outra finalidade (MN-06); `after` com novos campos
- [x] Int fim-a-fim (DB, container real): revogar JOB_APPLICATION com 2 candidaturas ativas + perfil ACTIVE → candidaturas encerradas fora do pipeline (MN-01), perfil PAUSED ausente de `searchCandidates` (MN-02), papel REVOKED, `after` correto, **nenhuma linha apagada** (MN-03); **outra** Pessoa intocada (MN-05); sem candidaturas ativas → `applicationsEnded=0` sem `APPLICATION_CANCELLED` (E1)
- [x] Int de atomicidade: injetar falha no applier (via `container.register` com fake que lança) → **rollback total**; consentimento ainda **ativo**, candidaturas ativas, perfil ACTIVE, papel ACTIVE (MN-04)
- [x] Testes preservados verdes: `revoke-consent.test.ts`, `revocation-cascade.test.ts`, `search-candidates.int.test.ts`, `cancel-application.int.test.ts`
- [x] Gate check passa: **full** · Test count registrado (sem deleções silenciosas)

**Tests**: integration · **Gate**: full · **Commit**: `feat(consents): aplicar cascata de artefatos de JOB_APPLICATION na revogação (CAND-7)`

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: participante OCULTAR (1 função + int) | 1 função | ✅ Granular |
| T2: participante ENCERRAR+MARCAR (1 função + int) | 1 função | ✅ Granular |
| T3: port + binding | 1 interface + 1 binding | ✅ Granular (coeso) |
| T4: wiring do revokeConsent + provas | 1 modificação de função + seus testes | ✅ Granular (co-locação obrigatória) |
| T5: contrato da matriz | 1 teste puro | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram | Status |
| --- | --- | --- | --- |
| T1 | None | (raiz) | ✅ Match |
| T2 | None | T1 → T2 (ordem por DB, não dependência de código) | ✅ Match (sequência por não-parallel-safe) |
| T5 | None | `[P]` | ✅ Match |
| T3 | T1, T2 | (T1,T2) → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |

> Nota: a seta `T1 → T2` no diagrama é **ordenação de execução** (int não parallel-safe, DB compartilhado), não
> dependência de código — consistente com a Parallelism Assessment.

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | participante de tx (persons) | integration | integration | ✅ OK |
| T2 | participante de tx (jobs) | integration | integration | ✅ OK |
| T3 | port + binding (config/wiring) | none (build gate) | none | ✅ OK (comportamento provado em T4) |
| T4 | Server Action (consents) | integration (+unit) | integration | ✅ OK |
| T5 | regra pura de domínio | unit | unit | ✅ OK |

## 💠 Must-Not Ownership

| Must-not | Owning task(s) | Teste negativo |
| --- | --- | --- |
| USP053-MN-01 (candidaturas fora do pipeline) | T2, T4 | int: 0 candidaturas ativas do titular após revogar; encerradas com `cancelledAt` (não apagadas) |
| USP053-MN-02 (perfil oculto) | T1, T4 | int: `searchCandidates` não retorna o titular; `publicationStatus != ACTIVE` |
| USP053-MN-03 (append-only / MANTER) | T1, T2 | int: linhas de `applications` persistem (só `cancelledAt`); campos do `CandidateProfile` intactos |
| USP053-MN-04 (atomicidade) | T4 | int: falha injetada no applier → rollback total; consentimento ainda ativo |
| USP053-MN-05 (escopo por titular) | T1, T2 | int: 2ª Pessoa com candidatura ativa/perfil ACTIVE intocada após revogar a 1ª |
| USP053-MN-06 (escopo por finalidade) | T4 | unit: revogar finalidade ≠ JOB_APPLICATION → applier não chamado; candidaturas/perfil inalterados |

Todos os 6 must-nots têm dono e teste negativo. ✅ Sem lacuna de decomposição.

---

## Notas de execução

- **Zero migração**; **sem dependência nova**; **sem evento de catálogo novo** (reusa `APPLICATION_CANCELLED` + `CONSENT_REVOKED.after`).
- Integração exige Postgres provisionado (`dotenv -e .env.local -- prisma migrate deploy` antes de `npm run test`; memória do projeto: `supabase db reset` sozinho não aplica Prisma).
- Ao final da última task, o **Verifier independente** roda automaticamente (author ≠ verifier): outcome check por AC + sensor de discriminação (mutações do §5 do design) + verificação dos 6 must-nots. Não é opcional.
