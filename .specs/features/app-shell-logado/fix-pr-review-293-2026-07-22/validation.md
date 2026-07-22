# Fase 10 Round 2 — App Shell Logado — Fix de Achados do `/pr-review` (PR #293) — Validation

**Date**: 2026-07-22 (rodada 1) / 2026-07-22 (rodada 2 — fix→re-verify iteração 1)
**Spec**: sem `spec.md` formal para esta rodada — achados do `/pr-review` na PR #293, verificados contra USP-064 (`.specs/features/app-shell-logado/usp-064-sidebar-desktop/`) e USP-065 (`.specs/features/app-shell-logado/usp-065-menu-perfil/`) já concluídas
**Diff range**: `920a217..b7a24eb` (rodada 1) + `b7a24eb..91f6a26` (rodada 2 — fix do único gap reportado)
**Verifier**: independent sub-agent (author ≠ verifier)
**Veredito final**: ✅ **PASS** (ver "Re-verificação — Iteração 1" ao final; a rodada 1 abaixo é preservada como registro histórico da evidência que motivou o gap)

---

## Achados originais (o que motivou os fixes)

1. ⚠️ Comentário `SPEC_DEVIATION` obsoleto em `app-sidebar.tsx` referenciando `app-desktop-menu.tsx` (deletado na PR #293).
2. ⚠️ `theme-toggle-placement.test.ts` só varria 3 arquivos com checagem booleana — não cobria `(app)/*` nem contava ocorrências.
3. ⚠️ Sidebar/menu de perfil viraram chrome permanente — sugerido 1 spec Playwright mínimo.
4. 💡 `ProfileMenu` usa `role="menu"`/`aria-haspopup` sem o contrato de teclado (Esc)/clique-fora.
5. Observação do agente de Performance: `transition-[width]` sem `duration-*`/`ease-*` em `app-sidebar.tsx`.

---

## Task Completion

| Commit | Fix | Status | Notes |
| --- | --- | ------ | ----- |
| `4040298` | Achado 1 — remove referência a `app-desktop-menu.tsx` | ✅ Done | `src/app/(app)/_components/app-sidebar.tsx:5` |
| `b03d11c` | Achado 5 — `duration-200 ease-in-out` na transição da sidebar | ✅ Done | `src/app/(app)/_components/app-sidebar.tsx:66` |
| `2316521` | Achado 2 — guard de tema conta ocorrências + cobre `(app)/*` | ✅ Done | `src/shared/__tests__/theme-toggle-placement.test.ts` |
| `7e64694` | Achado 4 — Escape + clique-fora no `ProfileMenu` | ✅ Done | `src/app/(app)/_components/profile-menu.tsx` |
| `b7a24eb` | Achado 3 — E2E mínimo do gate de sessão da casca | ✅ Done | `e2e/home/hub-sessao.spec.ts` |

All 5 findings have a corresponding commit. No task partial/blocked.

---

## Spec-Anchored Acceptance Criteria (achados tratados como AC)

| Achado (WHEN X THEN Y) | Outcome esperado | `file:line` + evidência | Result |
| --- | --- | --- | --- |
| 1: comentário `SPEC_DEVIATION` não referencia arquivo deletado | `app-sidebar.tsx` aponta só para `app-bottom-nav.tsx` (existente, com a nota completa) | `src/app/(app)/_components/app-sidebar.tsx:5` — `// SPEC_DEVIATION: ver nota completa em app-bottom-nav.tsx`; confirmado `app-bottom-nav.tsx:6` mantém a nota; `grep -rn "app-desktop-menu" src/` não retorna nenhum arquivo `.tsx` remanescente (só uma menção em docstring de teste, ver Gap 3 abaixo) | ✅ PASS |
| 2: guard de tema conta ocorrências e cobre `(app)/*` | 0 ocorrências em `layout.tsx`/`app-shell.tsx`/`app-header.tsx`/`app-sidebar.tsx`; exatamente 1 em `profile-menu.tsx`/`(public)`/`(auth)` | `src/shared/__tests__/theme-toggle-placement.test.ts:52-61` (`it.each` sobre os 4 arquivos `(app)`, `toBe(0)`) + `:64-68` (`profile-menu.tsx`, `toBe(1)`) — **mutação injetada e killed** (ver Discrimination Sensor #1, #2) | ✅ PASS |
| 3: sidebar/menu de perfil como chrome permanente — gate de sessão coberto por E2E | Acesso sem sessão a rota `(app)/*` redireciona para `/login` | `e2e/home/hub-sessao.spec.ts:29-32` — `expect(page).toHaveURL(/\/login(\?\|$)/)` + `expect(page.locator('h1')).toContainText('Entrar')`; **executado de fato** (`npx playwright test e2e/home/hub-sessao.spec.ts` → 1 passed, 20.1s, contra dev server + Supabase local reais) | ✅ PASS |
| 4a: Escape fecha o painel e devolve o foco ao trigger | `document.getElementById('profile-menu-panel')` sai do DOM; trigger recebe foco | `src/app/(app)/_components/__tests__/profile-menu.test.tsx:100-110` — `expect(...).not.toBeInTheDocument()` + `expect(screen.getByRole('button', {name: 'Abrir menu de perfil'})).toHaveFocus()` | ✅ PASS |
| 4b: clique fora do painel fecha o menu | Painel sai do DOM ao `mousedown` fora do container | `profile-menu.test.tsx:112-121` | ✅ PASS |
| 4c: clique dentro do painel não fecha via listener de fora | Painel permanece no DOM | `profile-menu.test.tsx:123-130` | ✅ PASS |
| 4d: listeners só existem no DOM enquanto `open === true` (sem vazamento) | Nenhum listener global permanente após fechar | **Sem `file:line` — nenhum teste assevera isso diretamente** (ver Gap 1) | ❌ GAP (evidence-or-zero) |
| 5: transição da sidebar anima com duração/easing válidos | Classe Tailwind compila e o efeito de largura anima em 200ms ease-in-out | `src/app/(app)/_components/app-sidebar.tsx:66` — `'border-r border-border bg-surface transition-[width] duration-200 ease-in-out'`; `npm run lint` e `npm run build` verdes (Tailwind aceita a combinação arbitrary-property + duration + ease) | ✅ PASS |

**Status**: ⚠️ 6/7 outcomes cobertos com evidência; 1 gap de cobertura (Gap 1, achado 4d — implementação correta, mas não comprovada por teste).

---

## Discrimination Sensor

Executado em scratch (arquivo copiado para `/private/tmp/.../scratchpad`, mutado no working tree, testado, revertido via `cp` do backup — nunca `git checkout`/`reset`).

| # | File:line | Mutação | Killed? |
| - | --------- | ------- | ------- |
| 1 | `src/app/(app)/_components/app-shell.tsx:1` (scratch) | Injetado `<ThemeToggle />` solto no arquivo | ✅ Killed — `theme-toggle-placement.test.ts` → `app-shell.tsx não monta <ThemeToggle>` falhou (`expected 1 to be 0`) |
| 2 | `src/app/(app)/_components/profile-menu.tsx:94` (scratch) | Duplicado `<ThemeToggle className="h-8 w-8" />` (2x) | ✅ Killed — `theme-toggle-placement.test.ts` → `profile-menu.tsx monta <ThemeToggle> exatamente 1x` falhou (`expected 2 to be 1`) |
| 3 | `src/app/(app)/_components/profile-menu.tsx:48-53` (scratch) | Removido o `return () => { removeEventListener... }` (cleanup do `useEffect`) — listeners passam a vazar entre re-renders | ❌ **Survived** — `profile-menu.test.tsx` (10/10 testes) continua verde |
| 4 | `src/app/(app)/_components/profile-menu.tsx:35` (scratch) | Removido o guard `if (!open) return;` no topo do `useEffect` — listeners passam a ser registrados mesmo com o painel fechado (exatamente o cenário que a task pediu para verificar) | ❌ **Survived** — `profile-menu.test.tsx` (10/10 testes) continua verde |

**Sensor depth**: lightweight (4 mutações, feature não é P0/crítica)
**Result**: 2/4 killed — ❌ **2 mutantes sobreviveram**, ambos no mesmo comportamento (achado 4d: "listener só existe enquanto `open === true`"). A implementação está correta (confirmado por leitura de `profile-menu.tsx:34-54`: guard `if (!open) return` + `return () => removeEventListener(...)`), mas nenhum teste do repo discrimina uma regressão nesse comportamento específico — os testes existentes cobrem *o que acontece quando os listeners disparam*, não *se eles deixam de existir quando o painel fecha*.

---

## Must-Not Verification (SIDE-MN-01..05, PROF-MN-01..05 — regressão)

Esta rodada não introduz novos must-nots formais (sem `spec.md`); a obrigação é não regredir os já verificados em USP-064/USP-065.

| ID | SHALL NOT… | Teste (`file:line`) | Green? |
| -- | ---------- | -------------------- | ------ |
| SIDE-MN-01..05 | (ver `usp-064-sidebar-desktop/validation.md`) | `app-sidebar.test.tsx` (re-executado nesta verificação) | ✅ |
| PROF-MN-01..03, 05 | (ver `usp-065-menu-perfil/validation.md`) | `profile-menu.test.tsx`, `app-shell-no-auth-pii.test.ts`, `app-shell-uses-tokens.test.ts` (re-executados) | ✅ |
| PROF-MN-04 | `ThemeToggle` flutuante montado em `(app)/*` | `theme-toggle-placement.test.ts` (fortalecido nesta rodada — agora cobre 4 arquivos `(app)` + contagem) — **este é o próprio achado 2, verificado acima com mutação killed** | ✅ |

**Status**: ✅ Todos os must-nots pré-existentes permanecem verdes (`npx vitest run` sobre os 6 arquivos-guarda: 54/54 testes passaram).

---

## Interactive UAT

Não aplicável — modo autônomo (sem supervisão), sem usuário disponível para UAT interativo. Os achados são de code review, não de comportamento visual/UX que exija julgamento humano em tempo real.

---

## Code Quality

| Principle | Status |
| --- | ------ |
| Minimum code (5 commits, cada um cirúrgico ao seu achado) | ✅ |
| Surgical changes (nenhum arquivo fora do escopo dos 5 achados) | ✅ |
| No scope creep | ✅ |
| Matches patterns (Escape/click-outside usa o mesmo molde `useState`+`useEffect`+cleanup já usado em `AppSidebar`/`ThemeToggle`; guard source-scan é o mesmo molde de `app-shell-no-auth-pii.test.ts`/`app-shell-uses-tokens.test.ts`) | ✅ |
| Spec-anchored outcome check (achados 1,2,3,5 e 4a-4c com asserção exata; 4d sem asserção — flagado) | ⚠️ |
| Every test maps to a claim (nenhum teste "solto" sem propósito) | ✅ |
| Documented guidelines followed | `docs/arch/project-guideline.md` (padrão de teste de source-scan), `CLAUDE.md` (Server Action/Client Component boundaries — não se aplica diretamente aqui, componentes já eram client) |

❌ 1 "No" relevante → Gap 1 abaixo (não bloqueia build/lint/gate, mas é uma lacuna de cobertura real no ponto que a task pediu para confirmar).

---

## Edge Cases

- [x] `app-desktop-menu.tsx` de fato não existe mais no código de produção (`find src -iname "*desktop-menu*"` → vazio)
- [x] Guard de tema falha se `<ThemeToggle>` for reintroduzido em qualquer arquivo `(app)/*` (mutação killed)
- [x] Guard de tema falha se `<ThemeToggle>` for duplicado em `profile-menu.tsx` (mutação killed)
- [x] E2E roda de fato contra servidor real (não é um teste trivialmente verde — validado com Playwright + dev server + Supabase local)
- [ ] Listener leak / vazamento enquanto painel fechado — implementação correta, mas SEM teste que discrimine a regressão (Gap 1)
- [x] Labels/padding da sidebar mudam sem transição ao colapsar (`{!collapsed && <span>...}` — mount/unmount instantâneo) — comportamento pré-existente, fora do escopo do achado 5 (que tratava só da largura), aceitável

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npx vitest run && npm run build`
- **Result**:
  - `typecheck`: 0 erros
  - `lint`: 0 erros
  - `vitest run`: 296 arquivos, 2115 testes — 2115 passed em run limpo (1 falha pontual de `manifest-interest-button.spec.tsx` em uma execução isolada, não reproduzida em 2 reruns subsequentes e em arquivo não tocado por este diff — flake pré-existente do runner, não regressão desta PR)
  - `build`: sucesso, todas as rotas geradas, incluindo `(app)/*`
- **Test count before feature** (commit `920a217`, verificado em worktree isolado): 296 arquivos, **2107 testes**, 100% verde
- **Test count after feature** (commit `b7a24eb`): 296 arquivos, **2115 testes**
- **Delta**: **+8 testes**, 0 removidos — confirmado por diff line-by-line: `theme-toggle-placement.test.ts` 3→8 (+5) e `profile-menu.test.tsx` +3 (Escape, clique-fora, clique-dentro-não-fecha); soma bate exatamente com +8
- **Skipped tests**: nenhum
- **Failures**: nenhuma reproduzível (flake isolado de `manifest-interest-button.spec.tsx`, arquivo fora do diff)

---

## Fix Plans

### Fix 1: Cobrir "listener não vaza enquanto painel fechado" (achado 4d)

- **Root cause**: `profile-menu.test.tsx` testa o comportamento funcional de Escape/clique-fora *enquanto o painel está aberto*, mas nenhum teste comprova que os listeners deixam de existir (ou nunca existiram) quando `open === false`. Confirmado por 2 mutações sobreviventes: (a) remover o `return` de cleanup do `useEffect`, (b) remover o guard `if (!open) return;` no topo do efeito — ambas passam despercebidas pelos 10 testes atuais.
- **Fix task**: Adicionar 1-2 testes a `profile-menu.test.tsx` que provem a ausência de listener quando fechado — ex.: renderizar com painel fechado, disparar `fireEvent.keyDown(document, {key: 'Escape'})` e `fireEvent.mouseDown(document.body)`, e então asserir que nada quebrou/nenhum `setOpen` inesperado ocorreu (ex.: espiar `document.addEventListener` com `vi.spyOn` antes da montagem e afirmar que não foi chamado com painel fechado; ou abrir, fechar, e então usar `vi.spyOn(document, 'removeEventListener')` para confirmar que a chamada de cleanup ocorreu).
- **Priority**: Minor (implementação já correta por leitura de código; achado original 4 era 💡 nice-to-have, não bloqueante; é lacuna de cobertura, não bug ativo)

### Fix 2 (não-bloqueante, fora do escopo dos 5 achados): docstring residual

- **Root cause**: `src/app/(app)/_components/__tests__/app-sidebar.test.tsx:7` ainda cita `app-desktop-menu.test.tsx` como "molde" em comentário — arquivo deletado. Não é o mesmo arquivo do achado 1 (que era só `app-sidebar.tsx`, já corrigido) e não foi tocado por nenhum dos 5 commits desta rodada.
- **Fix task**: Atualizar o comentário para citar `public-nav.test.tsx` (molde ainda existente) ou remover a referência.
- **Priority**: Cosmetic

---

## Summary (rodada 1 — ver veredito final atualizado na seção "Re-verificação — Iteração 1")

**Overall (rodada 1)**: ⚠️ Issues (não-bloqueantes) — **superado**: ver PASS final abaixo

**Spec-anchored check**: 6/7 outcomes cobertos com evidência exata; 1 gap de cobertura (achado 4d)
**Sensor**: 2/4 mutações killed — **2 sobreviveram**, ambas apontando para o mesmo comportamento não coberto (achado 4d)
**Must-nots**: 10/10 pré-existentes (SIDE-MN-01..05, PROF-MN-01..05) permanecem verdes — nenhuma regressão
**Gate**: typecheck ✅, lint ✅, vitest 2115/2115 ✅ (+8, 0 removido), build ✅, E2E novo executado de fato (1/1 passed)

**What works**:
- Achado 1 (comentário obsoleto): corrigido e confirmado — só resta uma menção residual fora de escopo (Fix 2, cosmético)
- Achado 2 (guard de tema): fortalecido corretamente — cobre `(app)/*` inteiro + contagem; 2 mutações injetadas (duplicação em `profile-menu.tsx`, reintrodução em `app-shell.tsx`) foram killed
- Achado 3 (E2E do gate de sessão): segue o padrão real do repo (`e2e/ativar-papel.spec.ts`), roda de fato contra servidor + Supabase local, não é trivialmente verde
- Achado 4a-4c (Escape/clique-fora do `ProfileMenu`): implementados corretamente, com foco devolvido ao trigger (não só fechamento visual) e listeners com `if (!open) return` + cleanup (confirmado por leitura de código)
- Achado 5 (transição da sidebar): `duration-200 ease-in-out` válido, lint/build verdes; labels/padding não animam (mount/unmount), mas isso é comportamento pré-existente fora do escopo do achado

**Issues found**:
1. (Minor) Achado 4d sem teste que discrimine "listener não vaza enquanto fechado" — 2 mutações sobreviventes no mesmo comportamento. Ver Fix 1.
2. (Cosmetic, fora do escopo dos 5 achados) `app-sidebar.test.tsx:7` cita `app-desktop-menu.test.tsx` (deletado) como molde. Ver Fix 2.

**Next steps**: Rodar Fix 1 (recomendado, mas não bloqueante para merge — a implementação está correta, só falta a rede de segurança de teste) e opcionalmente Fix 2 (cosmético). Nenhum dos dois é regressão introduzida por esta rodada de 5 fixes; ambos podem ser tratados em follow-up ou nesta mesma PR a critério do orquestrador.

---

## Requirement Traceability Update (rodada 1)

| Achado | Previous Status | New Status |
| ------ | ---------------- | ---------- |
| 1 (SPEC_DEVIATION obsoleto) | Implementing | ✅ Verified |
| 2 (guard de tema) | Implementing | ✅ Verified |
| 3 (E2E gate de sessão) | Implementing | ✅ Verified |
| 4 (Escape/clique-fora) | Implementing | ⚠️ Verified com gap de cobertura (Fix 1) |
| 5 (transição da sidebar) | Implementing | ✅ Verified |

---

## Re-verificação — Iteração 1 (fix→re-verify, commit `91f6a26`)

**Diff re-verificado**: `b7a24eb..91f6a26` — `test(identity): cobre cleanup do listener do ProfileMenu — mata mutante do Verifier`
**Escopo do fix**: só teste (`src/app/(app)/_components/__tests__/profile-menu.test.tsx`, +34/-1 linhas). Nenhuma mudança de produção — `profile-menu.tsx` idêntico ao da rodada 1 (já confirmado correto por leitura de código).

### O que o novo teste faz

Um teste novo (`registra os listeners de keydown/mousedown só enquanto o menu está aberto...`) usa `vi.spyOn(document, 'addEventListener'/'removeEventListener')` e assevera:
1. No mount inicial (painel fechado), nenhum `addEventListener('keydown'|'mousedown', ...)` foi chamado.
2. Ao abrir, os handlers são capturados via `addSpy.mock.calls`.
3. Ao fechar, `removeEventListener` é chamado com as MESMAS referências de função capturadas na abertura.

### Re-aplicação dos 2 mutantes sobreviventes da rodada 1

Mesmo processo da rodada 1 (scratch: `cp` do arquivo real para backup em `/private/tmp/.../scratchpad`, edição in-place, teste, `cp` de volta do backup — nunca `git checkout`/`reset`).

| # | File:line | Mutação | Rodada 1 | Rodada 2 |
| - | --------- | ------- | -------- | -------- |
| 3 | `profile-menu.tsx:48-53` (scratch) | Removido `return () => { removeEventListener(...) }` (cleanup do `useEffect`) | ❌ Survived | ✅ **Killed** — `expected "removeEventListener" to be called with arguments: ["keydown", [Function handleKeyDown]] / Number of calls: 0` |
| 4 | `profile-menu.tsx:35` (scratch) | Removido o guard `if (!open) return;` | ❌ Survived | ✅ **Killed** — `expected "addEventListener" to not be called with arguments: ["keydown", Any<Function>] / ... 1st addEventListener call: ["keydown", [Function handleKeyDown]]` |

Ambas as mutações revertidas logo após a confirmação; `git status --short src/app/(app)/_components/profile-menu.tsx` limpo em seguida (0 diff contra `HEAD`).

**Sensor (cumulativo, achado 4)**: 4/4 mutações killed (2 da rodada 1 — duplicação de `ThemeToggle` e reintrodução em `app-shell.tsx` — permanecem killed; as 2 que sobreviveram na rodada 1 agora são killed pelo teste novo).

### Regressão — resto da unidade

Não re-executada do zero (autorizado pelo orquestrador); confirmações pontuais:

| Check | Comando/evidência | Resultado |
| ----- | ------------------ | --------- |
| `profile-menu.test.tsx` completo | `npx vitest run profile-menu.test.tsx` | 11/11 passed (10 da rodada 1 + 1 novo) |
| Typecheck | `npm run typecheck` | 0 erros |
| Lint | `npm run lint` | 0 erros |
| Suite completa | `npx vitest run` | **296 arquivos, 2116 testes, 2116 passed** (2115 da rodada 1 + 1 novo; `manifest-interest-button.spec.tsx` — o flake pontual da rodada 1 — passou limpo nesta run, confirmando que era mesmo flake de runner, não regressão) |
| Working tree | `git status --short` | limpo (só os itens não-relacionados já presentes desde o início: `prisma/migrations/2026...`, `tmp/`, e o próprio `validation.md` novo desta feature) |

Demais achados (1, 2, 3, 5) e os must-nots SIDE-MN-01..05/PROF-MN-01..05 não foram re-testados nesta iteração — nenhum arquivo além de `profile-menu.test.tsx` mudou entre `b7a24eb` e `91f6a26`, então não há superfície nova para regredir neles.

### Gap 1 — status

**Fechado.** O gap "achado 4d: listener só existe enquanto `open === true`, sem teste que discrimine regressão" tinha evidence-or-zero = NOT covered na rodada 1. Agora: `profile-menu.test.tsx:135-166` cobre com asserção exata (spy em `addEventListener`/`removeEventListener`, mesmas referências de função), e as 2 mutações que sobreviveram na rodada 1 são killed nesta rodada. Gap 2 (docstring cosmético em `app-sidebar.test.tsx:7`) permanece aberto — fora do escopo do achado 4, não foi pedido para esta iteração, e continua não-bloqueante.

### Veredito final

**PASS ✅** — 7/7 outcomes dos 5 achados cobertos com evidência exata (achado 4 agora completo: 4a-4d todos com `file:line` + asserção); sensor 4/4 killed; must-nots 10/10 verdes (sem mudança desde rodada 1); gate limpo (typecheck/lint/vitest 2116/2116/build); E2E novo já confirmado rodando de verdade na rodada 1. Único item remanescente é o Gap 2 cosmético (docstring órfã em teste não tocado por esta PR), que não bloqueia.
