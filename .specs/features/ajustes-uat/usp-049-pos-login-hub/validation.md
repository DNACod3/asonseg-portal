# USP-049 — Pós-login hub/redirects/perfil/logout Validation

**Date**: 2026-07-11
**Spec**: `.specs/features/ajustes-uat/usp-049-pos-login-hub/spec.md`
**Diff range**: `c9d8a7c^..e9d5ae9` (8 commits, base `2f9e859`, branch `feat/fase-8-remediacao-uat`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 maskCpf | ✅ Done | `src/modules/persons/domain/cpf-mask.ts` |
| T2 buildHubLinks | ✅ Done | `src/modules/identity/domain/hub-links.ts` |
| T3 constantes identity/domain | ✅ Done | `role-activation.ts` (edit) + `roles.ts` (novo, `ALL_ROLE_LABELS`) |
| T4 signOutAction + SignOutForm | ✅ Done | `actions/signOut.ts` + `components/SignOutForm.tsx` |
| T5 viewPersonForSelf | ✅ Done | `views/view-person-for-self.ts` + unit + int |
| T7 `/inicio` page + card + guard | ✅ Done | `src/app/(app)/inicio/page.tsx` + `_components/hub-link-card.tsx` + DS scan |
| T8 redirects cadastro/consentimento | ✅ Done | `(auth)/cadastro/page.tsx` + `consentimento/page.tsx` |
| T6 `/perfil` real | ✅ Done | `src/app/(app)/perfil/page.tsx` (substitui placeholder) |

All 8 tasks committed atomically (8 commits, one per task, matching `tasks.md` commit messages exactly).

---

## Declared Deviations (author) — verified

| # | Deviation | Verified against code |
| - | --------- | ---------------------- |
| 1 | `ALL_ROLE_LABELS` instead of `ROLE_LABELS` (barrel name collision) | ✅ Confirmed: `role-activation.ts:31` already exports `ROLE_LABELS` (PublicRole-scoped, pre-existing, USP-006). `domain/roles.ts` documents the collision inline (`SPEC_DEVIATION` comment) and exports `ALL_ROLE_LABELS` (8 roles). Barrel `identity/index.ts:120,132` re-exports both without collision. |
| 2 | Page tests co-located `page.test.tsx` instead of `__tests__/` | ✅ Confirmed repo convention: `src/app/(app)/inicio/page.test.tsx`, `src/app/(app)/perfil/page.test.tsx` co-located; `_components/__tests__/`, `identity/__tests__/`, `persons/__tests__/`, `cadastro/consentimento/__tests__/` used elsewhere in the same diff — mixed co-location matches pre-existing repo pattern, not a fabricated exception. |
| 3 | Comments without literal "/app/" | Cosmetic; not spec-relevant, no impact on ACs. |
| 4 | Pre-existing flake in archive-job/pause-job.int (jobs) | ✅ Confirmed out of scope: `git diff --stat` for the feature range touches zero files matching `*jobs*` (26 files total, all under `identity`, `persons`, `app/(app)/inicio`, `app/(app)/perfil`, `app/(auth)/cadastro`). |

---

## Spec-Anchored Acceptance Criteria

### P1: Hub `/inicio`

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| HUB-01: Pessoa ativa acessa `/inicio` → 200, saudação + atalhos, sem 404 | HTTP 200, `person.fullName` na saudação | `src/app/(app)/inicio/page.test.tsx:51` — `expect(screen.getByText('Olá, Ana Candidata')).toBeInTheDocument()`; live check: `curl /inicio` → 307→`/login` (middleware auth), não 404 (see Outcome Check) | ✅ PASS |
| HUB-02: links pessoais fixos sempre presentes, mesmo sem papel | `/perfil`, `/perfil/papeis`, `/consentimentos` sempre no grupo "Minha conta" | `hub-links.test.ts:35-49` — `expect(minhaConta!.links.map(l=>l.href)).toEqual([...])`; `page.test.tsx:108-120` — papel-zero → 3 links | ✅ PASS |
| HUB-03: CANDIDATE→/candidato; PROVIDER→/prestador,/prestador/servicos,/prestador/manifestacoes; COMPANY_RESPONSIBLE→/empresa/cadastrar | exatamente esses hrefs por flag | `hub-links.test.ts:53-68` — `toContain`/`toEqual(arrayContaining(...))` por flag | ✅ PASS |
| HUB-04: `canAccessModerationQueue` true→`/moderacao`; false→ausente | link presente sse guard ao vivo true | `page.test.tsx:76-106` — 2 casos (com/sem delegação), incluindo `toHaveBeenCalledTimes(1)` no guard | ✅ PASS |
| HUB-05: links institucionais por guard (`/relatorios`, `/encaminhamentos/novo`, `/cadastro-assistido`, `/credenciais/reivindicacoes`, `/permissoes`) | cada um só para seu conjunto de papéis | `hub-links.test.ts:75-98,122-147` — um teste por link + por papel (COORDINATOR/SOCIAL_ASSISTANT/BOARD) | ✅ PASS |
| HUB-06: hub contém `SignOutForm` | botão "Sair" renderizado | `page.test.tsx:63-74` — `expect(screen.getByRole('button',{name:'Sair'})).toBeInTheDocument()` | ✅ PASS |
| HUB-07: 1º acesso → redirect `/trocar-senha` herdado | `requireActivePerson()` chamado sem `allowFirstAccess` | `page.test.tsx:136-146` — `expect(...).toHaveBeenCalledWith()` (zero args); comportamento herdado, não reimplementado (código não chama `redirect` diretamente) | ✅ PASS |

### P1: Redirects cadastro/consentimento

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| REDIR-01: fim de cadastro → `/candidato`/`/prestador`/`/inicio` por papel, nenhum `/app/` | valores exatos por papel | `registration-next-step.test.ts:17-31` — `expect(registrationNextStep('CANDIDATE')).toBe('/candidato')` etc. | ✅ PASS |
| REDIR-02: consentimento aceito → `next` validado ou fallback `/inicio` (não `/app/perfil`) | fallback = `/inicio` | `cadastro/consentimento/__tests__/page.test.tsx:64-74` — href "Aceitar depois" = `/inicio` (mesma constante do fallback); `role-activation.ts:82-86` código-fonte | ✅ PASS |
| REDIR-03: "Aceitar depois" → `/inicio` | href exato `/inicio` | `page.test.tsx:54-62` — `toHaveAttribute('href','/inicio')` | ✅ PASS |
| REDIR-04: `safeRedirect` preservado (anti-open-redirect) | comportamento existente não alterado | `src/app/(auth)/cadastro/consentimento/page.tsx:90` — `safeRedirect(next?..., POST_AUTH_FALLBACK)` mantém a chamada existente, só troca o 2º argumento | ✅ PASS |

### P2: `/perfil` real

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| PERFIL-01: nome/e-mail/CPF mascarado/papéis PT-BR | valores exatos exibidos | `perfil/page.test.tsx:50-67` — `getByText('Maria da Silva')`, `getByText('***.***.***-09')`, `getByText('Candidato(a)')` | ✅ PASS |
| PERFIL-02: atalhos `/perfil/papeis`, `/consentimentos` + logout | hrefs exatos + botão Sair | `perfil/page.test.tsx:69-89` | ✅ PASS |
| PERFIL-03: só `status=ACTIVE` | grant REVOKED ausente | `view-person-for-self.int.test.ts:56-73` — `expect(view!.roles).not.toContain('PROVIDER')` (papel REVOKED) contra Postgres real | ✅ PASS |

### P2: Logout

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| LOGOUT-01: "Sair" → `signOut()` + `redirect('/login')` | ambas chamadas, destino exato | `signOut.test.ts:56-61` — `toHaveBeenCalledTimes(1)` (signOut) + `toEqual(['/login'])` | ✅ PASS |
| LOGOUT-02: sem sessão → ainda redireciona (idempotente) | `redirect('/login')` mesmo com `getCurrentPerson()→null` | `signOut.test.ts:68-73` | ✅ PASS |
| LOGOUT-03: hub e `/perfil` renderizam `SignOutForm` | botão presente nas duas telas | `page.test.tsx:63-74` (hub) + `perfil/page.test.tsx:88` (perfil) | ✅ PASS |

**Status**: ✅ All ACs covered — 0 spec-precision gaps (todo critério tinha valor/estado preciso na spec, e o teste mira exatamente esse valor).

---

## Discrimination Sensor

Executado em árvore real (commits já mesclados, working tree limpa antes/depois) via edição pontual + `git checkout --` de reversão — nenhuma mutação permanece.

| # | Must-not alvo | File:line | Mutação | Killed? |
| - | -------------- | --------- | ------- | ------- |
| 1 | HUB-MN-01 | `hub-links.ts:137` | `companyResponsible` → href `/empresa/cadastrar` mudado para `/empresa` (bare, fora da allowlist) | ✅ Killed — 3 testes falharam (`hub-links.test.ts`) |
| 2 | HUB-MN-02 | `hub-links.ts:147-153` | Removido o guard `if (access.moderation)` — link `/moderacao` sempre incluído | ✅ Killed — 5 testes falharam (unit `hub-links.test.ts` + page `inicio/page.test.tsx`) |
| 3 | PERFIL-MN-01 | `app/(app)/perfil/page.tsx:16` | `viewPersonForSelf(person.id)` → hardcoded `viewPersonForSelf('some-other-person-id')` | ✅ Killed — `perfil/page.test.tsx` PERFIL-MN-01 falhou |
| 4 | LOGOUT-MN-01 | `identity/actions/signOut.ts:20-27` | `redirect('/login')` movido para **antes** de `supabase.auth.signOut()` | ✅ Killed — 3 testes falharam (`signOut.test.ts`), incl. `callOrder` |
| 5 | REDIR-MN-01 | `role-activation.ts:83` | `REGISTRATION_NEXT_STEP.CANDIDATE` → `/app/perfil/candidato/novo` | ✅ Killed — 3 testes falharam (`registration-next-step.test.ts`) |
| 6 | DS-MN-01 | `inicio/_components/hub-link-card.tsx:14` | Adicionado `style={{ color: '#1a2b3c' }}` (hex cru) | ✅ Killed — `ds-tokens.guard.test.ts` falhou |

**Sensor depth**: lightweight, mas com cobertura dedicada de **1 mutação por must-not** (6/6, acima do mínimo de 1–3 do tier default) — cada mutação mira o guard exato do must-not correspondente, conforme exigido por validate.md §6b.4.
**Result**: 6/6 killed — nenhum sobrevivente. Árvore restaurada (`git status --short` limpo de mutações após cada rodada, confirmado).

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| HUB-MN-01 | href fora da allowlist / `/app/` / rota-bare inexistente, para qualquer combinação de flags | `identity/__tests__/hub-links.test.ts:174-211` — 5 testes, 2⁹=512 combinações, `expect(EXISTING_HUB_ROUTES).toContain(href)` + `not.toContain('/empresa'|'/encaminhamentos'|'/pessoas')` + regex `/^\/app\//` | ✅ | ✅ |
| HUB-MN-02 | link de área sem permissão | `hub-links.test.ts:215-230` — `roles=[CANDIDATE]` e voluntário-sem-delegação → nenhum link institucional | ✅ | ✅ |
| PERFIL-MN-01 | dados de outra Pessoa em `/perfil` | `perfil/page.test.tsx:91-104` — `toHaveBeenCalledWith('person-XYZ')` (id da sessão, não hardcoded); `view-person-for-self.int.test.ts:75-95` (integração real, 2 pessoas distintas) | ✅ | ✅ |
| LOGOUT-MN-01 | navegar sem encerrar sessão | `signOut.test.ts:63-66` — `callOrder` explícito `['signOut','redirect']` | ✅ | ✅ |
| REDIR-MN-01 | destino com `/app/` ou rota inexistente | `registration-next-step.test.ts:40-58` — regex `/^\/app\//` sobre todos os valores + allowlist; `rg "/app/" src/app/(auth)/cadastro` vazio (ver Gate Check) | ✅ | ✅ |
| DS-MN-01 | hex cru / paleta fixa nas UIs novas | `inicio/__tests__/ds-tokens.guard.test.ts:27-39` — scan estático dos 4 arquivos-alvo (`inicio/page.tsx`, `hub-link-card.tsx`, `perfil/page.tsx`, `SignOutForm.tsx`) | ✅ | ✅ |

**Status**: ✅ All must-nots proven — 6/6 verdes, 6/6 com mutação do guard morta.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ — 26 arquivos, todos dentro do escopo declarado (identity, persons, app/(app)/inicio, app/(app)/perfil, app/(auth)/cadastro) |
| Surgical changes | ✅ — `role-activation.ts` só adiciona (não remove/edita comportamento de `ROLE_NEXT_STEP`); `consentimento/page.tsx`/`cadastro/page.tsx` trocam só os valores de destino |
| No scope creep | ✅ — zero arquivos `*jobs*` tocados (confirma deviation #4); casca global/app-shell, busca de Pessoas, gestão de empresa existente, auditoria de logout — todos explicitamente Out of Scope na spec e nenhum implementado |
| Matches patterns | ✅ — `<form action={serverAction}>` (precedente consentimento), `viewPersonForStaff` como precedente de View Model, `cnpj.ts` como precedente de formatador puro |
| Spec-anchored outcome check | ✅ — ver tabela acima, 0 gaps |
| Per-layer Coverage Expectation met | ✅ — domínio 1:1 com ACs (hub-links.test.ts exaustivo); view com unit+integration; Server Action com unit; páginas com RTL happy+edge (papel-zero, sem delegação, corrida rara→404) |
| Every test maps to a spec requirement | ✅ — todo `describe`/`it` referencia um ID (HUB-*, REDIR-*, PERFIL-*, LOGOUT-*, MN-*) |
| Documented guidelines followed | `CLAUDE.md` §Testing Requirements, §Server Action Pattern (gate de sessão), §Privacy (View Model self); `docs/arch/project-guideline.md` |

---

## Edge Cases

- [x] Pessoa ativa sem papel → hub com só links pessoais + logout (HUB-02): `page.test.tsx:108-120`
- [x] 1º acesso → redirect a `/trocar-senha` herdado: `page.test.tsx:136-146`
- [x] Sessão expira entre render e submit do "Sair" → idempotente: `signOut.test.ts:68-73`
- [x] `next` ausente/externo → fallback `/inicio` (REDIR-02/04): `consentimento/__tests__/page.test.tsx:64-74`
- [x] Voluntário sem delegação → sem `/moderacao`: `page.test.tsx:93-106` + `hub-links.test.ts:226-230`
- [x] Corrida rara (`viewPersonForSelf`→null) → `notFound()`, nunca substitui por dado de terceiro: `perfil/page.test.tsx:120-125`

---

## Outcome Check (spec-anchored, live)

Login real não é viável no Verifier (sem credenciais de sessão automatizáveis), então a verificação de resultado foi feita por duas vias complementares, ambas exigidas pelo orquestrador:

1. **Build**: `NODE_ENV=production npm run build` → sucesso; rotas listadas na tabela de output do Next.js:
   `ƒ /inicio` (359 B, 178 kB) e `ƒ /perfil` (359 B, 178 kB) — ambas **existem** como rotas server-rendered dinâmicas (não estáticas, condizente com `dynamic='force-dynamic'`, ADR-0030).
2. **Servidor vivo**: `npm run start` (produção) na porta 3000; `curl -sI http://localhost:3000/inicio` e `/perfil` → **HTTP 307** com `location: /login` (middleware de auth intercepta antes do render — comportamento esperado para rota `(app)` sem sessão), **não HTTP 404**. Confirma que as rotas são reconhecidas pelo App Router (um 404 real ocorreria se a rota não existisse). Servidor parado após a checagem.

**Conclusão**: `/inicio` e `/perfil` existem como rotas reais e resolvem antes do guard de auth — condição suficiente para o outcome-check ancorado na spec (ORQ-1/AUTH-4: "nenhum fluxo pós-login termina em 404").

---

## Gate Check

- **Gate command (Build)**: `npm run typecheck && npm run lint && npm run build && npm run test` — todos executados individualmente (ver abaixo), todos verdes.
- **typecheck**: ✅ `tsc --noEmit` — 0 erros.
- **lint**: ✅ `eslint .` — 0 erros (0 warnings reportados no output do gate; IDE mostrou 5 warnings pré-existentes de `sonarjs` em `hub-links.ts` sobre `Array.includes` vs `Set.has`, não bloqueantes e fora do escopo do gate declarado).
- **build**: ✅ `NODE_ENV=production npm run build` — sucesso, `/inicio` e `/perfil` presentes.
- **unit (`npm run test`)**: ✅ 258 arquivos, **1726 testes**, 0 falhas.
- **integration (`npm run test:integration`, arquivo escopado)**: ✅ `view-person-for-self.int.test.ts` — 2/2 testes, 0 falhas (Supabase local ativo).
- **`rg "/app/" src/app/(auth)/cadastro`**: ✅ vazio (nenhum prefixo de route group remanescente).
- **Test count**: 11 novos arquivos de teste introduzidos por esta USP (cpf-mask, hub-links, registration-next-step, signOut, SignOutForm, hub-link-card, view-person-for-self ×2, inicio/page, perfil/page, consentimento/page, ds-tokens.guard) — nenhuma deleção de teste detectada no diff.
- **Skipped**: nenhum.
- **Failures**: nenhuma.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ---------- |
| ORQ-1 (upstream) | Pending | ✅ Verified |
| AUTH-1 (upstream) | Pending | ✅ Verified |
| AUTH-3 (upstream) | Pending | ✅ Verified |
| AUTH-4 (upstream) | Pending | ✅ Verified |
| HUB-01..07 | Pending | ✅ Verified |
| REDIR-01..04 | Pending | ✅ Verified |
| PERFIL-01..03 | Pending | ✅ Verified |
| LOGOUT-01..03 | Pending | ✅ Verified |
| HUB-MN-01, HUB-MN-02 | Pending | ✅ Verified |
| PERFIL-MN-01 | Pending | ✅ Verified |
| LOGOUT-MN-01 | Pending | ✅ Verified |
| REDIR-MN-01 | Pending | ✅ Verified |
| DS-MN-01 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 20/20 ACs matched spec-defined outcome — 0 spec-precision gaps
**Sensor**: 6/6 mutations killed (1 per must-not, exceeding the lightweight-tier minimum)
**Must-nots**: 6/6 green, all with guard mutation killed
**Gate**: typecheck ✅, lint ✅, build ✅, unit 1726/1726 ✅, integration (scoped) 2/2 ✅

**What works**: Hub `/inicio` role-aware (todos os 8 perfis do seed cobertos por combinação de flags exaustiva 2⁹); redirects de cadastro/consentimento sem `/app/`; `/perfil` real com CPF mascarado e papéis ACTIVE-only; logout com ordem de operação garantida (signOut antes de redirect); Design System tokens-only nas 4 superfícies novas.

**Issues found**: nenhum.

**Next steps**: nenhum fix task necessário. Pronto para merge.
