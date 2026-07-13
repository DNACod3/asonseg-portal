# USP-060 — Higiene de dev/seed Specification

> **Fonte da verdade (upstream):** dossiê de UAT `.specs/features/ajustes-uat/uat-findings-2026-07-11.md`
> (tabela **Fase 8**, achados **PUB-6/SVC-3**, **AUTH-8**, **AUTH-9/REL-4**) + o problema de
> **determinismo** detectado durante a Fase 8. Os IDs de achado do dossiê são canônicos; os
> requisitos abaixo (`HYG-NN`) são adaptadores locais que os ancoram (esta USP é net-new, fora do
> PRD/board, como USP-045…059). ROADMAP: Fase 8, épico `ajustes-uat`.

## Problem Statement

O UAT de 2026-07-11 e a própria execução da Fase 8 expuseram quatro defeitos de **higiene de dev/seed**
(não de produto de usuário final): (1) testes de integração criam taxonomia e Pessoas no DB dev
compartilhado e **não limpam**, poluindo dropdowns públicos e o select de `/permissoes`; (2) a suíte de
integração **não roda verde ponta-a-ponta** contra um DB com volume acumulado — vagas recém-criadas somem
da página 1 da busca e uma asserção de contagem anti-enumeração é sensível a volume; (3) a senha do seed
`12345678` **viola a política de senha** do produto ("ao menos uma letra"); (4) o ambiente **local não
entrega e-mail** (Resend com key dummy + `CRON_SECRET` ausente ⇒ cron 503 fail-closed), impedindo a
verificação visual de qualquer AC de e-mail. Nada disso muda arquitetura ou comportamento de produção.

## Goals

