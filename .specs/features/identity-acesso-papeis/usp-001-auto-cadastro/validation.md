# USP-001 Auto-cadastro - Refactor (Fase 1) Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/identity-acesso-papeis/usp-001-auto-cadastro/spec.md`
**Diff range**: `e54e725..HEAD` (6 commits, `32b0dbb`..`8a82624`)
**Verifier**: independent sub-agent (author != verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | Done | Guarda HMAC + repasse de `sig` + testes de integração (`32b0dbb`) |
| T2   | Done | Restyle `RegisterPersonForm` + RTL novo (`8f0e502`) |
| T3   | Done | Restyle `cadastro/page.tsx` (`57ef01f`) |
| T4   | Done | Restyle `cadastro/consentimento/page.tsx` (`847400d`) |

---

## Spec-Anchored Acceptance Criteria

### P1: Restyle das telas do auto-cadastro para o Design System (AD-014)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: página de cadastro usa `FormHeader`+`StepIcon`(blue)+`FormCard`, sem paleta crua | Nenhuma classe `bg-blue-*`/`text-gray-*`; primitivos do DS compostos | `src/app/(auth)/cadastro/page.tsx:52-63` - `<StepIcon variant="blue">`, `<FormHeader .../>`, `<FormCard>` envolvendo o form; nenhuma ocorrência de `text-gray-*`/`bg-blue-*` no arquivo (confirmado por diff, ausência de matches) | PASS |
| AC2: `RegisterPersonForm` preserva RHF/Zod, CAPTCHA fail-closed, anti-enumeração, chamada a `registerPerson` | Comportamento idêntico ao pré-refactor | `src/modules/identity/__tests__/RegisterPersonForm.test.tsx:81-116` - `expect(actionState.registerPerson).toHaveBeenCalledWith(...)`, `expect(await screen.findByText('Não foi possível concluir o cadastro.')).toBeInTheDocument()` | PASS |
| AC3: página de aceite (TX2) usa `LgpdBox` + `Button` (submit + "Aceitar depois" `asChild`), preserva `verifyConsentToken`/`safeRedirect`/`acceptConsent` | Termo em `LgpdBox`; ambos botões via `Button` | `src/app/(auth)/cadastro/consentimento/page.tsx:92-119` - `<LgpdBox title=...>`, `<Button type="submit" ...>`, `<Button asChild variant="outline" ...><a href="/app/perfil">` | PASS |
| AC4: telas restilizadas resolvem cor via tokens (`data-theme`), sem hex cru | Zero hex/rgba cru introduzido | Diff completo (`git diff e54e725..HEAD`) inspecionado - nenhuma ocorrência de `#`/`rgb(` introduzida; only `color-mix(in_srgb,var(--color-*)...)` (tokens) | PASS |

### P1: Guarda de defesa em profundidade na TX2 (`acceptRoleConsent`)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: re-validar HMAC após parse Zod, antes de qualquer escrita | Guarda roda entre `safeParse` e `withAudit` | `src/modules/identity/actions/acceptRoleConsent.ts:37-45` - `if (!verifyConsentToken(...)) return fail('FORBIDDEN', ...)` posicionado antes de `await headers()`/`withAudit` | PASS |
| AC2: token válido -> prossegue idêntico (consent + grant ACTIVE + auditoria na mesma tx, ADR-0020) | 5 happy-paths preservados | `src/modules/identity/__tests__/acceptRoleConsent.int.test.ts:22-24,60-90,163-180` - todos os 5 casos existentes passam `sig: signConsentToken(...)` e continuam verdes (`npm run test:integration`: 7/7 passed neste arquivo) | PASS |
| AC3: página `acceptConsent` repassa `sig` da URL | closure inclui `sig: verifiedSig` | `src/app/(auth)/cadastro/consentimento/page.tsx:80,99` - `const verifiedSig = sig;` ... `sig: verifiedSig,` dentro de `acceptConsent()` | PASS |

---

## Edge Cases

- [x] `acceptRoleConsent` recebe `sig` de outro `personId`/`role` -> FORBIDDEN sem tocar o banco. `acceptRoleConsent.int.test.ts:198-216` - `expect(result.error.code).toBe('FORBIDDEN')`, grant permanece `AWAITING_CONSENT`, `consent` findFirst = `null`.
- [x] CAPTCHA não resolvido -> `registerPerson` não é chamado (client gate preservado). `RegisterPersonForm.test.tsx:67-79`.
- [x] Restyle não introduz campos de perfil nem checkbox inline. `RegisterPersonForm.test.tsx:60-65`.
- [x] ⚠️ `acceptRoleConsent` recebe `sig` **ausente** -> spec.md (Edge Cases, linha 113) declara outcome **FORBIDDEN**; a implementação retorna **VALIDATION** para `sig` ausente/vazio (`""` falha `z.string().min(1)` no Zod antes da guarda ser alcançada), e reserva **FORBIDDEN** apenas para `sig` bem-formado mas de outro par. Ver "Spec-precision gap" abaixo - não bloqueia PASS (o must-not U1-MN-01 exige apenas `{ok:false}` + zero escrita, ambos comprovados), mas é uma divergência de texto entre a seção Edge Cases e a tabela de Assumptions do próprio spec.md (que já documenta esse split). Recomendação: corrigir a redação da linha 113 do spec.md para "VALIDATION (ausente/vazio) ou FORBIDDEN (mismatch)".

**Status**: All edge cases handled; 1 spec-precision gap flagged (documentation-only, does not affect security guarantee).

---

## Discrimination Sensor

Todas as mutações abaixo foram injetadas em estado descartável (edição direta + `git checkout --` para reverter) e a árvore real nunca ficou suja entre passos (`git diff --quiet -- src/` confirmado limpo ao final).

| # | File:line | Description | Killed? |
| - | --- | --- | --- |
| 1 | `src/modules/identity/actions/acceptRoleConsent.ts:43-45` | Removida a guarda inteira (`if (!verifyConsentToken...) return fail(...)`) | Killed - `acceptRoleConsent.int.test.ts` 1/7 falhou (caso "sig de outro personId/role" passou a `ok:true`, indevido) |
| 2 | `src/modules/identity/actions/acceptRoleConsent.ts:43` | Condição invertida (`if (verifyConsentToken(...))` - guarda passa a rejeitar todo `sig` válido) | Killed - 5/7 falharam (todos os caminhos-feliz) |
| 3 | `src/modules/identity/schemas/registerPerson.ts:61` | `captchaToken: z.string().min(1, ...)` -> `.min(0, ...)` (removida a exigência Zod, a real guarda fail-closed) | Killed - `RegisterPersonForm.test.tsx` 1/5 falhou (exatamente o teste U1-MN-02) |
| 4 | `src/modules/identity/components/RegisterPersonForm.tsx:188` | Injetados `<input type="checkbox">` e `<input id="escolaridade">` no form | Killed - `RegisterPersonForm.test.tsx` 1/5 falhou (exatamente o teste U1-MN-03) |

**Sensor depth**: lightweight (4 mutações direcionadas ao código de maior risco: guarda TX2 e os dois must-nots de UI)
**Result**: 4/4 killed - PASS

Nota metodológica (mutação 3): o gate client `if (!captchaToken)` em `RegisterPersonForm.tsx:57` é defesa secundária; a defesa primária (fail-closed real) é o schema Zod `captchaToken: z.string().min(1)`, que bloqueia o submit via RHF antes do `onSubmit` rodar. Mutar apenas o gate client não mata o teste U1-MN-02 (Zod já bloqueia); mutar o Zod mata exatamente esse teste. Isso é esperado e não é uma fraqueza dos testes - é a ordem de defesa em profundidade documentada no design.

---

## Must-Not Verification

| ID | SHALL NOT... | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U1-MN-01 | Ativar grant/persistir consent sem HMAC válido | `acceptRoleConsent.int.test.ts:182-199` (sig vazio, VALIDATION) e `:201-219` (sig de outro par, FORBIDDEN) - ambos `expect(grant?.status).toBe('AWAITING_CONSENT')` + `expect(consent).toBeNull()` | Yes | Yes (mutações 1 e 2) |
| U1-MN-02 | Chamar `registerPerson` sem CAPTCHA resolvido | `RegisterPersonForm.test.tsx:67-79` - `expect(actionState.registerPerson).not.toHaveBeenCalled()` | Yes | Yes (mutação 3) |
| U1-MN-03 | Inserir campos de perfil/checkbox inline no cadastro | `RegisterPersonForm.test.tsx:60-65` - `expect(screen.queryByRole('checkbox')).toBeNull()`, `expect(screen.queryByLabelText(/escolaridade\|currículo\|telefone\|nascimento/i)).toBeNull()` | Yes | Yes (mutação 4) |

**Status**: All must-nots proven

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | PASS - T1 delta é 2 linhas de guarda + 1 campo de schema; restyle é markup/classe apenas |
| Surgical changes | PASS - nenhum handler/schema(exceto `sig`)/query/navegação/metadata alterado fora do escopo de T1 |
| No scope creep | PASS - `Out of Scope` do spec (checkbox inline, campos de perfil, troca HMAC->sessão) respeitado |
| Matches patterns | PASS - reusa `LoginForm` como padrão de restyle, `@/shared/ui` barrel, `signConsentToken`/`verifyConsentToken` existentes |
| Spec-anchored outcome check | PASS com 1 ressalva (ver Edge Cases - gap de redação, não de comportamento) |
| Per-layer Coverage Expectation met | PASS - Server Action: integration (happy+validação+guarda negativa); Client Component: RTL (render+2 must-nots); Server Component: gate de build (padrão do repo, confirmado em design.md Assumptions) |
| Every test maps to a spec requirement | PASS - todos os testes novos citam o ID (U1-MN-01/02/03, U1-GUARD-01) em nome/comentário |
| Documented guidelines followed | `CLAUDE.md` (Server Action pattern, Testing Requirements), `docs/arch/project-guideline.md` (DoD) - Server Action sequence (Zod -> guarda -> withAudit) seguida; ADR-0020 invariante preservada |

---

## Scope Hygiene

`git diff e54e725..HEAD --name-status` retorna exatamente 10 arquivos (todos dentro de `src/`, listados na Task Completion / diff acima). Nenhum arquivo de `.agents/`, `.claude/skills/`, `.wolf/`, `.specs/prd/`, `.specs/evaluations/` ou `.specs/features/vagas/` foi commitado neste range - essas alterações permanecem como working-tree sujo pré-existente, fora do escopo desta feature (confirmado via `git status --short` antes e depois da verificação).

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build && npm run test:integration`
- **Result**:
  - `typecheck`: 0 erros
  - `lint`: 0 erros
  - `test` (unit/RTL): **854 passed**, 0 failed, 117 arquivos
  - `build`: sucesso (`next build`, todas as rotas geradas, incluindo `/cadastro`, `/cadastro/consentimento`)
  - `test:integration`: **219 passed**, 0 failed, 39 arquivos (Postgres local `:55322`, rodado sozinho - não paralelo)
- **`acceptRoleConsent.int.test.ts` isolado**: 7/7 passed (5 happy-paths atualizados com `sig` válido + 2 negativos novos U1-MN-01)
- **`RegisterPersonForm.test.tsx`**: novo arquivo, 5/5 passed
- **Test count antes do refactor**: baseline não coletado formalmente (feature já mergeada); `acceptRoleConsent.int.test.ts` tinha 5 casos antes -> 7 depois (+2, ambos negativos do must-not, sem deleção). `RegisterPersonForm.test.tsx` é arquivo novo (+5).
- **Skipped tests**: nenhum
- **Failures**: nenhuma

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| IDN-01/02/03 (upstream) | Preservado | Verified (preservado, sem regressão) |
| U1-STYLE-01 | Pending | Verified |
| U1-GUARD-01 | Pending | Verified |
| U1-MN-01 | Pending | Verified |
| U1-MN-02 | Pending | Verified |
| U1-MN-03 | Pending | Verified |

---

## Summary

**Overall**: Ready

**Spec-anchored check**: 7/7 ACs matched spec outcome; 1 spec-precision gap (edge case "sig ausente" - spec.md diz FORBIDDEN, implementação retorna VALIDATION via Zod; comportamento de segurança - zero escrita, `ok:false` - preservado em ambos os ramos)
**Sensor**: 4/4 mutations killed
**Must-nots**: 3/3 green, todos com guarda comprovadamente morta por mutação
**Gate**: typecheck/lint/test(854)/build/test:integration(219) todos verdes

**What works**: Guarda de defesa em profundidade na TX2 é real e comprovada por mutação (não apenas "existe um teste" - remover ou inverter a guarda quebra os testes certos). Restyle é estritamente markup/classe - handlers, schemas (exceto o campo `sig` de T1), actions e queries fora de T1 permanecem intocados. Fluxo split TX1->TX2 e o aceite afirmativo sem `defaultChecked` preservados. CAPTCHA fail-closed e ausência de campos de perfil/checkbox comprovados por sensores que efetivamente discriminam.

**Issues found**:
1. Spec-precision gap (não-bloqueante): `spec.md` linha 113 (Edge Cases) declara `FORBIDDEN` para `sig` ausente; a implementação (correta e testada) retorna `VALIDATION` nesse caso porque o Zod (`sig: z.string().min(1)`) intercepta antes da guarda. Fix sugerido: editar a linha 113 do spec.md para refletir o split já documentado na tabela de Assumptions (linha 47) - "VALIDATION (Zod, ausente/vazio) ou FORBIDDEN (guarda, mismatch)".

**Next steps**: Nenhuma ação de código necessária. Recomenda-se atualizar a redação da linha 113 de `spec.md` (Edge Cases) na próxima janela de manutenção da spec para eliminar a ambiguidade textual - não é bloqueante para PASS.
