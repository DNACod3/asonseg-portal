# USP-002 Cadastro de Pessoa pela assistente social - Refactor (Fase 1) Specification

> **Fonte da verdade upstream (adaptar, não re-derivar):** os requisitos funcionais da USP-002
> já vivem no épico `.specs/features/identity-acesso-papeis/spec.md` (história "P1: Cadastro de
> Pessoa pela assistente social", requisitos **IDN-04 / IDN-05 / IDN-06** e Edge Cases). Este
> documento **não re-deriva** aqueles ACs - a USP já está implementada, mergeada e coberta por
> testes. Ele especifica **apenas o delta de refactor da Fase 1** (restyle para o Design System
> AD-014) sobre o código existente, e **documenta** a decisão de consistência sobre a colocação do
> módulo (mantém em `identity`). Os IDs `IDN-04..06` permanecem canônicos; os IDs locais abaixo
> (`U2-*`) cobrem só o que o épico não descreve (restyle + preservações).

## Problem Statement

O cadastro assistido (USP-002) está entregue e correto, mas a UI destoa do Design System extraído do
protótipo (AD-014): o `AssistedRegisterForm` usa Tailwind solto (`border-gray-300`, `bg-blue-600`,
`text-gray-*`, paleta `amber-*` para a caixa de exceção, paleta `green-*` para o sucesso) e a página
`cadastro-assistido` usa `text-gray-900`/`text-gray-600` sem os primitivos `FormHeader`/`StepIcon`/
`FormCard`. Além disso, a rodada de reconciliação levantou a questão de consistência: a USP-002 vive
no módulo `identity` (e não em `persons`) - decisão a ser **confirmada e documentada**, não revertida.
Este refactor aplica o DS (só estilo, fluxo 100% preservado) e registra a decisão de colocação.

## Goals

- [ ] Reestilizar o `AssistedRegisterForm` (Client Component) e a página `cadastro-assistido`
      (Server Component) com os primitivos e tokens do DS (AD-014), com paridade à linguagem visual do
      protótipo - **sem alterar comportamento** (RHF/Zod, exceção de CPF condicional, ausência de
      credencial, evidência de consentimento em papel).
- [ ] Documentar a decisão de consistência: **manter a USP-002 em `identity`** (não mover para
      `persons`), com justificativa registrada (candidato a nota AD).
- [ ] Manter verdes todos os testes existentes da USP-002 e cobrir o delta de restyle com asserções
      RTL de preservação (must-nots de comportamento).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Mover a USP-002 para o módulo `persons` (mudança física de arquivos/barrel) | Decisão desta spec: **manter em `identity`** (ver Assumptions). Mover arrisca quebra de barrel/carve-out client-server (AD-013/ADR-0017) sem ganho de correção; é churn, não refactor. |
| Qualquer mudança funcional em IDN-04/05/06 (nome obrigatório + campos opcionais, exceção de CPF com justificativa restrita a AS/diretoria, Pessoa sem credencial referenciável mas sem login, log de responsável) | Já entregues e cobertos pelos testes existentes; o restyle não os altera. |
| Adicionar campos de credencial (e-mail/senha) ou de login ao formulário assistido | A Pessoa é criada **sem credencial** por definição (IDN-06); a credencial só surge na USP-003 (reivindicação). Adicionar isso quebraria a fronteira e o must-not "credential-less não loga". |
| Trocar a evidência de consentimento em papel (`signedOnPaperAt`, SOCIAL_ASSISTANCE no audit `after`, ADR-0013) por consentimento digital | Decisão de produto (b): preservar os fluxos LGPD/arquitetura, aplicar só estilo. |
| Substituir o `<select>` nativo (papel) por um primitivo de Select | O DS (barrel `src/shared/ui/`) **não tem** primitivo Select; o `<select>` é restilizado com tokens (ver Assumptions). Introduzir um Select custom mudaria a semântica testada por `getByLabelText`/`fireEvent.change`. |

---

## Assumptions & Open Questions

Toda ambiguidade é resolvida ou registrada aqui - nada fica silenciosamente indefinido.

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| **Colocação do módulo:** a USP-002 permanece em `src/modules/identity`, não migra para `persons`. | agent | Manter em `identity`; registrar como decisão de consistência (candidato a nota AD). | A USP-002 cria uma **Pessoa sem credencial** como parte da superfície de **identidade/onboarding**; a política de autz (`ASSISTED_REGISTRATION_ROLES`/`canRegisterAssisted`) vive em `identity/domain` e é exportada pelo barrel `@/modules/identity`, consumido pela rota `(app)/cadastro-assistido` (`requireActivePerson` + `canRegisterAssisted` + form no mesmo barrel). Mover para `persons` quebra o barrel e arrisca o carve-out client/server já documentado (AD-013/ADR-0017: `@/modules/identity` puxa `next/headers`/`next/cache` transitivamente). É churn sem ganho de correção. | y |
| O DS não possui primitivo `Select`. | agent | Restilizar o `<select>` nativo (papel) inline, espelhando as classes-token do primitivo `Input` (`w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg focus:border-primary focus:ring-2 focus:ring-primary`). | Preserva a associação `<label htmlFor>`/`getByLabelText` e o `onChange` testado; usa tokens (convenção AD-014); não inventa componente. Mesmo espírito da decisão "radio card sem primitivo" da USP-001. | y |
| A caixa de "exceção de CPF" usa paleta `amber-*` crua; o DS não tem token de "warning". | agent | Mapear a caixa de exceção para a família de token **`cta`** (laranja - a cor de atenção do DS; há `StepIcon variant="orange"`), via `border-cta` + `bg-[color-mix(in_srgb,var(--color-cta)_10%,transparent)]` + texto `text-fg`/`text-cta`. | O DS tem apenas primary/secondary/cta/success/danger/border/fg. `cta` é a cor de atenção mais próxima do amber; mantém tudo em tokens (sem hex cru). | y |
| As caixas de sucesso (`green-*`) e de erro do servidor (`red-*`) usam paleta crua. | agent | Mapear sucesso para `success` (`bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-success`) e erro do servidor para `danger` (padrão do `LoginForm`/`RegisterPersonForm`). | Tokens do DS já cobrem success/danger; espelha o restyle já mergeado do `RegisterPersonForm`. | y |
| O Server Component de página (`cadastro-assistido`) segue o padrão do repo: gate de estilo é typecheck+lint+build, sem teste RTL de página. | agent | Não criar `page.test.tsx`; a cobertura concentra-se no Client Component (`AssistedRegisterForm.test.tsx`). | O repo só tem teste de página para `login` e `redefinir-senha`; restyle de Server Component é validado por build. O gate de papel (`requireActivePerson`+`canRegisterAssisted`→`notFound`) é preservado intacto (não é tocado no restyle). | y |
| Ícone do `StepIcon` da página assistida. | agent | `StepIcon variant="blue"` com SVG inline de "usuário/pessoa" (estilo do protótipo: `viewBox 0 0 24 24`, `strokeWidth={2}`, `stroke="currentColor"`; sem `lucide-react`). | Coerência com a família de onboarding/identidade (cadastro público usa `blue`+usuário). O protótipo não tem esta tela; aplica-se a linguagem, não uma cópia 1:1. | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Restyle das telas do cadastro assistido para o Design System (AD-014) - só estilo ⭐ MVP

**User Story**: Como assistente social que cadastra Pessoas, quero que o formulário de cadastro
assistido e sua página tenham a mesma identidade visual do restante do portal, para que a ferramenta
interna seja coesa e legível.

**Why P1**: Consistência visual é o objetivo central da rodada Fase 1 (AD-014). O cadastro assistido é
a porta de entrada da inclusão de Pessoas em vulnerabilidade.

**Acceptance Criteria**:

1. QUANDO a página `cadastro-assistido` é renderizada ENTÃO o sistema DEVE compô-la com `StepIcon`
   (variante `blue`, ícone de usuário) + `FormHeader` + `FormCard` ao redor do `AssistedRegisterForm`,
   sem classes de paleta crua (`text-gray-900`, `text-gray-600`).
2. QUANDO o `AssistedRegisterForm` é reestilizado ENTÃO o sistema DEVE usar `Label`/`Input`/`Textarea`/
   `Button` do barrel `@/shared/ui` e restilizar o `<select>` de papel e a caixa de exceção com tokens
   (`border-border`, `border-cta`, `color-mix` sobre `--color-cta`/`--color-success`/`--color-danger`),
   sem `bg-blue-600`/`border-gray-300`/`amber-*`/`green-*`/`red-*` cru.
3. QUANDO o `AssistedRegisterForm` é reestilizado ENTÃO o sistema DEVE **preservar** RHF+Zod
   (`registerByAssistantSchema`), a lógica condicional da exceção de CPF (marcar exceção esconde o CPF
   e exige justificativa), o campo `signedOnPaperAt`, a chamada a `registerPersonByAssistant` e todos
   os textos de rótulo/botão/estado testados - sem qualquer mudança de fluxo.
4. QUANDO qualquer tela restilizada é aberta em modo escuro ENTÃO o sistema DEVE resolver as cores via
   tokens (`data-theme`), sem hex cru.

**Independent Test**: Renderizar `AssistedRegisterForm` (RTL) e confirmar labels/inputs/exceção
condicional/botão preservados e uso dos primitivos; abrir `cadastro-assistido` no browser em light/dark
e confirmar composição `StepIcon`+`FormHeader`+`FormCard`; suíte de testes da USP-002 permanece verde.

---

## Edge Cases

- QUANDO o restyle é aplicado ENTÃO o sistema DEVE **não** introduzir campos de credencial (e-mail/senha)
  nem qualquer caminho de login no formulário assistido (preserva IDN-06: Pessoa sem credencial não loga).
- QUANDO a exceção de CPF está marcada ENTÃO o sistema DEVE (como hoje) esconder o campo CPF e exibir a
  justificativa obrigatória - a lógica condicional não muda com o restyle.
- QUANDO a exceção está marcada sem justificativa ENTÃO o sistema DEVE bloquear o submit e **não** chamar
  `registerPersonByAssistant` (gate client via Zod, preservado).
- QUANDO o restyle troca classes ENTÃO o sistema DEVE preservar `role="alert"`/`role="status"` e os textos
  de botão/sucesso ("Cadastrar Pessoa", "Pessoa cadastrada com sucesso", "Cadastrar outra Pessoa") de que
  os testes existentes dependem.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT... | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U2-MN-01 | QUANDO o `AssistedRegisterForm` é reestilizado ENTÃO o sistema NÃO DEVE alterar a lógica condicional da exceção de CPF: marcar a exceção sem justificativa NÃO DEVE chamar `registerPersonByAssistant`. | Restyle enfraquecer a exigência de justificativa obrigatória da exceção de CPF (IDN-05). | T1 | `AssistedRegisterForm.test.tsx` - "exceção marcada sem justificativa → erro e NÃO chama a action" (existente, mantido verde) + "esconde o CPF e mostra a justificativa". |
| U2-MN-02 | QUANDO o `AssistedRegisterForm` é reestilizado ENTÃO o sistema NÃO DEVE introduzir campos de credencial (e-mail/senha) ou caminho de login no formulário. | Quebra do invariante IDN-06 (Pessoa sem credencial não loga) e da fronteira USP-002/003. | T1 | `AssistedRegisterForm.test.tsx` - `queryByLabelText(/senha|password|e-?mail/i)` é `null` (novo). |

> **Preservados por não-alteração (fora do restyle, cobertos por testes existentes que devem seguir verdes):**
> gate de papel da rota (só `SOCIAL_ASSISTANT`/`BOARD` alcançam a tela; demais recebem 404), regra
> "auto-cadastro público não marca exceção" (IDN-05, enforçada na action `registerPersonByAssistant`),
> `withAudit` + eventos de exceção (`PERSON_CPF_EXCEPTION_GRANTED` / `PERSON_ASSISTED_EXCEPTION_DENIED`),
> e a evidência de consentimento em papel (SOCIAL_ASSISTANCE no audit `after`, ADR-0013). Cobertos por
> `register-by-assistant.test.ts` / `register-by-assistant.int.test.ts` (não tocados nesta rodada).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IDN-04 (upstream, canônico) | USP-002 | Verified (entregue) | Preservado |
| IDN-05 (upstream, canônico) | USP-002 | Verified (entregue) | Preservado |
| IDN-06 (upstream, canônico) | USP-002 | Verified (entregue) | Preservado |
| U2-STYLE-01 (local) | P1 Restyle | Tasks | Pending |
| U2-MN-01 (local) | P1 Restyle | Tasks | Pending |
| U2-MN-02 (local) | P1 Restyle | Tasks | Pending |

- **U2-STYLE-01**: Restyle do `AssistedRegisterForm` (Client) e da página `cadastro-assistido` (Server) com primitivos/tokens do DS, estilo apenas (AC P1 1-4).

**Coverage:** 6 itens (3 upstream preservados, 3 locais); 3 locais mapeados a tasks.

---

## Success Criteria

- [ ] `AssistedRegisterForm` e a página `cadastro-assistido` usam exclusivamente primitivos/tokens do DS; paridade visual com a linguagem do protótipo em light e dark.
- [ ] Nenhuma mudança de comportamento: RHF/Zod, exceção de CPF condicional, ausência de credencial, `signedOnPaperAt`, log de responsável, gate de papel - todos preservados.
- [ ] Decisão de colocação documentada (manter em `identity`), com rationale (candidato a nota AD).
- [ ] Todos os testes existentes da USP-002 permanecem verdes; delta coberto por RTL de preservação (U2-MN-01/02).