- [ ] `npm run test:integration` roda **verde de ponta a ponta** contra um DB com volume acumulado (após `supabase db reset` + reseed), sem depender de ordenação indefinida nem de contagem global.
- [ ] Nenhuma fixture de teste de integração (taxonomia órfã ou `Pessoa-XXXX`) permanece no DB dev após a suíte, e nenhuma vaza para as queries públicas de taxonomia nem para o select de voluntários.
- [ ] A senha do seed passa na política de senha mais estrita do produto e está documentada; as ~112 contas de demo continuam logando e podendo trocar/recuperar a própria senha.
- [ ] Em **desenvolvimento**, e-mails transacionais são visíveis (entregues ao Mailpit local); o cron `dispatch-outbox` roda localmente com `CRON_SECRET` documentado — **sem qualquer mudança de comportamento em produção** (Resend em prod, cron fail-closed em prod).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Alterar o `ORDER BY` / paginação de `search-jobs.ts` ou `search-services.ts` | **A investigação corrigiu a hipótese inicial:** a query de produção JÁ tem ordenação determinística (`published_at DESC NULLS LAST, last_status_change_at DESC, created_at DESC`). O defeito é **test-only** (fixtures criam vaga ACTIVE sem `publishedAt`). Nenhuma mudança de produto de determinismo é necessária. |
| Refatorar o padrão de cleanup para um helper compartilhado global (`globalTeardown`/factory) | 110/111 arquivos já fazem cleanup per-file; introduzir infra nova amplia blast-radius e arrisca os testes existentes. Correção mínima = adicionar os deletes faltantes per-file. |
| Adapter EmailSender SMTP em **produção** / trocar Resend | Estritamente dev-env/harness. Prod permanece Resend (ADR-0012/USP-044). |
| Alterar o guard fail-closed do cron (`verifyCronSecret`) | Já fail-closed em todo ambiente; local passa apenas configurando `CRON_SECRET`. Enfraquecer o guard violaria U44-MN-02. |
| Enfraquecer qualquer asserção de segurança (anti-enumeração) | Premissa inviolável; a correção do teste de credential-claim apenas **escopa** a contagem, sem tocar a propriedade de segurança. |
| Direito ao esquecimento / anonimização / retenção de PII | Frente pós-piloto (AD-024), gated por B-001. |
| Expor SMTP do Mailpit em ambientes remotos / CI | O harness é local-dev; CI não valida e-mail visualmente. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --------------------- | ----- | -------------- | --------- | ---------- |
| Determinismo do `search-jobs` NÃO é correção de produto | agent | Fix **test-only**: fixtures ACTIVE passam a setar `publishedAt` (espelhando a invariante real "toda vaga ACTIVE foi ativada e tem `publishedAt`"). A query de produção fica intocada. | A query já ordena de forma determinística; vaga ACTIVE com `publishedAt=NULL` é estado irreal (produção seta na 1ª ativação — USP-016). Corrigir a query mascararia um fixture irrealista. | y |
| Valor da nova senha do seed | agent | `asonseg2026` | Satisfaz a política mais estrita (≥8, ≤72, ≥1 letra `/[A-Za-z]/`, ≥1 número `/[0-9]/`); memorizável em PT-BR; determinística. | y |
| Abordagem do harness de e-mail dev | agent | **Adapter SMTP→Mailpit** (dev-only) via `nodemailer` como **devDependency**, selecionado por flag `EMAIL_DEV_SMTP`. Rejeitado o adapter console/log (zero-dep) porque **não** entrega ao Mailpit (o objetivo do achado é verificação VISUAL) e arriscaria U44-MN-04 (corpo/PII no log). | O achado AUTH-9/REL-4 pede "adapter EmailSender SMTP dev-only (Mailpit)"; testers já usam o Mailpit (55324) p/ e-mails de Auth — entregar os e-mails da app na mesma caixa é coerente. **⚠️ exige devDependency — ver Must-Nots/Risks.** | y |
| `nodemailer` fora do grafo de build de produção | agent | Adapter dev faz `await import('nodemailer')` **dinâmico** dentro do `send()`; a classe é importada estaticamente no container mas não puxa `nodemailer` no topo. Contingência: promover a `dependency` se o build de prod acusar leak. | Mantém `nodemailer` como devDependency dev-only sem quebrar o build de prod (gate `NODE_ENV=production build`). Lição conhecida de leak no nft (`@react-pdf`) é de tamanho de trace, não de falha de build. | y |
| Cron local: nenhuma mudança de código | agent | Apenas documentar `CRON_SECRET` no `.env.local`/`.env.example`/doc e como disparar o cron localmente com o header. | `verifyCronSecret` já fail-closed em todo ambiente; local passa configurando o segredo. Zero mudança de prod. | y |
| Interpretação de "guarda no seed" (dossiê) | agent | Sem novo código de guarda no seed: a guarda efetiva é (a) o cleanup per-file dos int-tests e (b) o `prisma/__tests__/seed.integration.test.ts` já existente (canonical taxonomy idempotente). | Nenhuma coluna distingue taxonomia de teste da canônica; a query pública não pode filtrar estruturalmente. A prevenção real é o cleanup + a guarda canônica já existente. | y |
| Exposição do SMTP do Mailpit local | agent | Descomentar `smtp_port = 55325` em `supabase/config.toml` (hoje comentado) e reiniciar o supabase. | Necessário para o app entregar SMTP ao Mailpit; hoje só a UI (55324) está exposta. Mudança de infra local, não de produto. | y |

**Open questions:** none — all resolved or logged above.

> **Entry Gate (Tasks §0):** nenhum item acima tem owner externo — todos são `agent` e resolvidos. A feature **entra** em task breakdown.

---

## User Stories

### P2: Suíte de integração determinística ⭐

**User Story**: Como desenvolvedor/CI, quero que `npm run test:integration` rode verde de ponta a ponta contra um DB com volume acumulado, para que a suíte seja um gate confiável e não dependa de ordem de execução nem de volume do DB.

**Why P2**: Sem isso a suíte é um gate não confiável (falha intermitente por volume), bloqueando merges e o Lançamento. Detectado como P2 durante a Fase 8.

**Acceptance Criteria**:

1. WHEN `archive-job.int.test.ts` e `pause-job.int.test.ts` criam uma vaga ACTIVE de fixture THEN o teste SHALL setar `publishedAt` no fixture (espelhando a invariante de produção), de modo que a asserção "a vaga aparece na página 1 de `searchJobs`" seja determinística mesmo com ≥20 vagas ACTIVE/verificadas/não-expiradas já no DB.
2. WHEN uma vaga é pausada ou arquivada nesses testes THEN a asserção de remoção (`not.toContain`) SHALL permanecer intacta e real (a vaga some da busca pública).
3. WHEN o teste anti-enumeração de `credential-claim.int.test.ts` verifica que nenhuma `CredentialClaim` foi criada para um CPF não elegível THEN a contagem SHALL ser **escopada às fixtures do próprio teste** (ex.: `where: { requestedEmail }` ou por `personId`), não uma contagem global da tabela.
4. WHEN a suíte inteira roda após `supabase db reset` + reseed de volume THEN `npm run test:integration` SHALL terminar verde (0 falhas atribuíveis a volume/ordenação).

