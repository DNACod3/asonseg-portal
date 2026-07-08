# Design — USP-013: Adicionar responsável (Refactor Fase 2 — DS)

**Spec**: `.specs/features/vinculos-pessoa-empresa/usp-013-adicionar-responsavel/spec.md`
**Status**: Draft

> **Adapter de design (não re-derivar).** A arquitetura da USP-013 já está fixada e implementada. Fontes da
> verdade upstream: `.specs/features/vinculos-pessoa-empresa/design.md` (adapter ICE da USP-013),
> `docs/arch/technical-design.md` §4.4/§4.5/§4.6, ADRs (ADR-0014, ADR-0020 atomicidade/outbox, ADR-0021 UNIQUE+409,
> ADR-0022 visibilidade/resposta binária, ADR-0029 rate limit, ADR-0030 revalidação por requisição), decisões
> **AD-006** (pendente+aceite) e **AD-007** (outbox). Design System: **AD-014** + **AD-015** (restyle style-only).
> Este documento só especifica **os deltas de refactor** de UI.

## 0. Estado atual (ground truth)

| Peça | Arquivo | Estado |
| --- | --- | --- |
| Action `adicionarResponsavel` | `src/modules/companies/actions/add-responsible.ts` | ✅ Zod → sessão → permissão ATIVO (P-005) → rate limit (L-002) → busca binária sem PII (P-001) → pré-condições (E-002/CONFLICT) → `withAudit(COMPANY_RESPONSIBLE_ADDED)`: grant `PENDING` + outbox `responsible-link-pending`; guarda P2002. |
| Action `aceitarVinculoResponsavel` | `src/modules/companies/actions/accept-responsible-link.ts` | ✅ Aceite pela sessão → `ACTIVE` + papel + consent finalidade 5 (P-003). |
| Form adição | `src/modules/companies/components/add-responsible-form.tsx` | ⚠️ Tailwind solto; single-step (SPEC_DEVIATION Level-1 documentada); sucesso/erro neutros. |
| Lista de pendentes | `src/modules/companies/components/pending-responsible-links-list.tsx` | ⚠️ Tailwind solto (`bg-blue-600`, `border-gray-200`, `text-gray-*`). |
| Página responsáveis | `src/app/(app)/empresa/[empresaId]/responsaveis/page.tsx` | ⚠️ Tailwind solto; renderiza header + lista de ativos (USP-014) + `AddResponsibleForm`. Gate `requireActivePerson` + 404. |
| Página aceite | `src/app/(app)/empresa/aceitar-vinculo/page.tsx` | ⚠️ Tailwind solto; gate `requireActivePerson` (redireciona a login se sem sessão). |

## 1. Deltas de refactor (o trabalho desta USP)

### D1 — Restyle `AddResponsibleForm` (style-only)
Mapeamento: `inputClass`/`labelClass`/`errorClass` → `Input`/`Label` + token danger; `<button bg-blue-600>` →
`<Button variant="primary" size="sm">`; caixa de sucesso (`bg-green-50…`) → caixa `role="status"` com tokens;
caixa de erro (`bg-red-50…`) → tokens danger. Título/descrição com `text-fg`/`text-fg-muted`.
**Preservar:** `useForm`/`zodResolver(formSchema)`, `adicionarResponsavel`, `reset`, mensagens **neutras** (o
sucesso NÃO exibe nome do alvo — P-001), single-step.

### D2 — Restyle `PendingResponsibleLinksList` (style-only)
`<li ...border-gray-200 bg-white shadow-sm>` → `Card`; `<button bg-blue-600>` → `<Button variant="primary" size="sm">`;
estado vazio (`bg-gray-50`) → superfície tokenizada; textos com `text-fg`/`text-fg-muted`; erro com `text-danger`.
**Preservar:** `aceitarVinculoResponsavel`, filtro otimista `setLinks`, `doneCount`, `pendingId`.

### D3 — Restyle páginas (style-only, seção USP-013)
- `responsaveis/page.tsx`: shell (header `FormHeader`/tokens) + área do `AddResponsibleForm`. **A seção "Responsáveis
  ativos" + `RemoveResponsibleDialog` é restilizada pela USP-014** (coordenação — spec Assumptions).
- `aceitar-vinculo/page.tsx`: `FormHeader` + tokens.
**Preservar:** gates de rota (`requireActivePerson`, `notFound()`), `force-dynamic`, queries.

## 2. Contratos preservados (referência — nada a alterar)

`adicionarResponsavel({empresaId,cpfOuEmail}) → ActionResult<{status:'PENDING'}>`;
`aceitarVinculoResponsavel({empresaId}) → ActionResult`. Eventos `COMPANY_RESPONSIBLE_ADDED` /
`COMPANY_RESPONSIBLE_LINK_ACCEPTED` (audit). Outbox `responsible-link-pending`. UNIQUE parcial
`(person_id, company_id) WHERE revoked_at IS NULL`.

## 3. Code Reuse Analysis

| Component | Location | How to Use |
| --- | --- | --- |
| Primitivos DS | `@/shared/ui` (`Input`/`Label`/`Button`/`Card`/`FormHeader`) | Substituem markup cru. |
| Padrão de restyle de form + caixa de erro | `LoginForm.tsx` (Fase 1) | Modelo de danger-token. |
| Guarda estática de paridade | `no-external-verify.test.ts` | Molde de teste que lê fonte. |

## 4. Error Handling Strategy (preservado)

| Cenário | Tratamento | Usuário vê |
| --- | --- | --- |
| Não-responsável | `FORBIDDEN` | Caixa de erro |
| Pessoa não cadastrada | `NOT_FOUND` | Orientação de auto-cadastro |
| Duplicidade | `CONFLICT`/`409` | "já é responsável / convite pendente" |
| Rate limit | `PRECONDITION_FAILED` | "aguarde alguns instantes" |
| Aceite inválido | erro da action | mensagem por item |

## 5. Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| Página `responsaveis` compartilhada com USP-014 | `responsaveis/page.tsx` | Conflito de edição entre USPs | Partição de seções (D3) + coordenação na branch da fase (spec Assumptions). |
| Regressão de privacidade no restyle | `add-responsible-form.tsx` | Vazar PII na mensagem de sucesso | RTL trava sucesso neutro (U13-MN-01); backend não retorna PII. |
| Single-step vs. design de dois passos | `add-responsible-form.tsx` | Divergência de UX vs. design | Preservado (mais privado); SPEC_DEVIATION já documentada. |

## 6. Tech Decisions

| Decisão | Escolha | Justificativa |
| --- | --- | --- |
| Busca | Manter single-step | Estritamente mais privado (P-001); não re-introduzir etapa com nome. |
| Partição da página compartilhada | USP-013 = shell + adição; USP-014 = lista + dialog | Cada USP dona da sua seção; evita conflito. |
| Teste de página | Nenhum | Padrão do repo/AD-015 (gate de build). |

> Nenhuma decisão nova de nível-projeto (conforma AD-014/AD-015 e ADRs existentes).
