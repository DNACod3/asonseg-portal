# USP-014 — Remover responsável de uma Empresa — Refactor (Fase 2) Specification

> **Fonte da verdade upstream (adaptar, não re-derivar).** Os requisitos funcionais da USP-014 já vivem no
> épico `.specs/features/vinculos-pessoa-empresa/spec.md` (história "P1: Remover responsável de uma Empresa",
> requisitos **VPE-04/05/06** + Edge Cases) e nos artefatos de nível-épico `design-usp-014.md` /
> `tasks-usp-014.md`. Decisão de projeto: **AD-008** (reuso `revokedAt`/`revokedBy` + nova coluna
> `revokeReason`; invariante ≥1 ACTIVE; entrega em PR único). A USP **já está implementada e mergeada**
> (`removerResponsavel`, `wouldLeaveCompanyWithoutResponsible`, `RemoveResponsibleDialog`, `listActiveResponsibles`).
> Este documento **não re-deriva** os ACs — VPE-04..06 permanecem canônicos. Ele especifica os **deltas de
> refactor da Fase 2** (adoção do DS, AD-014/AD-015). IDs locais (`U14-*`) cobrem só o restyle.
>
> **Alinhamento com AD-015:** restyle é **style-only, comportamento preservado**, ancorado nos testes
> existentes verdes como testes negativos.

## Problem Statement

A remoção de responsável (USP-014) está entregue e correta: `removerResponsavel` (append-only via
`revokedAt`/`revokedBy`/`revokeReason`, invariante "≥1 responsável ATIVO" via regra pura
`wouldLeaveCompanyWithoutResponsible`, permissão de responsável ATIVO, e-mail no outbox, auditoria com
justificativa) e a query `listActiveResponsibles`. Porém a UI — `RemoveResponsibleDialog` — usa Tailwind
solto (`bg-red-600`, `text-gray-*`, `border-gray-300`) e um **modal hand-rolled** (`fixed inset-0 bg-black/40`)
fora do Design System (AD-014); a seção "Responsáveis ativos" da página `responsaveis` também usa markup cru.
Este refactor aplica o DS (só estilo, fluxo preservado), aproveitando a variante `danger` do `Button` do DS
(AD-015).

## Goals

- [ ] Reestilizar `RemoveResponsibleDialog` com os primitivos/tokens do DS (`Button` variantes `danger`/`outline`,
      `Textarea`/`Label`, superfície de modal tokenizada), sem alterar comportamento.
- [ ] Reestilizar a seção "Responsáveis ativos" da página `(app)/empresa/[empresaId]/responsaveis` com tokens.
- [ ] Preservar as garantias: invariante "≥1 responsável ativo" (bloqueio do último), remoção **append-only**
      (nunca `delete`; histórico VPE-06), `revokeReason`, permissão ATIVO (P-005), auto-remoção → redireciona (ADR-0030).
- [ ] Manter verdes todos os testes existentes da USP-014 e cobrir os deltas com RTL + guarda estática de paridade DS.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar `removerResponsavel`, a regra `wouldLeaveCompanyWithoutResponsible`, coluna `revokeReason`, outbox ou audit | Entregues e cobertos por testes; refactor é **só de estilo**. |
| Dispatcher real do e-mail de aviso de remoção | É da USP-044; aqui só o enfileiramento no outbox. |
| Extrair um primitivo `Dialog`/`Modal` compartilhado para `src/shared/ui` | Ver Assumptions — default é restilizar o modal in-place; extração é melhoria opcional de baixa prioridade. |
| Rota `/empresa` (listagem) alvo do redirect de auto-remoção | Rota inexistente hoje (risco herdado); ver Risks no design. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| Não existe primitivo `Dialog`/`Modal` no DS; `RemoveResponsibleDialog` (e o dialog do `EditCompanyForm`) fazem modal hand-rolled. | agent | **Default: restilizar o modal in-place** — tokenizar a superfície (`bg-surface`/`text-fg`/`border-border`) e trocar os botões por `Button` do DS. Extrair um primitivo `Dialog` compartilhado fica como melhoria opcional (se o Implementer julgar barato, deve ir para `src/shared/ui` com tokens + teste). | Disciplina style-only (AD-015): risco mínimo, comportamento preservado. Extrair primitivo é mudança de fundação, fora do mandato de restyle. | y |
| A auto-remoção redireciona para `/empresa` (rota inexistente). | agent | Preservar o comportamento atual (não é regressão desta USP); registrar como risco herdado. Se trivial, o Implementer pode apontar para uma rota existente, mas **não** é requisito desta USP criar um dashboard. | Criar a listagem `/empresa` excede o mandato de restyle; o alvo do redirect é dívida pré-existente. | y |
| Página `responsaveis/page.tsx` compartilhada com USP-013. | agent | USP-014 restila a **seção "Responsáveis ativos" + `RemoveResponsibleDialog`**; o shell + adição é da USP-013. | Partição por seção evita conflito de edição (mesma coordenação da USP-013). | y |
| Server Component de página: gate de restyle = build; sem `page.test.tsx`. | agent | Não criar teste de página; cobertura no dialog (RTL) + guarda estática. | Consistente com AD-015 e o repo. | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Restyle da remoção de responsável para o Design System (AD-014) — só estilo ⭐ MVP

**User Story**: Como responsável de uma Empresa, quero que o diálogo de remoção e a lista de responsáveis
tenham a identidade visual do portal, para uma experiência coesa e para que a ação destrutiva seja
visualmente clara (variante `danger`).

