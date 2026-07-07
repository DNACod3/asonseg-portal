# USP-001 Auto-cadastro de Pessoa - Refactor (Fase 1) Specification

> **Fonte da verdade upstream (adaptar, não re-derivar):** os requisitos funcionais da USP-001
> já vivem no épico `.specs/features/identity-acesso-papeis/spec.md` (história "P1: Auto-cadastro
> de Pessoa no portal", requisitos **IDN-01 / IDN-02 / IDN-03** e Edge Cases). Este documento **não
> re-deriva** aqueles ACs - a USP já está implementada e mergeada. Ele especifica **apenas os dois
> deltas de refactor da Fase 1** sobre o código existente. Os IDs `IDN-01..03` permanecem canônicos;
> os IDs locais abaixo (`U1-*`) cobrem só o que o épico não descreve (restyle + guarda de sessão).

## Problem Statement

O auto-cadastro (USP-001) está entregue e correto, mas duas lacunas surgiram na rodada de
reconciliação da Fase 1: (1) a UI das telas de cadastro e de aceite de consentimento usa Tailwind
solto (`bg-blue-600`, `text-gray-*`) fora do Design System extraído do protótipo (AD-014), destoando
da linguagem visual; e (2) a Server Action `acceptRoleConsent` (TX2) não possui guarda de sessão/autz
própria - ela confia em `input.personId` e depende exclusivamente do token HMAC verificado **na
página**, ficando insegura se invocada diretamente. Este refactor aplica o DS (só estilo, fluxo
preservado) e adiciona defesa em profundidade na TX2.

## Goals

- [ ] Reestilizar a página de cadastro, o `RegisterPersonForm` e a página de aceite (TX2) com os
      primitivos e tokens do DS (AD-014), com paridade visual ao protótipo - **sem alterar
      comportamento** (RHF/Zod, CAPTCHA fail-closed, anti-enumeração, fluxo split TX1 -> TX2).
- [ ] Adicionar guarda de defesa em profundidade em `acceptRoleConsent`: re-validar o token HMAC
      assinado **dentro da action**, tornando-a segura mesmo se chamada fora da página.
- [ ] Manter verdes todos os testes existentes da USP-001 e cobrir os deltas com testes novos
      (RTL do formulário + caso negativo de integração da guarda).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar o fluxo split TX1 -> TX2 (cadastro mínimo -> aceite afirmativo em página separada) | Decisão de dono travada: refactor é **só de estilo**. O aceite versionado afirmativo (USP-043) é preservado como está. |
| Adicionar campos de perfil de candidato (escolaridade, currículo, telefone, nascimento, etc.) ao cadastro | Esses campos pertencem à **USP-009** (fase posterior). O protótipo os mostra, mas incluí-los quebra a fronteira de módulo/fase. |
| Inline de checkbox de consentimento na página de cadastro (como no protótipo) | Quebraria o consentimento afirmativo-versionado da USP-043; o aceite permanece em página separada (TX2). |
| Novos requisitos funcionais de IDN-01/02/03 (validação de CPF, unicidade, CAPTCHA server, bcrypt, e-mail de boas-vindas, auditoria) | Já entregues e cobertos pelos testes existentes; o refactor não os altera. |
| Substituir o mecanismo do token HMAC por sessão | Na TX2 do auto-cadastro **não há sessão** (a TX1 não autentica; só cria credencial Supabase). O guard correto é re-validar o token assinado. Ver Assumptions. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| Na TX2 do auto-cadastro não existe sessão autenticada (a TX1 `registerPerson` cria a credencial Supabase mas não faz login). | agent | A guarda de defesa em profundidade **re-valida o token HMAC** (`verifyConsentToken`) dentro de `acceptRoleConsent`, em vez de casar uma sessão inexistente. | Verificado no código: `registerPerson.ts` não estabelece cookie de sessão; o único portador de autorização até o aceite é o `sig` HMAC (`consentToken.ts`). Casar sessão quebraria o fluxo. | y |
| O campo do token entra no input tipado da action (`acceptRoleConsentSchema`), não como parâmetro solto. | agent | Adicionar `sig: z.string()` ao schema; verificar o HMAC na action após o parse Zod, antes de qualquer escrita. | Mantém um único input tipado; Zod cobre presença/forma, a action cobre a validade criptográfica (que depende de personId+role+segredo). | y |
| A página de aceite (TX2) mantém o **clique no botão "Aceitar"** como ação afirmativa (sem checkbox pré-marcado). | agent | Restyle preserva o `<form action={acceptConsent}>` com submit afirmativo; nenhum checkbox `defaultChecked` é introduzido. | Já satisfaz AC-043-1 (ação afirmativa, sem pré-marcação). Adicionar checkbox mudaria comportamento e converteria o Server Component em Client Component. | y |
| Server Components de página (cadastro, aceite) seguem o padrão do repo: gate de estilo é typecheck+lint+build, sem teste RTL de página. | agent | Não criar `page.test.tsx` para os Server Components restilizados; cobertura de teste concentra-se nos Client Components e na Server Action. | O repo só tem teste de página para `login` e `redefinir-senha`; restyle de Server Component é validado por build. | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Restyle das telas do auto-cadastro para o Design System (AD-014) - só estilo ⭐ MVP

**User Story**: Como visitante que se cadastra, quero que a página de cadastro, o formulário e a tela
de aceite tenham a mesma identidade visual do restante do portal, para que a experiência seja coesa e
profissional.

**Why P1**: Consistência visual é o objetivo central da rodada Fase 1 (AD-014). As telas do fluxo de
entrada são as de maior tráfego público.

**Acceptance Criteria**:

1. QUANDO a página de cadastro é renderizada ENTÃO o sistema DEVE compô-la com `FormHeader` + `StepIcon`
   (variante `blue`, ícone de usuário do protótipo) + `FormCard`, e o formulário DEVE usar
   `Label`/`Input`/`Button` do barrel `@/shared/ui`, sem classes de paleta crua (`bg-blue-600`,
   `text-gray-*`).
2. QUANDO o `RegisterPersonForm` é reestilizado ENTÃO o sistema DEVE **preservar** RHF+Zod
   (`registerPersonSchema`), o CAPTCHA Turnstile fail-closed, a mensagem de erro do servidor
   (anti-enumeração) e a chamada a `registerPerson` - sem qualquer mudança de fluxo.
3. QUANDO a página de aceite (TX2) é renderizada ENTÃO o sistema DEVE exibir o termo dentro de um
   `LgpdBox` e usar `Button` (submit afirmativo + "Aceitar depois" via `asChild`), preservando
   `verifyConsentToken`, `safeRedirect` e a ação `acceptConsent`.
4. QUANDO qualquer tela restilizada é aberta em modo escuro ENTÃO o sistema DEVE resolver as cores via
   tokens (`data-theme`), sem hex cru.

**Independent Test**: Renderizar `RegisterPersonForm` (RTL) e confirmar labels/inputs/botão preservados
e uso dos primitivos; abrir cadastro e aceite no browser em light/dark e confirmar paridade visual com
o protótipo; suíte de testes da USP-001 permanece verde.

---

### P1: Guarda de defesa em profundidade na TX2 (`acceptRoleConsent`) ⭐ MVP

**User Story**: Como responsável pela segurança, quero que `acceptRoleConsent` valide por conta própria
a autorização do chamador, para que a ativação de papel/consentimento não dependa apenas da verificação
feita na página.

**Why P1**: Toca autz/privacidade (LGPD). Sem a guarda, um chamador que conheça um `personId` em
`AWAITING_CONSENT` pode ativar o papel e persistir um consentimento chamando a action diretamente.

**Acceptance Criteria**:

1. QUANDO `acceptRoleConsent` é invocada ENTÃO o sistema DEVE, após o parse Zod e **antes de qualquer
   escrita**, re-validar o token HMAC do par (`personId`, `role`) via `verifyConsentToken`.
2. QUANDO o token é válido ENTÃO o sistema DEVE prosseguir exatamente como hoje (consent + grant ACTIVE
   + auditoria na mesma transação - invariante ADR-0020 preservada).
3. QUANDO a página `acceptConsent` chama a action ENTÃO o sistema DEVE repassar o `sig` recebido na URL
   (que já está em escopo após `verifyConsentToken` da página).

**Independent Test**: Invocar `acceptRoleConsent` sem `sig` (ou com `sig` inválido) para um `personId`
em `AWAITING_CONSENT` e confirmar `{ ok: false }` sem ativar o grant nem criar consent; repetir com
`sig` válido e confirmar ativação (invariante preservada).

---

## Edge Cases

- QUANDO `acceptRoleConsent` recebe `sig` ausente ENTÃO o sistema DEVE falhar (FORBIDDEN) sem tocar o banco.
- QUANDO `acceptRoleConsent` recebe `sig` de outro `personId`/`role` ENTÃO o sistema DEVE falhar (FORBIDDEN).
- QUANDO o CAPTCHA não foi resolvido no formulário ENTÃO o sistema DEVE **não** chamar `registerPerson` (gate client preservado no restyle) - além do fail-closed server-side já existente.
- QUANDO o restyle é aplicado ENTÃO o sistema DEVE **não** introduzir campos de perfil nem checkbox de consentimento inline na página de cadastro.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT... | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U1-MN-01 | QUANDO `acceptRoleConsent` é chamada sem token HMAC válido para (`personId`,`role`) ENTÃO o sistema NÃO DEVE ativar o grant nem persistir consent (retorna `{ok:false}`). | Ativação de papel/consentimento alheio via chamada direta à action (bypass da guarda de página). | T1 | `acceptRoleConsent.int.test.ts` - caso `sig` inválido/ausente: grant permanece `AWAITING_CONSENT`, zero linhas em `consent`, `ok=false`. |
| U1-MN-02 | QUANDO o formulário de cadastro é submetido sem CAPTCHA resolvido ENTÃO o sistema NÃO DEVE chamar `registerPerson`. | Restyle enfraquecer o gate anti-bot (fail-closed) da porta de entrada pública. | T2 | `RegisterPersonForm.test.tsx` - submit sem token de CAPTCHA: `registerPerson` mock não é chamado; mensagem de CAPTCHA exibida. |
| U1-MN-03 | QUANDO a página de cadastro (TX1) é reestilizada ENTÃO o sistema NÃO DEVE inserir campos de perfil (escolaridade/currículo/telefone/nascimento) nem checkbox de consentimento inline. | Quebra da fronteira USP-001/009 e do consentimento afirmativo-versionado (split LGPD da USP-043). | T2 (cadastro) + T4 (aceite preserva o split) | `RegisterPersonForm.test.tsx` - `queryByRole('checkbox')` é `null`; `queryByLabelText(/escolaridade\|currículo\|telefone\|nascimento/i)` é `null`. |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IDN-01 (upstream, canônico) | USP-001 | Verified (entregue) | Preservado |
| IDN-02 (upstream, canônico) | USP-001 | Verified (entregue) | Preservado |
| IDN-03 (upstream, canônico) | USP-001 | Verified (entregue) | Preservado |
| U1-STYLE-01 (local) | P1 Restyle | Tasks | Pending |
| U1-GUARD-01 (local) | P1 Guarda TX2 | Tasks | Pending |
| U1-MN-01 (local) | P1 Guarda TX2 | Tasks | Pending |
| U1-MN-02 (local) | P1 Restyle | Tasks | Pending |
| U1-MN-03 (local) | P1 Restyle | Tasks | Pending |

- **U1-STYLE-01**: Restyle de cadastro (page + form) e aceite (page) com primitivos/tokens do DS, estilo apenas (AC P1-Restyle 1-4).
- **U1-GUARD-01**: Re-validação do token HMAC dentro de `acceptRoleConsent` + repasse de `sig` pela página (AC P1-Guarda 1-3).

**Coverage:** 8 itens (3 upstream preservados, 5 locais); 5 locais mapeados a tasks.

---

## Success Criteria

- [ ] Cadastro, `RegisterPersonForm` e página de aceite usam exclusivamente primitivos/tokens do DS; paridade visual com o protótipo em light e dark.
- [ ] Nenhuma mudança de comportamento: RHF/Zod, CAPTCHA fail-closed, anti-enumeração, fluxo split TX1 -> TX2, invariante ADR-0020 - todos preservados.
- [ ] `acceptRoleConsent` rejeita `sig` ausente/inválido sem efeito colateral e mantém o caminho feliz com `sig` válido.
- [ ] Todos os testes existentes da USP-001 permanecem verdes; deltas cobertos por RTL do formulário + caso negativo de integração.
</content>
</invoke>
