# USP-006 Ativar papel adicional - Refactor (Fase 1) Design

**Spec**: `.specs/features/identity-acesso-papeis/usp-006-ativar-papel/spec.md`
**Status**: Draft

> **Fontes da verdade upstream (adaptar, nao re-derivar):** Design System AD-014
> (`.specs/features/fundacao-ui-design-system/design.md` + barrel `src/shared/ui/index.ts`) fixa os
> primitivos e tokens; o protótipo `docs/prototipo/index.html` fixa a linguagem visual. STATE.md
> `## Decisions`: **AD-014 (active)** e a convencao que este design consome; AD-013 (Fase 0) e escopo
> distinto e nao conflita. Nenhuma decisao ativa e supersedida. Este design **nao re-decide** nada do
> DS - apenas mapeia o markup atual das duas telas para os primitivos existentes.

---

## Architecture Overview

Refactor puramente de apresentacao. Duas camadas tocadas, ambas so no markup/classe:

```mermaid
graph TD
    subgraph DS[src/shared/ui - AD-014 (nao alterado)]
      FH[FormHeader / StepIcon]
      FC[FormCard]
      IN[Input / Label / Button]
      LG[LgpdBox / LgpdCheck]
    end
    subgraph USP006[USP-006 (so estilo)]
      PAGE[perfil/papeis/page.tsx]
      FORM[activate-role-form.tsx]
    end
    subgraph Preserved[Preservado - diff = 0]
      ACT[actions/activate-additional-role.ts]
      SCH[schemas/activate-role.schema.ts]
      DOM[domain/role-activation.ts]
      SRV[server/build-activatable-options.ts + session.ts]
    end
    FH --> PAGE
    FC --> PAGE
    IN --> FORM
    LG -.opcional.-> FORM
    PAGE --> FORM
    FORM -->|payload IDENTICO| ACT
    ACT --- SCH & DOM & SRV
```

**Principio central:** o `ActivateRoleForm` mantem exatamente o mesmo estado React (`selectedRole`,
`values`, `accepted`, `fieldErrors`, `serverError`), a mesma validacao client-side e o mesmo payload
para `activateAdditionalRole`. So mudam elementos crus por primitivos e classes de paleta por tokens.
A action e toda a cadeia server-side ficam **intocadas** - a preservacao da sequencia canonica e
garantida por nao-modificacao (o Verifier confirma diff = 0 nesses arquivos).

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `FormHeader` / `StepIcon` | `src/shared/ui` (barrel) | Cabecalho da pagina `perfil/papeis` (titulo + descricao atuais preservados). |
| `FormCard` | `src/shared/ui` | Envolver o formulario de ativacao e/ou cada bloco `RoleActivation`. |
| `Input` / `Label` / `Button` | `src/shared/ui` | Substituir `<input>`/`<label>`/`<button>` crus dos campos faltantes e do submit. |
| `LgpdBox` / `LgpdCheck` | `src/shared/ui` | Opcional: `LgpdBox` para a caixa do termo; `LgpdCheck` para o checkbox de aceite (mapeiam `.lgpd-box`/`.lgpd-check` do protótipo). |
| `Badge` | `src/shared/ui` | Opcional para rotulos auxiliares (ex.: finalidade). |
| `LoginForm.tsx` / `login/page.tsx` | `src/modules/identity/components`, `src/app/(auth)/login` | Gabarito de restyle ja mergeado: padrao de caixa danger-token, `FormHeader`+`FormCard`, `Button variant="primary"`. |
| `ActivateRoleForm.test.tsx` | `src/modules/identity/__tests__` | Rede de seguranca (5 casos) que deve permanecer verde - assevera preservacao de labels, botao, guardas e desfechos. |

### Integration Points

| System | Integration Method |
| --- | --- |
| `activateAdditionalRole` (Server Action) | O form continua importando e chamando a action com **payload identico** (`role`, `termVersion`, `termContentHash`, `acceptTerm`, `profile`). Sem mudanca. |
| `buildActivatableOptions` (server helper) | A pagina continua chamando-o verbatim; o restyle nao toca a montagem das opcoes nem o carregamento/validacao do termo. |
| Tailwind (v3.4.19) + tokens AD-014 | Classes de token (`text-fg`, `border-border`, `bg-background`, `text-danger`, `accent-primary`) ja no `theme.extend`; `content` cobre `src/modules/**` e `src/app/**`. |
| Vitest (jsdom) | `ActivateRoleForm.test.tsx` roda em `npm run test`; deps (action, router) mockadas. |

---

## Components

### `ActivateRoleForm` (restyle - so estilo)

