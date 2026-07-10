# USP-044 Tasks — Dispatcher assíncrono do Outbox de e-mail

**Design:** `.specs/features/notificacoes-email/usp-044-notificacoes-email/design.md`
**Spec:** `.specs/features/notificacoes-email/usp-044-notificacoes-email/spec.md`
**Status:** Draft
**Sizing (unidade):** **Large** (piso ICE — must-nots P-003/P-007). **4 tasks.**

## Entry Gate (ICE) — resultado: ✅ LIBERADO

Sinais do card USP-044 (matriz §USP-044, l.716-729) + ledger §2:
1. Q-aberta(dono): **nenhuma** (card `Deps/Q-abertas: —`). 2. ❓técnico/arquitetural: **nenhum** (matriz §Q-abertas mostra "E-mail post-commit/assíncrono → **Resolvido** ADR-0020"; "SPF/DKIM/DMARC → **Resolvido**"). 3. ADR Proposed: **nenhum** — ADR-0020 **Accepted**. 4. Pré-condição D-NNN: os gates D-001/D-002 (SPF/DKIM, revisão de templates) são **operacionais/pré-produção**, não bloqueiam a implementação do dreno. 5. Premissa PR aberta: **nenhuma** consumida. → **Nenhum sinal bloqueante dispara. Entra em dev.**

## Gate Check Commands

| Nível | Comando |
|---|---|
| quick | `npm run typecheck && npm run lint && npm run test` |
| full (integração) | `npm run test:integration` (`*.int.test.ts`, Postgres real via `.env.local`) |
| build | `npm run build` |

## Nota sobre os testes (ICE)

O produtor dos facts é **skill-tdad** (materializa os `.feature` PT-BR + specs RED nos caminhos-alvo abaixo, a partir dos `eval(+)/eval(−)` de `expectations-USP-044.md` e das ACs negativas de `spec.md`). Cada task já carrega o **caminho-alvo** e os **cenários** que provam suas ACs/must-nots. Nenhuma task difere teste para outra.

---

## Execution Plan

Cadeia sequencial (todos os testes de integração compartilham o DB → **não** paralelizáveis, TESTING/L-010):

```
T1 (template+união, unit) ──► T2 (hidratador jobs, int) ──► T3 (motor do dreno, unit+int) ──► T4 (rota cron + vercel.json, unit)
```

Sem tasks `[P]` — a cadeia é linear e os passos int. tocam estado mutável comum (Outbox/Job no Postgres).

---

## Task Breakdown

### T1: Template `job-expiry` + variante na união `EmailMessage`

**What:** Adicionar a variante `{ to; template:'job-expiry'; data: JobExpiryEmailData }` à união `EmailMessage`, criar o renderer PT-BR e ligá-lo ao `render()` do adapter.
**Where:** `src/shared/lib/email/email-sender.port.ts` (união + interface `JobExpiryEmailData`), `src/shared/lib/email/templates/job-expiry.ts` (novo), `src/shared/lib/email/resend-email-sender.ts` (`case 'job-expiry'` no switch exaustivo).
**Depends on:** None
**Reuses:** padrão dos templates irmãos (`application-confirmation.ts`, `templates/layout.ts`); `RenderedEmail`.
**Requirement:** E-001 (AC-044-D3 / AC-044-7 do épico), E-003/P-002 (minimização — só `empresaNome`/`vagaTitulo`/`diasRestantes`).

**Tools:** MCP: NONE · Skill: `skill-tdad` (materializa o unit spec)

**Done when:**
- [ ] `JobExpiryEmailData { empresaNome: string; vagaTitulo: string; diasRestantes: number }` exportada; variante na união; `render()` cobre `'job-expiry'` (switch continua exaustivo, compila).
- [ ] Renderer produz `subject`+`html`+`text` em PT-BR, sem PII de terceiro.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: +N unit passam (render PT-BR; exaustividade da união compila) — sem deleções silenciosas.

**Tests:** unit → `src/shared/lib/email/templates/__tests__/job-expiry.test.ts`
- cenário: dados válidos → assunto/corpo PT-BR contêm título da vaga e dias restantes; não contém e-mail/telefone de terceiros.
**TestGate:** quick
**Commit:** `feat(infra): template job-expiry para o dispatcher de e-mail (USP-044 T1)`

---

### T2: Hidratador `resolveJobExpiryEmail(jobId)` em `jobs` + registro no container

**What:** Query que transforma `{kind:'JOB_EXPIRY_D3', jobId}` num `EmailMessage` `job-expiry` (carrega vaga + responsável da Empresa com e-mail) ou `null` (no-op gracioso); registrar como resolver no `container.ts`.
**Where:** `src/modules/jobs/queries/resolve-job-expiry-email.ts` (novo) + export no barrel `src/modules/jobs/index.ts` + binding em `src/shared/container.ts`.
**Depends on:** T1 (precisa da variante `job-expiry` da união).
**Reuses:** relações `Job → Company → person_company_grants → Person.emailLogin` (USP-012/013); `prisma` singleton; `select` explícito + `take`.
**Requirement:** E-001 (AC-044-D3), AC-044-D5 (no-op sem destinatário).

