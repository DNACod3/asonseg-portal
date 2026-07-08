# Design — USP-012: Cadastro de Empresa (Refactor Fase 2 — DS + wiring)

**Spec**: `.specs/features/cadastros-publicos/usp-012-cadastro-empresa/spec.md`
**Status**: Draft

> **Adapter de design (não re-derivar).** A arquitetura da USP-012 já está fixada e implementada. Fontes da
> verdade upstream: `.specs/features/cadastros-publicos/spec.md` (CAD-11..15), `docs/arch/technical-design.md`
> §4.4/§4.5/§4.6, ADRs (ADR-0014 Empresa sem login/N:N, ADR-0020 atomicidade, ADR-0021 CNPJ único, ADR-0023
> audit append-only, ADR-0024 verificação na 1ª vaga, ADR-0030 revalidação por requisição). Design System:
> **AD-014** (`.specs/features/fundacao-ui-design-system/`, `src/shared/ui/`) + **AD-015** (restyle style-only).
> Este documento só especifica **os deltas de refactor** sobre o código existente.

## 0. Estado atual (ground truth)

| Peça | Arquivo | Estado |
| --- | --- | --- |
| Action `createCompany` | `src/modules/companies/actions/create-company.ts` | ✅ Completa. Zod → `getCurrentPerson` → `requireActiveConsent('PORTAL_ACCESS')` → `loadTerm` + checagem de hash → CNPJ único → `withAudit(COMPANY_CREATED)` atômico: `Company{isVerified:false}` + grant `RESPONSIBLE`/`ACTIVE` + `Consent{COMPANY_REPRESENTATION}`; guarda P2002. |
| Domínio CNPJ | `src/modules/companies/domain/cnpj.ts` | ✅ `normalizeCnpj`/`isValidCnpj`/`formatCnpj`/`isCnpjUniqueViolation`. |
| Schema | `src/modules/companies/schemas/create-company.schema.ts` | ✅ Normaliza/valida dígitos; limites de campo. |
| Form | `src/modules/companies/components/create-company-form.tsx` | ⚠️ Tailwind solto (`inputClass`/`labelClass`/`errorClass`, `bg-blue-600`, term box cru). Redireciona a `/empresa/${companyId}` (rota inexistente). |
| **Rota** | `src/app/(app)/empresa/cadastrar/page.tsx` | ❌ **Não existe.** Nenhuma página renderiza o form. |

## 1. Deltas de refactor (o trabalho desta USP)

### D1 — Restyle `CreateCompanyForm` (style-only)
Trocar as constantes locais e a marcação crua pelos primitivos do DS. Mapeamento verbatim:

| Antes (cru) | Depois (DS / token) |
| --- | --- |
| `<label className={labelClass}>` | `<Label htmlFor=…>` |
| `<input className={inputClass}>` | `<Input …register()>` |
| `<textarea className={inputClass}>` | `<Textarea …register()>` |
| `<button className="…bg-blue-600…">` | `<Button type="submit" disabled=…>` (variant `primary`) |
| `<p className={errorClass}>` (erro de campo) | `<p className="mt-1 text-sm text-danger">` (token) |
| Caixa de erro de servidor (`bg-red-50 border-red-200 text-red-700`) | caixa `role="alert"` com tokens (`border-danger`/`text-danger`), padrão `LoginForm` |
| Caixa do termo (`bg-gray-50 border-gray-200`) | `LgpdBox title="Termo de representação empresarial"` (corpo rolável dentro; checkbox afirmativo com `accent-primary`) |
| Radios `type/MEI` | mesma semântica; label/estado com tokens (`text-fg`, `accent-primary`) |

**Preservar (não tocar):** `useForm`/`zodResolver(createCompanySchema)`, `defaultValues` (incl. version/hash do
termo), `consentChecked` state + gate `disabled={isPending || !consentChecked}`, campos ocultos
`companyRepresentationTermVersion`/`Hash`, `useTransition`, chamada `createCompany`. **Ajuste pontual
(comportamento adjacente):** trocar o alvo do redirect de `/empresa/${companyId}` → `/empresa/${companyId}/responsaveis`
(rota existente) — documentado como decisão (evita 404 pós-cadastro).

