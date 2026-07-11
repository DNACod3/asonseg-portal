# USP-049 — Pós-login hub/redirects/perfil/logout — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tasks com o skill **`bravi-spec-driven`**: ative-o **pelo nome** e siga o fluxo Execute e as
Critical Rules. Não busque arquivos do skill por caminho. O skill é a fonte da verdade do fluxo completo
(ciclo por task, delegação de sub-agentes, revisão de adequação, Verifier, sensor de discriminação). Os
**testes-fonte** (facts) de cada AC/must-not saem do skill **`skill-tdad`** (Gherkin PT-BR + specs Vitest red +
matriz AC→teste) antes de implementar.

**Se o skill não puder ser ativado, PARE e avise — não prossiga sem ele.**

---

**Design**: `.specs/features/ajustes-uat/usp-049-pos-login-hub/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes de Execute. Guidelines encontradas:
> `CLAUDE.md` (§Testing Requirements: Server Action cobre happy/Zod/permission/consent/concorrência; unit 90%
> domínio; integração 80% actions sensíveis), `docs/arch/project-guideline.md` (DoD), `vitest.config.ts`
> (exclui `*.int.test.ts`; coverage include = `src/shared/**`, `src/modules/**`, `src/middleware.ts`),
> `vitest.integration.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domínio puro (`identity/domain/hub-links.ts`, `role-activation.ts`, `roles.ts`; `persons/domain/cpf-mask.ts`) | unit | Todos os ramos; 1:1 com ACs; must-nots HUB-MN-01/02, REDIR-MN-01 com teste negativo | `src/modules/**/__tests__/*.test.ts` | `npm run test` |
| View / data-access (`persons/views/view-person-for-self.ts`) | unit + integration | Serialização/máscara (unit) + query real (`where status=ACTIVE`, own-id) (integração); PERFIL-MN-01 negativo | `src/modules/persons/__tests__/*.test.ts` + `*.int.test.ts` | `npm run test` + `npm run test:integration` |
| Server Action (`identity/actions/signOut.ts`) | unit | happy (signOut chamado + redirect), idempotência sem sessão; LOGOUT-MN-01 negativo | `src/modules/identity/__tests__/*.test.ts` | `npm run test` |
| Componente / Página (`SignOutForm`, `inicio/page.tsx` + `_components`, `perfil/page.tsx`) | unit (RTL/jsdom) | Render por papel (mock sessão/guards), presença de logout, links corretos; DS-MN-01 (static scan tokens-only) | `src/app/(app)/**/*.test.tsx`, `src/modules/identity/__tests__/*.test.tsx` | `npm run test` |
| Wiring de redirect (`(auth)/cadastro/page.tsx`, `cadastro/consentimento/page.tsx`) | unit (RTL page test do consentimento) + lógica em helper testado (T3) | "Aceitar depois"/fallback → `/inicio`; sem prefixo `/app/` | `src/app/(auth)/cadastro/**/*.test.tsx` | `npm run test` |
| Config / barrels | none | — (build gate: typecheck + lint) | — | build gate |

> Nota: páginas em `src/app/**` **não** entram no coverage include — a lógica testável vive em `src/modules/**`
> (medido). Isto é intencional e evita a regressão de branch-gate (lição do projeto: testes que puxam módulos
> não-medidos derrubam o gate). O núcleo puro (hub-links/máscara/redirect) é todo módulo.

## Parallelism Assessment

> Gerada de codebase — confirmar antes de Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit / RTL (`*.test.ts(x)`) | Yes | jsdom + mocks; sem store compartilhado | `vitest.config.ts` (default pool), suíte unit existente |
| integração (`*.int.test.ts`) | No | Postgres compartilhado + cleanup por suíte | `vitest.integration.config.ts`; convenção do repo (cleanup apaga linhas) |

## Gate Check Commands

> Gerada de codebase — confirmar antes de Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com testes unit/RTL | `npm run test` |
| Full | Após a task com teste de integração (T5) | `npm run test && npm run test:integration` |
| Build | Fim de fase / tasks de config/barrel | `npm run typecheck && npm run lint && npm run build && npm run test` |

---

## Execution Plan

### Phase 1: Fundação — núcleo puro + action/form (Parallel OK)

```
T1 [P]   maskCpf (persons/domain)
T2 [P]   buildHubLinks + allowlist (identity/domain)
T3 [P]   constantes identity/domain (redirect + ROLE_LABELS)
T4 [P]   signOutAction + SignOutForm
```

### Phase 2: Views + páginas + wiring (depende da Fase 1)

```
T5       viewPersonForSelf (dep: T1)            [sequencial — teste de integração]
T7 [P]   /inicio page + cards + guard tokens (dep: T2, T4)
T8 [P]   fix redirects cadastro/consentimento (dep: T3)
```

### Phase 3: Perfil (depende de T5)

```
T6       /perfil real (dep: T5, T4, T3)
```

---

## Task Breakdown

### T1: `maskCpf` — util puro de máscara de CPF [P]

**What**: Função pura que mascara um CPF revelando só os 2 últimos dígitos (`***.***.***-NN`).
**Where**: `src/modules/persons/domain/cpf-mask.ts` (+ export no barrel `src/modules/persons/index.ts`)
**Depends on**: None
**Reuses**: precedente de formatador `src/modules/companies/domain/cnpj.ts`
**Requirement**: PERFIL-01 (parte CPF)

**Tools**: MCP: NONE · Skill: `skill-tdad` (facts do formato)

**Done when**:
- [ ] `maskCpf('12345678909') === '***.***.***-09'`; 11 dígitos com/sem pontuação normalizados
- [ ] Entrada malformada (≠11 dígitos) → `***.***.***-**` (nunca vaza dígitos)
- [ ] Unit test cobre os ramos; Gate quick passa: `npm run test`
- [ ] Test count: ≥3 casos passam (sem deleção silenciosa)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(persons): maskCpf para exibição de CPF do titular (USP-049)`

---

### T2: `buildHubLinks` + allowlist de rotas — catálogo puro do hub [P]

**What**: `HubAccess`/`HubLink`/`HubLinkGroup`, `EXISTING_HUB_ROUTES`, `hubAccessFromRoles(roles)` e
`buildHubLinks(access)` puros — links pessoais fixos + links por flag, todos dentro da allowlist.
**Where**: `src/modules/identity/domain/hub-links.ts` (+ barrel `identity/index.ts`)
**Depends on**: None
**Reuses**: role-sets dos guards (`canRegisterAssisted`, `canApproveCredentialClaim`, `isCoordinator`,
`canViewOperationalReports/Social`) — valores espelhados como predicados locais (sem runtime cross-module)
**Requirement**: HUB-02, HUB-03, HUB-05, HUB-MN-01, HUB-MN-02

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [ ] `buildHubLinks` sempre inclui o grupo "Minha conta" (`/perfil`, `/perfil/papeis`, `/consentimentos`) (HUB-02)
- [ ] Cada flag (`candidate`/`provider`/`companyResponsible`/`moderation`/`referral`/`assistedRegistration`/`credentialClaim`/`reports`/`permissions`) liga exatamente seu(s) link(s) (HUB-03/05)
- [ ] **HUB-MN-01 (negativo)**: para todo subconjunto de flags, todo href ∈ `EXISTING_HUB_ROUTES`; nenhum casa `/^\/app\//`; ausência de `/empresa` bare, `/encaminhamentos` bare e `/pessoas`
- [ ] **HUB-MN-02 (negativo)**: `roles=[CANDIDATE]` (e `moderation=false`) ⇒ nenhum link institucional/moderação
- [ ] Gate quick passa; Test count: ≥8 casos passam
**Tests**: unit · **Gate**: quick
**Commit**: `feat(identity): buildHubLinks — catálogo de atalhos do hub por acesso (USP-049)`

---

### T3: Constantes de `identity/domain` — redirect de cadastro + rótulos de papel [P]

**What**: `REGISTRATION_NEXT_STEP`, `registrationNextStep(role)`, `POST_AUTH_FALLBACK='/inicio'` (em
`role-activation.ts`, junto do `ROLE_NEXT_STEP` existente) e `ROLE_LABELS` PT-BR (novo `roles.ts`).
**Where**: `src/modules/identity/domain/role-activation.ts` (editar) + `src/modules/identity/domain/roles.ts` (novo) + barrel
**Depends on**: None
**Reuses**: `PublicRole`; valores de `ROLE_LABELS` idênticos ao mapa inline de `pessoas/[id]/page.tsx`
**Requirement**: REDIR-01, REDIR-MN-01, PERFIL-01 (rótulos)

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [ ] `registrationNextStep`: `CANDIDATE→/candidato`, `PROVIDER→/prestador`, `CLIENT→/inicio`, desconhecido→`/inicio`
- [ ] **REDIR-MN-01 (negativo)**: nenhum valor de `REGISTRATION_NEXT_STEP`/`POST_AUTH_FALLBACK` casa `/^\/app\//`; todos ∈ allowlist de rotas reais
- [ ] `ROLE_LABELS` cobre CANDIDATE/PROVIDER/CLIENT/COMPANY_RESPONSIBLE/VOLUNTEER/COORDINATOR/SOCIAL_ASSISTANT/BOARD (PT-BR)
- [ ] Barrel exporta as novas constantes; Gate quick passa; Test count: ≥4 casos
**Tests**: unit · **Gate**: quick
**Commit**: `feat(identity): próximo-passo de cadastro sem prefixo /app + ROLE_LABELS (USP-049)`

---

### T4: `signOutAction` + `SignOutForm` — logout [P]

**What**: Server Action de logout (gate de sessão → `supabase.auth.signOut()` → `redirect('/login')`) +
componente Server `SignOutForm` (form com botão "Sair").
**Where**: `src/modules/identity/actions/signOut.ts` (novo) + `src/modules/identity/components/SignOutForm.tsx` (novo) + barrel
**Depends on**: None
**Reuses**: template `identity/actions/reset-password.ts:97` (`supabase.auth.signOut`); `getCurrentPerson` (gate H3); `<form action={serverAction}>` (precedente consentimento); `Button` de `@/shared/ui`
**Requirement**: LOGOUT-01, LOGOUT-02, LOGOUT-03, LOGOUT-MN-01, DS-MN-01 (form)

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [ ] `signOutAction`: chama `getCurrentPerson()` (gate), depois `supabase.auth.signOut()`, depois `redirect('/login')`
- [ ] Sem sessão (`getCurrentPerson`→null) → ainda `redirect('/login')` (idempotente) (LOGOUT-02)
- [ ] **LOGOUT-MN-01 (negativo)**: unit prova que `supabase.auth.signOut` é invocado antes do redirect; sem a chamada o teste falha
- [ ] `SignOutForm` renderiza `<form action={signOutAction}>` + `Button` "Sair"; DS-MN-01 (sem hex cru)
- [ ] Guard estático H3 satisfeito (action tem gate de sessão); Gate quick passa; Test count: ≥4 casos
**Tests**: unit (action + component RTL) · **Gate**: quick
**Commit**: `feat(identity): logout (signOutAction + SignOutForm) (USP-049)`

---

### T5: `viewPersonForSelf` — View Model do titular (dep: T1)

**What**: Projeção self `{ fullName, emailLogin, cpfMasked, roles(ACTIVE) }` lida pelo id da sessão.
**Where**: `src/modules/persons/views/view-person-for-self.ts` (+ barrel)
**Depends on**: T1 (`maskCpf`)
**Reuses**: padrão de select de `getCurrentPerson`/`viewPersonForStaff`; `maskCpf`
**Requirement**: PERFIL-01, PERFIL-03, PERFIL-MN-01

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [ ] `viewPersonForSelf(id)` retorna nome + e-mail + CPF mascarado + papéis; unit (mock prisma) cobre a serialização/máscara
- [ ] **Integração**: consulta real retorna só `roleGrants status=ACTIVE` (grant revogado não aparece) (PERFIL-03) e resolve pelo id passado
- [ ] **PERFIL-MN-01 (negativo)**: a função só aceita/usa o `personId` da sessão (sem parâmetro de terceiro); teste assevera que consulta pelo id fornecido e não expõe outra Pessoa
- [ ] Gate full passa: `npm run test && npm run test:integration`; Test count: unit ≥2 + int ≥2
**Tests**: unit + integration · **Gate**: full
**Commit**: `feat(persons): viewPersonForSelf — dados próprios do titular (USP-049)`

---

### T7: Página `/inicio` (hub) + cartões + guard tokens-only [P] (dep: T2, T4)

**What**: `HubPage` composition-root (`requireActivePerson` → flags de acesso + `canAccessModerationQueue` →
`buildHubLinks` → cartões + `SignOutForm`) + `HubLinkCard` + guard estático tokens-only das UIs novas.
**Where**: `src/app/(app)/inicio/page.tsx` (novo, `dynamic='force-dynamic'`) + `src/app/(app)/inicio/_components/hub-link-card.tsx` + `src/app/(app)/inicio/__tests__/*.test.tsx`
**Depends on**: T2 (`buildHubLinks`), T4 (`SignOutForm`)
**Reuses**: `@/modules/identity` (session, buildHubLinks), `@/modules/moderation` (`canAccessModerationQueue`), `@/shared/ui` (`Card`,`Button`,`FormHeader`)
**Requirement**: HUB-01, HUB-02, HUB-03, HUB-04, HUB-05, HUB-06, HUB-07, HUB-MN-01/02 (integração), DS-MN-01

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [ ] `/inicio` renderiza saudação com `fullName` + grupos de links do papel + `SignOutForm` (HUB-01/06)
- [ ] Page test (mock `requireActivePerson` + `canAccessModerationQueue`): candidato vê `/candidato` e links pessoais; voluntário-com-moderação vê `/moderacao`; voluntário-sem-delegação NÃO vê `/moderacao` (HUB-03/04); papel-zero vê só pessoais (HUB-02)
- [ ] `moderation` flag vem de `await canAccessModerationQueue(person)` (não de papel puro)
- [ ] **DS-MN-01 (static scan)**: teste varre `src/app/(app)/inicio/**` + `perfil/page.tsx` + `identity/components/SignOutForm.tsx` — nenhum hex cru / `bg-*-600`; só tokens
- [ ] 1º acesso → redirect `/trocar-senha` herdado (não reimplementado) (HUB-07)
- [ ] Gate quick passa; Test count: ≥5 casos
**Tests**: unit (RTL) · **Gate**: quick
**Commit**: `feat(identity): hub /inicio role-aware pós-login (USP-049 · ORQ-1)`

---

### T8: Corrigir redirects de cadastro/consentimento [P] (dep: T3)

**What**: `cadastro/page.tsx` usa `registrationNextStep` (remove o `NEXT_STEP_BY_ROLE` bugado);
`cadastro/consentimento/page.tsx` usa `POST_AUTH_FALLBACK` no `safeRedirect` e no link "Aceitar depois".
**Where**: `src/app/(auth)/cadastro/page.tsx` (editar) + `src/app/(auth)/cadastro/consentimento/page.tsx` (editar) + `src/app/(auth)/cadastro/consentimento/__tests__/*.test.tsx`
**Depends on**: T3
**Reuses**: `registrationNextStep`, `POST_AUTH_FALLBACK` (T3); `safeRedirect` existente
**Requirement**: REDIR-01, REDIR-02, REDIR-03, REDIR-04

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [ ] `cadastro/page.tsx`: `handleRegistrationSuccess` deriva o `next` de `registrationNextStep(result.role)`; nenhum literal `/app/…` remanescente
- [ ] `consentimento`: fallback `safeRedirect(next, POST_AUTH_FALLBACK)` e `<a href={POST_AUTH_FALLBACK}>Aceitar depois</a>` → `/inicio`
- [ ] Page test (RTL do consentimento, token/params válidos mockados) assevera o href "Aceitar depois" = `/inicio`; se RTL de server-component async não for viável no repo, assevera via a constante usada pela página
- [ ] `rg "/app/" src/app/(auth)/cadastro` retorna vazio (nenhum prefixo de route group)
- [ ] Gate quick passa; Test count: ≥1 caso novo
**Tests**: unit (RTL page) · **Gate**: quick
**Commit**: `fix(identity): redirects de cadastro/consentimento para rotas reais (USP-049 · AUTH-1)`

---

### T6: Página `/perfil` real do titular (dep: T5, T4, T3)

**What**: Substituir o placeholder por tela real: `requireActivePerson` → `viewPersonForSelf(person.id)` →
render (nome, e-mail, CPF mascarado, papéis via `ROLE_LABELS`) + atalhos `/perfil/papeis` e `/consentimentos`
+ `SignOutForm`.
**Where**: `src/app/(app)/perfil/page.tsx` (substituir) + `src/app/(app)/perfil/__tests__/*.test.tsx`
**Depends on**: T5 (`viewPersonForSelf`), T4 (`SignOutForm`), T3 (`ROLE_LABELS`)
**Reuses**: `@/modules/identity` (session, ROLE_LABELS, SignOutForm), `@/modules/persons` (viewPersonForSelf), `@/shared/ui` (`Card`, `Badge`)
**Requirement**: PERFIL-01, PERFIL-02, PERFIL-03, PERFIL-MN-01 (page), DS-MN-01

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [ ] Page test (mock `requireActivePerson` + `viewPersonForSelf`): exibe nome, e-mail, CPF mascarado e papéis rotulados PT-BR; sem placeholder de dev
- [ ] Contém atalhos para `/perfil/papeis` e `/consentimentos` + `SignOutForm` (PERFIL-02)
- [ ] Usa **apenas** `person.id` da sessão (nenhum param de terceiro) (PERFIL-MN-01)
- [ ] DS-MN-01: sem hex cru (coberto pelo scan do T7 que inclui `perfil/page.tsx`)
- [ ] Gate quick passa; Test count: ≥3 casos
**Tests**: unit (RTL) · **Gate**: quick
**Commit**: `feat(persons): /perfil real do titular (nome/e-mail/CPF/papéis + logout) (USP-049 · AUTH-4)`

---

## Parallel Execution Map

```
Phase 1 (Parallel — unit-safe):
    ├── T1 [P]
    ├── T2 [P]
    ├── T3 [P]
    └── T4 [P]

Phase 2 (T1..T4 completas):
    T5        (dep T1; teste de integração → sequencial, sem [P])
    ├── T7 [P] (dep T2, T4)
    └── T8 [P] (dep T3)

Phase 3 (T5 completa):
    T6        (dep T5, T4, T3)
```

**Parallelism constraint:** T5 roda sequencial (teste de integração NÃO parallel-safe — Parallelism
Assessment). T7/T8 são order-free (`[P]`). T6 sozinha na Fase 3. ≤3 fases → execução inline (sem sub-agentes).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 maskCpf | 1 função pura | ✅ Granular |
| T2 buildHubLinks | 1 arquivo domínio (catálogo puro) | ✅ Granular |
| T3 constantes identity/domain | 2 arquivos coesos (constantes) | ✅ OK (coeso) |
| T4 signOut + form | 1 action + 1 form (mesmo conceito: logout) | ✅ OK (coeso) |
| T5 viewPersonForSelf | 1 view | ✅ Granular |
| T6 /perfil page | 1 página | ✅ Granular |
| T7 /inicio page + card + guard | 1 página + 1 componente + 1 guard (mesma feature UI) | ✅ OK (coeso) |
| T8 redirect fixes | 2 edições de página (mesma correção AUTH-1) | ✅ OK (coeso) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T1 | None | Fase 1 raiz | ✅ Match |
| T2 | None | Fase 1 raiz | ✅ Match |
| T3 | None | Fase 1 raiz | ✅ Match |
| T4 | None | Fase 1 raiz | ✅ Match |
| T5 | T1 | Fase 2, dep T1 | ✅ Match |
| T7 | T2, T4 | Fase 2, dep T2,T4 | ✅ Match |
| T8 | T3 | Fase 2, dep T3 | ✅ Match |
| T6 | T5, T4, T3 | Fase 3, dep T5 (+T4,T3 da Fase 1) | ✅ Match |

Nenhuma task marcada `[P]` depende de outra `[P]` na mesma fase (T7 e T8 não dependem entre si; T5 não é `[P]`).

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Domínio puro | unit | unit | ✅ OK |
| T2 | Domínio puro | unit | unit | ✅ OK |
| T3 | Domínio puro (constantes) | unit | unit | ✅ OK |
| T4 | Server Action + componente | unit | unit | ✅ OK |
| T5 | View / data-access | unit + integration | unit + integration | ✅ OK |
| T6 | Página | unit (RTL) | unit | ✅ OK |
| T7 | Página + componente | unit (RTL) | unit | ✅ OK |
| T8 | Wiring de redirect (páginas) | unit (RTL page do consentimento) | unit | ✅ OK |

Nenhuma violação: nenhuma task usa `Tests: none` indevidamente; a lógica de redirect (T8) tem cobertura
própria (page test do consentimento) **e** o helper testado no T3 — não é deferimento de teste.

---

## 💠 Must-Not Ownership

| Must-Not | Owning task(s) | Negative test presente? |
| --- | --- | --- |
| HUB-MN-01 (nenhum href fora da allowlist / `/app/` / rota-bare inexistente) | T2 (primário), T7 (integração) | ✅ T2: varredura exaustiva de flags ∈ allowlist |
| HUB-MN-02 (nenhum link de área sem permissão) | T2 (primário), T7 | ✅ T2/T7: candidato/voluntário-sem-delegação |
| PERFIL-MN-01 (sem PII de terceiro em /perfil) | T5, T6 | ✅ T5: consulta só por id da sessão; T6: sem param de terceiro |
| LOGOUT-MN-01 (não navega sem encerrar sessão) | T4 | ✅ T4: `signOut` invocado antes do redirect |
| REDIR-MN-01 (sem `/app/` nem rota inexistente) | T3 (primário), T8 | ✅ T3: nenhum valor `/^\/app\//`; T8: `rg /app/` vazio |
| DS-MN-01 (tokens-only nas UIs novas) | T7 (scan), T4, T6 | ✅ T7: static scan sem hex cru |

Todo `[FEAT]-MN-NN` da spec tem task dona + teste negativo. Sem gap de decomposição.

---

## Tools (MCPs e Skills)

- **MCP**: nenhum necessário (só filesystem/edições locais).
- **Skill**: `skill-tdad` para gerar os facts (Gherkin PT-BR + specs Vitest red + matriz AC→teste) de cada AC e
  must-not **antes** de implementar; `bravi-spec-driven` (Execute) para o ciclo por task + Verifier.

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate`. Todo `Done when` é binário/testável e referencia o comando de
gate. Contagem de testes explicitada para prevenir deleção silenciosa. Um commit atômico por task.
</content>