**Tools:** MCP: NONE · Skill: `skill-tdad`

**Done when:**
- [ ] `resolveJobExpiryEmail(jobId): Promise<EmailMessage | null>` — vaga+responsável com e-mail → `{template:'job-expiry', to, data}`; vaga inexistente **ou** sem responsável com `emailLogin` → `null`.
- [ ] Registrado no container (padrão despacho-por-tipo; `shared` não importa `jobs` diretamente — resolver injetado).
- [ ] Gate check passes: `npm run test:integration`
- [ ] Test count: +N integração passam — sem deleções silenciosas.

**Tests:** integration → `src/modules/jobs/__tests__/resolve-job-expiry-email.int.test.ts`
- cenários: vaga com responsável+e-mail → `EmailMessage` com `to` correto e `data` mínimo; vaga sem responsável com e-mail → `null`; jobId inexistente → `null`.
**TestGate:** full
**Commit:** `feat(jobs): hidratador de e-mail de expiração para o dispatcher do Outbox (USP-044 T2)`

---

### T3: Motor do dreno `dispatchOutbox()` — claim + retry + isolamento + resolução

**What:** Função que reivindica lote limitado de linhas `topic='email'` via `FOR UPDATE SKIP LOCKED`, resolve o payload (passthrough do `EmailMessage` completo ou hidratação de `JOB_EXPIRY_D3`), envia via a porta `EmailSender`, marca `processedAt` em sucesso / `attempts`+`lastError` em falha / no-op gracioso quando resolve `null`, com isolamento por linha e log só de metadado; retorna `{sent, failed, skipped, claimed}`.
**Where:** `src/shared/lib/outbox/dispatch-outbox.ts` (novo; resolver de payload no mesmo arquivo ou irmão `resolve-outbox-email.ts`).
**Depends on:** T2 (resolver de `JOB_EXPIRY_D3` via container), T1 (template existe).
**Reuses:** `prisma.$queryRaw`/`$transaction`; `EMAIL_SENDER_TOKEN` via `container`; `childLogger({module:'cron', job:'dispatch-outbox'})`. Constantes `BATCH_SIZE=50`, `MAX_ATTEMPTS=5` (design D-3).
**Requirement:** E-001 (AC-044-D1/D2/D4/D6), P-003, P-007, **U44-MN-01**, **U44-MN-03**, **U44-MN-04**.

**Tools:** MCP: NONE · Skill: `skill-tdad`

**Done when:**
- [ ] Seleção: `topic='email' AND processedAt IS NULL AND attempts < MAX_ATTEMPTS`, `ORDER BY createdAt ASC`, `LIMIT BATCH_SIZE` (paginação obrigatória).
- [ ] Claim por linha via transação curta com `FOR UPDATE SKIP LOCKED`; envio dentro do lock; `processedAt` marcado na mesma tx em sucesso.
- [ ] Falha de linha: `attempts+1` + `lastError`, `processedAt` nulo; **nunca** lança para fora do laço (isolamento).
- [ ] `null` do resolver → `processedAt` marcado, contado como `skipped`.
- [ ] Log carrega apenas `outboxId`/`template`|`kind`/status/`attempts` — **nunca** `data`/corpo/PII (U44-MN-04).
- [ ] Injeção de `EmailSender` fake nos testes (depende da **porta**, nunca de `ResendEmailSender`).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test` **e** `npm run test:integration`
- [ ] Test count: +N unit e +M integração passam — sem deleções silenciosas.

**Tests:**
- unit → `src/shared/lib/outbox/__tests__/resolve-outbox-email.test.ts`
  - discriminação de payload: `template` válido → passthrough; `kind:'JOB_EXPIRY_D3'` → delega ao hidratador (mock); payload malformado → erro tratado; decisão `attempts < MAX` (regra de cap).
- integration → `src/shared/lib/outbox/__tests__/dispatch-outbox.int.test.ts` (Postgres real, `EmailSender` fake):
  - **AC-044-D2:** linha `EmailMessage` completa → fake chamado com a mensagem; `processedAt` setado.
  - **AC-044-D3:** linha `JOB_EXPIRY_D3` (com vaga+responsável seed) → hidratada e enviada.
  - **AC-044-D4:** fake retorna `{ok:false}` → `attempts` incrementado, `lastError` gravado, `processedAt` nulo.
  - **AC-044-D5:** `JOB_EXPIRY_D3` com jobId inexistente → `skipped`, `processedAt` setado, sem retry.
  - **U44-MN-01 (concorrência, L-010):** duas execuções `dispatchOutbox()` concorrentes (fake com barreira para forçar overlap real) sobre N linhas → **soma de envios = N, cada linha 1×**, todas com `processedAt`; asserção no **estado do DB / contagem do fake**, não em pré-check de app.
  - **U44-MN-03 (poison + isolamento):** linha com `attempts = MAX_ATTEMPTS` → **não** selecionada; e uma linha que falha no meio do lote **não** impede o envio das demais.
  - **U44-MN-04:** captura de log não contém corpo/`data`/PII.
**TestGate:** full
**Commit:** `feat(infra): dispatcher assíncrono do Outbox de e-mail com claim idempotente e retry (USP-044 T3)`

---

### T4: Rota de cron `dispatch-outbox` (fail-closed) + entrada em `vercel.json`

**What:** Route handler GET que valida `CRON_SECRET` (fail-closed) e chama `dispatchOutbox()`, mais a agenda no `vercel.json`.
**Where:** `src/app/api/cron/dispatch-outbox/route.ts` (novo) + `vercel.json` (`"crons"`).
**Depends on:** T3.
**Reuses:** `verifyCronSecret` (`src/shared/lib/cron-secret.ts`), `childLogger`, `NextResponse`, o clone de `src/app/api/cron/expire-jobs/route.ts` (mesmo esqueleto e contrato de status).
**Requirement:** E-001 (AC-044-D6), **U44-MN-02** (fail-closed).

**Tools:** MCP: NONE · Skill: `skill-tdad`

**Done when:**
- [ ] `export const dynamic = 'force-dynamic'`; `GET(request)`; `verifyCronSecret` → missing_secret `503` / unauthorized `401` (**sem chamar `dispatchOutbox`**) / ok segue.
- [ ] Sucesso → `NextResponse.json({ ok:true, sent, failed, skipped })`; erro → `500` + `log.error`; `childLogger({module:'cron', job:'dispatch-outbox'})`.
- [ ] `vercel.json` ganha `{ "path":"/api/cron/dispatch-outbox", "schedule":"* * * * *" }` (design D-4; se o plano Vercel limitar a cadência, usar a maior frequência disponível — nota operacional).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test` **e** `npm run build`
- [ ] Test count: +N unit passam — sem deleções silenciosas.