### D2 — Nova rota `(app)/empresa/cadastrar/page.tsx` (Server Component, `force-dynamic`)
Molde: `src/app/(app)/empresa/[empresaId]/responsaveis/page.tsx` (gate `requireActivePerson`) + carga de termo
como em `src/app/(auth)/cadastro/consentimento/page.tsx` (uso de `loadTerm`). Responsabilidades:
1. `requireActivePerson()` (redireciona a login se sem sessão — AC-2).
2. `loadTerm('COMPANY_REPRESENTATION', <versão corrente>)` server-side → `{ version, contentHash, body }`.
3. Compor `FormHeader` + `StepIcon` (variante azul, ícone de prédio/empresa do protótipo) + `FormCard`
   envolvendo `<CreateCompanyForm term={…} />`.

> A action `createCompany` já valida o hash server-side (U12-MN-02); a página só entrega o termo íntegro
> pré-carregado. A identidade da versão corrente do termo segue o padrão já usado por `loadTerm` no repo.

## 2. Contratos preservados (referência — nada a alterar)

`createCompany(input) → ActionResult<{ companyId, cnpj, razaoSocial }>`. Sequência e invariantes em
`create-company.ts` (ADR-0020 atomicidade; ADR-0021 CNPJ único; ADR-0024 `isVerified=false`). Eventos:
`COMPANY_CREATED` (audit, já catalogado). Consent: `COMPANY_REPRESENTATION` (finalidade 5) + pré-condição
`PORTAL_ACCESS`.

## 3. Code Reuse Analysis

| Component | Location | How to Use |
| --- | --- | --- |
| Primitivos DS | `@/shared/ui` (`Input`/`Label`/`Textarea`/`Button`/`FormCard`/`FormHeader`/`StepIcon`/`LgpdBox`) | Import via barrel; substituem markup cru. |
| Padrão de restyle de form | `src/modules/identity/components/LoginForm.tsx` + `RegisterPersonForm.tsx` (Fase 1) | Modelo de caixa de erro/danger-token e composição. |
| Gate de rota autenticada | `(app)/empresa/[empresaId]/responsaveis/page.tsx` | Molde de `requireActivePerson` + `force-dynamic`. |
| Carga de termo server-side | `(auth)/cadastro/consentimento/page.tsx` (`loadTerm`) | Molde para pré-carregar `COMPANY_REPRESENTATION`. |

## 4. Error Handling Strategy (preservado)

| Cenário | Tratamento | Usuário vê |
| --- | --- | --- |
| CNPJ inválido | Zod / `isValidCnpj` | Erro de campo (token danger) |
| CNPJ duplicado | `CONFLICT` (pré-check + P2002) | Caixa de erro com orientação |
| Hash do termo divergente | `VALIDATION` | "Recarregue a página" |
| `PORTAL_ACCESS` ausente | `CONSENT_REQUIRED` | Mensagem de consentimento |
| Sessão expirada | `UNAUTHENTICATED` | Redireciona/mensagem |

## 5. Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| Redirect órfão pós-cadastro | `create-company-form.tsx:60` (`/empresa/${companyId}`) | 404 imediato ao concluir o cadastro | D1 aponta para `/empresa/${companyId}/responsaveis` (existe). |
| Redirect órfão `/empresa` (listagem) | `remove-responsible-dialog.tsx:67` | Auto-remoção leva a 404 | Fora do escopo da USP-012; documentado como risco/Deferred (é da USP-014 e/ou de um futuro dashboard). |
| Form órfão (sem rota) | `create-company-form.tsx` só no barrel | USP-012 não exercível | D2 cria a rota. |
| Consent single-step vs. split da Fase 1 | `create-company-form.tsx` (checkbox) | Divergência de padrão de consentimento | Decisão documentada: single-step é apropriado ao cadastro de Empresa (uma etapa); garantia LGPD via hash server-side. |

## 6. Tech Decisions

| Decisão | Escolha | Justificativa |
| --- | --- | --- |
| Consentimento na USP-012 | Checkbox afirmativo single-step dentro do `LgpdBox` (não o split da USP-043) | Cadastro de Empresa é uma única transação; o servidor valida versão+hash (aceite versionado íntegro). Divergência consciente vs. AD-015, documentada. |
| Alvo do redirect de sucesso | `/empresa/${companyId}/responsaveis` | Rota existente; leva o novo responsável à gestão da Empresa. Evita 404. |
| Teste de página | Nenhum (`page.test.tsx`) | Padrão do repo/AD-015 para restyle de Server Component: gate de build. |

> Nenhuma decisão aqui é de nível-projeto nova (todas conformam a AD-014/AD-015 e às ADRs existentes).
