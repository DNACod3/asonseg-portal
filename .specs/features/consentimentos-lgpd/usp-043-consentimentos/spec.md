# USP-043 Consentimentos por finalidade (LGPD) - Refactor (Fase 1) Specification

> **Fonte da verdade upstream (adaptar, não re-derivar):** os requisitos funcionais da USP-043 já vivem
> no épico `.specs/features/consentimentos-lgpd/spec.md` (histórias P1, requisitos **LGP-01..LGP-06**).
> Este documento **não** re-deriva aqueles ACs - a USP já está implementada e mergeada. Ele especifica
> **apenas o delta de restyle da Fase 1** sobre o painel do titular (LGP-05). Os IDs `LGP-*` permanecem
> canônicos; os IDs locais abaixo (`U43-*`) cobrem só o que o épico não descreve (restyle).

## Problem Statement

O painel de consentimentos do titular (USP-043 / LGP-05) está entregue e correto, mas usa Tailwind solto
(`bg-green-100`, `text-gray-*`, `bg-white`, `border-gray-200`, botões vermelhos crus) fora do Design
System da Fase 1 (AD-014). Este refactor aplica os primitivos e tokens do DS ao componente `ConsentsPanel`
e à página `consentimentos`, **sem alterar comportamento**: revogação por finalidade com confirmação,
separação vigentes/revogados, abertura do termo aceito e escopo por titular autenticado permanecem
idênticos.

## Goals

- [ ] Reestilizar `ConsentsPanel` (Client Component) com `Card`, `Badge`, `Button` do DS e tokens
      (`text-fg`, `text-fg-muted`, `bg-background`), preservando semântica e acessibilidade.
- [ ] Reestilizar a página `consentimentos` (Server Component) com tokens e `Card` no estado vazio,
      preservando `requireActivePerson` (escopo do titular) e o carregamento deduplicado de termos.
- [ ] Manter verdes os testes existentes do painel (roles/nomes acessíveis) e a garantia de privacidade
      (só consentimentos do próprio titular).

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar a ação de revogação (`revokeConsent`), a cascata para role grant ou a auditoria | Delta é **só de estilo**; o backend de LGP-04 é preservado. |
| Alterar a query `listOwnConsents` / view `own-consents.view` | Restyle não toca dados; o escopo por `personId` (privacidade) permanece intacto. |
| Novos requisitos de LGP-01..LGP-06 (registro, termo versionado, requireActiveConsent, revogação, direito de acesso) | Já entregues e cobertos por testes; o refactor não os altera. |
| Restyle da página de aceite (TX2) do auto-cadastro | Pertence ao fluxo USP-001 (rota `(auth)/cadastro/consentimento`), planejada em `.specs/features/identity-acesso-papeis/usp-001-auto-cadastro/`. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| Mapeamento de status -> variante de `Badge`. | agent | `vigente`->`green`, `desatualizado`->`orange`, `revogado`->`gray`. | Corresponde às cores atuais (verde/âmbar/cinza) e às variantes disponíveis no `Badge` do DS. | y |
| O `Badge` do DS não tem variante de rótulo "âmbar"; hoje o painel usa `bg-amber-100`. | agent | Usar `orange` (variante DS mais próxima) para `desatualizado` ("Requer novo aceite"). | O DS deriva tints por `color-mix` sobre tokens; `orange`(cta) é o mais próximo do âmbar sem hex cru. | y |
| Ações destrutivas (Revogar / Sim, revogar) não têm variante `danger` no `Button`. | agent | Usar `Button variant="outline"` com override de token de perigo (`border-danger text-danger` / caixa de confirmação `bg-[color-mix(...danger...)]`), preservando os nomes acessíveis. | Mantém a convenção AD-014 (tokens, sem hex cru) e o padrão danger já usado no `LoginForm`. | y |
| A página `consentimentos` mantém alinhamento à esquerda (lista de gestão), não centralizado. | agent | Não usar `FormHeader` (centralizado); restilizar o `<header>` com tokens e `Card` no estado vazio. | `FormHeader` é para formulários centralizados; o painel é uma lista de gestão. | y |
| Server Component de página segue o padrão do repo: gate de estilo é typecheck+lint+build, sem teste de página. | agent | Não criar `page.test.tsx`; cobertura concentra-se no Client Component `ConsentsPanel`. | Consistente com o repo (só `login`/`redefinir-senha` têm teste de página). | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Restyle do painel de consentimentos para o Design System (AD-014) - só estilo ⭐ MVP

