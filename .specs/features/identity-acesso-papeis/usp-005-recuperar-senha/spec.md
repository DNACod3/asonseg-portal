# USP-005 Recuperar senha esquecida - Refactor (Fase 1) Specification

> **Fonte da verdade upstream (adaptar, não re-derivar):** os requisitos funcionais da USP-005
> já vivem no épico `.specs/features/identity-acesso-papeis/spec.md` (história "P1: Recuperar senha
> esquecida", requisitos **IDN-12 / IDN-13** e Edge Cases). Este documento **não re-deriva** aqueles
> ACs - a USP já está implementada e mergeada. Ele especifica **apenas o delta de refactor da Fase 1**
> (restyle ao Design System) sobre o código existente. Os IDs `IDN-12..13` permanecem canônicos; os IDs
> locais abaixo (`U5-*`) cobrem só o que o épico não descreve (restyle das telas).

## Problem Statement

A recuperação de senha (USP-005) está entregue e correta, mas as quatro telas do fluxo usam Tailwind
solto (`bg-blue-600`, `text-gray-*`, `border-gray-300`, `bg-red-50`, `bg-green-50`, `focus:ring-blue-*`)
fora do Design System extraído do protótipo (AD-014), destoando da linguagem visual do login (já
reestilizado na Unidade 0). Este refactor aplica o DS **só de estilo** às duas páginas
(`recuperar-senha`, `redefinir-senha`) e aos dois formulários (`PasswordResetRequestForm`,
`PasswordResetForm`), preservando todo o comportamento de segurança: CAPTCHA fail-closed,
anti-enumeração (mensagem genérica idêntica), token de redefinição de uso único e validade de 24h.
**Nenhuma Server Action, schema ou navegação é tocada.**

## Goals

- [ ] Reestilizar `recuperar-senha/page.tsx`, `redefinir-senha/page.tsx`, `PasswordResetRequestForm` e
      `PasswordResetForm` com os primitivos e tokens do DS (AD-014), aplicando a **linguagem visual do
      protótipo** (form-card / form-header / step-icon / btn) - **sem alterar comportamento**.
- [ ] Preservar as guardas de segurança da UI: gate CAPTCHA fail-closed (Turnstile), a **mensagem
      genérica idêntica** de confirmação (anti-enumeração), o campo `token` oculto (uso único) e o ramo
      "link inválido/incompleto" da página de redefinição.
- [ ] Manter verdes todos os testes existentes da USP-005 (`PasswordResetForms.test.tsx`,
      `redefinir-senha/page.test.tsx`) - eles já cobrem CAPTCHA, anti-enumeração e token.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar `request-password-reset.ts`, `reset-password.ts` ou `password-reset.schema.ts` | Refactor é **só de estilo**. Anti-enumeração (mensagem genérica), validade de 24h e uso único do token vivem nas actions e são preservados sem toque. |
| Alterar o mecanismo de CAPTCHA (Turnstile / `captchaToken` no schema) | O gate fail-closed é comportamento; o restyle preserva o `<Turnstile>`, o campo oculto e a checagem `if (!captchaToken)`. |
| Alterar a leitura de `searchParams.token_hash` ou o ramo condicional da página de redefinição | Lógica de roteamento preservada; só a marcação de ambos os ramos é restilizada. |
| Novos requisitos funcionais de IDN-12/13 | Já entregues e cobertos pelos testes existentes; o refactor não os altera. |
| Reestilizar `login` | Já feito na Unidade 0 (AD-014); não pertence a esta USP. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| Anti-enumeração é comportamento da **action** (mensagem genérica retornada), não do form. | agent | O restyle preserva a exibição de `result.data.message` (a mensagem genérica) e **não** introduz ramo de UI que revele existência do e-mail. `requestPasswordReset` não é tocada. | O form só reflete a mensagem que a action decide; como a action é preservada, a anti-enumeração é estruturalmente mantida. O teste "e-mail válido + CAPTCHA → confirmação genérica" (e o form some) trava isso. | y |
| A caixa de confirmação de sucesso (hoje verde `bg-green-50`) migra para token de sucesso. | agent | `rounded-sm bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] p-4 text-sm text-success`, espelhando o padrão danger-token do `LoginForm`. Mantém `role="status"` e o texto genérico. | Tokeniza sem hex cru (mesma técnica do `StepIcon`/`LoginForm`); preserva o seletor de teste (`findByText(GENERIC)`). | y |
| Telas de auth restilizadas seguem o padrão do login: `FormHeader` + `FormCard`, mais `StepIcon`. | agent | Ambas as páginas usam `FormHeader` + `FormCard` (padrão verbatim do login) + `StepIcon` (variante `blue`, glifo de cadeado/chave) para ecoar o par form-header/step-icon do protótipo. Glifo/variante exatos são discricionários e decorativos. | As telas não existem no protótipo; aplica-se a **linguagem** (não cópia 1:1). `FormHeader`/`FormCard` garantem paridade de token; `StepIcon` enriquece. | y |
| `recuperar-senha/page.tsx` não tem teste de página; `redefinir-senha/page.tsx` tem. | agent | O restyle de `recuperar-senha` é validado por build (sem page.test). O restyle de `redefinir-senha` **deve manter verde** `redefinir-senha/page.test.tsx` (ramo sem token → `role="alert"` + link "Solicitar novo link"→`/recuperar-senha`; ramo com token → renderiza o form). | Só `redefinir-senha` tem roteamento condicional que justifica page.test; o restyle preserva os seletores que o teste assevera. | y |
| O campo `token` oculto do `PasswordResetForm` é preservado no restyle. | agent | `<input type="hidden" {...register('token')} />` e `defaultValues: { token }` permanecem; o restyle não os remove. | O uso único depende do token trafegar no submit; removê-lo quebraria a redefinição (e o teste "válido → envia token + senha"). | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Restyle das telas de recuperação/redefinição de senha para o Design System (AD-014) - só estilo ⭐ MVP

**User Story**: Como usuário que esqueceu a senha, quero que as telas de solicitação e de definição de
nova senha tenham a mesma identidade visual do login e do restante do portal, para que a experiência
seja coesa e confiável.

**Why P1**: Consistência visual é o objetivo central da rodada Fase 1 (AD-014); telas de recuperação
são de alta sensibilidade (o usuário já está em atrito) e devem transmitir confiança.

**Acceptance Criteria**:

1. QUANDO `recuperar-senha/page.tsx` é renderizada ENTÃO o sistema DEVE compô-la com `FormHeader`
   (+ `StepIcon`) + `FormCard`, sem classes de paleta crua, preservando `metadata`,
   `dynamic='force-dynamic'` e o `siteKey` passado ao form.
2. QUANDO o `PasswordResetRequestForm` é reestilizado ENTÃO o sistema DEVE usar `Label`/`Input`/`Button`
   do `@/shared/ui`, caixa de erro danger-token e caixa de confirmação success-token, **preservando**
   RHF+Zod, o `<Turnstile>` + campo `captchaToken` oculto, o gate `if (!captchaToken)`, a exibição da
   mensagem genérica e o desaparecimento do formulário após envio.
3. QUANDO `redefinir-senha/page.tsx` é renderizada ENTÃO o sistema DEVE restilizar **ambos** os ramos
   (com token → `FormHeader`+`FormCard`+`PasswordResetForm`; sem token → `FormHeader`+`FormCard` +
   alerta danger-token com o link "Solicitar novo link"→`/recuperar-senha`), preservando a leitura de
   `searchParams.token_hash` e a condição.
4. QUANDO o `PasswordResetForm` é reestilizado ENTÃO o sistema DEVE usar `Label`/`Input`/`Button`,
   **preservando** o campo `token` oculto (`register('token')` + `defaultValues`), RHF+Zod, a chamada
   `resetPassword`, o redirect e os textos de label/botão.
5. QUANDO qualquer tela restilizada é aberta em modo escuro ENTÃO o sistema DEVE resolver as cores via
   tokens (`data-theme`), sem hex cru.

**Independent Test**: `PasswordResetForms.test.tsx` (6 casos) e `redefinir-senha/page.test.tsx` (2
casos) permanecem verdes após o restyle (labels, botões "Enviar link de recuperação"/"Redefinir senha",
mensagem genérica, "CAPTCHA obrigatório", `role="alert"`/`role="status"`, link "Solicitar novo link");
abrir as duas telas no browser em light/dark e confirmar paridade com a linguagem do protótipo.

---

## Edge Cases

- QUANDO o `PasswordResetRequestForm` é submetido sem CAPTCHA resolvido ENTÃO o sistema DEVE **não**
  chamar `requestPasswordReset` (gate fail-closed + Zod "CAPTCHA obrigatório" preservados no restyle).
- QUANDO a solicitação é enviada com sucesso ENTÃO o sistema DEVE exibir **sempre a mesma** mensagem
  genérica, sem revelar se o e-mail existe (anti-enumeração preservada; a action não é tocada).
- QUANDO `redefinir-senha` é acessada sem `token_hash` ENTÃO o sistema DEVE exibir o alerta "Link
  inválido ou incompleto" com o link "Solicitar novo link" e **não** renderizar o formulário.
- QUANDO o `PasswordResetForm` é submetido com senha fraca/divergente ENTÃO o sistema DEVE **não**
  chamar `resetPassword` (guarda client Zod preservada).
- QUANDO o restyle é aplicado ENTÃO o sistema DEVE **não** alterar handlers, schemas, actions,
  navegação, metadata nem o campo `token` oculto.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT... | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U5-MN-01 | QUANDO o `PasswordResetRequestForm` é submetido sem CAPTCHA resolvido ENTÃO o sistema NÃO DEVE chamar `requestPasswordReset`. | Restyle enfraquecer o gate anti-bot (fail-closed) da recuperação de senha. | T1 | `PasswordResetForms.test.tsx` "sem CAPTCHA → validação bloqueia o envio, NÃO chama a action" (existente, mantido verde). |
| U5-MN-02 | QUANDO a solicitação é enviada ENTÃO o sistema NÃO DEVE exibir mensagem/estado que revele se o e-mail existe (mensagem genérica idêntica). | Restyle introduzir vetor de enumeração de contas (fracasso de privacidade). | T1 | `PasswordResetForms.test.tsx` "e-mail válido + CAPTCHA → confirmação genérica" + o form some (existente, mantido verde). |
| U5-MN-03 | QUANDO o `PasswordResetForm`/`redefinir-senha` são reestilizados ENTÃO o sistema NÃO DEVE submeter `resetPassword` sem `token`, nem renderizar o formulário quando não há `token_hash` na URL. | Restyle quebrar o uso único do token / permitir redefinição sem link válido. | T2 (form) + T4 (página) | `PasswordResetForms.test.tsx` "válido → envia token + senha" (token trafega) + `redefinir-senha/page.test.tsx` "sem token → sem formulário" (existentes, mantidos verdes). |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IDN-12 (upstream, canônico) | USP-005 | Verified (entregue) | Preservado |
| IDN-13 (upstream, canônico) | USP-005 | Verified (entregue) | Preservado |
| U5-STYLE-01 (local) | P1 Restyle | Tasks | Pending |
| U5-MN-01 (local) | P1 Restyle | Tasks | Pending |
| U5-MN-02 (local) | P1 Restyle | Tasks | Pending |
| U5-MN-03 (local) | P1 Restyle | Tasks | Pending |

- **U5-STYLE-01**: Restyle das 2 páginas + 2 formulários com primitivos/tokens do DS, estilo apenas (AC P1-Restyle 1-5).

**Coverage:** 6 itens (2 upstream preservados, 4 locais); 4 locais mapeados a tasks.

---

## Success Criteria

- [ ] As 2 páginas e os 2 formulários usam exclusivamente primitivos/tokens do DS; paridade visual com a linguagem do protótipo em light e dark.
- [ ] Nenhuma mudança de comportamento: RHF/Zod, CAPTCHA fail-closed, anti-enumeração (mensagem genérica idêntica), token oculto/uso único, ramo "link inválido" - todos preservados; nenhuma action/schema/navegação tocada.
- [ ] Todos os testes existentes da USP-005 permanecem verdes: `PasswordResetForms.test.tsx` (6) e `redefinir-senha/page.test.tsx` (2).
