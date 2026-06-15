# Tasks — USP-013: Adicionar responsável a uma Empresa

> ICE mode · Large (ICED + must-not P-001..P-005). Modelo **pendente+aceite** (decisão de kickoff).
> Cada task resolve os ponteiros do card e embute o fragmento. Testes produzidos por **skill-tdad**
> (não inventar `Tests` — preencher com os paths que o skill-tdad retorna). Commit atômico por task.
> Sub-issues do board (expandidas): **#130 = backend/actions**, **#131 = UI** (modelo simples → pendente+aceite).

## Entry gate (verificado no kickoff) ✅
- USP #129 está **Ready**, sem flag Blocked. Upstream USP-012 (`createCompany`) e USP-001 (cadastro Pessoa) implementados. Pode prosseguir.
- **Gate D-001 (jurídico)** é pré-condição de **deploy em produção**, não de merge. Rastreado em STATE.md.

---

## Sub-issue #130 — Backend (schema + eventos + actions) — ✅ CONCLUÍDO (2026-06-15)

> T1 ✅ 4f413bc · T2 ✅ 617dc68 · T3 ✅ 0fec67f · T4 ✅ 74377fa. Testes verdes
> (24 integração companies + 10 e-mail), typecheck/lint limpos. Outbox = AD-007.

### T1 — Schema: status do vínculo (PENDING/ACTIVE) + UNIQUE parcial
- **What:** adicionar ciclo de status ao vínculo Pessoa↔Empresa preservando append-only (`revokedAt`).
- **Where:** `prisma/schema.prisma` (model `PersonCompanyGrant`, novo enum `CompanyGrantStatus`); nova migration SQL.
- **Reuses:** padrão de enums existentes (`CompanyGrantType`).
- **Fragmento (design §1):**
  - enum `CompanyGrantStatus { PENDING, ACTIVE }` `@@map("company_grant_status")`.
  - campos: `status CompanyGrantStatus @default(ACTIVE)`, `pendingAt DateTime?`, `acceptedAt DateTime?`.
  - migration raw: `CREATE UNIQUE INDEX uq_person_company_active ON person_company_grants(person_id, company_id) WHERE revoked_at IS NULL;`
- **Cross-impact (obrigatório na mesma task):**
  - `companies/actions/create-company.ts` (USP-012) → grant inicial grava `status: ACTIVE`.
  - `companies/adapters/prisma-company-responsibility.ts` + `persons/ports/companyResponsibility.ts` → `companiesLeftWithoutResponsible` conta **apenas** `status=ACTIVE AND revokedAt=null`.
- **Depends on:** —
- **Done when:** `npx prisma migrate dev` aplica; grants antigos = ACTIVE; UNIQUE parcial existe; typecheck verde; USP-012 e a query de invariante atualizados sem regressão.
- **Tests:** `companies/__tests__/grant-status-migration.int.test.ts` (skill-tdad — P-004 unicidade; invariante conta só ACTIVE).
- **Gate:** `npm run typecheck && npm run test -- companies`

### T2 — Evento de audit + template de e-mail de aceite
- **What:** catalogar `COMPANY_RESPONSIBLE_LINK_ACCEPTED` e criar template `responsible-link-pending`.
- **Where:** `src/modules/audit/events.ts`; `src/shared/lib/email/email-sender.port.ts` (+ `ResendEmailSender`).
- **Reuses:** `COMPANY_RESPONSIBLE_ADDED` (já existe); templates `welcome`/`credential-claim-welcome` como molde.
- **Fragmento:** adicionar à união discriminada `EmailMessage`: `{ to; template: 'responsible-link-pending'; data: { empresaNome; acceptUrl } }`; render no adapter.
- **Depends on:** —
- **Done when:** evento exportado do catálogo; novo template compila no tipo discriminado e renderiza; teste de render verde.
- **Tests:** `shared/lib/email/__tests__/responsible-link-pending.test.ts` (skill-tdad — E-003).
- **Gate:** `npm run typecheck && npm run test -- email`

### T3 — Action `adicionarResponsavel` (busca binária → vínculo PENDING + outbox)
- **What:** Server Action que busca Pessoa (binário, sem PII), valida permissão + rate limit, cria vínculo PENDING e enfileira e-mail.
- **Where:** `src/modules/companies/actions/add-responsible.ts`; `src/modules/companies/schemas/add-responsible.schema.ts`; query de busca binária (helper em `companies/queries/` ou `persons`).
- **Reuses:** `create-company.ts` (sequência canônica), normalização CPF (`persons`), `withAudit`, outbox.
- **Fragmento (design §2.1 — runbook-server-action):** Zod → `requirePermission` (ator é responsável **ACTIVE**, P-005) → rate limit (ADR-0029) → busca binária CPF|e-mail (P-001/ADR-0022, sem PII no retorno) → pré-cond Pessoa existe (E-002 → NOT_FOUND+auto-cadastro) e sem vínculo PENDING/ACTIVE (CONFLICT 409) → `withAudit('COMPANY_RESPONSIBLE_ADDED')`: cria grant `PENDING` + `tx.outbox` `responsible-link-pending` → captura `P2002`→CONFLICT.
- **Depends on:** T1, T2.
- **Done when:** action retorna `ActionResult`; vínculo nasce PENDING; e-mail enfileirado; não-responsável negado; CPF inexistente orienta auto-cadastro; duplicata → 409.
- **Tests:** `companies/__tests__/add-responsible.int.test.ts` (skill-tdad — E-001, E-002, P-001, P-004, P-005, L-002): happy, Zod-fail, permission-denied, busca-sem-PII, duplicidade-409, rate-limit, não-cadastrada.
- **Gate:** `npm run typecheck && npm run lint && npm run test -- companies`

