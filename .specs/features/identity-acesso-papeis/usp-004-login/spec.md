# USP-004 Autenticar no portal (login) - Refactor (Fase 1) Specification

> **Fonte da verdade upstream (adaptar, não re-derivar):** os requisitos funcionais da USP-004
> já vivem no épico `.specs/features/identity-acesso-papeis/spec.md` (história "P1: Autenticar no
> portal com e-mail e senha", requisitos **IDN-09 / IDN-10 / IDN-11** e Edge Cases). Este documento
> **não re-deriva** aqueles ACs - a USP já está implementada e mergeada. Ele especifica **apenas os
> dois deltas de refactor da Fase 1** sobre o código existente. Os IDs `IDN-09..11` permanecem
> canônicos; os IDs locais abaixo (`U4-*`) cobrem só o que o épico não descreve (restyle das telas
> remanescentes de auth + padronização da resolução de sessão).

## Problem Statement

O login (USP-004) está entregue e correto. A **tela de login** (`login/page.tsx` + `LoginForm`) já foi
reestilizada ao Design System na **Unidade 0** (fundação, AD-014) como prova de paridade - ela está
fora do escopo desta unidade. Restam duas lacunas na rodada de reconciliação da Fase 1: (1) a tela de
**troca de senha no 1º acesso** (`trocar-senha/page.tsx` + `ChangePasswordForm`) ainda usa Tailwind
solto (`bg-blue-600`, `text-gray-*`, `border-gray-300`, `focus:ring-blue-*`) fora do DS; e (2) a Server
Action `changePasswordFirstAccess` resolve a Pessoa autenticada via `supabase.auth.getUser()` cru +
`prisma.person.findUnique` manual, em vez do helper canônico de sessão (`getCurrentPerson`,
`server/session.ts`, ADR-0030) que o restante do módulo usa. Este refactor aplica o DS (só estilo,
fluxo preservado) e padroniza a resolução do ator na TX de troca de senha (sem enfraquecer o fluxo de
1º acesso).

## Goals

- [ ] Reestilizar a página de troca de senha (`trocar-senha/page.tsx`) e o `ChangePasswordForm` com os
      primitivos e tokens do DS (AD-014), aplicando a **linguagem visual do protótipo** (form-card /
      form-header / step-icon / btn) - **sem alterar comportamento** (RHF+Zod, validação de força/
      confirmação, chamada a `changePasswordFirstAccess`, redirect a `/inicio`).
- [ ] Padronizar `changePasswordFirstAccess` para resolver o ator via `getCurrentPerson()` (helper
      canônico de sessão, ADR-0030), como faz o resto do módulo (`activate-additional-role.ts`),
      **preservando** o comportamento do 1º acesso e todas as guardas.
- [ ] Manter verdes todos os testes existentes da USP-004; atualizar o teste da action ao novo seam de
      sessão e cobrir a guarda com um caso negativo (nenhuma escrita sem Pessoa ativa).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Reestilizar `login/page.tsx` + `LoginForm.tsx` | **Já feito na Unidade 0** (fundação DS, AD-014, DS-18/DS-19/DS-20). Verificado: `LoginForm.tsx` importa `@/shared/ui` e usa `Input`/`Label`/`Button` + tokens; `login/page.tsx` usa `FormCard`/`FormHeader`. Nenhuma mudança adicional. |
| Alterar qualquer comportamento de login (`login.ts`, `domain/lockout.ts`, `domain/anti-timing.ts`, `signIn.ts`) | Fora do escopo: lockout (5/15min), anti-timing, mensagem genérica, sessão 12h e `withAudit` de sucesso+falha permanecem intocados. O refactor não toca `login.ts`. |
| Alterar a transação de troca de senha (atualizar senha + baixar `primeiroAcesso` + `withAudit`) | A padronização toca **apenas** a resolução do ator (passos 2). A escrita (`updateUser` + `credential.update` + audit na mesma tx) é preservada verbatim. |
| Novos requisitos funcionais de IDN-09/10/11 | Já entregues e cobertos pelos testes existentes; o refactor não os altera. |
| Adicionar teste de integração (Postgres) para `changePasswordFirstAccess` | A action tem cobertura **unit** com Supabase/Prisma/audit mockados (`changePassword.test.ts`); o padrão do repo para esta action é unit. Sem DB tocado. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| A padronização da resolução do ator usa `getCurrentPerson()` do `server/session.ts`. | agent | `changePasswordFirstAccess` passa a chamar `getCurrentPerson()` (que já resolve a Pessoa + revalida `status` no DB, ADR-0030) no lugar de `supabase.auth.getUser()` + `prisma.person.findUnique` manuais. | É exatamente o helper que o resto do módulo usa para resolver o ator (ex.: `activate-additional-role.ts:67`). Elimina a duplicação de resolução/revalidação de status. | y |
| `getCurrentPerson()` **não** expõe `credential.id`; a action precisa dele para `tx.credential.update`. | agent | Após `getCurrentPerson()`, buscar a credencial por `prisma.credential.findUnique({ where: { personId }, select: { id: true } })` (o campo `personId` é `@unique` no schema - `prisma/schema.prisma:217`). Se não houver credencial → `fail('FORBIDDEN', ...)`, preservando a guarda atual. | Mantém a guarda "sem credencial → FORBIDDEN" e obtém a chave da linha **sem** alargar o contrato do helper de sessão (que roda no hot path de `(app)`). | y |
| A resolução via `getCurrentPerson()` colapsa "sem sessão" e "Pessoa inativa" no mesmo `null`. | agent | Ambos passam a retornar `fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.')`. O código de erro do ramo "inativa" muda de `FORBIDDEN` para `UNAUTHENTICATED`; a guarda `FORBIDDEN` é **preservada** para o ramo "sem credencial". | O `getCurrentPerson()` já reforça `status === 'ATIVO'` (não distingue o porquê do `null`). O ramo "inativa" é **inalcançável na prática** (uma Pessoa `INATIVO` não faz login - USP-007 bloqueia; o 1º acesso exige sessão viva do login). O desfecho observável é idêntico: operação bloqueada, senha não trocada, flag não baixada. Só muda o rótulo interno de um ramo inalcançável. Isto é o "helper swap changes a seam" - o teste da action é atualizado ao novo seam. | y |
| `updateUser({ password })` continua exigindo o cliente Supabase. | agent | A action continua chamando `createSupabaseServerClient()` para `supabase.auth.updateUser({ password })` (a mutação de senha precisa do provedor de auth). A padronização recai **apenas** sobre a resolução do ator, não sobre a mutação. | A troca de senha é genuinamente uma operação do provedor; padronizar a resolução não elimina a necessidade do provedor para a escrita. | y |
| `actorUserId` na auditoria passa a vir de `person.supabaseUserId`. | agent | `withAudit(..., { actorUserId: person.supabaseUserId, actorPersonId: person.id, ... })`. | `person.supabaseUserId` é exatamente o antigo `user.id`; valor idêntico, auditoria preservada. | y |
| Telas de auth restilizadas seguem o padrão do login: `FormHeader` + `FormCard`, mais `StepIcon` (linguagem do protótipo). | agent | `trocar-senha` usa `FormHeader` + `FormCard` (padrão verbatim do login já mergeado) + `StepIcon` (variante `blue`, glifo de cadeado/escudo) para ecoar o par form-header/step-icon do protótipo. Glifo/variante exatos são discricionários e decorativos. | A tela não existe no protótipo; aplica-se a **linguagem** (não cópia 1:1). `FormHeader`/`FormCard` garantem paridade de token (iguais ao login); `StepIcon` enriquece a paridade com as telas de formulário do protótipo. | y |
| Server Component de página (`trocar-senha`) segue o padrão do repo: gate de estilo é typecheck+lint+build, sem teste RTL de página. | agent | Não criar `page.test.tsx` para `trocar-senha` (diferente de `login`/`redefinir-senha`, que já têm). Cobertura concentra-se no `ChangePasswordForm` (RTL existente) e na action (unit). | O repo só tem page.test onde o roteamento condicional justifica; `trocar-senha` é render direto. | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Restyle da troca de senha no 1º acesso para o Design System (AD-014) - só estilo ⭐ MVP

**User Story**: Como usuário em primeiro acesso, quero que a tela de definição da nova senha tenha a
mesma identidade visual do login e do restante do portal, para que a experiência seja coesa.

**Why P1**: Consistência visual é o objetivo central da rodada Fase 1 (AD-014); a troca no 1º acesso é
a primeira interação autenticada de todo usuário pré-cadastrado.

**Acceptance Criteria**:

1. QUANDO a página `trocar-senha` é renderizada ENTÃO o sistema DEVE compô-la com `FormHeader`
   (+ `StepIcon`) + `FormCard`, sem classes de paleta crua (`bg-blue-600`, `text-gray-*`,
   `focus:ring-blue-*`).
2. QUANDO o `ChangePasswordForm` é reestilizado ENTÃO o sistema DEVE usar `Label`/`Input`/`Button` do
   barrel `@/shared/ui` e a caixa de erro no padrão danger-token do `LoginForm`
   (`bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] text-danger`), **preservando** RHF+Zod
   (`changePasswordFirstAccessSchema`), a validação de força/confirmação, a chamada a
   `changePasswordFirstAccess`, o redirect a `/inicio` e os textos de label/botão.
3. QUANDO qualquer tela restilizada é aberta em modo escuro ENTÃO o sistema DEVE resolver as cores via
   tokens (`data-theme`), sem hex cru.

**Independent Test**: Rodar `ChangePasswordForm.test.tsx` (5 casos existentes) verde após o restyle
(labels "Nova senha"/"Confirmar nova senha", botão "Salvar nova senha", `role="alert"` preservados);
abrir `trocar-senha` no browser em light/dark e confirmar paridade com a linguagem do protótipo.

---

### P1: Padronizar a resolução de sessão em `changePasswordFirstAccess` (helper canônico) ⭐ MVP

**User Story**: Como mantenedor do módulo identity, quero que a troca de senha no 1º acesso resolva a
Pessoa autenticada pelo mesmo helper canônico usado no resto do módulo, para que a revalidação de
sessão/status seja única e consistente (ADR-0030).

**Why P1**: Consistência arquitetural e defesa em profundidade: `getCurrentPerson()` centraliza a
revalidação de `Person.status` por request (ADR-0030); duplicar essa lógica com `getUser()` cru abre
espaço para divergência.

**Acceptance Criteria**:

1. QUANDO `changePasswordFirstAccess` resolve o ator ENTÃO o sistema DEVE usar `getCurrentPerson()`
   (não `supabase.auth.getUser()` + `prisma.person.findUnique` manuais).
2. QUANDO `getCurrentPerson()` retorna `null` (sem sessão ou Pessoa não-ativa) ENTÃO o sistema DEVE
   retornar `fail('UNAUTHENTICATED', ...)` **antes de qualquer escrita** (sem `updateUser`, sem
   `credential.update`, sem audit).
3. QUANDO a Pessoa está ativa mas não tem credencial ENTÃO o sistema DEVE retornar `fail('FORBIDDEN',
   ...)` (guarda preservada, via `prisma.credential.findUnique`).
4. QUANDO a Pessoa ativa com credencial submete uma senha válida ENTÃO o sistema DEVE proceder
   **exatamente como hoje**: `supabase.auth.updateUser({ password })`, e na mesma transação
   `withAudit(AUTH_PASSWORD_CHANGED_FIRST_ACCESS)` baixar `primeiroAcesso` e auditar; retornar
   `{ redirectTo: '/inicio' }`.

**Independent Test**: `changePassword.test.ts` (action) atualizado ao novo seam (`getCurrentPerson` +
`prisma.credential.findUnique` mockados): happy path atualiza senha/baixa flag/audita/redireciona;
`null` de `getCurrentPerson` → UNAUTHENTICATED sem escrita; sem credencial → FORBIDDEN; erro do provedor
→ INTERNAL; input inválido → VALIDATION. Todos verdes.

---

## Edge Cases

- QUANDO `changePasswordFirstAccess` é chamada sem sessão / com Pessoa inativa ENTÃO o sistema DEVE
  falhar (`UNAUTHENTICATED`) sem tocar o provedor de auth nem o banco.
- QUANDO a Pessoa ativa não tem credencial ENTÃO o sistema DEVE falhar (`FORBIDDEN`) sem escrita.
- QUANDO o `ChangePasswordForm` é submetido com senha fraca ou confirmação divergente ENTÃO o sistema
  DEVE **não** chamar `changePasswordFirstAccess` (guarda client Zod preservada no restyle).
- QUANDO o restyle é aplicado ENTÃO o sistema DEVE **não** alterar handlers, schema, action, metadata,
  `dynamic='force-dynamic'` nem os textos de label/botão que os testes asseveram.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT... | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U4-MN-01 | QUANDO `getCurrentPerson()` retorna `null` (sem sessão / Pessoa não-ativa) OU não há credencial, ENTÃO `changePasswordFirstAccess` NÃO DEVE chamar `supabase.auth.updateUser` nem baixar `primeiroAcesso` nem auditar (retorna `{ok:false}` antes de qualquer escrita). | Troca de senha / baixa da flag de 1º acesso por chamador não autenticado, Pessoa inativa ou sem credencial. | T1 | `changePassword.test.ts` - casos `getCurrentPerson→null` e `credential→null`: `ok=false`, `supaState.updateUser` NÃO chamado, `withAudit`/`credential.update` não invocados. |
| U4-MN-02 | QUANDO o `ChangePasswordForm` é submetido com senha fraca ou confirmação divergente ENTÃO o sistema NÃO DEVE chamar `changePasswordFirstAccess`. | Restyle enfraquecer a validação client-side (força/confirmação) da troca de senha. | T2 | `ChangePasswordForm.test.tsx` (existentes, mantidos verdes) - "senha fraca → NÃO chama a action" e "confirmação diferente → NÃO chama a action". |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IDN-09 (upstream, canônico) | USP-004 | Verified (entregue) | Preservado |
| IDN-10 (upstream, canônico) | USP-004 | Verified (entregue) | Preservado |
| IDN-11 (upstream, canônico) | USP-004 | Verified (entregue) | Preservado |
| U4-STYLE-01 (local) | P1 Restyle | Tasks | Pending |
| U4-BACKEND-01 (local) | P1 Sessão canônica | Tasks | Pending |
| U4-MN-01 (local) | P1 Sessão canônica | Tasks | Pending |
| U4-MN-02 (local) | P1 Restyle | Tasks | Pending |

- **U4-STYLE-01**: Restyle de `trocar-senha/page.tsx` + `ChangePasswordForm` com primitivos/tokens do DS, estilo apenas (AC P1-Restyle 1-3).
- **U4-BACKEND-01**: Resolução do ator via `getCurrentPerson()` + guarda de credencial em `changePasswordFirstAccess`, preservando a transação (AC P1-Sessão 1-4).

**Coverage:** 7 itens (3 upstream preservados, 4 locais); 4 locais mapeados a tasks.

---

## Success Criteria

- [ ] `trocar-senha/page.tsx` e `ChangePasswordForm` usam exclusivamente primitivos/tokens do DS; paridade visual com a linguagem do protótipo em light e dark; login **não** foi tocado (já feito na Unidade 0).
- [ ] `changePasswordFirstAccess` resolve o ator via `getCurrentPerson()`; transação de troca de senha (updateUser + credential.update + withAudit) preservada verbatim.
- [ ] Guarda preservada: sem Pessoa ativa → UNAUTHENTICATED sem escrita; sem credencial → FORBIDDEN.
- [ ] Todos os testes existentes da USP-004 permanecem verdes; `changePassword.test.ts` atualizado ao novo seam com o caso negativo da guarda (U4-MN-01) e `ChangePasswordForm.test.tsx` verde (U4-MN-02).
