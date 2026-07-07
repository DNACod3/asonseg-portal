# USP-007 Inativar Pessoa - Restyle ao Design System (Fase 1) - Specification

> **Unidade de refactor (Grupo E).** O comportamento da USP-007 já está entregue e
> mergeado na Fase 1. Esta unidade **não** altera comportamento: reestiliza a UI de
> inativação para o Design System (AD-014) e mais nada. As ACs comportamentais são
> **preservadas** (regressão), não reimplementadas.

## Fonte da verdade upstream (adaptar, não re-derivar)

Requisitos de **comportamento** desta USP são canônicos no épico e no código já entregue -
esta spec **indexa**, não os reescreve:

| Fonte | O que fornece | Como é usado aqui |
|---|---|---|
| `.specs/features/identity-acesso-papeis/spec.md` (épico) | História "P1: Inativar Pessoa" + **IDN-15**, **IDN-16** (AC-007-1/2/3) | IDs canônicos de comportamento; reusados sem re-mintar. |
| `src/modules/persons/actions/inactivate-person.ts` | Sequência da Server Action sensível já implementada | Comportamento congelado a preservar. |
| `src/modules/persons/domain/person-inactivation.ts` | Política de autorização pura (`canInactivatePerson`) | Comportamento congelado a preservar. |
| STATE.md `AD-014` | Convenção de Design System (tokens + primitivos `src/shared/ui`) | Restrição de projeto ativa que este restyle deve seguir. |
| `.specs/features/fundacao-ui-design-system/design.md` | Inventário de primitivos e tokens | Fonte dos componentes/classes-token do restyle. |

Requisitos **novos** desta unidade (o trabalho de restyle) recebem IDs **locais** `U7-NN` /
`U7-MN-NN` e são explicitamente marcados como adições locais.

## Problem Statement

A UI de inativação (`inactivate-person-dialog.tsx` e o ramo ATIVO de `pessoas/[id]/page.tsx`)
foi escrita com Tailwind ad-hoc (`bg-red-600`, `text-gray-900`, `border-gray-200`, hex de
paleta fixa) antes da fundação de Design System (AD-014). Isso quebra a paridade visual com o
resto da Fase 1 e ignora os tokens/primitivos de `src/shared/ui`. Precisamos reestilizar essas
telas consumindo o Design System, **sem tocar em nenhum comportamento** (autorização, pré-condição
de único responsável, idempotência, justificativa obrigatória, guard de concorrência, auditoria,
histórico preservado).

## Goals

- [ ] `inactivate-person-dialog.tsx` reestilizado com primitivos/tokens do DS (Button, Textarea, Label, cores semânticas), sem classes de paleta fixa.
- [ ] Ramo ATIVO de `pessoas/[id]/page.tsx` reestilizado com `Badge`/`Card`/tokens do DS.
- [ ] Ação destrutiva com tratamento visual "danger" consistente e reutilizável no DS (variante `danger` do `Button`).
- [ ] Zero mudança de comportamento: toda a suíte de testes de comportamento existente segue verde e inalterada.

## Out of Scope

| Feature | Reason |
|---|---|
| Qualquer mudança em handlers, schema Zod, Server Action, query, view model, navegação, metadata ou cache | Restyle é **style-only**; comportamento é congelado (preservação). |
| Introduzir um primitivo Dialog/Modal ou dependência de dialog (`@radix-ui/react-dialog` etc.) | O DS não tem Dialog; o diálogo atual é bespoke e deve permanecer (sem nova dependência - AD-014/allowlist). |
| Ramo "pedido do titular sob LGPD" (E-004/P-004 do intent) | Fora de escopo do código atual (gate D-003); não é reaberto por um restyle. |
| Ramo INATIVO do `page.tsx` (badge "Inativa", CTA de reativação) | Restilizado na **mesma** tarefa de página desta unidade (arquivo único), mas a lógica de reativação é da USP-045. Ver Assumptions. |
| Endurecer o escopo do coordenador para "coordenador da sua área" | Não há modelo de área no MVP (limitação consciente do domínio); não é trabalho de restyle. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|
| A UI de inativação deve virar `variant="danger"` do `Button` (adicionada ao DS) em vez de override de classe por call-site | agent | Adicionar UMA variante `danger` ao primitivo `Button` (token `bg-danger`, guard-safe), reusável | DRY e consistente com a linguagem do protótipo; o brief cita "Button variants incl. danger"; alternativa (override `bg-danger` no call-site) documentada como fallback | y (autônomo) |
| O `page.tsx` é um arquivo único que serve ATIVO (USP-007) e INATIVO (USP-045); o restyle da página inteira é **uma** tarefa atômica desta unidade (USP-007) | agent | USP-007 possui o restyle do arquivo `page.tsx` (ambos os ramos); USP-045 não toca a página (evita edição dupla do mesmo arquivo) | Ownership de arquivo limpo no pipeline por-unidade; USP-007 roda antes (dep da 045) | y (autônomo) |
| Sem teste de rota para `page.tsx`; a preservação de comportamento da página é verificada por diff + build + testes das funções subjacentes | agent | Gate de build para a página; as guardas de autorização/`notFound`/`isSelf` ficam byte-a-byte inalteradas | O repo não tem teste da rota RSC `force-dynamic`; build+diff é o piso pragmático (coerente com a filosofia de cobertura do repo) | y (autônomo) |
| O port `CompanyResponsibility` está **hoje** ligado ao adapter REAL (`PrismaCompanyResponsibilityAdapter`), não ao `Null...` | agent | Documentar o estado real: P-002 é efetivamente aplicado (não vacuamente) - `src/shared/container.ts:92` | O módulo `companies` já existe (USP-012..017); o brief citava o stub Null (desatualizado) | y (verificado no código) |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Inativar Pessoa (comportamento - canônico, PRESERVAR) ⭐ MVP