**Why P1**: Consistência visual (AD-015); a variante `danger` do DS comunica a natureza destrutiva.

**Acceptance Criteria**:

1. QUANDO o `RemoveResponsibleDialog` é reestilizado ENTÃO o sistema DEVE usar `Button` (`variant="danger"` no
   confirmar, `variant="outline"` no cancelar, gatilho "Remover" com estilo destrutivo tokenizado),
   `Label`/`Textarea` para o motivo, e superfície de modal com tokens (`bg-surface`/`text-fg`/`border-border`),
   sem paleta crua (`bg-red-600`, `text-gray-*`, `border-gray-300`).
2. QUANDO o diálogo é reestilizado ENTÃO o sistema DEVE **preservar** RHF+Zod (`removeResponsibleSchema`), o
   campo `motivo` opcional, a chamada a `removerResponsavel`, o tratamento de `PRECONDITION_FAILED` (último ativo)
   e `FORBIDDEN`, e o redirecionamento em auto-remoção (`selfRemoved`).
3. QUANDO a seção "Responsáveis ativos" da página é reestilizada ENTÃO o sistema DEVE usar tokens (`text-fg`,
   `border-border`, marcação "(você)" com `text-fg-muted`), preservando a listagem de `listActiveResponsibles` e o gate de rota.
4. QUANDO qualquer tela restilizada é aberta em modo escuro ENTÃO o sistema DEVE resolver as cores via tokens
   (`data-theme`), incluindo o overlay do modal, sem hex cru.

**Independent Test**: Renderizar `RemoveResponsibleDialog` (RTL) e confirmar: abre o modal, coleta motivo
opcional, chama `removerResponsavel({grantId, motivo})`, renderiza a mensagem de erro de "último responsável"
quando a action retorna `PRECONDITION_FAILED`; abrir a página em light/dark; suíte da USP-014 permanece verde.

---

## Edge Cases (preservados do backend — não regredir no restyle)

- QUANDO a remoção deixaria a Empresa sem responsável ativo ENTÃO o sistema DEVE bloquear (`PRECONDITION_FAILED`).
- QUANDO quem não é responsável ATIVO tenta remover ENTÃO o sistema DEVE negar (`FORBIDDEN`).
- QUANDO o ator remove o próprio vínculo com outro ativo ENTÃO o sistema DEVE permitir e redirecionar (perde acesso).
- QUANDO o grant já foi revogado ENTÃO o sistema DEVE tratar idempotentemente (`NOT_FOUND`).
- QUANDO o restyle é aplicado ENTÃO o sistema DEVE **não** transformar a remoção em `delete` (append-only preservado no backend).

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U14-MN-01 | QUANDO a remoção deixaria a Empresa com 0 responsáveis ATIVOS ENTÃO o sistema NÃO DEVE encerrar o vínculo. | Empresa órfã de responsável (perda de governança / bloqueio operacional). | T3 (action preservada) | `remove-responsible.int.test.ts` — remover o último ativo → `PRECONDITION_FAILED`, grant intacto. |
| U14-MN-02 | QUANDO um vínculo é removido ENTÃO o sistema NÃO DEVE apagar a linha (hard delete) — remoção é append-only (`revokedAt`). | Perda de histórico auditável do vínculo (VPE-06 / ADR-0023). | T3 | `remove-responsible.int.test.ts` — após remoção, a linha persiste com `revokedAt`/`revokedBy` preenchidos. |
| U14-MN-03 | QUANDO quem não é responsável ATIVO tenta remover ENTÃO o sistema NÃO DEVE encerrar o vínculo. | Escalada de privilégio / remoção maliciosa (P-005). | T3 | `remove-responsible.int.test.ts` — não-responsável → `FORBIDDEN`, grant intacto. |
| U14-MN-04 | QUANDO o `RemoveResponsibleDialog`/seção de ativos é reestilizado ENTÃO o sistema NÃO DEVE reter paleta crua (`bg-red-*`, `text-gray-*`, `border-gray-*`) nem hex cru. | Smoke de que o DS substitui o ad-hoc (espelha DS-MN-03). | T1, T2 | `ds-empresa-remover-parity.test.ts`. |

> U14-MN-01..03 são prova de **preservação**; os testes de integração existentes (verdes) são os negativos.
> O restyle (T1/T2) toca só markup/classe.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| VPE-04 (upstream, canônico; AC-014-1) | USP-014 | Verified (entregue) | Preservado |
| VPE-05 (upstream, canônico; AC-014-2) | USP-014 | Verified (entregue) | Preservado |
| VPE-06 (upstream, canônico; AC-014-3) | USP-014 | Verified (entregue) | Preservado |
| U14-STYLE-01 (local) | P1 Restyle | Tasks | Pending |
| U14-MN-01..04 (local) | P1 | Tasks | Pending |

**ID format:** upstream `VPE-NN` canônico; local `U14-STYLE-NN` e must-nots `U14-MN-NN`.

**Coverage:** 8 itens (3 upstream preservados, 5 locais); 5 locais mapeados a tasks.

---

## Success Criteria

- [ ] `RemoveResponsibleDialog` e a seção de ativos usam primitivos/tokens do DS (incl. `Button variant="danger"`); paridade light/dark, overlay tokenizado.
- [ ] Nenhuma mudança de comportamento: invariante ≥1 ativo, append-only, `revokeReason`, permissão ATIVO, auto-remoção → redireciona — todos preservados.
- [ ] Todos os testes existentes da USP-014 permanecem verdes; deltas cobertos por RTL + guarda estática de paridade DS.
