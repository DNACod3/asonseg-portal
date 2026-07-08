# USP-015 — Editar dados da Empresa — Refactor (Fase 2) Specification

> **Fonte da verdade upstream (adaptar, não re-derivar).** Os requisitos funcionais da USP-015 já vivem no
> épico `.specs/features/vinculos-pessoa-empresa/spec.md` (história "P1: Editar dados da Empresa", requisitos
> **VPE-07/08** + Edge Cases) e no `design-usp-015.md` (adapter ICE), chaveados aos IDs ICE **E-001..003 /
> P-001..005** (`docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-015.md`). ADRs relevantes:
> ADR-0020 (edição+rebaixamento atômicos), ADR-0021 (CNPJ único no UPDATE), ADR-0023 (audit append-only),
> ADR-0024 (re-verificação só de campos identitários). A USP **já está implementada e mergeada**
> (`editarEmpresa`, `identityFieldsChanged`, `EditCompanyForm`, rota `editar`). Este documento **não re-deriva**
> os ACs — VPE-07/08 e os IDs ICE permanecem canônicos. Ele especifica os **deltas de refactor da Fase 2**
> (adoção do DS, AD-014/AD-015). IDs locais (`U15-*`) cobrem só o restyle.
>
> **Alinhamento com AD-015:** restyle é **style-only, comportamento preservado**, ancorado nos testes
> existentes verdes como testes negativos.

## Problem Statement

A edição de Empresa (USP-015) está entregue e correta: `editarEmpresa` (permissão de responsável ATIVO, CNPJ
único no UPDATE, regra pura `identityFieldsChanged` → rebaixamento `isVerified=false` **na mesma transação**
quando muda `cnpj`/`razaoSocial`/`nomeFantasia`, auditoria `before`/`after`, guarda P2002). Porém a UI —
`EditCompanyForm` — usa Tailwind solto (`bg-blue-600`, `text-gray-*`, constantes `inputClass`/`labelClass`/`errorClass`)
e um **diálogo de confirmação de re-verificação hand-rolled** (`fixed inset-0 bg-black/40`) fora do Design
System (AD-014); a página `editar` também usa markup cru. Este refactor aplica o DS (só estilo, fluxo preservado).

## Goals

- [ ] Reestilizar `EditCompanyForm` com os primitivos/tokens do DS (`Input`/`Label`/`Textarea`/`Button`,
      diálogo de confirmação tokenizado), sem alterar comportamento.
- [ ] Reestilizar a página `(app)/empresa/[empresaId]/editar` com `FormHeader`/tokens.
- [ ] Preservar as garantias: rebaixamento de `isVerified` na mesma transação para campos identitários
      (proteção RP-005), CNPJ único no UPDATE (P-005), permissão ATIVO (P-004), aviso de re-verificação
      **antes** do submit (E-002/D-015-E), servidor como fonte da verdade do rebaixamento.
