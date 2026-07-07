# USP-043 Consentimentos - Refactor (Fase 1) Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/consentimentos-lgpd/usp-043-consentimentos/spec.md`
**Diff range**: `e54e725..HEAD` (6 commits, `32b0dbb`..`8a82624`)
**Verifier**: independent sub-agent (author != verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | Done | Restyle `ConsentsPanel` + assert opcional de variante `Badge` (`0fb9b70`) |
| T2   | Done | Restyle `consentimentos/page.tsx` (`8a82624`) |

---

## Spec-Anchored Acceptance Criteria

### P1: Restyle do painel de consentimentos para o Design System (AD-014)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `Card` por consentimento, `Badge` (green/orange/gray por status), `Button` para ações, sem paleta crua | `STATUS_BADGE` mapeia `vigente->green, desatualizado->orange, revogado->gray`; `<article>` com tokens de superfície | `src/modules/consents/components/consents-panel.tsx:16-20` - mapa `variant`; `:75` - `className="rounded-md border border-border bg-surface p-6 shadow-sm"`; teste `consents-panel.test.tsx:77-97` - `expect(screen.getByText('Vigente')).toHaveClass('text-success')` etc. | PASS |
| AC2: preserva landmarks (`region`), `role="dialog"` `aria-modal`, nomes acessíveis | Sem renomear regiões/botões | `consents-panel.tsx:28,40` (`aria-labelledby="vigentes-heading"`/`"revogados-heading"`), `:138-139` (`role="dialog" aria-modal="true"`); `consents-panel.test.tsx` (3 casos pré-existentes mantidos verdes, nomes "Revogar"/"Sim, revogar"/"Ver termo aceito"/"Cancelar" intactos) | PASS |
| AC3: consentimento revogado não oferece "Revogar" | Só vigentes recebem `revocable` | `consents-panel.tsx:35,45` - `revocable` (true) nos vigentes, `revocable={false}` nos revogados; `:117` `{revocable && <Button>Revogar</Button>}` | PASS |
| AC4: página `consentimentos` preserva `requireActivePerson`, dedup de termos, `dynamic='force-dynamic'` | Nenhuma mudança de lógica de dados | `git diff` de `src/app/(app)/consentimentos/page.tsx` - único delta é `<h1>`/`<p>`/estado-vazio (tokens/`Card`); `requireActivePerson()`, o loop de dedup e `export const dynamic = 'force-dynamic'` (linha 11, fora do diff) inalterados | PASS |
| AC5: telas em modo escuro resolvem cor via tokens | Sem hex cru | Diff completo inspecionado - apenas `text-fg`/`text-fg-muted`/`bg-surface`/`bg-background`/`border-border`/`color-mix(...var(--color-danger)...)`; nenhum hex/rgba literal introduzido | PASS |

---

## Edge Cases

- [x] Sem consentimentos vigentes -> mensagem vazia com tokens (`text-fg-muted`, sem `text-gray-*`). `consents-panel.tsx:33`.
- [x] Consentimentos revogados -> seção aparece com `Badge` cinza (`variant: 'gray'` -> `text-fg-muted`) e sem "Revogar". `consents-panel.tsx:19,45,117` + sensor de mutação abaixo.
- [x] Revogação falha -> erro exibido na caixa de confirmação com token de perigo. `consents-panel.tsx:151` - `{error && <p className="... text-danger">{error}</p>}`; comportamento não tocado pelo refactor (só a classe).
- [x] Restyle não altera query/scoping por `personId`. `src/modules/consents/queries/list-own-consents.ts` e `src/app/(app)/consentimentos/page.tsx` - `requireActivePerson()`/`listOwnConsents(person.id)` fora do diff (linhas não tocadas).

**Status**: All edge cases handled correctly.

---

## Discrimination Sensor

Mutação injetada em estado descartável (edição direta + `git checkout --`); árvore real confirmada limpa ao final (`git diff --quiet -- src/`).

| # | File:line | Description | Killed? |
| - | --- | --- | --- |
| 1 | `src/modules/consents/components/consents-panel.tsx:45` | `revocable={false}` (revogados) -> `revocable` (guarda do must-not U43-MN-01 removida) | Killed - `consents-panel.test.tsx` 1/4 falhou (teste "separa vigentes de revogados e só oferece revogar nos vigentes") |

**Sensor depth**: lightweight (1 mutação direcionada ao único must-not comportamental deste refactor - a exposição condicional do botão "Revogar"; U43-MN-02 é escopo de query não tocado pelo diff, coberto por teste pré-existente inalterado, não sujeito a mutação neste round por não haver código novo a mutar)
**Result**: 1/1 killed - PASS

---

## Must-Not Verification

| ID | SHALL NOT... | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U43-MN-01 | Oferecer "Revogar" em revogado / revogar sem confirmação | `consents-panel.test.tsx` (existente, mantido verde) - `queryByRole('button', {name: 'Revogar'})` ausente nos cards revogados; `role="dialog"` antes de `revokeConsent` | Yes | Yes (mutação 1) |
| U43-MN-02 | Vazar consentimentos entre titulares | `list-own-consents.test.ts` (existente, não tocado pelo diff) - escopo por `personId`; página `consentimentos/page.tsx` continua usando `requireActivePerson().id` (confirmado por leitura do diff - linha não alterada) | Yes | N/A - código não tocado por este refactor; ausência de escrita = proteção herdada, não nova. Verificação por leitura confirma zero alteração na chamada `listOwnConsents(person.id)`. |

**Status**: All must-nots proven

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | PASS - troca 1:1 de classes cruas por primitivos/tokens; nenhuma abstração nova além do já existente `STATUS_BADGE` (só troca de tipo de valor) |
| Surgical changes | PASS - nenhuma alteração em `revokeConsent`, `listOwnConsents`, `own-consents.view` |
| No scope creep | PASS - `Out of Scope` do spec (ação de revogação, query, restyle da TX2 do cadastro) respeitado |
| Matches patterns | PASS - reusa padrão danger-token do `LoginForm`, `Badge`/`Button`/`Card` do barrel `@/shared/ui` |
| Spec-anchored outcome check | PASS - todos os 5 ACs mapeados a outcome preciso do spec e confirmados |
| Per-layer Coverage Expectation met | PASS - Client Component: RTL (separação+confirmação+disparo+termo+variante Badge); Server Component: gate de build (padrão do repo) |
| Every test maps to a spec requirement | PASS - novo teste cita `U43-STYLE-01` no nome |
| Documented guidelines followed | `CLAUDE.md` (Privacy - View Models, Testing Requirements), `docs/arch/project-guideline.md` - escopo por titular preservado via `requireActivePerson()` (view model, não Prisma direto) |

---

## Scope Hygiene

Ver `.specs/features/identity-acesso-papeis/usp-001-auto-cadastro/validation.md` (mesmo diff range, mesma verificação) - `git diff e54e725..HEAD --name-status` não inclui nenhum arquivo de `.agents/`, `.claude/skills/`, `.wolf/`, `.specs/prd/`, `.specs/evaluations/` ou `.specs/features/vagas/`.

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build`
- **Result**:
  - `typecheck`: 0 erros
  - `lint`: 0 erros
  - `test` (unit/RTL): **854 passed**, 0 failed, 117 arquivos (inclui `consents-panel.test.tsx`)
  - `build`: sucesso (`next build`, rota `/consentimentos` gerada)
- **`consents-panel.test.tsx` isolado**: 4/4 passed (3 casos pré-existentes mantidos + 1 novo de variante `Badge`)
- **Test count antes do refactor**: `consents-panel.test.tsx` tinha 3 casos -> 4 depois (+1, sem deleção)
- **Skipped tests**: nenhum
- **Failures**: nenhuma

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| LGP-05/LGP-04 (upstream) | Preservado | Verified (preservado, sem regressão) |
| U43-STYLE-01 | Pending | Verified |
| U43-MN-01 | Pending | Verified |
| U43-MN-02 | Pending | Verified |

---

## Summary

**Overall**: Ready

**Spec-anchored check**: 5/5 ACs matched spec outcome, sem gaps
**Sensor**: 1/1 mutation killed
**Must-nots**: 2/2 green (1 comprovado por mutação nova, 1 herdado de código/teste não tocado pelo diff)
**Gate**: typecheck/lint/test(854)/build todos verdes

**What works**: Restyle é estritamente markup/classe - `revokeConsent`, `listOwnConsents`, cascata de role grant e auditoria fora do diff. Landmarks, `role="dialog"`, e os 4 nomes acessíveis ("Revogar", "Sim, revogar", "Ver termo aceito", "Cancelar") intactos e comprovados verdes. A condição "Revogar só em vigentes" é uma guarda de UI real, comprovada por mutação (inverter a prop `revocable` quebra o teste pré-existente).

**Issues found**: nenhum.

**Next steps**: nenhuma ação necessária.
