# Design — USP-015: Editar dados da Empresa (Refactor Fase 2 — DS)

**Spec**: `.specs/features/vinculos-pessoa-empresa/usp-015-editar-empresa/spec.md`
**Status**: Draft

> **Adapter de design (não re-derivar).** Arquitetura já fixada e implementada. Fontes upstream:
> `.specs/features/vinculos-pessoa-empresa/design-usp-015.md`, `docs/arch/technical-design.md` §4.4/§4.5/§4.6,
> ADRs (ADR-0020 atomicidade, ADR-0021 CNPJ único no UPDATE, ADR-0023 audit append-only, ADR-0024 re-verificação
> só de identitários, ADR-0030 revalidação por requisição). Design System: **AD-014** + **AD-015** (restyle
> style-only). Só especifica os **deltas de UI**.

## 0. Estado atual (ground truth)

| Peça | Arquivo | Estado |
| --- | --- | --- |
| Action `editarEmpresa` | `src/modules/companies/actions/edit-company.ts` | ✅ Zod → sessão → carrega `before` (`NOT_FOUND`) → permissão ATIVO (P-004/`FORBIDDEN`) → CNPJ único no UPDATE (P-005/`CONFLICT`) → `withAudit(COMPANY_UPDATED)`: `update` com `isVerified:false` **sse** `identityFieldsChanged && before.isVerified` (mesma tx, P-001) + audit `before`/`after`; guarda P2002. |
| Regra pura | `src/modules/companies/domain/company-edit.ts` | ✅ `identityFieldsChanged(before, after)` (cnpj/razaoSocial/nomeFantasia). |
| Schema | `src/modules/companies/schemas/edit-company.schema.ts` | ✅ Reusa validadores do create; `empresaId` uuid; `isVerified` não é campo de entrada. |
| Form | `src/modules/companies/components/edit-company-form.tsx` | ⚠️ Tailwind solto; diálogo de re-verificação hand-rolled (`fixed inset-0 bg-black/40`, `bg-blue-600`). |
| Página | `src/app/(app)/empresa/[empresaId]/editar/page.tsx` | ⚠️ Tailwind solto; gate `requireActivePerson` + 404 + carga dos dados. Tem `page.test.tsx`. |

## 1. Deltas de refactor (o trabalho desta USP)

### D1 — Restyle `EditCompanyForm` (style-only)
- `inputClass`/`labelClass`/`errorClass` → `Input`/`Label`/`Textarea` + token danger.
- Botão "Salvar alterações" (`bg-blue-600`) → `<Button variant="primary">`.
- Caixas sucesso/erro → tokens (padrão `LoginForm`).
- **Diálogo de re-verificação** (D-015-E): superfície `bg-white shadow-xl` → `bg-surface`/`text-fg`/`border-border`;
  "Cancelar" (`border-gray-300`) → `<Button variant="outline">`; "Confirmar e salvar" (`bg-blue-600`) → `<Button variant="primary">`;
  overlay tokenizado.
**Preservar (crítico):** `useForm`/`zodResolver(editCompanySchema)`, `defaultValues` pré-preenchidos, campo oculto
`empresaId`, `useEffect` do Esc, a lógica `onSubmit` que chama `identityFieldsChanged(...)` e só abre o diálogo
quando `changed && empresa.isVerified`, `submit` → `editarEmpresa`, `router.refresh`, tratamento de erros. **O
cliente decide só se pede confirmação; o servidor decide o rebaixamento.**

### D2 — Restyle da página `editar` (style-only)
Header → `FormHeader`/tokens; textos `text-gray-*` → `text-fg`/`text-fg-muted`. **Preservar:** gate de rota,
carga de dados, `force-dynamic`, e o `page.test.tsx` existente verde.

## 2. Contratos preservados (referência — nada a alterar)

`editarEmpresa(input) → ActionResult<{companyId, isVerified, downgraded}>`. Evento `COMPANY_UPDATED` (audit,
já catalogado). Rebaixamento atômico (ADR-0020/0024). CNPJ único no UPDATE (ADR-0021). Sem e-mail.

## 3. Code Reuse Analysis

| Component | Location | How to Use |
| --- | --- | --- |
| `Input`/`Label`/`Textarea`/`Button` | `@/shared/ui` | Substituem markup cru. |
| Padrão de restyle de form + caixa de erro | `LoginForm.tsx`/`RegisterPersonForm.tsx` | Modelo danger-token. |
| Padrão de diálogo (irmão) | `remove-responsible-dialog.tsx` (USP-014, restilizado) | Consistência do modal. |
| Guarda estática | `no-external-verify.test.ts` | Molde. |

## 4. Error Handling Strategy (preservado)

| Cenário | Tratamento | Usuário vê |
| --- | --- | --- |
| Empresa inexistente | `NOT_FOUND` | Caixa de erro |
| Não-responsável | `FORBIDDEN` | Caixa de erro |
| CNPJ de outra Empresa | `CONFLICT` | "já cadastrado em outra Empresa" |
| Mudança identitária (verificada) | diálogo client + `downgraded:true` server | Aviso de re-verificação → sucesso |

## 5. Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| Diálogo hand-rolled irmão do da USP-014 | `edit-company-form.tsx` | Duplicação de shell de modal | Default: restilizar consistente com a USP-014. Opção: extrair `Dialog` para `shared/ui` (com tokens + teste). |
| Regressão da fronteira client/server no rebaixamento | `edit-company-form.tsx:93-113` | Cliente "decidir" o rebaixamento | Preservar a lógica: cliente só pede confirmação; U15-MN-01 tem caso de bypass server-side. |

## 6. Tech Decisions

| Decisão | Escolha | Justificativa |
| --- | --- | --- |
| Diálogo | Restilizar in-place com tokens + `Button` | Style-only; risco mínimo; consistente com USP-014. |
| Fronteira do rebaixamento | Servidor decide; cliente só avisa | Segurança não depende do cliente (D-015-C/D-015-E preservados). |
| Teste de página | Preservar `page.test.tsx` existente; sem novos | Padrão do repo/AD-015. |

> Nenhuma decisão nova de nível-projeto (conforma AD-014/AD-015 e ADRs existentes).