**Independent Test**: rodar `npm run test:integration` duas vezes seguidas sem reset entre as rodadas (acumulando volume); ambas verdes.

---

### P2: Harness de e-mail local (Mailpit) + cron local

**User Story**: Como tester/desenvolvedor, quero que os e-mails transacionais caiam no Mailpit local e o cron `dispatch-outbox` rode localmente, para que eu consiga verificar visualmente os ACs de e-mail — sem alterar produção.

**Why P2**: AUTH-9/REL-4: nenhum AC de e-mail é verificável visualmente hoje; limita a validação do MVP.

**Acceptance Criteria**:

1. WHEN `EMAIL_DEV_SMTP` está ligado em desenvolvimento THEN o container SHALL resolver `EMAIL_SENDER_TOKEN` para um adapter SMTP dev que entrega ao Mailpit local (127.0.0.1:55325), e os e-mails aparecem na UI do Mailpit (127.0.0.1:55324).
2. WHEN `EMAIL_DEV_SMTP` está desligado (default) THEN o container SHALL resolver `ResendEmailSender` — o comportamento de produção fica idêntico ao atual.
3. WHEN o `.env.local` define `CRON_SECRET` e a rota `/api/cron/dispatch-outbox` é chamada com o header correspondente THEN o cron SHALL drenar o outbox localmente (sem 503), entregando os e-mails ao adapter dev.
4. WHEN o adapter dev envia um e-mail THEN ele SHALL entregar o corpo por SMTP ao Mailpit e SHALL NOT registrar o corpo do e-mail nem PII de terceiros nos logs estruturados (respeita U44-MN-04).
5. WHEN o build de produção (`NODE_ENV=production next build`) roda THEN ele SHALL passar sem `nodemailer` no caminho de produção (adapter dev nunca selecionado; `nodemailer` importado dinamicamente).

**Independent Test**: com `supabase start` (smtp 55325 exposto), `EMAIL_DEV_SMTP=1` e `CRON_SECRET` setados, disparar um fluxo que enfileira e-mail + chamar o cron com o header ⇒ e-mail visível no Mailpit; repetir com a flag off ⇒ container resolve Resend.

---

### P3: Cleanup de fixtures dos testes de integração

**User Story**: Como operador do ambiente dev, quero que os testes de integração limpem as próprias fixtures, para que taxonomia órfã e Pessoas de teste não vazem para os dropdowns públicos nem para o select de `/permissoes`.

**Why P3**: PUB-6/SVC-3: poluição visível em filtros públicos (taxonomia "Busca Int"/"Centro Int"…) e ~33 `Pessoa-XXXX` no select de voluntários. Cosmético/higiene, não afeta produto.

**Acceptance Criteria**:

1. WHEN `search-jobs.int.test.ts` termina THEN ele SHALL ter deletado a JobArea `"Busca Int Área"` e as Regions `"Busca Int Região A"`/`"Busca Int Região B"` que criou, e SHALL asseverar (contagem por nome == 0) que foram removidas.
2. WHEN `search-services.int.test.ts` termina THEN ele SHALL ter deletado as Regions `"Busca Int Serviço Região A"`/`"Busca Int Serviço Região B"` que criou (a categoria já é limpa hoje), com asserção de remoção.
3. WHEN `submit-job-for-moderation.int.test.ts` termina THEN ele SHALL ter deletado a Region `"Centro Int Submit"` que criou, com asserção de remoção.
4. WHEN `submit-service.int.test.ts` termina THEN ele SHALL ter deletado a Region `"Centro Int Submit Service"` que criou, com asserção de remoção.
5. WHEN `delegated-permissions.int.test.ts` termina THEN ele SHALL ter deletado todas as Pessoas `Pessoa-XXXX` que criou (que hoje não tem teardown algum), com asserção de remoção — de modo que `listEligibleVolunteers()` não retorne fixtures de teste.
6. WHEN qualquer cleanup roda THEN ele SHALL deletar **apenas** as linhas nomeadas pelas próprias fixtures do teste (nunca a taxonomia canônica do seed nem a Empresa de demo CNPJ `11444777000242`) e SHALL NOT executar DELETE/UPDATE em `audit_log`.

