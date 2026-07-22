# Fase 10 — App Shell Logado — Fix de Achados do /pr-review (PR #292) — Validation

**Date**: 2026-07-22
**Spec**: sem `spec.md` formal para esta rodada — achados do `/pr-review` na PR #292 (ver seção "Achados originais" abaixo), verificados contra USP-061/062/063 já concluídas (`.specs/features/app-shell-logado/usp-061-casca-header/`, `usp-062-bottom-tab-bar/`, `usp-063-menu-desktop/`)
**Diff range**: `683de16..e22dc66` (branch `feat/fase-10-app-shell-logado`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Achados originais (o que motivou os fixes)

1. **Performance** — `(app)/layout.tsx` e `(app)/inicio/page.tsx` chamavam `requireActivePerson()`/`canAccessModerationQueue()` de forma independente; como o layout envolve toda rota `(app)/*`, `/inicio` pagava sessão+query de moderação em dobro por request.
2. **Warning ×2** — `app-bottom-nav.test.tsx` e `app-desktop-menu.test.tsx` importavam `@/modules/identity/domain/app-nav`/`domain/hub-links` (caminho profundo) sem a justificativa que os componentes de produção irmãos têm (evitar `next/headers` no bundle client — motivo que não se aplica a testes Vitest/Node).

---

## Task Completion

| Fix | Status | Notes |
| --- | ------ | ----- |
| perf(identity): memoize `getCurrentPerson`/`canAccessModerationQueue` via `cache()` | ✅ Done | `src/modules/identity/server/session.ts:1,50-87`; `src/modules/moderation/server/moderation-access.ts:1,32-41` |
| test(identity): trocar import profundo por barrel nos 2 testes de nav | ✅ Done | `src/app/(app)/_components/__tests__/app-bottom-nav.test.tsx:16-18`; `.../__tests__/app-desktop-menu.test.tsx:15` |

---

## Achado 1 — Performance (cache() do React)

### 1a. Assinatura pública e comportamento observável inalterados

| Function | Antes | Depois | Result |
| -------- | ----- | ------ | ------ |
| `getCurrentPerson(): Promise<CurrentPerson \| null>` | `export async function` | `export const … = cache(async function …)` — mesma assinatura, mesmo tipo de retorno | ✅ PASS — `src/modules/identity/server/session.ts:50` |
| `canAccessModerationQueue(person: CurrentPerson): Promise<boolean>` | `export async function` | `export const … = cache(async function …)` — mesma assinatura | ✅ PASS — `src/modules/moderation/server/moderation-access.ts:32` |
| `requireActivePerson()` | `export async function` (chama `getCurrentPerson()` + `redirect()`) | **inalterado** — permanece `async function` solta, NÃO envolvida em `cache()` | ✅ PASS — `src/modules/identity/server/session.ts:94-101` (confirmado por leitura direta; `redirect()` do Next continua fora de qualquer memoização, preservando o side-effect por request) |

### 1b. `cache()` fora de uma render RSC real (afirmação do Implementer)

Verificado por inspeção direta do pacote instalado (`node_modules/react@19.2.6`), não apenas por confiança na documentação:

- `node_modules/react/cjs/react.development.js:917-921` (build "default", o que o Vitest/Node resolve):
  ```js
  exports.cache = function (fn) {
    return function () {
      return fn.apply(null, arguments);
    };
  };
  ```
  Ou seja, no ambiente de teste (condição de export `default`, não `react-server`), `cache()` é um passthrough puro — **nenhuma memoização ocorre**, cada chamada direta executa a função de novo. Isso é exatamente o que o comentário adicionado no código (`session.ts:42-48`, `moderation-access.ts:25-30`) afirma.
- `node_modules/react/package.json` → `exports["."]["react-server"] = "./react.react-server.js"`: confirma que existe uma condição de export separada (`react-server`) usada pelo bundler RSC do Next.js em produção, onde a memoização real (keyed por identidade dos argumentos, por árvore de render) se aplica — não exercitada pelo Vitest.
- Conclusão: a afirmação do Implementer está correta e evidenciada no código-fonte da dependência instalada, não apenas em memória de treinamento.

### 1c. Testes existentes de `session.ts`/`moderation-access.ts` não viraram falsos-canário

`git checkout` confirmou zero diff residual após a sonda (ver Discrimination Sensor). Mutação 1 (reverter `cache()` para função solta) **sobreviveu** nos 4 arquivos de teste relevantes (`session.test.ts`, `moderation-access.test.ts`, `layout.test.tsx`, `inicio/page.test.tsx` — 33/33 continuaram verdes) — **resultado esperado e correto**: como `cache()` não memoiza fora de uma render RSC real (1b), nenhum teste unitário deveria depender desse comportamento, e nenhum dependia.

### 1d. Composição real no `(app)/layout.tsx` + `(app)/inicio/page.tsx`

- `src/app/(app)/layout.tsx:29-34` — chama `requireActivePerson()` (→ `getCurrentPerson()` cacheada) e `canAccessModerationQueue(person)` (cacheada), alimentando `AppShell`.
- `src/app/(app)/inicio/page.tsx:22-26` — chama `requireActivePerson()` e `canAccessModerationQueue(person)` de forma independente, exatamente o cenário do achado original. Com `cache()` real (condição `react-server`, produção), a 2ª chamada de cada helper dentro da mesma árvore de render reaproveita o resultado memoizado — `getCurrentPerson` não tem argumentos (chave de cache trivial) e `canAccessModerationQueue` recebe a MESMA instância de `person` (mesma referência, já que vem da mesma chamada cacheada de `getCurrentPerson`), batendo a chave de identidade do `cache()`.

---

## Achado 2 — Import profundo → barrel nos testes de nav

| Symbol | Exportado pelo barrel `src/modules/identity/index.ts`? | Evidência |
| ------ | ------------------------------------------------------- | --------- |
| `selectPrimaryTabs` | ✅ Sim | `index.ts:60` — `export { pickActiveHref, selectPrimaryTabs, BOTTOM_TAB_SHORT_LABELS } from './domain/app-nav';` |
| `buildHubLinks` | ✅ Sim | `index.ts:56` — `export { buildHubLinks, hubAccessFromRoles, EXISTING_HUB_ROUTES } from './domain/hub-links';` |
| `hubAccessFromRoles` | ✅ Sim | idem |
| `EXISTING_HUB_ROUTES` | ✅ Sim | idem |

Não é alucinação do Implementer — os 4 símbolos existem no barrel, confirmados por `grep` direto no arquivo.

- Import continua **dinâmico**: `await import('@/modules/identity')` em ambos os arquivos (`app-bottom-nav.test.tsx:16-18`, `app-desktop-menu.test.tsx:15`) — não virou `import … from` estático no topo. Isso preserva a ordem exigida pelo `vi.mock('next/navigation', …)` hoisted (linhas 11-13/anteriores), que precisa rodar antes do módulo real ser importado.
- Contraste com produção preservado: `app-bottom-nav.tsx:16` e `app-desktop-menu.tsx:8-9,13,15` continuam importando via caminho profundo `@/modules/identity/domain/app-nav` / `domain/hub-links`, com o comentário explicando o motivo real (evitar `next/headers` no bundle client) — motivo que não se aplica aos testes (Vitest/Node, sem bundling client), validando a assimetria como intencional e correta.
- `git diff 14a0878..e22dc66` confirma que a mudança foi só a troca do import, nenhuma asserção de teste foi alterada.

---

## Discrimination Sensor

Executado em estado real do repositório (edição + `git checkout` para descartar — sem stash necessário, pois não havia outras mudanças pendentes nesses 2 arquivos). Diff residual confirmado zero após a sonda.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ------------ | ------- |
| 1 | `src/modules/identity/server/session.ts:50` + `src/modules/moderation/server/moderation-access.ts:32` | Reverter `cache(async function …)` → `async function` solta (remover a memoização introduzida pelo fix) | ❌ Sobreviveu (esperado/informacional — ver abaixo) |
| 2 | `src/modules/identity/server/session.ts:75` | Inverter a condição de status: `person.status !== 'ATIVO'` → `person.status === 'ATIVO'` (regressão real de lógica de negócio) | ✅ Killed — 7/12 testes de `session.test.ts` falharam |

**Sensor depth**: lightweight (2 mutações, proporcional ao risco — mudança é perf-only + refactor de import, sem lógica de negócio nova)
**Result**: 1/2 killed — **mas a sobrevivência da Mutação 1 é o resultado correto e esperado**, não uma falha de teste. Justificativa: `cache()` do React só memoiza dentro de uma render RSC real com a condição de export `react-server` (ver Achado 1b); em Vitest (condição `default`), `cache()` é passthrough puro, então remover o wrapper não muda absolutamente nenhum comportamento observável em teste — não deveria haver (e não há) um teste canário para uma otimização que só se manifesta na árvore de render RSC de produção. A Mutação 2 prova que a suíte segue discriminando regressões reais de lógica de negócio na mesma função, isto é, os testes não ficaram "cegos" por causa do wrapper `cache()`.

---

## Must-Not Verification (Fase 10 — USP-061/062/063, não regredidos)

| ID | SHALL NOT… | Negative test (`file:line`) | Green? |
| -- | ---------- | ---------------------------- | ------ |
| APP-SHELL-MN-01 | Casca sem beco sem saída (nenhum estado sem navegação de volta) | `src/app/(app)/_components/__tests__/app-shell.test.tsx:54` | ✅ |
| APP-SHELL-MN-02 | Hub isolado (`/inicio`) não renderiza mais o próprio "Sair" (logout migrado p/ casca) | `src/app/(app)/inicio/page.test.tsx:72` | ✅ |
| APP-SHELL-MN-03 | Casca `(app)` sem sessão/PII/Prisma/View Model/Server Action direto no componente apresentacional | `src/shared/__tests__/app-shell-no-auth-pii.test.ts:46` | ✅ |
| BNAV-MN-01 | Nenhuma aba da bottom nav fora da allowlist (`EXISTING_HUB_ROUTES` ∪ `/inicio`) | `src/app/(app)/_components/__tests__/app-bottom-nav.test.tsx:93-105` | ✅ |
| BNAV-MN-02 | Nenhuma aba de área sem permissão (ex.: `/moderacao` p/ quem não tem acesso) | `src/app/(app)/_components/__tests__/app-bottom-nav.test.tsx:107-118`; composição no layout: `src/app/(app)/layout.test.tsx:132` | ✅ |
| BNAV-MN-03 | `app-bottom-nav.tsx`/`nav-icons.tsx` cobertos pela varredura "sem PII/sessão" | `src/shared/__tests__/app-shell-no-auth-pii.test.ts:53` | ✅ |
| DNAV-MN-01 | Nenhum link do menu desktop fora da allowlist | `src/app/(app)/_components/__tests__/app-desktop-menu.test.tsx:104-116` | ✅ |
| DNAV-MN-02 | Nenhum grupo/link sem permissão no menu desktop | `src/app/(app)/_components/__tests__/app-desktop-menu.test.tsx:117+`; composição: `src/app/(app)/layout.test.tsx:132` | ✅ |
| DNAV-MN-03 | `app-desktop-menu.tsx` coberto pela varredura "sem PII/sessão" | `src/shared/__tests__/app-shell-no-auth-pii.test.ts:59` | ✅ |

**Status**: ✅ Todos os 10 must-nots das USP-061/062/063 permanecem verificados — nenhuma regressão introduzida pelo fix (confirmado por execução direta desses 6 arquivos de teste: 53/53 passaram isoladamente, e como parte da suíte completa de 2093).

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ — 2 comentários de arquitetura + wrapper `cache()` em 2 funções; troca de 1 linha de import em 2 arquivos de teste |
| Surgical changes | ✅ — nenhum arquivo fora do escopo dos 2 achados foi tocado |
| No scope creep | ✅ |
| Matches patterns | ✅ — `cache()` é o padrão canônico do App Router para dedupe por request; barrel import é a convenção do repo (CLAUDE.md "Import rule") |
| Spec-anchored outcome check | ✅ — sem spec formal nesta rodada; outcome verificado contra os 2 achados textuais do `/pr-review`, ambos endereçados precisamente |
| Documented guidelines followed | `CLAUDE.md` ("Import rule: sempre importar via barrel"); `docs/arch/project-guideline.md` (padrões de Server Component) |

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test -- --run && npm run build`
- **Result**: typecheck limpo (0 erros), lint limpo (0 erros/warnings), **294 arquivos / 2093 testes passaram (0 falhas)**, build de produção OK (todas as rotas geradas, incluindo `/inicio`, `/moderacao`, etc.)
- **Test count antes do fix** (commit `683de16`, fim da Fase 10 original): 294 arquivos / 2093 testes (mesmo baseline — o fix não adicionou nem removeu testes, apenas trocou 2 imports e comentários de doc)
- **Test count depois do fix** (commit `e22dc66`): 294 arquivos / 2093 testes
- **Delta**: 0 (esperado — fix não introduz nem remove testes, só refatora imports e adiciona memoização transparente)
- **Skipped tests**: nenhum
- **Failures**: nenhuma

---

## Edge Cases

- [x] `requireActivePerson()` NÃO foi envolvida em `cache()` — `redirect()` continua com side-effect por request, não memoizado
- [x] `canAccessModerationQueue` cacheada por referência de `person` — funciona porque `getCurrentPerson` (também cacheada) garante a mesma instância dentro da mesma render
- [x] `cache()` fora de render RSC (testes) é passthrough puro — confirmado no código-fonte do pacote instalado, não apenas na doc do comentário
- [x] Import dinâmico preservado nos 2 testes de nav — ordem de `vi.mock` hoisted não quebrada

---

## Requirement Traceability Update

| Achado | Previous Status | New Status |
| ------ | ---------------- | ---------- |
| 1 — Performance (chamada dupla de sessão/moderação) | Reportado no `/pr-review` | ✅ Verificado — corrigido com `cache()`, comportamento observável inalterado |
| 2 — Warning ×2 (import profundo sem justificativa nos testes) | Reportado no `/pr-review` | ✅ Verificado — trocado para barrel, import dinâmico preservado |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 2/2 achados do `/pr-review` endereçados com o outcome exato pedido (memoização transparente sem quebrar assinatura/side-effects; barrel import sem quebrar ordem de mock)
**Sensor**: 1/2 mutações killed — a sobrevivente é o resultado correto e esperado (ver justificativa na seção Discrimination Sensor), não uma fraqueza de teste
**Must-nots**: 10/10 verdes (USP-061/062/063, nenhuma regressão)
**Gate**: typecheck ✅, lint ✅, 2093/2093 testes ✅, build ✅

**What works**:
- `getCurrentPerson`/`canAccessModerationQueue` memoizadas via `cache()` do React sem alterar assinatura pública, tipo de retorno ou comportamento para os mesmos inputs
- `requireActivePerson` permanece não-cacheada, preservando o side-effect de `redirect()` por request
- Testes unitários de `session.ts`/`moderation-access.ts` continuam exercitando o caminho sem-cache corretamente (confirmado: `cache()` é passthrough fora de RSC real) e continuam discriminando regressões reais de lógica (Mutação 2 killed)
- Os 4 símbolos trocados para import via barrel (`selectPrimaryTabs`, `buildHubLinks`, `hubAccessFromRoles`, `EXISTING_HUB_ROUTES`) são de fato exportados por `src/modules/identity/index.ts` — não há alucinação
- Import dinâmico (`await import(...)`) preservado, mantendo a ordem correta com `vi.mock` hoisted
- Nenhum dos 10 must-nots das USP-061/062/063 regrediu

**Issues found**: nenhum

**Next steps**: nenhum fix pendente — PASS.