**User Story**: Como titular autenticado, quero que o painel "Meus consentimentos" tenha a identidade
visual do portal, para que a gestão dos meus dados seja clara e consistente.

**Why P1**: Coesão visual (AD-014) numa tela sensível de LGPD; o painel é o ponto único de transparência
e revogação do titular.

**Acceptance Criteria**:

1. QUANDO o painel é renderizado ENTÃO o sistema DEVE usar `Card` para cada consentimento, `Badge`
   (green/orange/gray por status) e `Button` para as ações, sem classes de paleta crua.
2. QUANDO o painel é reestilizado ENTÃO o sistema DEVE **preservar** a semântica e acessibilidade:
   landmarks `region` ("Consentimentos vigentes"/"Consentimentos revogados"), o `role="dialog"`
   `aria-modal` da confirmação, e os nomes acessíveis dos botões ("Revogar", "Sim, revogar", "Ver termo
   aceito", "Cancelar").
3. QUANDO um consentimento está revogado ENTÃO o sistema DEVE **não** oferecer o botão "Revogar" (só nos
   vigentes) - comportamento inalterado.
4. QUANDO a página `consentimentos` é reestilizada ENTÃO o sistema DEVE preservar `requireActivePerson`
   (escopo do titular), o carregamento deduplicado dos termos e `dynamic='force-dynamic'`, restilizando
   header/estado-vazio com tokens/`Card`.
5. QUANDO qualquer tela é aberta em modo escuro ENTÃO o sistema DEVE resolver as cores via tokens.

**Independent Test**: Rodar `consents-panel.test.tsx` (RTL) e confirmar que separação vigentes/revogados,
confirmação de revogação, disparo de `revokeConsent({purpose})` e abertura do termo continuam verdes com
os primitivos; abrir o painel no browser em light/dark e confirmar paridade.

---

## Edge Cases

- QUANDO não há consentimentos vigentes ENTÃO o painel DEVE exibir a mensagem vazia com tokens (sem `text-gray-*`).
- QUANDO há consentimentos revogados ENTÃO a seção "revogados" DEVE aparecer com `Badge` cinza e sem botão "Revogar".
- QUANDO a revogação falha (action retorna erro) ENTÃO a mensagem de erro DEVE ser exibida na caixa de confirmação com token de perigo (comportamento inalterado, só cor via token).
- QUANDO o restyle é aplicado ENTÃO o sistema DEVE **não** alterar a query/scoping por `personId` (privacidade preservada).

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT... | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U43-MN-01 | QUANDO o painel é reestilizado ENTÃO o sistema NÃO DEVE oferecer "Revogar" em consentimento revogado nem revogar sem confirmação. | Revogação acidental / estado inconsistente do role grant. | T1 | `consents-panel.test.tsx` (existente) - "Revogar" ausente em revogados; `role="dialog"` de confirmação antes de disparar `revokeConsent`. Mantido verde. |
| U43-MN-02 | QUANDO a página de consentimentos é carregada ENTÃO o sistema NÃO DEVE exibir consentimentos de outra Pessoa. | Vazamento LGPD entre titulares. | T2 | `list-own-consents.test.ts` (existente, escopo por `personId`) - a página continua usando `requireActivePerson().id`; o restyle não toca a query. Mantido verde. |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| LGP-05 (upstream, canônico) | USP-043 | Verified (entregue) | Preservado |
| LGP-04 (upstream, canônico - revogação) | USP-043 | Verified (entregue) | Preservado (só estilo) |
| U43-STYLE-01 (local) | P1 Restyle | Tasks | Pending |
| U43-MN-01 (local) | P1 Restyle | Tasks | Pending |
| U43-MN-02 (local) | P1 Restyle | Tasks | Pending |

- **U43-STYLE-01**: Restyle de `ConsentsPanel` + página `consentimentos` com primitivos/tokens do DS, estilo apenas (AC P1-Restyle 1-5).

**Coverage:** 5 itens (2 upstream preservados, 3 locais); 3 locais mapeados a tasks.

---

## Success Criteria

- [ ] `ConsentsPanel` e a página `consentimentos` usam exclusivamente `Card`/`Badge`/`Button`/tokens do DS; paridade visual em light e dark.
- [ ] Nenhuma mudança de comportamento: revogação com confirmação, separação vigentes/revogados, abertura de termo, escopo por titular - preservados.
- [ ] `consents-panel.test.tsx` e os testes de escopo (`list-own-consents`) permanecem verdes; nomes acessíveis e landmarks intactos.
</content>
