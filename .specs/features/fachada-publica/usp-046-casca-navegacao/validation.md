# USP-046 — Casca de navegação pública — Validation

**Date**: 2026-07-10
**Spec**: `.specs/features/fachada-publica/usp-046-casca-navegacao/spec.md` (greenfield-adapter, não-ICE)
**Diff range**: `44181a5..HEAD` (commits `73ee60e..48a8110`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
|------|---------|-------|
| T1 (`SiteFooter`) | ✅ Done | `73ee60e` |
| T2 (`PublicNav`) | ✅ Done | `8beb4b9` |
| T3 (`SiteHeader`) | ✅ Done | `05eeae9` |
| T4 (guardas must-not) | ✅ Done | `ffd7f2f` |
| T5 (montagem no layout) | ✅ Done | `48a8110` |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
|---|---|---|---|
| CASCA-01 header landmark+marca→`/`+nav+ações | `<header>` sticky, marca linka `/` | `src/app/(public)/_components/site-header.tsx:31,38` · RTL `site-header.test.tsx:21-29` · live curl `<header class="sticky top-0 z-40...">` on `/`,`/vagas`,`/servicos` | ✅ PASS |
| CASCA-02 nav primária p/ rotas reais | Início `/`, Vagas `/vagas`, Serviços `/servicos` como `<a>` | `public-nav.tsx:23-27,63-65` · RTL `site-header.test.tsx:33-38` · live HTML `href="/vagas"`,`href="/servicos"` | ✅ PASS |
| CASCA-03 active-state via `usePathname` (incl. prefixo) | `/` exato; `/vagas/123`→Vagas; `/servicos/x`→Serviços; nenhum falso-positivo | `public-nav.tsx:35-38` (`isActive`) · RTL `public-nav.test.tsx:17-31,39-57` (unit do helper + render) · **sensor**: mutação no `isActive` matou 3 testes (ver §Sensor) | ✅ PASS |
| CASCA-04 Entrar/Cadastrar via `Button asChild`+`Link` | `outline`/`sm`→`/login`; `primary`/`sm`→`/cadastro`; sem `<button>` extra | `site-header.tsx:14-23` · RTL `site-header.test.tsx:42-50` (`tagName==='A'`) · live HTML confirma `<a href="/login">`/`<a href="/cadastro">` | ✅ PASS |
| CASCA-05 responsivo (colapso desktop↔mobile) | nav/ações inline ocultas <768px, hamburguer oculto ≥769px | `public-nav.tsx:58`(`hidden ... md:flex`), `92`(`md:hidden`) | ✅ PASS (classes Tailwind; sem teste de resize, mas fiel ao breakpoint do protótipo — verificação estática, não runtime) |
| CASCA-06 menu mobile togglado + `aria-expanded`/`aria-controls` | clique alterna `open`; painel `#public-mobile-menu` | `public-nav.tsx:86-108` · RTL `public-nav.test.tsx:72-86` (`fireEvent.click` confirma `aria-expanded` true→false e presença/ausência do painel) | ✅ PASS |
| CASCA-07 teclado + `aria-label` no `<nav>` | `<nav aria-label="Navegação principal">` | `public-nav.tsx:56-57` · RTL `public-nav.test.tsx:60-64` | ✅ PASS |
| CASCA-08 footer landmark + marca + colunas | `<footer>` c/ marca + 4 colunas | `site-footer.tsx:70-72` · RTL `site-footer.test.tsx:9-14` · live curl `<footer class="bg-footer...">` | ✅ PASS |
| CASCA-09 links footer só p/ rota real (sem `#`) | zero `href="#"` | `site-footer.tsx:97-106` · RTL `site-footer.test.tsx:17-33` (loop `not.toBe('#')`) · live curl `grep -c 'href="#"'` = 0 · **sensor**: N/A (guarda estática cobre por `casca-*` — ver must-nots) | ✅ PASS |
| CASCA-10 institucionais como não-links "em breve" | texto não-focável, não âncora | `site-footer.tsx:107-113` · RTL `site-footer.test.tsx:36-43` (`item.closest('a')` é `null`) | ✅ PASS |
| CASCA-11 copyright/tagline + colapso 1-coluna | texto "© 2026 ASONSEG…" + tagline; `grid-cols-1` em viewport estreita | `site-footer.tsx:74,119-124` · RTL `site-footer.test.tsx:46-50` | ✅ PASS |
| CASCA-12 montagem header→main→footer, `<main>` único | ordem DOM header→main→footer; 1 `<main>`/página | `layout.tsx:20-28` · RTL `layout.test.tsx:17-36` (ordem via `compareDocumentPosition`) · **live**: `grep -c '<main'` = 1 em `/`,`/vagas`,`/servicos`,`/login` (login sem casca, confirma escopo) · as 5 páginas públicas confirmadas sem `<main>` duplicado (diff `page.tsx`,`vagas/page.tsx`,`vagas/[id]/page.tsx`,`servicos/page.tsx`,`servicos/[id]/page.tsx`) | ✅ PASS |
| CASCA-13 `revalidate` preservado por página | layout não declara `export const revalidate` | `layout.tsx` (ausente) · RTL `layout.test.tsx:40-44` (`readFileSync`+`not.toMatch`) · build output confirma `Revalidate 10m` em `/` | ✅ PASS |
| CASCA-14 sem regressão nos testes de página existentes | suíte pública segue verde | full run: 235/235 arquivos, 1575/1575 testes | ✅ PASS |
| CASCA-15 seams (`PublicNav` data-driven + `className`/slots) | `items?`/`actions?`/`className?` sem quebrar mecânica | `public-nav.tsx:40-44` · RTL `public-nav.test.tsx:88-92` (seam `items` custom) · `SiteHeader`/`SiteFooter` `className?` (`site-header.tsx:26`, `site-footer.tsx:67`) — **sem teste direto de merge de `className`** | ⚠️ Spec-precision gap (menor) — ver §Edge Cases |

**Status**: ✅ All ACs covered (14/15 full evidence; 1 minor spec-precision gap on `className`-merge assertion, low risk — `cn` é utilitário já testado/reusado da fundação).

---

## Discrimination Sensor

Todas as mutações rodaram em scratch (arquivo restaurado via cópia + `git diff` confirmando árvore limpa após cada uma; suíte completa re-rodada ao final: 235/235 arquivos, 1575/1575 testes, idêntico ao estado pré-sensor).

| # | File:line | Description | Killed? |
|---|-----------|-------------|---------|
| 1 | `public-nav.tsx:37` | `isActive`: removida a cláusula de prefixo (`pathname.startsWith(...)`), voltando a só match exato | ✅ Killed — 3 testes falharam (`public-nav.test.tsx:24,49,56`) |
| 2 | `public-nav.tsx` (injeção) | `import { Menu } from 'lucide-react'` injetado no topo do arquivo da casca | ✅ Killed — `casca-no-icon-state-lib.test.ts` falhou (guarda CASCA-MN-04) |
| 3 | `site-footer.tsx:72` | `bg-footer text-fg-muted` → `bg-[#1e293b] text-gray-500` (hex cru + paleta fixa) | ✅ Killed — `casca-uses-tokens.test.ts` falhou em ambas asserções (hex + paleta fixa), guarda CASCA-MN-02 |
| 4 | `site-header.tsx` (injeção) | `import { getCurrentPerson } from '@/modules/identity'` injetado no topo | ✅ Killed — `casca-no-auth-pii.test.ts` falhou (guarda CASCA-MN-01) |
| 5 (observação) | `public-nav.tsx` (injeção side-effect) | `import 'lucide-react';` (sem `from`) — forma de import não-idiomática | ❌ Survived — regex do guard exige `from '...'`; forma bare/side-effect não é como libs de ícone são consumidas na prática (sempre `import { X } from '...'`), risco real baixo. Registrado como observação, não bloqueia (ver Fix Plans). |

**Sensor depth**: lightweight (4 mutações no comportamento de risco + 1 mutação adicional de observação sobre a forma de import do guard)
**Result**: 4/4 mutações-alvo mortas (100%) — a 5ª é uma observação de robustez do guard contra uma forma de import improvável, não uma falha do comportamento coberto pelos ACs.

---

## 🧬 Must-Not Verification (aplicando o rigor de §6b ainda que a USP seja greenfield-adapter)

| ID | SHALL NOT… | Negative fact (`file:line`) | Green? | Guard mutation killed? |
|----|------------|------------------------------|--------|--------------------------|
| CASCA-MN-01 | Importar sessão/PII/Prisma/View Models/Server Actions na casca | `src/shared/__tests__/casca-no-auth-pii.test.ts:43-57` | ✅ | ✅ (mutação #4) |
| CASCA-MN-02 | Hex cru / paleta fixa na casca | `src/shared/__tests__/casca-uses-tokens.test.ts:37-67` | ✅ | ✅ (mutação #3) |
| CASCA-MN-03 | CDN/host externo na casca | `src/shared/__tests__/casca-no-external-cdn.test.ts:33-55` | ✅ | not re-tested directly (mesmo padrão estrutural de #3/#4; regex simples e direta, baixo risco) |
| CASCA-MN-04 | Lib de estado/ícone proibida no menu mobile | `src/shared/__tests__/casca-no-icon-state-lib.test.ts:36-50` | ✅ | ✅ (mutação #2, com forma idiomática de import) |

**Status**: ✅ All must-nots proven (evidência-ou-zero; todos os 4 guards varrem o diretório inteiro via `readdirSync` recursivo, não lista fixa — pegam arquivos novos automaticamente).

---

## Deviation Review (Implementer's 4 flagged deviations)

1. **`<main>` duplicado removido em 5 rotas** (não só a home) — verificado por diff + live curl: `/`, `/vagas`, `/vagas/[id]`, `/servicos`, `/servicos/[id]` têm exatamente 1 `<main>` cada; `/login` (grupo `(auth)`, fora do escopo) não tem header/footer/`<main>` extra — confirma que a casca não vazou para outro grupo de rotas. ✅ Correto, sem regressão.
2. **Token `--color-footer` novo** (`globals.css:28,68`) + `footer` no Tailwind (`tailwind.config.ts:28-30`) — guarda `casca-uses-tokens` confirmada como sensor real (mutação #3 matou). Nenhum hex cru em `.tsx`; o hex vive só em `globals.css` (fonte única de tokens, mesmo padrão de `--color-primary` etc.). ✅ Conforme CASCA-MN-02 e design.md §4 (a nota do próprio design já previa essa saída).
3. **`hover:text-white`** em vez de `hover:text-surface` — verificado: `text-white`/`bg-white` já é padrão estabelecido na fundação (`src/shared/ui/button.tsx:25,27,30` usa `bg-cta text-white`, `hover:text-white`), portanto não é um "vazamento de paleta" novo — é o mesmo padrão aceito para texto/ícone sobre superfície de cor fixa (footer é fixo-escuro nos dois temas, `--color-footer` não inverte). `text-surface` (`var(--color-white)`) inverteria para escuro no dark mode, quebrando a legibilidade sobre o footer escuro — a decisão do Implementer é tecnicamente mais correta que a literal do design.md. Guard `casca-uses-tokens` não teria pego `text-white` mesmo se fosse considerado errado (gap do guard, não da implementação) — mas dado o precedente já aceito no `Button`, não é tratado como violação. ✅ Aceitável, com nota.
4. **`PublicNav actions?: ReactNode`** — RTL `public-nav.test.tsx:88-92` confirma que o seam `items` custom não quebra a mecânica (active-state, mobile toggle). `actions` é renderizado condicionalmente sem alterar o comportamento default (quando omitido, simplesmente não renderiza o bloco) — não há teste explícito de `actions` isoladamente, mas a composição real (`SiteHeader` passando `HEADER_ACTIONS`) é exercida indiretamente por todos os testes de `site-header.test.tsx` (Entrar/Cadastrar aparecem via essa prop) e confirmada ao vivo (curl). A11y do menu mobile (`aria-expanded`/`aria-controls`) segue coberta e verde (RTL + sensor). ✅ Seam não quebra o contrato de USP-047/048.

---

## Interactive UAT Results

N/A — feature validada via gates automatizados + evidência ao vivo (curl no build de produção); sem UAT interativo solicitado.

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code | ✅ |
| Surgical changes | ✅ (só os arquivos das 5 rotas + casca + tokens + guardas) |
| No scope creep | ✅ (Out of Scope do spec respeitado — sem home, sem wiring integrado, sem páginas institucionais) |
| Matches patterns | ✅ (segue padrão RTL/guarda `node:fs` já usado em `ds-*-parity`/`closed-src-root`) |
| Spec-anchored outcome check | ✅ (tabela acima) |
| Every test maps to a spec requirement | ✅ |

---

## Edge Cases

- [x] Rota fora da nav → nenhum item ativo (`public-nav.test.tsx:28-31`)
- [x] `/` não casa por prefixo vazio contra `/vagas` (`public-nav.test.tsx:17-20`)
- [ ] Menu mobile fecha ao navegar para um link — implementado (`onClick={closeMobileMenu}`, `public-nav.tsx:122`) mas **sem teste RTL direto** que clique num link do painel mobile e confirme o fechamento — spec-precision gap menor (comportamento de uma linha, sem lógica de risco).
- [ ] `className` extra mesclado via `cn` sem duplicar/contradizer — implementado em todos os 3 componentes, mas **sem teste RTL direto** de merge de classes — `cn` é utilitário já testado na fundação (Fase 1), risco baixo.
- [x] Cruzar breakpoint com menu aberto — resolvido estruturalmente por CSS (dois blocos `md:flex`/`md:hidden` independentes do estado `open`), não requer JS adicional.

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build`
- **Result**: typecheck ✅ (0 erros) · lint ✅ (0 erros) · test ✅ 235/235 arquivos, 1575/1575 testes · build ✅ (rotas `(public)` compilam; header/footer confirmados no HTML via `next start` + `curl` em `/`, `/vagas`, `/servicos`)
- **Test count antes da feature**: não medido diretamente (baseline não coletado antes do range), mas a suíte completa pós-feature está 100% verde e o diff só adiciona arquivos de teste (nenhuma remoção de teste existente no diff)
- **Skipped tests**: nenhum
- **Failures**: nenhuma

---

## Fix Plans

Nenhum bloqueante. Duas observações não-bloqueantes para follow-up (não geram fix task obrigatória nesta USP):

### Obs 1: Guard `casca-no-icon-state-lib` não pega import bare/side-effect (`import 'lucide-react';`)
- **Root cause**: regex exige `from '...'`; forma sem `from` não é capturada.
- **Risco**: baixo — nenhuma lib de ícone/estado é consumida dessa forma na prática (sempre named/default import).
- **Prioridade**: Cosmetic/Minor — sugerido para USP-047/048 (mesmo guard será reusado) endurecer a regex se quiserem fechar 100%.

### Obs 2: Dois edge cases sem teste RTL direto (fechar menu mobile ao navegar; merge de `className`)
- **Root cause**: cobertos pelo código, não pela suíte.
- **Risco**: baixo — comportamento de uma linha / utilitário já testado na fundação.
- **Prioridade**: Minor — podem ser adicionados oportunisticamente em USP-047/048 quando os seams forem exercitados de verdade.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| CASCA-01..14 | Pending | ✅ Verified |
| CASCA-15 | Pending | ✅ Verified (com nota de spec-precision menor no merge de `className`) |
| CASCA-MN-01 | Pending | ✅ Verified (eval(−) green, sensor confirmado) |
| CASCA-MN-02 | Pending | ✅ Verified (eval(−) green, sensor confirmado) |
| CASCA-MN-03 | Pending | ✅ Verified (eval(−) green) |
| CASCA-MN-04 | Pending | ✅ Verified (eval(−) green, sensor confirmado) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 14/15 ACs full evidence, 1 minor spec-precision gap (CASCA-15 className-merge, low risk)
**Sensor**: 4/4 targeted mutations killed (100%); 1 additional observational mutation on an unrealistic import form survived (guard-hardening suggestion, not a behavior gap)
**Must-nots**: 4/4 eval(−) green
**Gate**: typecheck+lint+test(1575)+build all passed

**What works**: Casca completa (header sticky + nav responsiva/acessível + footer institucional) montada uma única vez no `(public)/layout.tsx`; ISR preservado por página; zero regressão nas 5 rotas públicas; todos os 4 must-nots com guarda estática comprovadamente discriminativa; live-build confirma header/footer reais no HTML de `/`, `/vagas`, `/servicos` e ausência total em `/login` (escopo correto).

**Issues found**: nenhum bloqueante; 2 observações menores registradas em Fix Plans (não geram retrabalho nesta USP).

**Next steps**: Merge liberado do ponto de vista de verificação. USP-047/048 podem consumir os seams (`items`, `actions`, `className`) conforme documentado.
