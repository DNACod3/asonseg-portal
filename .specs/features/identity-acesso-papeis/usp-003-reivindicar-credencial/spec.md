# USP-003 Reivindicar credencial de Pessoa pré-cadastrada - Refactor (Fase 1) Specification

> **Fonte da verdade upstream (adaptar, não re-derivar):** os requisitos funcionais da USP-003
> já vivem no épico `.specs/features/identity-acesso-papeis/spec.md` (história "P1: Reivindicar
> credencial de Pessoa pré-cadastrada", requisitos **IDN-07 / IDN-08** e Edge Cases). Este documento
> **não re-deriva** aqueles ACs - a USP já está implementada, mergeada e coberta por testes. Ele
> especifica **apenas o delta de refactor da Fase 1** (restyle para o Design System AD-014) sobre o
> código existente, e **documenta** a decisão de consistência sobre o estilo de autorização do
> aprovador (mantém a checagem inline). Os IDs `IDN-07..08` permanecem canônicos; os IDs locais abaixo
> (`U3-*`) cobrem só o que o épico não descreve (restyle + preservações).

## Problem Statement

A reivindicação de credencial (USP-003) está entregue e correta, mas as quatro telas do fluxo destoam do
Design System extraído do protótipo (AD-014): o `CredentialClaimForm` (público), a página
`reivindicar-credencial`, o `CredentialClaimReview` (fila interna) e a página `credenciais/reivindicacoes`
usam Tailwind solto (`border-gray-300`, `bg-blue-600`, `text-gray-*`, `bg-blue-600`, `green-*`, `red-*`,
`bg-white`). Além disso, a rodada de reconciliação levantou a questão de consistência de autz: a action
`verifyCredentialClaim` faz a checagem de aprovador **inline** (`getCurrentPerson` + `canApproveCredentialClaim`)
em vez do helper `requirePermission` - decisão a ser **confirmada e documentada**, não alterada. Este
refactor aplica o DS (só estilo, fluxo 100% preservado) e registra a decisão de autz.

## Goals

- [ ] Reestilizar `CredentialClaimForm` + página `reivindicar-credencial` (público) e
      `CredentialClaimReview` + página `credenciais/reivindicacoes` (interno) com os primitivos e tokens
      do DS (AD-014) - **sem alterar comportamento** (CAPTCHA fail-closed, anti-enumeração, e-mail em uso,
      guard de concorrência, `withAudit`).
- [ ] Documentar a decisão de consistência: **manter a autz do aprovador inline** em
      `verifyCredentialClaim` (não migrar para `requirePermission`), com justificativa registrada.
- [ ] Manter verdes todos os testes existentes da USP-003 e cobrir o delta de restyle com asserções RTL
      de preservação (must-nots de comportamento).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Migrar a autz de `verifyCredentialClaim` para `requirePermission` | Decisão desta spec: **manter inline** (ver Assumptions). O gate é de **papel institucional inerente** (`SOCIAL_ASSISTANT`/`BOARD`/`COORDINATOR`), não de permissão delegável do catálogo; `requirePermission` exige um `PermissionId` + alteração de `checkPermission` - mudança de comportamento fora do escopo style-only. |
| Qualquer mudança funcional em IDN-07/08 (solicitação pendente, verificação de identidade, ativação após confirmação AS/diretoria, bloqueio por e-mail duplicado, log de verificação) | Já entregues e cobertos pelos testes existentes; o restyle não os altera. |
| Substituir o `<select>` nativo (meio de verificação) por um primitivo de Select | O DS (barrel `src/shared/ui/`) **não tem** primitivo Select; o `<select>` é restilizado com tokens. Introduzir um Select custom mudaria a semântica testada por `getByLabelText`/`fireEvent.change`. |
| Revelar existência da Pessoa na resposta pública, ou remover o CAPTCHA | Vetor de enumeração/anti-bot (P-006 / ADR-0014): a mensagem genérica e o gate CAPTCHA fail-closed são preservados como must-nots. |

---

## Assumptions & Open Questions

Toda ambiguidade é resolvida ou registrada aqui - nada fica silenciosamente indefinido.

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| **Estilo de autz do aprovador:** `verifyCredentialClaim` mantém a checagem inline (`getCurrentPerson` + `canApproveCredentialClaim`), não migra para `requirePermission`. | agent | Manter inline; registrar como decisão de consistência. | O gate é de **papel institucional inerente** (`CREDENTIAL_CLAIM_APPROVER_ROLES` = `SOCIAL_ASSISTANT`/`BOARD`/`COORDINATOR`), da mesma família de `requireCoordinator` e de `ASSISTED_REGISTRATION_ROLES` (USP-002). O helper `requirePermission` recebe um `PermissionId` do catálogo e avalia **delegação** via `checkPermission`; não há `PermissionId` "aprovar reivindicação" (o RBAC delegado da USP-008 ainda não cobre este item - ver `domain/credential-claim.ts`). Migrar exigiria inventar um `PermissionId` + alterar `checkPermission` - mudança de comportamento, **fora** do escopo style-only e sem ganho de correção (o gate atual não é enfraquecível: a rota `(app)` e a action repetem a checagem, defesa em profundidade / P-005). | y |
| O DS não possui primitivo `Select`. | agent | Restilizar os `<select>` nativos (meio de verificação, no form público e na fila) inline, espelhando as classes-token do `Input` (`w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg focus:border-primary focus:ring-2 focus:ring-primary`). | Preserva `<label htmlFor>`/`getByLabelText` e `onChange` testados; usa tokens; não inventa componente. | y |
| As caixas de sucesso/status (`green-*`) e o estado vazio (`gray-*`) usam paleta crua. | agent | Sucesso → família `success`; estado vazio/cards → `Card` do barrel ou tokens `border-border`/`bg-surface`/`text-fg-muted`; erro do servidor → `danger` (padrão `LoginForm`/`RegisterPersonForm`). | Tokens do DS já cobrem success/danger/surface/border; espelha o restyle já mergeado. | y |
| Os Server Components de página (`reivindicar-credencial`, `credenciais/reivindicacoes`) seguem o padrão do repo: gate de estilo é typecheck+lint+build, sem teste RTL de página. | agent | Não criar `page.test.tsx`; cobertura concentra-se nos Client Components (`CredentialClaimForms.test.tsx`). | O repo só tem teste de página para `login`/`redefinir-senha`; o gate de aprovador (`requireActivePerson`+`canApproveCredentialClaim`→`notFound`) é preservado intacto. | y |
| Os dois Client Components (`CredentialClaimForm` e `CredentialClaimReview`) compartilham o arquivo de teste `CredentialClaimForms.test.tsx`. | agent | Restilizar em tasks separadas (T1 form, T3 review), mas **sequenciais** (T3 depois de T1) para evitar edição concorrente do mesmo arquivo de teste. | Mantém cada componente atômico sem conflito no arquivo de teste compartilhado; cada task mantém verdes as asserções da outra. | y |
| Ícones dos `StepIcon` das páginas. | agent | `reivindicar-credencial`: `StepIcon variant="blue"` (ícone de chave/credencial); `credenciais/reivindicacoes`: `StepIcon variant="orange"` (ícone de checklist/revisão). SVG inline estilo protótipo (`viewBox 0 0 24 24`, `strokeWidth={2}`, sem `lucide-react`). | Estas telas não existem no protótipo; aplica-se a linguagem: `blue` para identidade/onboarding, `orange` (cta) para a fila operacional/revisão. | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Restyle das telas da reivindicação de credencial para o Design System (AD-014) - só estilo ⭐ MVP

**User Story**: Como Pessoa pré-cadastrada (solicitante público) e como aprovador interno (AS/coordenação/
diretoria), quero que as telas de reivindicação e de verificação tenham a mesma identidade visual do
restante do portal, para que o fluxo seja coeso e confiável.

**Why P1**: Consistência visual é o objetivo central da rodada Fase 1 (AD-014). A tela pública é a ponte
entre o cadastro assistido e o acesso autônomo (inclusão digital).

**Acceptance Criteria**:

1. QUANDO a página `reivindicar-credencial` (pública) é renderizada ENTÃO o sistema DEVE compô-la com
   `StepIcon` (blue) + `FormHeader` + `FormCard` ao redor do `CredentialClaimForm`, e o link "Entrar" DEVE
   usar `text-primary` (sem `text-blue-600`).
2. QUANDO o `CredentialClaimForm` é reestilizado ENTÃO o sistema DEVE usar `Label`/`Input`/`Button` do
   barrel, restilizar o `<select>` (meio de verificação) com tokens, e **preservar** o gate CAPTCHA
   fail-closed, a mensagem genérica (anti-enumeração), o `<input type="hidden">` do Turnstile e a chamada
   a `requestCredentialClaim` - sem mudança de fluxo.
3. QUANDO a página `credenciais/reivindicacoes` (interna) é renderizada ENTÃO o sistema DEVE compô-la com
   `StepIcon` (orange) + `FormHeader`, e o `CredentialClaimReview` DEVE usar `Card`/tokens (sem `bg-white`/
   `border-gray-*`/`bg-blue-600`) e `Button` para "Confirmar e ativar".
4. QUANDO o `CredentialClaimReview` é reestilizado ENTÃO o sistema DEVE **preservar** o `<select>` de meio
   utilizado, o handler `onConfirm` (chama `verifyCredentialClaim` com `claimId`+meio), a remoção do item
   em sucesso, a manutenção em erro, e o estado vazio/`role="status"`.
5. QUANDO qualquer tela restilizada é aberta em modo escuro ENTÃO o sistema DEVE resolver as cores via
   tokens (`data-theme`), sem hex cru.

**Independent Test**: Renderizar `CredentialClaimForm` e `CredentialClaimReview` (RTL) e confirmar
labels/inputs/select/botões e comportamento (CAPTCHA fail-closed, resposta genérica, confirmação/remoção)
preservados e uso dos primitivos; abrir as duas páginas no browser em light/dark e confirmar composição
`StepIcon`+`FormHeader`+`FormCard`/`Card`; suíte de testes da USP-003 permanece verde.

---

## Edge Cases

- QUANDO o `CredentialClaimForm` é submetido sem CAPTCHA resolvido ENTÃO o sistema DEVE **não** chamar
  `requestCredentialClaim` (gate client preservado no restyle) - além do fail-closed server-side já existente.
- QUANDO a solicitação pública é bem-sucedida ENTÃO o sistema DEVE exibir a **mesma mensagem genérica** do
  servidor, sem revelar se a Pessoa existe (anti-enumeração) - o caminho de render `role="status"` é preservado.
- QUANDO o restyle troca classes ENTÃO o sistema DEVE preservar `role="alert"`/`role="status"` e os textos
  de botão/label de que os testes dependem ("Solicitar reivindicação", "Confirmar e ativar", "Meio de
  verificação preferido", "Meio de verificação utilizado", estado vazio "Não há reivindicações...").
- QUANDO o `CredentialClaimReview` confirma uma reivindicação ENTÃO o sistema DEVE chamar
  `verifyCredentialClaim({ claimId, verificationMethod })` com o meio selecionado e remover o item da fila
  em sucesso - wiring preservado.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT... | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U3-MN-01 | QUANDO o `CredentialClaimForm` é submetido sem CAPTCHA resolvido ENTÃO o sistema NÃO DEVE chamar `requestCredentialClaim`. | Restyle enfraquecer o gate anti-bot fail-closed da porta pública (ADR-0014). | T1 | `CredentialClaimForms.test.tsx` - "sem CAPTCHA resolvido → não chama a action" (existente, mantido verde). |
| U3-MN-02 | QUANDO a solicitação pública é bem-sucedida ENTÃO o sistema NÃO DEVE exibir conteúdo que revele a existência (ou não) da Pessoa - só a mensagem genérica do servidor. | Enumeração de Pessoas via resposta que vaze existência (P-006). | T1 | `CredentialClaimForms.test.tsx` - "submissão válida + CAPTCHA → resposta genérica" (status exibe a `message` do servidor; nenhum ramo condicional novo por existência). |
| U3-MN-03 | QUANDO o `CredentialClaimReview` é reestilizado ENTÃO o sistema NÃO DEVE alterar o wiring de confirmação: chamar `verifyCredentialClaim` com `claimId`+meio selecionado, remover em sucesso, manter em erro. | Restyle quebrar a ativação verificada/o guard de concorrência do lado do cliente. | T3 | `CredentialClaimForms.test.tsx` - "confirmar → chama a action com o meio selecionado e remove o item" + "action falha → mantém o item e exibe o erro" (existentes, verdes). |

> **Preservados por não-alteração (fora do restyle, cobertos por testes existentes que devem seguir verdes):**
> o gate de aprovador da rota interna (só `SOCIAL_ASSISTANT`/`BOARD`/`COORDINATOR`; demais recebem 404), a
> autz inline da action `verifyCredentialClaim` (P-005), o bloqueio de e-mail em uso, a exigência de
> verificação antes da ativação, o guard de concorrência (`updateMany` count===0) e o `withAudit`. Cobertos
> por `credential-claim.test.ts` / `credential-claim.int.test.ts` / `credential-claim-model.int.test.ts`
> (não tocados nesta rodada).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IDN-07 (upstream, canônico) | USP-003 | Verified (entregue) | Preservado |
| IDN-08 (upstream, canônico) | USP-003 | Verified (entregue) | Preservado |
| U3-STYLE-01 (local) | P1 Restyle | Tasks | Pending |
| U3-MN-01 (local) | P1 Restyle | Tasks | Pending |
| U3-MN-02 (local) | P1 Restyle | Tasks | Pending |
| U3-MN-03 (local) | P1 Restyle | Tasks | Pending |

- **U3-STYLE-01**: Restyle dos 4 arquivos (form público, página pública, fila interna, página interna) com primitivos/tokens do DS, estilo apenas (AC P1 1-5).

**Coverage:** 6 itens (2 upstream preservados, 4 locais); 4 locais mapeados a tasks.

---

## Success Criteria

- [ ] `CredentialClaimForm`, `CredentialClaimReview` e as duas páginas usam exclusivamente primitivos/tokens do DS; paridade visual com a linguagem do protótipo em light e dark.
- [ ] Nenhuma mudança de comportamento: CAPTCHA fail-closed, anti-enumeração (mensagem genérica), e-mail em uso, verificação antes da ativação, guard de concorrência, `withAudit`, gate de aprovador - todos preservados.
- [ ] Decisão de autz documentada (manter inline em `verifyCredentialClaim`), com rationale.
- [ ] Todos os testes existentes da USP-003 permanecem verdes; delta coberto por RTL de preservação (U3-MN-01/02/03).
