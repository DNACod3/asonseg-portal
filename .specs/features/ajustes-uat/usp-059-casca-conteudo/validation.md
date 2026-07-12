# USP-059 — Casca e Conteúdo — Validation

**Date**: 2026-07-12
**Spec**: `.specs/features/ajustes-uat/usp-059-casca-conteudo/spec.md`
**Diff range**: `0b6a810~1..fef161e` (11 commits, 11 tasks) + docs commit `b61bfdc` (SOC-6)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | ✅ Done | `src/app/not-found.tsx` + guard + RTL test |
| T2   | ✅ Done | `src/app/icon.svg` |
| T3   | ✅ Done | `/termos`, `/privacidade` + guard |
| T4   | ✅ Done | `parseTermMarkdown`/`TermMarkdown` + 2 guards |
| T5   | ✅ Done | 4 forms adopt `TermMarkdown` |
| T6   | ✅ Done | consents-panel adopts `TermMarkdown` |
| T7   | ✅ Done | `PERSON_STATUS_LABELS` |
| T8   | ✅ Done | `COMPANY_GRANT_STATUS_LABELS` |
| T9   | ✅ Done | consolidated panel labels + MN-05 guard |
| T10  | ✅ Done | `pessoas/[id]` dedup |
| T11  | ✅ Done | docs-only badge literal alignment (commit `b61bfdc`) |

All 11 commits present in the range, one per task, matching `tasks.md` commit messages exactly.

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | --------------------- | ------------------------ | ------ |
| PUB3-1 | Título/mensagem PT-BR em `not-found.tsx` | `src/app/__tests__/not-found.test.tsx:19-22` — `getByText('Página não encontrada')` / mensagem; **live**: `curl /rota-que-nao-existe-xyz` → HTTP 404, body contém "Página não encontrada" | ✅ PASS |
| PUB3-2 | `SiteHeader`+`<main>` único+`SiteFooter` | `src/app/__tests__/not-found.test.tsx:27-29` — `getByRole('banner')`, `getAllByRole('main')` length 1, `getByRole('contentinfo')` | ✅ PASS |
| PUB3-3 | Link "Voltar para a home" → `/` | `src/app/__tests__/not-found.test.tsx:34-37` — `getByRole('link', {name: 'Voltar para a home'})` `href="/"` | ✅ PASS |
| PUB3-4 | Classes de token + status HTTP 404 | `src/app/not-found.tsx:23` (`mx-auto ... max-w-3xl ... px-4 py-8`); **live**: `curl -w "%{http_code}"` → `404` | ✅ PASS |
| PUB4-1 | `<link rel="icon">` gerado pela convenção | Build output lista `○ /icon.svg`; **live**: `curl http://localhost:3000/` → `<link rel="icon" href="/icon.svg?..." type="image/svg+xml" sizes="any"/>` | ✅ PASS |
| PUB4-2 | "A" branca sobre gradiente `#2563EB→#3B82F6` | `src/app/icon.svg:4-5,10` — `stop-color="#2563EB"`/`"#3B82F6"`, `text ... fill="#fff">A</text>` | ✅ PASS |
| AUTH2-1 | 200 + casca + aviso "em elaboração" (`/termos`) | `src/app/(public)/__tests__/legal-placeholder.test.tsx:17-21`; **live**: `curl /termos` → HTTP 200, body contém "em elaboração e ficará disponível em breve" | ✅ PASS |
| AUTH2-2 | idem para `/privacidade` | mesmo `describe.each`, entrada `PrivacidadePage`; **live**: `curl /privacidade` → HTTP 200 | ✅ PASS |
| AUTH2-3 | Sem termo/aceite carregado | `legal-placeholder.test.tsx:23-27` (`queryByRole('checkbox')`/`'button'` ausentes) + `:30-45` (source sem `loadTerm`/`LgpdBox`/`legal/consent-terms`) | ✅ PASS |
| AUTH6-1 | `TermMarkdown` cobre H1/H2/negrito/lista/citação/régua/código/parágrafo | `src/shared/ui/__tests__/term-markdown.test.tsx:12-111` — 1 teste por construto, valores exatos do parser (`toEqual`) | ✅ PASS |
| AUTH6-2 | Sintaxe crua não aparece como texto | `term-markdown.test.tsx:143-149` — `expect(text).not.toContain('# Termo...')` etc. | ✅ PASS |
| AUTH6-3 | Construto desconhecido degrada sem lançar | `term-markdown.test.tsx:98-103` — H3 vira `paragraph` com texto literal, `not.toThrow()` | ✅ PASS |
| AUTH6-4 | Substitui despejo cru nos 5 pontos | Diffs `38785aa` (4 forms) + `e175fa2` (consents-panel) mostram `<TermMarkdown source={...}/>` substituindo `<div>{...}</div>`; `CandidateForm.test.tsx:61-70`, `consents-panel.test.tsx:78-84` (padrão repetido em `ProviderForm`/`CvUploadForm`/`create-company-form` tests) confirmam `<strong>` renderizado e ausência de `**` | ✅ PASS |
| SOC4-1 | Badge de papel usa `ALL_ROLE_LABELS` | `consolidated-person-panel.tsx:50` — `ALL_ROLE_LABELS[role] ?? role`; teste `ConsolidatedPersonPanel.test.tsx:39` — `getByText('Candidato(a)')` | ✅ PASS |
| SOC4-2 | Status pessoa usa `PERSON_STATUS_LABELS` | `consolidated-person-panel.tsx:43`; teste `:40` (`'Ativa'`) e `:198` (`'Inativa'`) | ✅ PASS |
| SOC4-3 | Status serviço/vínculo usam `labelContentStatus`/`COMPANY_GRANT_STATUS_LABELS` | `consolidated-person-panel.tsx:180,225`; teste `ConsolidatedPersonPanel.test.tsx:242-243` (`'Ativo'`, `'Pendente'`) | ✅ PASS |
| SOC4-4 | `pessoas/[id]` usa os mesmos mapas canônicos, dedup do `ROLE_LABELS` inline | Diff `fef161e` — `ROLE_LABELS` inline (8 entradas) removido, `ALL_ROLE_LABELS`+`PERSON_STATUS_LABELS` importados e usados; valores idênticos confirmados por comparação byte-a-byte com `identity/domain/roles.ts:20-28` | ✅ PASS |
| SOC6-1 | Spec USP-037 linhas 29/56/89/96/142 usam o literal longo | `git show b61bfdc` — diff confirma as 5 ocorrências trocadas + racionalização da l.56 reescrita | ✅ PASS |
| SOC6-2 | TD §3.5 l.693 usa o literal longo | `git show b61bfdc -- docs/arch/technical-design.md` — linha do diagrama trocada | ✅ PASS |
| SOC6-3 | Nenhum `src/**` tocado | `git show --stat b61bfdc` → só 2 arquivos, ambos fora de `src/` | ✅ PASS |