**Independent Test**: rodar a suíte; consultar `listActiveRegions`/`listApprovedJobAreas`/`listServiceCategories`/`listEligibleVolunteers` ⇒ nenhum nome de fixture de teste presente; `seed.integration.test.ts` segue verde.

---

### P3: Senha do seed válida pela política

**User Story**: Como tester das contas de demo, quero que a senha do seed passe na política de senha do produto, para que eu possa logar e também trocar/recuperar a senha sem que o formulário rejeite a própria senha semeada.

**Why P3**: AUTH-8: `12345678` (só dígitos) falha a regra "ao menos uma letra" dos schemas de trocar/recuperar senha.

**Acceptance Criteria**:

1. WHEN o seed cria as contas de Auth THEN a senha fixa SHALL satisfazer a política mais estrita do produto (≥8, ≤72, ≥1 letra, ≥1 número).
2. WHEN a documentação de credenciais de teste (`docs/operacao/contas-de-teste-seed.md`) e o log do seed (`prisma/seed.ts`) são lidos THEN eles SHALL citar a nova senha (nenhuma referência remanescente a `12345678`).
3. WHEN um teste-guarda valida a senha do seed contra os schemas de trocar/recuperar senha THEN ele SHALL passar (a senha do seed é aceita pela política).

**Independent Test**: `db:seed` e logar numa conta da tabela com a nova senha; abrir `/trocar-senha` e confirmar que a nova senha é aceita; teste-guarda verde.

---

## Edge Cases

- WHEN o cleanup de Region roda mas ainda existem Jobs/Services FK-referenciando a Region THEN o teardown SHALL deletar Jobs/Services/Companies/Persons ANTES da taxonomia (ordem correta), como os teardowns existentes já fazem.
- WHEN `EMAIL_DEV_SMTP` está ligado mas o Mailpit não está de pé (SMTP recusado) THEN o adapter dev SHALL retornar `{ ok: false }` sem lançar (o port `EmailSender` nunca lança — contrato de USP-044).
- WHEN a suíte de integração roda sem `DATABASE_URL` THEN os testes seguem auto-skipando (`describe.skipIf`) — o cleanup não roda e não quebra nada.
- WHEN o seed é re-rodado (idempotente) e as contas de Auth já existem THEN a nova senha NÃO é re-aplicada às contas existentes (Supabase reusa por e-mail) — documentar que um `db reset`/recriação de Auth é necessário para propagar a nova senha a contas pré-existentes.
- WHEN o build de prod traça `nodemailer` no bundle mesmo com import dinâmico THEN é apenas peso de trace (não falha) — se falhar, contingência = promover a `dependency`.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| -- | ------------------------------------- | -------- | ----------- | ------------- |
| HYG-MN-01 | WHEN qualquer cleanup de int-test roda THEN SHALL NOT deletar a taxonomia canônica do seed (`REGIONS`/`JOB_AREAS`/`SERVICE_CATEGORIES` de `reference.ts`) nem a Empresa de demo (CNPJ `11444777000242`) | Quebrar o seed de demo / o E2E de descoberta / `seed.integration.test.ts` | T3,T4,T5,T6,T7 | Cada delete é keyed por nomes de fixture do próprio teste; `seed.integration.test.ts` permanece verde após a suíte |
| HYG-MN-02 | WHEN qualquer cleanup de int-test roda THEN SHALL NOT executar DELETE/UPDATE em `audit_log` fora do caminho append-only (`app.audit_purge`) | Violar a invariante append-only de auditoria | T3,T5,T6,T7 | Nenhum cleanup adicionado toca `audit_log`; `append-only.int.test.ts` segue verde |
| HYG-MN-03 | WHEN a correção de determinismo é aplicada THEN ela SHALL NOT enfraquecer (a) a asserção de remoção pós-pausa/arquivamento nem (b) a propriedade de segurança anti-enumeração do credential-claim (resposta genérica + zero claim para CPF não elegível) | Mascarar regressão real de produto / enfraquecer garantia de segurança | T1,T2 | Mutação: pausar/arquivar deixa de remover ⇒ teste falha; a ação cria claim p/ CPF não elegível ⇒ contagem escopada > 0 ⇒ teste falha |
| HYG-MN-04 | WHEN em produção (deploy Vercel) THEN o sistema SHALL NOT resolver o adapter SMTP dev nem permitir `EMAIL_DEV_SMTP=true`, e o cron SHALL NOT deixar de ser fail-closed (segredo ausente ⇒ 503, incorreto ⇒ 401) | E-mail de prod indo pro Mailpit / abertura do cron em prod / transporte dev vazando p/ prod | T9,T11 | `env` parse LANÇA quando `VERCEL_ENV=production` && `EMAIL_DEV_SMTP=true` (superRefine); container resolve Resend quando a flag é false |
| HYG-MN-05 | WHEN a senha do seed é definida THEN ela SHALL NOT ser um valor que falhe a política de trocar/recuperar senha do produto | Contas de demo que não conseguem trocar/recuperar a própria senha; achado AUTH-8 reaparece | T8 | Teste-guarda: `FIXED_PASSWORD` passa `changePassword`/`password-reset` schema (letra + número + tamanho) |