- [ ] Manter verdes todos os testes existentes da USP-015 e cobrir os deltas com RTL + guarda estática de paridade DS.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar `editarEmpresa`, `identityFieldsChanged`, o schema `editCompanySchema` ou a auditoria | Entregues e cobertos por testes; refactor é **só de estilo**. |
| Destaque no moderador de "o que mudou desde a verificação" | É entregável da **USP-017** (deriva do audit `before`/after`); D-015-A não cria coluna. |
| Notificação por e-mail na edição | O card não aponta evento de e-mail; edição não notifica (não fabricar). |
| Extrair um primitivo `Dialog`/`Modal` compartilhado | Ver Assumptions — default é restilizar o diálogo in-place. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| O diálogo de confirmação de re-verificação é hand-rolled (irmão do da USP-014). | agent | **Default: restilizar in-place** — tokenizar a superfície + `Button` do DS. Extrair primitivo `Dialog` é opcional (se barato, ir para `shared/ui` com tokens + teste). | Disciplina style-only (AD-015); risco mínimo. Mesma decisão da USP-014. | y |
| A detecção client de mudança identitária + confirmação antes do submit (D-015-E) é UX; o servidor é a fonte da verdade do rebaixamento. | agent | Preservar exatamente: `identityFieldsChanged` no cliente decide **se pede confirmação**; o servidor decide **se rebaixa**. | Segurança não pode depender do cliente; o restyle não move essa fronteira. | y |
| Já existe `editar/page.test.tsx` (gate da rota). | agent | Preservar/atualizar apenas o necessário no restyle; não remover. | Consistência com o repo; o teste de gate de rota é ativo defensivo. | y |
| Server Component de página: gate de restyle = build (além do `page.test.tsx` já existente). | agent | Não adicionar novos testes de página além dos existentes; cobertura no form (RTL) + guarda estática. | Consistente com AD-015. | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Restyle da edição de Empresa para o Design System (AD-014) — só estilo ⭐ MVP

**User Story**: Como responsável de uma Empresa, quero que o formulário de edição e o aviso de re-verificação
tenham a identidade visual do portal, para uma experiência coesa e um aviso claro sobre a re-verificação.

**Why P1**: Consistência visual (AD-015).

**Acceptance Criteria**:

1. QUANDO o `EditCompanyForm` é reestilizado ENTÃO o sistema DEVE usar `Label`/`Input`/`Textarea`/`Button` do
   `@/shared/ui`, sem `inputClass`/`labelClass`/`errorClass` nem paleta crua (`bg-blue-600`, `text-gray-*`,
   `border-gray-300`), preservando RHF+Zod (`editCompanySchema`), os `defaultValues` pré-preenchidos, os campos
   ocultos, e a chamada a `editarEmpresa`.
2. QUANDO o diálogo de confirmação de re-verificação é reestilizado ENTÃO o sistema DEVE usar `Button`
   (`primary` no confirmar, `outline` no cancelar) e superfície tokenizada (`bg-surface`/`text-fg`/`border-border`),
   **preservando** a lógica: só abre quando `identityFieldsChanged` é verdadeiro **e** `empresa.isVerified` é `true`.
3. QUANDO a página `editar` é reestilizada ENTÃO o sistema DEVE usar `FormHeader`/tokens, preservando o gate de
   rota (`requireActivePerson`, 404 para não-responsável), a carga dos dados atuais e `force-dynamic`.
4. QUANDO qualquer tela restilizada é aberta em modo escuro ENTÃO o sistema DEVE resolver as cores via tokens
   (`data-theme`), incluindo o overlay do diálogo, sem hex cru.

**Independent Test**: Renderizar `EditCompanyForm` (RTL) e confirmar: editar só a descrição → submete direto
(sem diálogo); editar razão social (empresa verificada) → abre o diálogo de re-verificação; confirmar chama
`editarEmpresa`; abrir a página em light/dark; suíte da USP-015 permanece verde.

---

## Edge Cases (preservados do backend — não regredir no restyle)

- QUANDO muda campo não-identitário (descrição/endereço/setor/type) ENTÃO o sistema DEVE persistir sem rebaixar `isVerified`.
- QUANDO muda campo identitário (cnpj/razaoSocial/nomeFantasia) ENTÃO o sistema DEVE rebaixar `isVerified=false` na mesma transação.
- QUANDO o CNPJ novo pertence a outra Empresa ENTÃO o sistema DEVE bloquear (`CONFLICT`).
- QUANDO quem não é responsável ATIVO tenta editar ENTÃO o sistema DEVE negar (`FORBIDDEN`).
- QUANDO a Empresa não existe ENTÃO o sistema DEVE retornar `NOT_FOUND`.
- QUANDO o restyle é aplicado ENTÃO o sistema DEVE **não** permitir que o cliente decida o rebaixamento (servidor é a fonte da verdade).

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U15-MN-01 | QUANDO a edição altera `cnpj`, `razaoSocial` ou `nomeFantasia` de uma Empresa verificada ENTÃO o sistema NÃO DEVE manter `isVerified=true`. | Empresa alterando identidade jurídica após verificação sem re-checagem (RP-005 / vetor pós-verificação). | T3 (action preservada) | `edit-company.int.test.ts` — mudança identitária → `isVerified=false` na mesma tx (inclui bypass via chamada direta, D-003). |
| U15-MN-02 | QUANDO o CNPJ editado já pertence a outra Empresa ENTÃO o sistema NÃO DEVE persistir a edição. | Colisão de identidade jurídica no UPDATE (P-005 / ADR-0021). | T3 | `edit-company.int.test.ts` — CNPJ de outra Empresa → `CONFLICT`. |
| U15-MN-03 | QUANDO quem não é responsável ATIVO tenta editar ENTÃO o sistema NÃO DEVE alterar a Empresa. | Edição não autorizada (P-004). | T3 | `edit-company.int.test.ts` — não-responsável → `FORBIDDEN`, Empresa intacta. |
| U15-MN-04 | QUANDO o `EditCompanyForm`/diálogo/página é reestilizado ENTÃO o sistema NÃO DEVE reter paleta crua (`bg-blue-*`, `text-gray-*`, `border-gray-*`) nem hex cru. | Smoke de que o DS substitui o ad-hoc (espelha DS-MN-03). | T1, T2 | `ds-empresa-editar-parity.test.ts`. |

> U15-MN-01..03 são prova de **preservação**; os testes de integração existentes (verdes) são os negativos.
> O restyle (T1/T2) toca só markup/classe. Em especial, U15-MN-01 tem um caso de **bypass** (chamada direta à
> action, sem passar pelo aviso do cliente) — o rebaixamento é server-side e não depende do diálogo de UI.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| VPE-07 (upstream, canônico; AC-015-1/E-001) | USP-015 | Verified (entregue) | Preservado |
| VPE-08 (upstream, canônico; AC-015-2/E-002/P-001) | USP-015 | Verified (entregue) | Preservado |
| U15-STYLE-01 (local) | P1 Restyle | Tasks | Pending |
| U15-MN-01..04 (local) | P1 | Tasks | Pending |

**ID format:** upstream `VPE-NN` (+ ICE `E-/P-`) canônico; local `U15-STYLE-NN` e must-nots `U15-MN-NN`.

**Coverage:** 7 itens (2 upstream preservados, 5 locais); 5 locais mapeados a tasks.

---

## Success Criteria

- [ ] `EditCompanyForm`, o diálogo de re-verificação e a página `editar` usam primitivos/tokens do DS; paridade light/dark, overlay tokenizado.
- [ ] Nenhuma mudança de comportamento: rebaixamento atômico de identitários, CNPJ único no UPDATE, permissão ATIVO, aviso client antes do submit, servidor como fonte da verdade — todos preservados.
- [ ] Todos os testes existentes da USP-015 permanecem verdes; deltas cobertos por RTL + guarda estática de paridade DS.
