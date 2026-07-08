# USP-013 — Adicionar responsável a uma Empresa — Refactor (Fase 2) Specification

> **Fonte da verdade upstream (adaptar, não re-derivar).** Os requisitos funcionais da USP-013 já vivem no
> épico `.specs/features/vinculos-pessoa-empresa/spec.md` (história "P1: Adicionar responsável a uma Empresa",
> requisitos **VPE-01/02/03** + Edge Cases) e no `design.md` (adapter ICE) do mesmo épico, chaveados aos IDs
> ICE **E-001..003 / P-001..005 / L-002** (`docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-013.md`).
> Decisões de projeto: **AD-006** (modelo pendente+aceite), **AD-007** (outbox mínimo). A USP **já está
> implementada e mergeada** (`adicionarResponsavel`, `aceitarVinculoResponsavel`, `AddResponsibleForm`,
> `PendingResponsibleLinksList`, páginas `responsaveis` e `aceitar-vinculo`). Este documento **não re-deriva**
> os ACs — VPE-01..03 e os IDs ICE permanecem canônicos. Ele especifica os **deltas de refactor da Fase 2**
> (adoção do DS, AD-014/AD-015). IDs locais (`U13-*`) cobrem só o restyle.
>
> **Alinhamento com AD-015:** restyle é **style-only, comportamento preservado**, ancorado nos testes
> existentes verdes como testes negativos.

## Problem Statement

A adição de responsável (USP-013) está entregue e correta: `adicionarResponsavel` (busca binária sem PII,
permissão de responsável ATIVO, rate limit anti-enumeração, grant `PENDING`, outbox de e-mail de aceite,
UNIQUE parcial + `409`) e `aceitarVinculoResponsavel` (aceite pela sessão → `ACTIVE` + ativação de papel +
consent finalidade 5, na mesma transação). Porém a UI — `AddResponsibleForm`, `PendingResponsibleLinksList` e
as páginas `responsaveis`/`aceitar-vinculo` — usa Tailwind solto (`bg-blue-600`, `text-gray-*`, constantes
`inputClass`/`labelClass`/`errorClass`) fora do Design System (AD-014). Este refactor aplica o DS (só estilo,
fluxo preservado).

## Goals

- [ ] Reestilizar `AddResponsibleForm` e `PendingResponsibleLinksList` com os primitivos/tokens do DS
      (`Input`/`Label`/`Button`/`Card`), sem alterar comportamento.
- [ ] Reestilizar as páginas `(app)/empresa/[empresaId]/responsaveis` (shell + área de adição) e
      `(app)/empresa/aceitar-vinculo` com `FormHeader`/tokens.
- [ ] Preservar as garantias de privacidade/autz/LGPD: busca **binária sem PII** (P-001), grant nasce
      **`PENDING`** (P-002/AD-006), só responsável ATIVO adiciona (P-005), rate limit anti-enumeração (L-002),
      aceite pela sessão (não pelo link) + consent finalidade 5 atômico (P-003).
- [ ] Manter verdes todos os testes existentes da USP-013 e cobrir os deltas com RTL + guarda estática de paridade DS.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar `adicionarResponsavel`/`aceitarVinculoResponsavel`, schema `PersonCompanyGrant`, outbox ou eventos | Entregues e cobertos por testes; refactor é **só de estilo**. |
| Re-introduzir o fluxo de busca em duas etapas (buscar → confirmar) | O single-step atual é **estritamente mais privado** (não retorna PII); SPEC_DEVIATION Level-1 já documentado no componente. Ver Assumptions. |
| Convite por e-mail a Pessoa não cadastrada | Pessoa deve estar pré-cadastrada (V2). |
| Restyle do `RemoveResponsibleDialog` e da lista de responsáveis ativos (USP-014) | Coabitam a página `responsaveis` mas pertencem à USP-014. Ver Assumptions (coordenação). |
| Dispatcher real do e-mail de aceite | É da USP-044; aqui só o enfileiramento no outbox (AD-007). |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| A busca é single-step (uma chamada sem PII), divergindo do design §4 (dois passos). | agent | Preservar o single-step no restyle; não re-introduzir a etapa de confirmação com nome. | É estritamente mais privado (P-001) — a action resolve a busca server-side e não retorna identidade. SPEC_DEVIATION Level-1 já documentado em `add-responsible-form.tsx`. | y |
| A página `responsaveis/page.tsx` é compartilhada por USP-013 (adição) e USP-014 (lista+remoção). | agent | USP-013 restila o **shell da página + área de adição**; USP-014 restila a **lista de ativos + `RemoveResponsibleDialog`**. Coordenar na mesma branch da fase. | Evita que duas USPs briguem pelo mesmo arquivo; cada uma dona da sua seção. O Implementer sequencia (mesma branch de fase). | y |
| Server Components de página seguem o padrão do repo (gate de restyle = build; sem `page.test.tsx`). | agent | Não criar teste de página; cobertura nos Client Components + guarda estática. | Consistente com AD-015 e com o repo. | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Restyle da adição/aceite de responsável para o Design System (AD-014) — só estilo ⭐ MVP

**User Story**: Como responsável de uma Empresa (e como Pessoa convidada), quero que as telas de adicionar
responsável e de aceitar convite tenham a identidade visual do portal, para uma experiência coesa.

**Why P1**: Consistência visual é o objetivo central da Fase 2 (AD-015).

**Acceptance Criteria**:

