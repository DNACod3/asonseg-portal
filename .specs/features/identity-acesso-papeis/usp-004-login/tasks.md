# USP-004 Autenticar no portal (login) - Refactor (Fase 1) Tasks

## Execution Protocol (MANDATORY - do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill
files by filesystem path. The skill is the source of truth for the per-task cycle (implement -> gate ->
atomic commit), sub-agent delegation, adequacy review, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator - do not proceed without it.**

**Refactor discipline (applies to every restyle task):** change **only markup/classes**. Do not touch
handlers, schemas, actions, navigation, metadata, or cache config on restyle tasks. Existing tests MUST
stay green (no weakening/deleting). **Login (`login/page.tsx` + `LoginForm.tsx`) is OUT OF SCOPE - já
reestilizado na Unidade 0 (AD-014); não tocar.** Preserve: lockout (5/15min), anti-timing, mensagem
genérica, sessão 12h, `withAudit` de sucesso+falha - todos vivem em `login.ts`/domínio e **não** são
tocados.

**Backend discipline (T1):** a padronização toca **apenas** a resolução do ator (passos 2). A transação
de escrita (`updateUser` + `credential.update` + `withAudit`) é preservada verbatim. Não enfraquecer o
fluxo de 1º acesso.

---

**Design**: `.specs/features/identity-acesso-papeis/usp-004-login/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found:
> `CLAUDE.md` (§Testing Requirements), `docs/arch/project-guideline.md` (DoD), `vitest.config.ts`.
> DS `.tsx` ficam fora do gate de cobertura (filosofia do repo, AD-014), mas cada Client Component
> tocado tem `.test.tsx` co-localizado que roda em `npm run test`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Server Action (`changePasswordFirstAccess`) | unit | Happy + VALIDATION + **guarda negativa (U4-MN-01)**: `getCurrentPerson→null` e `credential→null` sem escrita + erro do provedor | `src/modules/identity/__tests__/changePassword.test.ts` | `npm run test` |
| Client Component (`ChangePasswordForm`) | unit (RTL) | Render de campos + validação client-side (U4-MN-02: fraca/divergente → não chama a action) + happy/erro | `src/modules/identity/__tests__/ChangePasswordForm.test.tsx` | `npm run test` |
| Server Component (`trocar-senha/page.tsx`) | none | Gate de build (padrão do repo para restyle de página sem roteamento condicional) | `src/app/(auth)/trocar-senha/**` | build gate |

## Parallelism Assessment

> Generated from codebase - confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (action, mocks) | Yes | `vi.mock` + `vi.hoisted` por arquivo; sem estado compartilhado | `changePassword.test.ts:9-40` |
| unit (RTL, jsdom) | Yes | Isolamento por arquivo; deps mockadas | `ChangePasswordForm.test.tsx`, `LoginForm` pattern |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks com testes unit (action ou RTL) | `npm run typecheck && npm run lint && npm run test` |
| Build | Tasks de restyle de Server Component (página) | `npm run typecheck && npm run lint && npm run test && npm run build` |

> Sem gate Full/integração: nenhum teste de integração (Postgres) é tocado por esta unidade.

---

## Execution Plan

### Phase 1: Padronização de backend (Sequential)

```
T1
```

### Phase 2: Restyle do formulário (Parallel OK)

```
T2  (ChangePasswordForm - independe de T1)
```

### Phase 3: Casca de página (Sequential)

```
T2 ──→ T3
```

3 fases -> execução inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Padronizar `changePasswordFirstAccess` para `getCurrentPerson()` + guarda de credencial

**What**: Substituir a resolução do ator (passos 2: `supabase.auth.getUser()` + `prisma.person.findUnique`)
por `getCurrentPerson()`; adicionar a guarda de credencial via `prisma.credential.findUnique`;
preservar a transação de escrita; atualizar o teste unit da action ao novo seam e adicionar o caso
negativo da guarda.
**Where**:
- `src/modules/identity/actions/changePassword.ts` (modify - só os passos de resolução; transação intocada)
- `src/modules/identity/__tests__/changePassword.test.ts` (modify - novo seam + caso negativo)
**Depends on**: None
**Reuses**: `getCurrentPerson` (`../server/session`), `createSupabaseServerClient`, `withAudit`, `Credential.personId @unique` (`prisma/schema.prisma:217`)
**Requirement**: U4-BACKEND-01, U4-MN-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] A action resolve o ator via `const person = await getCurrentPerson()`; `if (!person) return fail('UNAUTHENTICATED', ...)` **antes de qualquer escrita**.
- [ ] Guarda de credencial: `prisma.credential.findUnique({ where: { personId: person.id }, select: { id: true } })`; `if (!credential) return fail('FORBIDDEN', ...)`.
- [ ] `supabase.auth.getUser()` e `prisma.person.findUnique` **não** são mais usados para resolver o ator na action.
- [ ] Transação preservada: `updateUser({ password: senhaNova })`, `withAudit(AUTH_PASSWORD_CHANGED_FIRST_ACCESS)` baixando `primeiroAcesso` via `tx.credential.update({ where: { id: credential.id } })`, `actorUserId: person.supabaseUserId`, `actorPersonId: person.id`, `context: { route: '/trocar-senha' }`; retorna `{ redirectTo: '/inicio' }`.
- [ ] Teste atualizado ao novo seam: mock de `../server/session` (`getCurrentPerson`) + `prisma.credential.findUnique` (no lugar de `person.findUnique`); mock de `supabase.updateUser` preservado.
- [ ] Cenários preservados: happy (atualiza senha + baixa flag + audita + `/inicio`); `VALIDATION` (input inválido); erro do provedor → `INTERNAL`.
- [ ] **Negative test (U4-MN-01)** adicionado/atualizado: `getCurrentPerson→null` → `UNAUTHENTICATED` com `updateUser` e `withAudit`/`credential.update` **não** chamados; `credential→null` (Pessoa ativa) → `FORBIDDEN` com zero escrita.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: `changePassword.test.ts` mantém os 4 casos de schema + >=5 casos de action (happy, VALIDATION, `null`→UNAUTHENTICATED, `credential null`→FORBIDDEN, provider→INTERNAL), todos verdes (sem deleções silenciosas).

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(identity): padroniza changePasswordFirstAccess p/ getCurrentPerson (ADR-0030)`

---

### T2: Restyle `ChangePasswordForm` para o Design System (só estilo) [P]

**What**: Trocar `<label>`/`<input>`/`<button>` crus por `Label`/`Input`/`Button`; caixa de erro no
padrão danger-token; manter verdes os 5 casos do `ChangePasswordForm.test.tsx`.
**Where**:
- `src/modules/identity/components/ChangePasswordForm.tsx` (modify - só marcação/classe)
**Depends on**: None (independe de T1; toca arquivo diferente)
**Reuses**: `LoginForm.tsx` (padrão de restyle), `@/shared/ui`
**Requirement**: U4-STYLE-01, U4-MN-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Form usa `Label`/`Input`/`Button variant="primary"` do `@/shared/ui`; nenhuma classe de paleta crua (`bg-blue-600`, `text-gray-*`, `border-gray-300`, `focus:ring-blue-*`, `bg-red-50`, `text-red-*`).
- [ ] Caixa de erro do servidor no padrão danger-token (`rounded-sm bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger`); erros de campo mantêm `<p role="alert" className="text-xs text-danger">`.
- [ ] Comportamento preservado: RHF+Zod (`changePasswordFirstAccessSchema`), gate client de força/confirmação, `changePasswordFirstAccess`, `router.replace(redirectTo)` + `refresh`; labels "Nova senha"/"Confirmar nova senha" e botão "Salvar nova senha" inalterados.
- [ ] **RTL (U4-MN-02):** `ChangePasswordForm.test.tsx` (5 casos existentes) permanece verde sem alteração das assertivas - "senha fraca → NÃO chama a action" e "confirmação diferente → NÃO chama a action" continuam passando.
- [ ] Renderiza corretamente em light e dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: `ChangePasswordForm.test.tsx` = 5 casos verdes (inalterados).

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(identity): restyle ChangePasswordForm com Design System (AD-014) - só estilo`

---

### T3: Restyle `trocar-senha/page.tsx` para o Design System (só estilo)

**What**: Envolver a página com `FormHeader` (+ `StepIcon variant="blue"`, glifo de cadeado) + `FormCard`
ao redor do `ChangePasswordForm`; tokens em qualquer texto auxiliar.
**Where**: `src/app/(auth)/trocar-senha/page.tsx` (modify - só marcação/classe)
**Depends on**: T2 (o form restilizado é renderizado dentro do card)
**Reuses**: `@/shared/ui` (`FormHeader`, `StepIcon`, `FormCard`); `login/page.tsx` como gabarito de composição
**Requirement**: U4-STYLE-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Página compõe `FormHeader title="Defina sua nova senha" description="..."` (+ opcional `StepIcon variant="blue"`) + `FormCard` ao redor do `ChangePasswordForm`.
- [ ] Preservados sem alteração: `metadata`, `dynamic='force-dynamic'`, o import de `ChangePasswordForm`.
- [ ] Sem classes de paleta crua (`text-gray-900`, `text-gray-500`); textos usam `text-fg`/`text-fg-muted` (ou via `FormHeader`).
- [ ] Renderiza corretamente em light e dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component - gate de build, padrão do repo)
**Gate**: build

**Commit**: `refactor(identity): restyle página de troca de senha (1º acesso) com Design System (AD-014)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1  (padronização de sessão + testes unit da action)

Phase 2 (Parallel):
  T2 [P]  (restyle form - independe de T1)

Phase 3 (Sequential):
  T2 complete, then:
    T3  (restyle página - usa o form no card)
```

**Parallelism constraint:** T1 e T2 tocam arquivos distintos (action vs. componente) e poderiam ir em
qualquer ordem; mantidos em fases separadas por clareza de commit (backend, depois apresentação). T3
depende de T2 (composição visual). Todos os testes são unit/jsdom (parallel-safe).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: padronização de sessão + testes unit | 1 deliverable coeso (a resolução do ator; action + seu teste) | Granular |
| T2: restyle form | 1 componente | Granular |
| T3: restyle página | 1 arquivo | Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (raiz) | Match |
| T2 | None | [P] em Phase 2, sem seta de entrada | Match |
| T3 | T2 | T2 -> T3 | Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Server Action | unit | unit | OK |
| T2 | Client Component | unit (RTL) | unit | OK |
| T3 | Server Component (página) | none (build) | none | OK |

---

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U4-MN-01 (sem escrita sem Pessoa ativa/credencial) | T1 | `changePassword.test.ts` casos `getCurrentPerson→null`/`credential→null`: `ok=false`, `updateUser`/`withAudit`/`credential.update` não chamados |
| U4-MN-02 (validação client-side não enfraquecida) | T2 | `ChangePasswordForm.test.tsx` "senha fraca → NÃO chama a action" e "confirmação diferente → NÃO chama a action" (existentes, mantidos verdes) |

---

## Task Verification Standards

Cada `Done when` é binário e referencia o comando de gate da seção Gate Check Commands. Contagens de
teste explícitas previnem deleções silenciosas. Restyle tasks (T2/T3) devem manter verdes todos os
testes existentes da USP-004 (regra de refactor: só estilo). **Login não é tocado** (já no DS,
Unidade 0). T1 preserva a transação de escrita e todas as guardas do 1º acesso.