**Status**: ✅ All ACs covered — 20/20, evidence-or-zero, no spec-precision gaps found.

---

## Discrimination Sensor

Scratch state: working tree was clean at HEAD (`fef161e`+docs); each mutation applied directly, targeted test run, then `git checkout -- <file>` reverted before the next. Confirmed clean (`git status --short` empty, `git diff --stat HEAD` empty) after all 5 mutations.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ------------ | ------- |
| 1 (MN-01) | `src/app/not-found.tsx:18` | Injected literal `getCurrentPerson` in a comment (guard breach simulation) | ✅ Killed — `not-found-no-auth-pii.test.ts` failed (`expect(true).toBe(false)`) |
| 2 (MN-05) | `src/modules/persons/components/consolidated-person-panel.tsx:43` | Reverted `PERSON_STATUS_LABELS[person.status] ?? person.status` → raw `{person.status}` | ✅ Killed — 3 tests failed in `ConsolidatedPersonPanel.test.tsx`, including the MN-05 negative test |
| 3 (MN-03) | `package.json` (dependencies) | Injected `"marked": "^9.0.0"` | ✅ Killed — `no-markdown-dep.test.ts` failed (`offenders` = `["marked"]`) |
| 4 (MN-04) | `src/shared/ui/term-markdown.tsx:172` | Replaced text-span `<Fragment>{value}</Fragment>` with `<span dangerouslySetInnerHTML={{__html: value}}/>` | ✅ Killed — MN-04 test failed, `<script>` element actually rendered into the DOM |
| 5 (MN-02) | `src/app/(public)/termos/page.tsx:20-22` | Replaced honest placeholder text with fabricated acceptance-style text | ✅ Killed — `legal-placeholder.test.tsx` failed (`getByText(PLACEHOLDER_TEXT)` not found) |