- **Purpose**: exibir papeis ativaveis, campos faltantes, termo e aceite; submeter a `activateAdditionalRole`.
- **Location**: `src/modules/identity/components/activate-role-form.tsx`
- **Mudancas (markup/classe apenas)**:
  - Radios de selecao de papel: manter `<input type="radio">`; trocar `accent-blue-600`→`accent-primary` (ou `accent-[var(--color-primary)]`), `border-gray-200`→`border-border`, `has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50`→variantes de token (`has-[:checked]:border-primary has-[:checked]:bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]`), `text-gray-*`→`text-fg`/`text-fg-muted`, `hover:bg-gray-50`→superficie de token.
  - Bloco `RoleActivation`: `<form>` envolto em `FormCard` (ou classes de card em token) no lugar de `rounded-xl border border-gray-200 bg-white ... shadow-sm`; titulo/descricao em `text-fg`/`text-fg-muted`.
  - Campos faltantes: `<label>`→`Label`, `<input>`→`Input` (encaminha `ref`/props nativas; compativel com o `value`/`onChange` controlados atuais); erro de campo mantem `<p role="alert" className="text-xs text-danger">`.
  - Caixa do termo: `bg-gray-50`→superficie de token (ou `LgpdBox`), mantendo `max-h-72 overflow-auto ... whitespace-pre-wrap` e o conteudo `option.term.body`.
  - Checkbox de aceite: `<input type="checkbox">` com `accent-primary` (ou `LgpdCheck`); texto em `text-fg`.
  - Caixa de erro do servidor: `bg-red-50 text-red-700`→padrao danger-token do `LoginForm`.
  - Botao submit: `<button ...bg-blue-600...>`→`<Button variant="primary" type="submit" disabled={!accepted || isPending}>`; textos "Ativando..."/"Ativar papel" preservados.
- **Preservado**: todos os hooks/estado, `onSubmit`, a validacao dos `missingFields`, o gate do aceite, o payload da action, `router.push(result.data.nextStep)` + `refresh`, todos os textos que os testes asseveram.
- **Reuses**: `@/shared/ui` (`Input`/`Label`/`Button`/`FormCard`/`LgpdBox`/`LgpdCheck`).

### `perfil/papeis/page.tsx` (restyle - so estilo)

- **Purpose**: rota autenticada que lista papeis ativaveis e renderiza o formulario.
- **Location**: `src/app/(app)/perfil/papeis/page.tsx`
- **Mudancas (markup/classe apenas)**: `<header>`+`<h1 className="text-gray-900">`+`<p className="text-gray-600">`→`FormHeader title="Ativar novo papel" description="..."` (texto atual preservado) + opcional `StepIcon variant="blue"`; `<main>` mantem o container centralizado com tokens.
- **Preservado (verbatim)**: `export const dynamic = 'force-dynamic'`, `await requireActivePerson()`, o snapshot `{ phone, fullAddress }`, `await buildActivatableOptions(...)`, `<ActivateRoleForm options={options} />`, o comentario de privacidade (P-002).
- **Reuses**: `@/shared/ui` (`FormHeader`, `StepIcon`); `login/page.tsx` como gabarito de composicao.

---

## Data Models (if applicable)

N/A - unidade puramente de apresentacao; nenhum modelo Prisma, Server Action ou consulta e criado ou
alterado. Os fluxos da USP-006 permanecem intactos.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| Erro do servidor da action (CONFLICT/PRECONDITION/INTERNAL) | Mesma `serverError` renderizada, agora na caixa danger-token | Mensagem identica, so o estilo muda. |
| Campo faltante vazio / aceite nao marcado | Guarda client preservada (nao chama a action; botao desabilitado) | Comportamento identico (U6-MN-01). |
| Cor em modo escuro | Tokens re-resolvem via `data-theme`; radios/checkbox usam `accent` de token | Sem hex cru; paridade light/dark. |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| --- | --- | --- | --- |
| `Input` (forwardRef) precisa aceitar `value`/`onChange` controlados (o form e controlado, nao usa RHF) | `activate-role-form.tsx:170-180` | Se `Input` nao encaminhar props nativas, quebraria o controle | `Input` e `forwardRef` sobre `<input>` nativo (design AD-014); encaminha todas as props - compativel; `ActivateRoleForm.test.tsx` (change/submit) prova em verde. |
| DS nao tem primitivo Radio/Checkbox | `src/shared/ui/index.ts` | Tentacao de introduzir primitivo novo (fora do escopo) | Manter elementos nativos com `accent`/tokens; documentado como assumption. Checkbox de aceite pode usar `LgpdCheck` (ja existe). |
| Editar componente/pagina de um modulo entregue | `src/modules/identity/**`, `src/app/(app)/perfil/papeis/**` | Regressao de fluxo de ativacao | So troca de marcacao/estilo; a action fica intocada (diff = 0); `ActivateRoleForm.test.tsx` assevera preservacao. |

> Nenhum outro concern relevante encontrado nos arquivos tocados.

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Radio/checkbox nativos vs. primitivo novo | Nativos com `accent-primary`/tokens | DS nao expoe Radio; introduzir primitivo e outra unidade. Estilo-apenas. |
| Checkbox de aceite do termo | `LgpdCheck` (opcional) ou `<input>` com `accent-primary` | `LgpdCheck` mapeia `.lgpd-check` do protótipo (consentimento) - encaixe semantico; discricionario. |
| Caixa do termo | Superficie de token / `LgpdBox` | Remove `bg-gray-50` cru mantendo scroll e `whitespace-pre-wrap`. |
| Cabecalho da pagina | `FormHeader` (+ `StepIcon`) | Paridade de token com login/cadastro; texto atual preservado. |
| Sem page.test para `perfil/papeis` | Gate de build | Render direto sem roteamento condicional; mesma decisao do precedente usp-004-login. |

> **Project-level decisions:** nenhuma nova - este design apenas **consome** AD-014. Nada a anexar a
> STATE.md `## Decisions`.

---

## Tips aplicadas
- Context first: reusa `LoginForm`/`login page` como gabarito e a rede RTL existente.
- Reuse e rei: so primitivos do barrel `@/shared/ui`; nada reinventado.
- Interfaces first: o payload da action e o estado do form sao contratos fixos - preservados verbatim.