**Fonte canônica:** épico `identity-acesso-papeis/spec.md` > "P1: Inativar Pessoa" (IDN-15, IDN-16).

Reproduzido aqui **apenas** como âncora de regressão - o restyle não pode violar nenhum destes.
O detalhamento de cada AC é o do épico; o mapeamento para o código atual está em `design.md`.

**Acceptance Criteria (preservados):**

1. (IDN-15 / AC-007-1) QUANDO o operador autorizado inativa uma Pessoa, ENTÃO o sistema DEVE impedir novos logins dessa Pessoa (efeito de `status=INATIVO` via `getCurrentPerson`/ADR-0030).
2. (IDN-15 / AC-007-2) ENQUANTO a Pessoa está inativa, o sistema DEVE preservar todo o histórico - nada é apagado (grants, consentimentos, candidaturas, etc.).
3. (IDN-16 / AC-007-3) QUANDO a Pessoa é único responsável ativo de uma Empresa, ENTÃO o sistema DEVE bloquear a inativação até designar outro responsável (`PRECONDITION_FAILED`, port `CompanyResponsibility`).
4. QUANDO o ator não é autorizado (não board nem coordenador; coordenador sobre não-voluntário; ou auto-inativação), ENTÃO o sistema DEVE recusar com `FORBIDDEN` e mensagem específica.
5. QUANDO a Pessoa já está inativa, ENTÃO o sistema DEVE retornar `CONFLICT` (idempotência).
6. QUANDO a justificativa falta ou tem menos de 5 caracteres, ENTÃO o sistema DEVE recusar na borda (Zod) sem chamar a persistência.
7. QUANDO dois submits concorrem, ENTÃO o guard `updateMany where status=ATIVO` DEVE garantir que só um vença (o perdedor vira `CONFLICT`).
8. A transição DEVE rodar dentro de `withAudit('PERSON_INACTIVATED')` (uma transação; motivo na coluna `justification`).

**Independent Test:** as suítes `person-inactivation.test.ts`, `inactivate-person.int.test.ts` e `InactivatePersonDialog.test.tsx` (já existentes) permanecem verdes e **inalteradas** após o restyle.

---

### P1: Restyle da UI de inativação ao Design System (LOCAL - trabalho desta unidade) ⭐ MVP

**User Story:** Como mantenedor do Portal, quero a UI de inativação estilizada pelos tokens e
primitivos do Design System (AD-014), para que a tela tenha paridade visual com o resto da Fase 1
e seja consistente no dark mode, sem qualquer mudança de comportamento.

**Why P1:** É o objetivo desta unidade de refactor; sem ele a tela permanece fora do DS.

**Acceptance Criteria:**

1. (U7-01) QUANDO o `inactivate-person-dialog.tsx` é renderizado, ENTÃO seus controles DEVEM usar os primitivos do DS (`Button`, `Textarea`, `Label`) via barrel `@/shared/ui`, e a casca (overlay + cartão) DEVE usar tokens (`bg-surface`, `text-fg`, `text-fg-muted`, `border-border`, `rounded-lg`, `shadow-xl`) - sem classes de paleta fixa (`bg-red-600`, `text-gray-*`, `border-gray-*`).
2. (U7-02) QUANDO o botão de ação destrutiva (gatilho "Inativar Pessoa" e "Confirmar inativação") é renderizado, ENTÃO DEVE usar `Button variant="danger"`; o botão "Cancelar" DEVE usar `Button variant="outline"`.
3. (U7-03) QUANDO o `Button` recebe `variant="danger"`, ENTÃO DEVE renderizar tratamento vermelho via token `bg-danger` (sem hex cru), mantendo as variantes existentes (`primary`/`secondary`/`outline`) inalteradas.
4. (U7-04) QUANDO o ramo ATIVO de `pessoas/[id]/page.tsx` é renderizado, ENTÃO o selo de status DEVE usar `Badge` (verde para "Ativa"), a seção DEVE usar `Card`/tokens, títulos DEVEM usar `font-heading` e o texto DEVE usar tokens (`text-fg`/`text-fg-muted`) - sem paleta fixa.
5. (U7-05) O restyle DEVE preservar todos os seletores acessíveis que os testes existentes usam: nomes dos botões ("Inativar Pessoa", "Confirmar inativação", "Cancelar"), o `role="dialog"` com `aria-labelledby`, o `aria-label`/`htmlFor` do campo "Motivo da inativação", e os `role="alert"` de erro.