**Sensor depth**: one mutation per must-not guard (5/5), exceeding the default lightweight tier (1–3) because the spec carries 5 must-nots.
**Result**: 5/5 killed — PASS ✅

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | ----------- | ----------------------------------------- | ------ | ------------------------ |
| CASCA59-MN-01 | 404 importar/consumir sessão, `getCurrentPerson`, View Models, Prisma, Server Actions, PII | `src/shared/__tests__/not-found-no-auth-pii.test.ts:28-30` — `expect(pattern.test(content)).toBe(false)` × 6 patterns | ✅ | ✅ |
| CASCA59-MN-02 | `/termos`/`/privacidade` apresentar conteúdo jurídico fabricado ou aceite | `src/app/(public)/__tests__/legal-placeholder.test.tsx:23-27,30-45` | ✅ | ✅ |
| CASCA59-MN-03 | Renderer de Markdown introduzir dependência nova | `src/shared/__tests__/no-markdown-dep.test.ts:17-28` | ✅ | ✅ |
| CASCA59-MN-04 | Renderer emitir HTML injetado do conteúdo | `src/shared/ui/__tests__/term-markdown.test.tsx:154-163` | ✅ | ✅ |
| CASCA59-MN-05 | Painel consolidado exibir enum cru | `src/modules/persons/__tests__/ConsolidatedPersonPanel.test.tsx:203-249` | ✅ | ✅ |

**Status**: ✅ All 5 must-nots proven (green negative test + guard-removal mutation killed).

---

## Live Runtime Evidence (build + start, non-mocked)

```
npm run build   → ✓ Compiled successfully; routes list includes:
                   ○ /_not-found   ○ /icon.svg   ○ /termos   ○ /privacidade
npm run start -p 3000 (Supabase local UP, :55321-55324)

curl /rota-que-nao-existe-xyz     → HTTP 404, body: "Página não encontrada" / "Voltar para a home"
curl / | grep 'rel="icon"'         → <link rel="icon" href="/icon.svg?..." type="image/svg+xml" sizes="any"/>
curl /termos                       → HTTP 200, "Termos de Uso" + "em elaboração e ficará disponível em breve"
curl /privacidade                  → HTTP 200, "Política de Privacidade" + same placeholder text
curl -I /icon.svg                  → HTTP 200, content-type: image/svg+xml
```
Server stopped after verification (no lingering process on :3000).

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ — 32 files, all within the 11 tasks' declared scope |
| Surgical changes | ✅ — no unrelated file touched (confirmed `identity/domain/roles.ts`, the source of `ALL_ROLE_LABELS`, predates this feature — commit `6ea85de`, USP-049 — not modified here) |
| No scope creep | ✅ — `/termos`,`/privacidade` real legal content correctly deferred (D-002); footer links correctly untouched (Fase 9) |
| Matches patterns | ✅ — reuses `SiteHeader`/`SiteFooter`/`FormHeader`/`Button`/`Badge`/`Card` from `@/shared/ui`; barrel-only imports |
| Spec-anchored outcome check | ✅ — see AC table above, all evidence-or-zero |
| Per-layer coverage | ✅ — pure functions (parser, label maps) 1:1 branch coverage; components render+edge+negative; page-with-IO (`pessoas/[id]`) correctly classified as behavior-preserving dedup, no new test required (values covered by T7) |
| No unclaimed tests | ✅ — every new/extended test traces to a requirement ID or must-not in its own describe/it name |
| Documented guidelines followed | `CLAUDE.md` (module barrel imports, Server Action pattern n/a here — no mutations added), `docs/arch/project-guideline.md` |

---

## Declared Deviations — Verified