### T4 — Action `aceitarVinculoResponsavel` (PENDING → ACTIVE + papel + consent)
- **What:** Pessoa adicionada aceita; vínculo vira ACTIVE, papel COMPANY_RESPONSIBLE ativado, consent finalidade 5 capturado — atômico.
- **Where:** `src/modules/companies/actions/accept-responsible-link.ts` (+ schema).
- **Reuses:** `ensure-client-role.ts` / `activate-provider-role.ts` (ativar papel + consent na tx), `withAudit`.
- **Fragmento (design §2.2 — P-003/ADR-0020):** Zod `{ empresaId }` → `getCurrentPerson()` = Pessoa do vínculo PENDING → pré-cond grant PENDING existe (idempotência) → `withAudit('COMPANY_RESPONSIBLE_LINK_ACCEPTED')` tx: grant→ACTIVE+acceptedAt, ativar papel COMPANY_RESPONSIBLE, gravar consent finalidade 5.
- **Depends on:** T1, T2.
- **Done when:** aceite torna ACTIVE; papel e consent gravados na mesma tx; aceite de vínculo não-PENDING bloqueado; auditoria registra quem aceitou e quando.
- **Tests:** `companies/__tests__/accept-responsible-link.int.test.ts` (skill-tdad — E-001 ativação papel/consent, P-002, P-003): happy, papel+consent atômicos, idempotência, permission.
- **Gate:** `npm run typecheck && npm run test -- companies`

---

## Sub-issue #131 — UI (adicionar + aceitar) — ✅ CONCLUÍDO (2026-06-15)

> T5 ✅ + T6 ✅ (11e10e5) · E2E de guarda de rota (d47f873). typecheck/lint/build
> limpos. SPEC_DEVIATION Level-1: UX busca→confirmar colapsada em 1 chamada sem PII.
> E2E autenticado (fluxo completo) diferido — coberto por testes de integração.

### T5 — UI adicionar responsável (busca binária + confirmar)
- **What:** form no painel da Empresa: busca CPF/e-mail → resposta binária → confirmar adição.
- **Where:** `src/modules/companies/components/add-responsible-form.tsx`; rota em `(app)/` (painel Empresa).
- **Reuses:** `create-company-form` (RHF + Zod adapter + Server Action), shadcn/ui.
- **Fragmento (design §4):** form busca → exibe "Pessoa encontrada — confirmar adição" **sem nome** → confirmar → toast "convite pendente de aceite"; estados de erro (não cadastrada → orientar auto-cadastro; duplicata; sem permissão).
- **Depends on:** T3.
- **Done when:** fluxo de UI chama a action; nenhuma PII renderizada antes do aceite; erros tratados; E2E top-flow verde.
- **Tests:** `e2e/companies/add-responsible.spec.ts` (skill-tdad — D-002/D-003 sem PII).
- **Gate:** `npm run typecheck && npm run lint && npm run test:e2e -- add-responsible`

### T6 — UI aceitar vínculo (listagem pendentes + rota de aceite)
- **What:** painel da Pessoa adicionada: lista vínculos pendentes + página de aceite alcançada pelo link do e-mail.
- **Where:** `src/modules/companies/components/pending-links-list.tsx`; rota `(app)/.../aceitar-vinculo` (autenticada).
- **Reuses:** componentes de listagem existentes, Server Action `aceitarVinculoResponsavel`.
- **Fragmento (design §4):** link do e-mail → rota autenticada (se deslogada, login→retorna) → botão "Aceitar vínculo" → action → após aceite, Empresa aparece nas opções de operação.
- **Depends on:** T4, T5.
- **Done when:** Pessoa vê pendentes, aceita e passa a operar a Empresa; rota exige sessão correta; E2E do fluxo de aceite verde.
- **Tests:** `e2e/companies/accept-responsible-link.spec.ts` (skill-tdad — D-002).
- **Gate:** `npm run typecheck && npm run lint && npm run test:e2e -- accept-responsible`

---

## Rastreabilidade AC(ICE) → task
| ICE ID | Cobre | Task(s) |
|---|---|---|
| E-001 | adicionar (PENDING) + aceite (ACTIVE+papel+consent) | T3, T4 |
| E-002 | Pessoa não cadastrada → bloqueio + auto-cadastro | T3 |
| E-003 | e-mail com link de aceite | T2, T3 |
| P-001 | busca binária sem PII | T3, T5 |
| P-002 | aceite explícito obrigatório (pendente até aceite) | T3, T4, T6 |
| P-003 | vínculo+papel consistentes (atômico) | T1, T4 |
| P-004 | unicidade sob concorrência (UNIQUE+409) | T1, T3 |
| P-005 | só responsável ativo busca/adiciona | T3, T5 |
| L-002 | rate limit anti-enumeração | T3 |
| D-001 | gate jurídico (deploy) | STATE.md |

## Plano de paralelismo
- T1 e T2 em paralelo `[P]` (independentes).
- T3 e T4 dependem de T1+T2; T3 e T4 podem correr em paralelo entre si após T1/T2.
- T5 depende de T3; T6 depende de T4+T5.
- **Ordem sugerida de PRs:** PR-#130 = T1→T2→T3→T4 (backend completo); PR-#131 = T5→T6 (UI).
