# Design — USP-014: Remover responsável (Refactor Fase 2 — DS)

**Spec**: `.specs/features/vinculos-pessoa-empresa/usp-014-remover-responsavel/spec.md`
**Status**: Draft

> **Adapter de design (não re-derivar).** Arquitetura já fixada e implementada. Fontes upstream:
> `.specs/features/vinculos-pessoa-empresa/design-usp-014.md`, `docs/arch/technical-design.md` §4.4/§4.5/§4.6,
> ADRs (ADR-0014, ADR-0020 outbox, ADR-0023 audit append-only, ADR-0030 revalidação por requisição), decisão
> **AD-008** (revokeReason + invariante). Design System: **AD-014** + **AD-015** (restyle style-only). Só
> especifica os **deltas de UI**.

## 0. Estado atual (ground truth)

| Peça | Arquivo | Estado |
| --- | --- | --- |
| Action `removerResponsavel` | `src/modules/companies/actions/remove-responsible.ts` | ✅ Zod → sessão → carrega grant → permissão ATIVO (P-005) → invariante `wouldLeaveCompanyWithoutResponsible` (AC-014-2) → `withAudit(COMPANY_RESPONSIBLE_REMOVED)`: `updateMany` set `revokedAt`/`revokedBy`/`revokeReason` (append-only) + outbox `responsible-removed` + justificativa. Retorna `{selfRemoved}`. |
| Regra pura | `src/modules/companies/domain/grants.ts` | ✅ `wouldLeaveCompanyWithoutResponsible(activeGrantIds, grantId)`. |
| Query | `src/modules/companies/queries/list-active-responsibles.ts` | ✅ `select` explícito, `isSelf`. |
| Dialog | `src/modules/companies/components/remove-responsible-dialog.tsx` | ⚠️ Modal hand-rolled (`fixed inset-0 bg-black/40`), `bg-red-600`, `border-gray-300`, `text-gray-*`. Tem `edit-company-form`-style Esc handler. |
| Página (seção ativos) | `src/app/(app)/empresa/[empresaId]/responsaveis/page.tsx` | ⚠️ Lista `divide-gray-200 border-gray-200`, `text-gray-*`. |

## 1. Deltas de refactor (o trabalho desta USP)

### D1 — Restyle `RemoveResponsibleDialog` (style-only)
- Gatilho "Remover" (`border-red-300 text-red-700`) → `<Button variant="danger" size="sm">` (ou `outline` com
  cor destrutiva tokenizada, conforme paridade — a variante `danger` foi adicionada ao DS na Fase 1/AD-015).
- Botão "Confirmar remoção" (`bg-red-600`) → `<Button variant="danger">`; "Cancelar" (`border-gray-300`) → `<Button variant="outline">`.
- Campo motivo: `<label>`+`<textarea className={inputClass}>` → `<Label>`+`<Textarea>`.
- Superfície do modal (`bg-white shadow-xl`) → `bg-surface`/`text-fg`/`border-border`; overlay `bg-black/40`
  mantém-se (é neutro, funciona em ambos os temas) ou tokeniza para `bg-fg/40` conforme paridade.
- Caixa de erro (`bg-red-50 text-red-700`) → tokens danger.
**Preservar:** `useForm`/`zodResolver(removeResponsibleSchema)`, `open` state, Esc handler, `removerResponsavel`,
tratamento de `selfRemoved` (`router.push('/empresa')`) e erros, `isSelf`/`nome` na cópia.

### D2 — Restyle da seção "Responsáveis ativos" (página, style-only)
`<ul className="divide-gray-200 border-gray-200">` → tokens (`divide-border`, `border-border`); `text-gray-800`
→ `text-fg`; "(você)" → `text-fg-muted`. **Preservar:** `listActiveResponsibles`, composição do
`RemoveResponsibleDialog`, gate de rota.

> Coordenação USP-013: o **shell + área de adição** da página são da USP-013; aqui só a **seção de ativos**.

## 2. Contratos preservados (referência — nada a alterar)

`removerResponsavel({grantId, motivo?}) → ActionResult<{selfRemoved}>`. Evento `COMPANY_RESPONSIBLE_REMOVED`
(audit, já catalogado). Invariante via regra pura. Append-only (`revokedAt`). Outbox `responsible-removed`.

## 3. Code Reuse Analysis

| Component | Location | How to Use |
| --- | --- | --- |
| `Button` (danger/outline), `Label`, `Textarea` | `@/shared/ui` | Substituem os botões/campos crus. |
| Padrão de modal (referência) | `edit-company-form.tsx` (dialog hand-rolled irmão) | Mesmo shell — restilizar de forma consistente (ou extrair primitivo, opcional). |
| Guarda estática | `no-external-verify.test.ts` | Molde. |

## 4. Error Handling Strategy (preservado)

| Cenário | Tratamento | Usuário vê |
| --- | --- | --- |
| Último responsável ativo | `PRECONDITION_FAILED` | "Designe outro responsável antes…" |
| Não-responsável | `FORBIDDEN` | Caixa de erro |
| Grant já revogado | `NOT_FOUND` | Mensagem de idempotência |
| Auto-remoção | `{selfRemoved:true}` | Redireciona (perde acesso) |

## 5. Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| Redirect `/empresa` órfão em auto-remoção | `remove-responsible-dialog.tsx:67` | 404 após auto-remoção | Risco herdado; fora do mandato de restyle criar a listagem. Preservar; opcionalmente apontar para rota existente. |
| Dois modais hand-rolled irmãos (remove + edit) | `remove-responsible-dialog.tsx`, `edit-company-form.tsx` | Duplicação de shell de modal | Default: restilizar consistente. Opção: extrair `Dialog` para `shared/ui` (com tokens + teste) — decisão do Implementer. |
| Página compartilhada com USP-013 | `responsaveis/page.tsx` | Conflito de edição | Partição por seção + coordenação de branch. |

## 6. Tech Decisions

| Decisão | Escolha | Justificativa |
| --- | --- | --- |
| Modal | Restilizar in-place com tokens + `Button danger` | Style-only; risco mínimo. Extrair primitivo é opcional. |
| Cor destrutiva | `Button variant="danger"` (token `bg-danger`) | Comunica ação destrutiva; já no DS (AD-015). |
| Teste de página | Nenhum | Padrão do repo/AD-015 (gate de build). |

> Nenhuma decisão nova de nível-projeto (conforma AD-014/AD-015 e ADRs existentes).