**Independent Test:** `npm run test` (RTL do diálogo verde), `npm run build` + `npm run typecheck` + `npm run lint` verdes; inspeção de diff confirma apenas markup/classes alteradas.

---

## Edge Cases

- QUANDO o dark mode está ativo (`[data-theme="dark"]`), ENTÃO os tokens DEVEM re-resolver e o diálogo/página DEVEM permanecer legíveis sem `dark:` explícito (garantido pelos primitivos/tokens).
- QUANDO a Pessoa é ela mesma (`isSelf`), ENTÃO a página DEVE continuar exibindo o aviso "Você não pode inativar a si mesmo(a)" (ramo preservado, só reestilizado).
- QUANDO a action retorna `PRECONDITION_FAILED` (único responsável), ENTÃO o diálogo DEVE continuar exibindo a mensagem e permanecer aberto (comportamento preservado; só o estilo do bloco de erro muda para token).

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT... | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| U7-MN-01 | QUANDO reestilizando, o sistema NÃO DEVE alterar nenhum comportamento da inativação: autorização sensível ao alvo (`canInactivatePerson`), pré-condição de único responsável (P-002), idempotência, justificativa obrigatória (Zod), guard de concorrência (`updateMany where status=ATIVO`), o wrapping `withAudit('PERSON_INACTIVATED')`, ou a garantia de que nada é apagado. | Regressão silenciosa de privilégio/integridade sob o rótulo "só estilo" | T2, T3 | Suíte de comportamento existente (`person-inactivation.test.ts`, `inactivate-person.int.test.ts`, `InactivatePersonDialog.test.tsx`) segue **verde e inalterada** |
| U7-MN-02 | QUANDO reestilizando, o sistema NÃO DEVE introduzir dependência de dialog/modal (`@radix-ui/react-dialog` ou similar) nem hex cru / utilitário de paleta fixa dentro de `src/shared/ui/**`. | Inchaço de dependência / violação do sistema de tokens (quebra dark mode e fonte única de verdade do DS) | T1, T2 | Grep guard de ausência de dep de dialog + guarda **DS-MN-02** existente (scan de hex/paleta em `src/shared/ui/**`) segue verde |
| U7-MN-03 | QUANDO reestilizando `page.tsx`, o sistema NÃO DEVE alterar as guardas de autorização/entrada (`requireActivePerson`, `hasInactivationPrivilege`→`notFound`, `viewPersonForStaff`, `isSelf`, `hasReactivationPrivilege`), o export `dynamic='force-dynamic'`, nem o mapa `ROLE_LABELS`. | Vazamento de rota / mudança de cache / regressão de privilégio via "restyle" da página | T3 | Diff review confirma que só JSX/classes mudaram; `npm run build`/`typecheck`/`lint` verdes; testes das funções subjacentes verdes |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| IDN-15 | Inativar Pessoa (comportamento) | - | Implemented (preserve) |
| IDN-16 | Único responsável de Empresa | - | Implemented (preserve) |
| U7-01 | Restyle do diálogo (primitivos + tokens) | Tasks | In Tasks |
| U7-02 | Botões danger/outline no diálogo | Tasks | In Tasks |
| U7-03 | Variante `danger` do `Button` (DS) | Tasks | In Tasks |
| U7-04 | Restyle do ramo ATIVO da página (Badge/Card/tokens) | Tasks | In Tasks |
| U7-05 | Preservação de seletores acessíveis | Tasks | In Tasks |
| U7-MN-01 | Preservação de comportamento da inativação | Tasks | In Tasks |
| U7-MN-02 | Sem dep de dialog / sem hex em shared/ui | Tasks | In Tasks |
| U7-MN-03 | Preservação das guardas/config da página | Tasks | In Tasks |

**ID format:** IDN-* são canônicos do épico (comportamento, reusados sem re-mintar). U7-* são adições locais desta unidade de restyle.

**Coverage:** 9 requisitos totais (2 canônicos preservados + 7 locais), todos mapeados a tarefas.

---

## Success Criteria

- [ ] Diálogo e página ATIVO consomem exclusivamente primitivos/tokens do DS; zero classe de paleta fixa nos arquivos tocados.
- [ ] `Button` ganha variante `danger` reusável (token, sem hex), variantes existentes intactas.
- [ ] `npm run test` (unit/RTL), `npm run typecheck`, `npm run lint`, `npm run build` verdes; integração (`npm run test:integration`) verde como rede de segurança de regressão.
- [ ] Nenhum teste de comportamento foi modificado, enfraquecido ou removido.