---

## Requirement Traceability

| Requirement ID | Story | Achado(s) upstream | Phase | Status |
| -------------- | ----- | ------------------ | ----- | ------ |
| HYG-01 | P2: Determinismo (publishedAt em fixtures ACTIVE) | Determinismo (Fase 8) | Tasks | Implementing |
| HYG-02 | P2: Determinismo (count escopado credential-claim) | Determinismo (Fase 8) | Tasks | Implementing |
| HYG-03 | P2: Suíte verde ponta-a-ponta | Determinismo (Fase 8) | Tasks | Implementing |
| HYG-04 | P2: Adapter SMTP dev + seleção por env | AUTH-9/REL-4 | Tasks | Implementing |
| HYG-05 | P2: Prod resolve Resend (flag off) | AUTH-9/REL-4 | Tasks | Implementing |
| HYG-06 | P2: `CRON_SECRET` local + cron drena | AUTH-9/REL-4 | Tasks | Implementing |
| HYG-07 | P2: adapter dev não loga corpo/PII | AUTH-9/REL-4 | Tasks | Implementing |
| HYG-08 | P2: build de prod passa sem nodemailer no caminho de prod | AUTH-9/REL-4 | Tasks | Implementing |
| HYG-09 | P3: cleanup taxonomia (4 arquivos) | PUB-6/SVC-3 | Tasks | Implementing |
| HYG-10 | P3: cleanup Pessoas (delegated-permissions) | PUB-6/SVC-3 | Tasks | Implementing |
| HYG-11 | P3: cleanup só de fixtures do teste | PUB-6/SVC-3 | Tasks | Implementing |
| HYG-12 | P3: senha do seed válida + docs | AUTH-8 | Tasks | Implementing |
| HYG-13 | P3: teste-guarda da senha do seed | AUTH-8 | Tasks | Implementing |
| HYG-MN-01 | HYG-MN-01 | PUB-6/SVC-3 | Tasks | Implementing |
| HYG-MN-02 | HYG-MN-02 | PUB-6/SVC-3 | Tasks | Implementing |
| HYG-MN-03 | HYG-MN-03 | Determinismo | Tasks | Implementing |
| HYG-MN-04 | HYG-MN-04 | AUTH-9/REL-4 | Tasks | Implementing |
| HYG-MN-05 | HYG-MN-05 | AUTH-8 | Tasks | Implementing |

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 18 total (13 reqs + 5 must-nots), todos mapeáveis a tasks (ver tasks.md).

---

## Success Criteria

- [ ] `npm run test:integration` verde após `supabase db reset` + reseed, e verde numa segunda rodada sem reset (volume acumulado).
- [ ] Após a suíte, `listActiveRegions`/`listApprovedJobAreas`/`listServiceCategories`/`listEligibleVolunteers` não retornam nenhum nome de fixture de teste (`Int`/`Busca`/`Centro`/`Pessoa-`).
- [ ] `db:seed` cria contas que logam com a nova senha e conseguem abrir/usar `/trocar-senha` sem rejeição; nenhuma referência a `12345678` no código/docs de seed.
- [ ] Com o harness dev ligado, um e-mail transacional aparece no Mailpit (55324) e o cron local drena sem 503; com a flag off, o container resolve Resend.
- [ ] `NODE_ENV=production next build`, `typecheck`, `lint` e a suíte unit continuam verdes; **sem migração**; a única dependência nova é `nodemailer` + `@types/nodemailer` como **devDependency** dev-only.