| Deviation | Verification |
| --------- | ------------- |
| JSDoc comments rewritten to avoid containing the literal strings their own guards forbid | Confirmed: `grep -n "getCurrentPerson\|requireActivePerson\|@/shared/lib/prisma\|use server" src/app/not-found.tsx` → no match; `termos`/`privacidade` JSDoc paraphrases rather than naming `loadTerm`/`LgpdBox`/`legal/consent-terms` literally |
| `*/` removed from a glob inside a comment (parse hazard) | Confirmed: `term-markdown.tsx` JSDoc references `legal/consent-terms` without a `*/`-containing glob; no comment-termination artifact found |
| `at(i)` helper for `noUncheckedIndexedAccess` | Confirmed: `parseTermMarkdown` uses `const at = (index) => lines[index] ?? ''` throughout, consistent with `tsc --noEmit` passing clean |
| T9 "Ativa" collision resolved with `within()` | Confirmed: `ConsolidatedPersonPanel.test.tsx:105-109` scopes the query to `applicationCard` via `within()`, not a weaker assertion — the panel legitimately renders "Ativa" as both the person-status label and the application-active label in the same fixture |
| ESM cycle `persons ↔ companies/reporting` (2 nodes) accepted, build OK | Confirmed: `npm run build` compiles successfully; `consolidated-person-panel.tsx` imports `@/modules/companies` and `@/modules/reporting`, consistent with the declared cycle; no `SPEC_DEVIATION` marker needed beyond what's declared |

All 5 deviations verified as described — no undisclosed behavior found beyond what was declared.

---

## Edge Cases

- [x] EC-1: 404 in `(app)` context reuses static `SiteHeader` (header shows "Entrar/Cadastrar" even for logged-in users) — accepted per A4/H-4, no PII leak (MN-01 guard covers this).
- [x] EC-2: `TERM_BODY_UNAVAILABLE` fallback renders as paragraph — `term-markdown.test.tsx:105-110`.
- [x] EC-3: HTML-like content in term body renders inert — covered by MN-04 test + mutation.
- [x] EC-4: Unknown role/status key falls back to raw value (`?? role` / `?? person.status`) — code-level fallback present in all 4 badge sites; no unknown key exists today given fixed enums.
- [x] EC-5: `/termos`/`/privacidade` respond identically regardless of session — pages are static Server Components with no session read (confirmed no `getCurrentPerson`/session import in either file).

---

## Gate Check

- **Gate command**: `npm run build && npm run lint && npm run typecheck && npm run test`
- **Result**: build ✅, lint ✅ (0 errors), typecheck ✅ (0 errors), test 1988/1988 passed, 0 failed, 0 skipped
- **Test count before feature** (worktree at `0b6a810~1`): 274 files / 1948 tests
- **Test count after feature** (`fef161e`): 281 files / 1988 tests
- **Delta**: +7 files / +40 tests — matches exactly the 7 new test files declared across T1/T3/T4/T7/T8 (`not-found.test.tsx`, `not-found-no-auth-pii.test.ts`, `legal-placeholder.test.tsx`, `term-markdown.test.tsx`, `no-markdown-dep.test.ts`, `person-status-labels.test.ts`, `company-grant-status-labels.test.ts`) plus extensions to existing files (T5/T6/T9/T10) — no deletions, no weakened assertions.
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans

None — no gaps found.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ----------- |
| PUB3-1..4 | Implementing | ✅ Verified |
| PUB4-1..2 | Implementing | ✅ Verified |
| AUTH2-1..3 | Implementing | ✅ Verified |
| AUTH6-1..4 | Implementing | ✅ Verified |
| SOC4-1..4 | Implementing | ✅ Verified |
| SOC6-1..3 | Implementing | ✅ Verified |
| CASCA59-MN-01..05 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 20/20 ACs matched spec-defined outcome, 0 spec-precision gaps
**Sensor**: 5/5 mutations killed (one per must-not guard)
**Must-nots**: 5/5 green + guard-removal mutation killed
**Gate**: build/lint/typecheck/test all green (1988/1988 tests, +40 net new vs. pre-feature baseline)

**What works**: PT-BR 404 with public chrome (live HTTP 404 verified), favicon served with correct brand identity, `/termos`+`/privacidade` placeholders (live HTTP 200 verified) that don't fabricate legal content, Markdown-free term renderer adopted in all 5 use sites without any new dependency and without HTML injection, consolidated panel and `pessoas/[id]` fully de-rawed to PT-BR labels via canonical maps, SOC-6 docs realigned with zero `src/` touch.

**Issues found**: none.

**Next steps**: none — feature verified PASS. No lessons to distill (clean PASS, no surviving mutants, no spec-precision gaps, no failed ACs, no `SPEC_DEVIATION` markers beyond the ones already declared and verified as intended).