**Tests:** unit (route handler, `dispatchOutbox` mockado) → `src/app/api/cron/dispatch-outbox/__tests__/route.test.ts`
- **U44-MN-02:** sem `CRON_SECRET` no env → `503`, `dispatchOutbox` **não** chamado; segredo ausente/errado → `401`, não chamado; segredo válido → `200` com `{sent,failed,skipped}` e `dispatchOutbox` chamado **uma** vez.
**TestGate:** quick (build no gate por causa da rota nova, alinhado ao precedente `expire-jobs`)
**Commit:** `feat(infra): rota de cron dispatch-outbox fail-closed + agenda vercel.json (USP-044 T4)`

---

## Parallel Execution Map

```
Sequencial (sem [P]):
  T1 ──► T2 ──► T3 ──► T4
```
Motivo: T2/T3 são integração sobre o mesmo Postgres (estado mutável compartilhado, não paralelo-seguro — TESTING/L-010); T4 depende do motor de T3.

---

## Pré-approval Check 1 — Task Granularity

| Task | Escopo | Status |
|---|---|---|
| T1 | 1 template + 1 variante de união (1 arquivo novo + 2 edições coesas no mesmo concern email) | ✅ Granular |
| T2 | 1 query (1 arquivo) + 1 binding no container | ✅ Granular |
| T3 | 1 função/motor (1 arquivo, 1 conceito: o dreno) + resolver irmão | ✅ Granular (coeso; separar claim do laço deixaria código não-testável) |
| T4 | 1 route handler + 1 entrada de agenda | ✅ Granular |

## Pré-approval Check 2 — Diagram-Definition Cross-Check

| Task | Depends on (corpo) | Diagrama mostra | Status |
|---|---|---|---|
| T1 | None | (raiz da cadeia) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2, T1 | T2 → T3 (T1 transitivo via T2) | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |

Nenhuma task `[P]` → nenhuma dependência intra-fase paralela a checar.

## Pré-approval Check 3 — Test Co-location Validation

| Task | Camada criada/modificada | Matriz/guia exige | Task diz | Status |
|---|---|---|---|---|
| T1 | template/render puro (`shared/lib/email`, regra pura) | unit | unit | ✅ OK |
| T2 | query de leitura em módulo (toca DB) | integration | integration | ✅ OK |
| T3 | lógica de dreno (DB + porta) — regra pura + I/O | unit **+** integration | unit + integration | ✅ OK |
| T4 | route handler sensível (contrato fail-closed) | unit (route) + build | unit + build | ✅ OK |

Nenhuma `Tests: none`; nenhum diferimento de teste ("testado noutra task"). ✅ Todas as camadas com teste co-localizado.

---

## Revisão humana (Dev Sênior)

USP ICED/must-not → as 3 tabelas acima vão ao **Dev Sênior antes do Execute** (política "Claude per-US, Sênior revisa"). Pós-Execute, revisão contra `project-guideline` (□/🚨) via `pr-review`, com o `validation.md` do Verifier em mãos (Verifier independente roda antes da revisão humana).