1. QUANDO o `AddResponsibleForm` é reestilizado ENTÃO o sistema DEVE usar `Label`/`Input`/`Button` do
   `@/shared/ui`, sem `inputClass`/`labelClass`/`errorClass` nem paleta crua (`bg-blue-600`, `text-gray-*`,
   `focus:ring-blue-*`), preservando RHF+Zod, a chamada a `adicionarResponsavel` e as caixas de sucesso/erro neutras (sem PII).
2. QUANDO o `PendingResponsibleLinksList` é reestilizado ENTÃO o sistema DEVE usar `Card`/`Button`/tokens,
   preservando `aceitarVinculoResponsavel`, a remoção otimista do item aceito e a mensagem de estado vazio.
3. QUANDO as páginas `responsaveis` (shell + adição) e `aceitar-vinculo` são reestilizadas ENTÃO o sistema DEVE
   usar `FormHeader`/tokens (`text-fg`, `text-fg-muted`), preservando os gates de rota (`requireActivePerson`,
   404 para não-responsável) e `force-dynamic`.
4. QUANDO qualquer tela restilizada é aberta em modo escuro ENTÃO o sistema DEVE resolver as cores via tokens (`data-theme`), sem hex cru.

**Independent Test**: Renderizar `AddResponsibleForm` (RTL) e confirmar labels/input/botão preservados e uso
dos primitivos, e que o sucesso é confirmado de forma **neutra** (sem nome do alvo); renderizar
`PendingResponsibleLinksList` com itens e confirmar que aceitar chama `aceitarVinculoResponsavel` e remove o
item; abrir as telas em light/dark; suíte da USP-013 permanece verde.

---

## Edge Cases (preservados do backend — não regredir no restyle)

- QUANDO o ator não é responsável ATIVO ENTÃO o sistema DEVE negar (`FORBIDDEN`).
- QUANDO a Pessoa buscada não está cadastrada ENTÃO o sistema DEVE bloquear e orientar auto-cadastro (`NOT_FOUND`).
- QUANDO já há vínculo `PENDING`/`ACTIVE` ENTÃO o sistema DEVE bloquear a duplicidade (`CONFLICT`/`409`).
- QUANDO há muitas buscas em sequência ENTÃO o sistema DEVE aplicar rate limit (`PRECONDITION_FAILED`).
- QUANDO a Pessoa aceita um vínculo que não está mais `PENDING` ENTÃO o sistema DEVE bloquear (idempotência).
- QUANDO o restyle é aplicado ENTÃO o sistema DEVE **não** exibir nome/identidade do alvo na busca/adição (P-001).

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U13-MN-01 | QUANDO uma Pessoa é buscada por CPF/e-mail para adição ENTÃO o sistema NÃO DEVE expor nome/foto/PII do alvo antes do aceite. | Enumeração de CPF / vazamento de identidade (P-001 / ADR-0022). | T1 (form) + T4 (action preservada) | `add-responsible.int.test.ts` (retorno sem PII) + RTL do form (sucesso neutro, sem nome). |
| U13-MN-02 | QUANDO um responsável é adicionado ENTÃO o sistema NÃO DEVE criar o grant como `ACTIVE` sem aceite explícito da Pessoa. | Adição não consentida (fracasso LGPD F2 — P-002 / AD-006). | T4 | `add-responsible.int.test.ts` — grant nasce `PENDING`; só `aceitarVinculoResponsavel` o torna `ACTIVE`. |
| U13-MN-03 | QUANDO quem não é responsável ATIVO tenta adicionar ENTÃO o sistema NÃO DEVE criar o vínculo. | Escalada de privilégio na gestão da Empresa (P-005). | T4 | `add-responsible.int.test.ts` — não-responsável → `FORBIDDEN`, zero grant. |
| U13-MN-04 | QUANDO as telas da USP-013 são reestilizadas ENTÃO o sistema NÃO DEVE reter utilitários de paleta crua (`bg-blue-*`, `text-gray-*`, `ring-blue-*`) nem hex cru. | Smoke de que o DS substitui o ad-hoc (espelha DS-MN-03). | T1, T2, T3 | `ds-empresa-responsaveis-parity.test.ts` (arquivos da USP-013). |

> U13-MN-01..03 são prova de **preservação** — o backend já as garante e os testes de integração existentes
> (verdes) são os negativos. O restyle (T1/T2/T3) toca só markup/classe e não pode enfraquecê-las.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| VPE-01 (upstream, canônico; E-001/P-001/P-005/L-002) | USP-013 | Verified (entregue) | Preservado |
| VPE-02 (upstream, canônico; E-001) | USP-013 | Verified (entregue) | Preservado |
| VPE-03 (upstream, canônico; E-002/E-003/P-002/P-003/P-004) | USP-013 | Verified (entregue) | Preservado |
| U13-STYLE-01 (local) | P1 Restyle | Tasks | Pending |
| U13-MN-01..04 (local) | P1 | Tasks | Pending |

**ID format:** upstream `VPE-NN` (+ ICE `E-/P-/L-`) canônico; local `U13-STYLE-NN` e must-nots `U13-MN-NN`.

**Coverage:** 8 itens (3 upstream preservados, 5 locais); 5 locais mapeados a tasks.

---

## Success Criteria

- [ ] `AddResponsibleForm`, `PendingResponsibleLinksList` e as páginas usam primitivos/tokens do DS; paridade light/dark.
- [ ] Nenhuma mudança de comportamento: busca binária sem PII, grant `PENDING`, permissão ATIVO, rate limit, aceite pela sessão + consent atômico — todos preservados.
- [ ] Todos os testes existentes da USP-013 permanecem verdes; deltas cobertos por RTL + guarda estática de paridade DS.
