# USP-006 Ativar papel adicional na Pessoa autenticada - Refactor (Fase 1) Specification

> **Fonte da verdade upstream (adaptar, nao re-derivar):** os requisitos funcionais da USP-006 ja
> vivem no epico `.specs/features/identity-acesso-papeis/spec.md` (historia "P1: Ativar papel adicional
> na Pessoa autenticada", requisito **IDN-14** e Edge Cases). Este documento **nao re-deriva** aqueles
> ACs - a USP ja esta implementada e mergeada. Ele especifica **apenas o delta de refactor da Fase 1**
> (restilizar a tela e o formulario ao Design System AD-014, estilo apenas) sobre o codigo existente.
> O ID `IDN-14` permanece canonico; o ID local abaixo (`U6-*`) cobre so o que o epico nao descreve
> (restyle da tela de ativacao de papel + garantias de preservacao).

## Problem Statement

A USP-006 esta entregue e correta: a Server Action `activate-additional-role.ts` e o exemplar canonico
da sequencia de Server Action sensivel (resolve a Pessoa **so** pela sessao, recomputa o SHA-256 do
termo server-side via `loadTerm`, ativa sem moderacao do papel, tudo em uma unica `withAudit`
transacao, reativacao idempotente, exige apenas os campos faltantes do perfil). O que falta na rodada
de reconciliacao da Fase 1 e puramente visual: a rota `(app)/perfil/papeis/page.tsx` e o Client
Component `activate-role-form.tsx` ainda usam Tailwind solto (`bg-blue-600`, `text-gray-*`,
`border-gray-200`, `focus:ring-blue-*`, `accent-blue-600`, `bg-gray-50`, `bg-red-50`/`text-red-*`) fora
do Design System. Estas telas **nao existem no protótipo**, entao aplica-se a **linguagem visual** do
protótipo (FormHeader/FormCard/StepIcon/Input/Label/Button/Badge + tokens - a mesma ja aplicada a
login e cadastro), **nao** uma copia 1:1. Este refactor e **estilo apenas**: nenhum handler, schema,
action, query, navegacao, metadata ou cache e alterado.

## Goals

- [ ] Reestilizar o `ActivateRoleForm` (`components/activate-role-form.tsx`) com os primitivos e tokens
      do DS (AD-014) - `Input`/`Label`/`Button`, caixa de erro danger-token, cartao `FormCard`,
      radios/checkbox com `accent` de token - **sem alterar comportamento** (selecao de papel, campos
      faltantes, exibicao do termo, aceite obrigatorio, validacao client-side, chamada a
      `activateAdditionalRole`, redirect a `nextStep`).
- [ ] Reestilizar a rota `perfil/papeis/page.tsx` com `FormHeader` (+ `StepIcon`) e tokens, envolvendo
      o formulario reestilizado - preservando `dynamic='force-dynamic'`, `requireActivePerson` e
      `buildActivatableOptions` verbatim.
- [ ] Manter verdes todos os testes existentes da USP-006 (em especial `ActivateRoleForm.test.tsx`, 5
      casos), sem enfraquecer nenhuma assertiva.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar a Server Action `activate-additional-role.ts` (sequencia canonica) | Fora do escopo: a resolucao via `getCurrentPerson` (P-002), a recomputacao server-side do SHA-256 do termo (`loadTerm`, P-004/L-002), a ativacao sem moderacao (E-003), a `withAudit` transacao unica (P-001), a idempotencia de reativacao e o calculo de `missingProfileFields` permanecem **intocados**. O restyle nao toca a action (diff = 0 no arquivo da action). |
| Alterar `schemas/activate-role.schema.ts`, `domain/role-activation.ts`, `server/build-activatable-options.ts`, `server/session.ts` | Nenhum destes e tocado; o restyle e so de apresentacao. |
| Novos requisitos funcionais de IDN-14 | Ja entregues e cobertos pelos testes existentes; o refactor nao os altera. |
| Adicionar Radio/Checkbox como primitivos ao DS | O DS (AD-014) nao expoe primitivos Radio/Checkbox (barrel `src/shared/ui/index.ts`); os radios de selecao de papel e o checkbox de aceite permanecem elementos nativos, restilizados com `accent`/tokens. Criar novos primitivos e outra unidade. |
| Reestilizar login / cadastro | Ja feitos (Unidade 0 AD-014 e Grupo A); fora desta unidade. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| Telas sem contrapartida no protótipo seguem a **linguagem** do protótipo, nao uma copia 1:1. | agent | Aplicar `FormHeader`+`FormCard`+`StepIcon`+`Input`/`Label`/`Button`/`Badge` + tokens - o mesmo vocabulario ja aplicado a login/cadastro. | Decisao do dono do refactor (STATE.md: aplicar o DS a TODAS as telas da Fase 1, mesmo as ~10 sem contrapartida). Consistencia de token, nao pixel-copia. | y |
| Radios (selecao de papel) e checkbox (aceite do termo) permanecem elementos nativos. | agent | Manter `<input type="radio">`/`<input type="checkbox">`; trocar `accent-blue-600` por `accent-[var(--color-primary)]` (ou `accent-primary`) e as bordas/realces por tokens (`border-border`, `has-[:checked]:border-primary`). | O DS nao tem primitivo Radio; o checkbox de consentimento pode opcionalmente usar `LgpdCheck` (mapeia `.lgpd-check` do protótipo). Nao introduzir primitivo novo mantem o refactor estilo-apenas. | y |
| A caixa do termo (scroll) e o realce de selecao usam superficie/tokens do DS. | agent | Trocar `bg-gray-50` por superficie de token (`bg-background` / `bg-[var(--color-background)]` ou `LgpdBox`); `border-gray-200`→`border-border`; `text-gray-*`→`text-fg`/`text-fg-muted`. | Remove hex/paleta crua (respeita a convencao AD-014 e o espirito de DS-MN-03) mantendo o conteudo e o comportamento do scroll do termo. | y |
| A pagina usa `FormHeader` no lugar do `<header>`+`<h1>`/`<p>` cru. | agent | `FormHeader title="Ativar novo papel" description="..."` (texto atual preservado) + opcional `StepIcon variant="blue"`; `<main>` mantem o container centralizado. | Paridade de token com login/cadastro; o texto explicativo (multi-papel, ativacao imediata) e preservado. | y |
| Server Component de pagina (`perfil/papeis`) segue o padrao do repo: gate de estilo e typecheck+lint+build, sem teste RTL de pagina. | agent | Nao criar `page.test.tsx` para `perfil/papeis`. A cobertura concentra-se no `ActivateRoleForm` (RTL existente). | O repo so tem page.test onde ha roteamento condicional; `perfil/papeis` e render direto (sem branch `notFound`). Mesma decisao do precedente usp-004-login. | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Restyle da ativacao de papel adicional para o Design System (AD-014) - so estilo ⭐ MVP

**User Story**: Como usuario autenticado, quero que a tela de ativar um novo papel tenha a mesma
identidade visual do login, do cadastro e do restante do portal, para que a experiencia seja coesa.

**Why P1**: Consistencia visual e o objetivo central da rodada Fase 1 (AD-014); ativar papel adicional
e um fluxo autenticado recorrente (candidato que vira prestador etc.).

**Acceptance Criteria**:

1. QUANDO o `ActivateRoleForm` e reestilizado ENTAO o sistema DEVE usar `Label`/`Input`/`Button` do
   barrel `@/shared/ui` e a caixa de erro do servidor no padrao danger-token do `LoginForm`
   (`rounded-sm bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger`),
   **preservando** a selecao de papel, a exibicao apenas dos campos faltantes (E-001), a exibicao do
   termo da finalidade (P-004), o aceite obrigatorio, a validacao client-side, a chamada a
   `activateAdditionalRole` com o payload identico e o `router.push(nextStep)` + `refresh`.
2. QUANDO a rota `perfil/papeis/page.tsx` e reestilizada ENTAO o sistema DEVE compo-la com `FormHeader`
   (+ opcional `StepIcon`) e tokens, sem classes de paleta crua (`text-gray-*`, `bg-blue-*`), e DEVE
   preservar `dynamic='force-dynamic'`, `requireActivePerson()` e `buildActivatableOptions()` verbatim.
3. QUANDO qualquer tela restilizada e aberta em modo escuro ENTAO o sistema DEVE resolver as cores via
   tokens (`data-theme`), sem hex cru (radios/checkbox usam `accent` de token; termo/realces usam
   superficie de token).

**Independent Test**: Rodar `ActivateRoleForm.test.tsx` (5 casos existentes) verde apos o restyle
(labels "Telefone"/"Endereco completo", botao "Ativar papel", `role="alert"`, "sem papeis ativaveis",
"nao chama a action sem campos", "action falha exibe mensagem" preservados); abrir `perfil/papeis` no
browser em light/dark e confirmar paridade com a linguagem do protótipo.

---

## Edge Cases

- QUANDO nao ha papeis ativaveis ENTAO o formulario DEVE manter a mensagem "voce ja possui todos os
  papeis publicos disponiveis" (estilo em token, sem `text-gray-500` cru).
- QUANDO os campos faltantes nao sao preenchidos ENTAO o formulario DEVE **nao** chamar
  `activateAdditionalRole` (guarda client preservada no restyle).
- QUANDO o aceite do termo nao esta marcado ENTAO o botao "Ativar papel" DEVE permanecer desabilitado
  (guarda preservada no restyle).
- QUANDO o restyle e aplicado ENTAO o sistema DEVE **nao** alterar handlers, schema, action, o payload
  enviado a `activateAdditionalRole`, `dynamic='force-dynamic'` nem os textos de label/botao que os
  testes asseveram.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT... | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U6-MN-01 | QUANDO o `ActivateRoleForm` e submetido com campos faltantes vazios OU sem o aceite do termo marcado, ENTAO o sistema NAO DEVE chamar `activateAdditionalRole`. | Restyle enfraquecer as guardas client-side (campos obrigatorios do papel e aceite do termo) da ativacao de papel. | T1 | `ActivateRoleForm.test.tsx` (existentes, mantidos verdes) - "campos faltantes nao preenchidos -> NAO chama a action" e "botao desabilitado ate marcar o aceite". |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IDN-14 (upstream, canonico) | USP-006 | Verified (entregue) | Preservado |
| U6-STYLE-01 (local) | P1 Restyle | Tasks | Pending |
| U6-MN-01 (local) | P1 Restyle | Tasks | Pending |

- **U6-STYLE-01**: Restyle de `perfil/papeis/page.tsx` + `activate-role-form.tsx` com primitivos/tokens do DS, estilo apenas (AC P1-Restyle 1-3).

**Coverage:** 3 itens (1 upstream preservado, 2 locais); 2 locais mapeados a tasks.

---

## Success Criteria

- [ ] `perfil/papeis/page.tsx` e `activate-role-form.tsx` usam exclusivamente primitivos/tokens do DS; paridade visual com a linguagem do protótipo em light e dark.
- [ ] A Server Action `activate-additional-role.ts` e todos os arquivos de dominio/schema/server da USP-006 permanecem **intocados** (diff = 0) - sequencia canonica preservada por nao-modificacao.
- [ ] Todos os testes existentes da USP-006 permanecem verdes; `ActivateRoleForm.test.tsx` (5 casos) verde sem alteracao das assertivas (U6-MN-01).
