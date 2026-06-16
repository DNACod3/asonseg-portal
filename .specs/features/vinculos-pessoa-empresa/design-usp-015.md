# Design — USP-015: Editar dados da Empresa

> **ICE Design-adapter.** Não re-deriva arquitetura: resolve os ponteiros do card da matriz
> (`docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` → USP-015). Fonte da verdade:
> `technical-design.md` §4.4/§4.5/§4.6 + ADRs + runbooks + spec.md (AC-015-1..2 + edges) +
> `intents/intent-USP-015.md` + `expectations/expectations-USP-015.md` (E-001..003, P-001..005).

## 0. Card resolvido (entrada única)

| Ponteiro do card | Resolve para |
|---|---|
| **Schemas** | `companies` (TD §4.5) → no código `Company`. Edição **rebaixa `isVerified=false` na mesma transação** quando muda campo identitário. `audit_log` (before/após). **Sem nova coluna** (ver D-015-A). |
| **Endpoints** | `companies.editarEmpresa` (TD §4.4) |
| **Eventos** | `COMPANY_UPDATED` (audit, **já catalogado** — `audit/events.ts:50`) (TD §4.6) |
| **ADRs técnicos** | ADR-0020 (edição+rebaixamento atômicos), ADR-0021 (CNPJ único em UPDATE), ADR-0023 (log append-only), ADR-0024 (re-verificação na próxima vaga — só campos identitários) |
| **Runbooks** | runbook-server-action, runbook-audit-log |
| **Fase** | Fase 2 (TD §5) |
| **Gate** | — (sem Q-aberta no card; F2/F3 do intent ✅ RESOLVIDOS pelo dono). |
| **Risco** | RP-005 (vetor pós-verificação): P-001 garante rebaixamento na mesma transação. |

## 1. Decisões de design (divergências resolvidas)

**D-015-A — E-003 ("marcar campos alterados desde a verificação") NÃO cria coluna nova.**
O intent (F2 ✅ RESOLVIDO) é explícito: *"Impacto técnico: nenhum — `content_transitions` já registra o
histórico"*; e a auditoria `COMPANY_UPDATED` guarda `before`/`after` (L-002). A tela do moderador na USP-017
deriva "o que mudou desde a verificação" **lendo o histórico de auditoria**, não de um snapshot redundante no
`Company`. **Resolução:** USP-015 não adiciona coluna `changedSinceVerification`. O par before/after do
`audit_log` é a fonte; o destaque visual no moderador é entregável da **USP-017** (downstream), fora do escopo
desta US. Mantém o card (que não aponta schema novo) e evita fabricação.

**D-015-B — Campos identitários = exatamente `cnpj`, `razaoSocial`, `nomeFantasia`.**
AC-015-2 / E-002 / ADR-0024 limitam o rebaixamento a esses três. `type`, `setor`, `descricao`, `endereco`
**não** rebaixam (intent F3 ✅ RESOLVIDO: editar descrição/contato não rebaixa — só re-modera o conteúdo, o que
é responsabilidade de outra US). **Resolução:** regra pura `identityFieldsChanged(before, after): boolean`
em `domain/company-edit.ts` (sem IO), comparando os três campos. A action a aplica para decidir o rebaixamento.

**D-015-C — Rebaixamento na MESMA transação (P-001, blindagem de RP-005).**
Não existe rota administrativa que edite identitário sem rebaixar. **Resolução:** dentro de
`withAudit(COMPANY_UPDATED)`, o `tx.company.update` aplica `isVerified: false` **sse e só se**
`identityFieldsChanged` for verdadeiro (e a empresa estava `isVerified=true` — idempotente se já era false).
Uma só escrita atômica: edição + rebaixamento. Teste de bypass (D-003) cobre a chamada direta à action.

**D-015-D — CNPJ único preservado no UPDATE (P-005 / ADR-0021).**
A `@unique` em `companies.cnpj` cobre o UPDATE no banco. **Resolução:** pré-checagem
`findUnique({ cnpj })` excluindo a própria Empresa → `CONFLICT` se pertencer a outra; guarda de concorrência
no `catch` (P2002 em `companies_cnpj_key`), espelhando `create-company.ts:156-163`.

**D-015-E — Aviso explícito ANTES da confirmação (E-002, proteção a F2 — mudança consciente).**
O cliente detecta alteração nos campos identitários (compara valores originais × editados) e, **antes** de
submeter, exibe diálogo de confirmação: *"Esta alteração exigirá nova verificação manual na próxima vaga
publicada."* O servidor permanece a fonte da verdade do rebaixamento (cliente não decide nada de segurança).

**D-015-F — Permissão (P-004): só responsável ATIVO edita.**
Mesmo predicado de `add-responsible.ts:60-72` (grant `RESPONSIBLE`+`ACTIVE`+`revokedAt=null`). Defesa em
profundidade: a rota `/empresa/[empresaId]/editar` faz 404 para não-responsável; a action reconfirma → `FORBIDDEN`.

## 2. Contrato (TD §4.4) — `companies.editarEmpresa`

`editarEmpresa({ empresaId, cnpj, type, razaoSocial, nomeFantasia, setor, descricao?, endereco? })`
— `companies/actions/edit-company.ts`. Sequência canônica (runbook-server-action):
1. **Zod**: `editCompanySchema` reusa os validadores de campo de `createCompanySchema` (normalização/dígitos do
   CNPJ, trims) + `empresaId: uuid`. `isVerified` **não** é campo de entrada (controlado pelo sistema).
2. **getCurrentPerson()** (ADR-0030). Sem sessão → `UNAUTHENTICATED`.
3. **Carregar Empresa alvo** (`before`): existe? Senão `NOT_FOUND`. Resolver estado atual (incl. `isVerified`).
4. **requirePermission (P-004)**: ator é responsável `ACTIVE`+`revokedAt=null` da `empresaId`. Senão `FORBIDDEN`.
5. **Pré-condição CNPJ único (P-005)**: se `cnpj` mudou, `findUnique` em outra Empresa → `CONFLICT`.
6. **withAudit(`COMPANY_UPDATED`)** em transação (ADR-0020/0023):
   - `downgrade = identityFieldsChanged(before, after)` (regra pura, D-015-B).
   - `tx.company.update({ where:{id}, data:{ ...campos, ...(downgrade ? { isVerified:false } : {}) } })`.
   - `audit.entityType='company'`, `audit.entityId=empresaId`, `audit.before={campos+isVerified}`,
     `audit.after={campos+isVerified}` (par completo → E-003/D-004).
   - `catch` P2002 `companies_cnpj_key` → `CONFLICT` (guarda de concorrência, D-015-D).
7. Retorno `ActionResult<{ companyId, isVerified, downgraded }>`. Nunca `throw`; nunca model cru.

## 3. Eventos (TD §4.6)
- **Audit**: `COMPANY_UPDATED` — já no catálogo (`audit/events.ts:50`). Nada a criar.
- **Outbox/e-mail**: **nenhum** (o card não aponta evento de e-mail; edição não notifica). Não fabricar.

## 4. UI (sub-issue #142)
Nova rota `(app)/empresa/[empresaId]/editar/page.tsx` (gate: responsável `ACTIVE` → 404, molde de
`responsaveis/page.tsx`), carregando os dados atuais da Empresa para pré-preencher.
- **`EditCompanyForm`** (client, RHF+Zod, molde de `create-company-form.tsx`): campos editáveis;
  detecta mudança em campo identitário e, no submit, abre **diálogo de confirmação** com o aviso de
  re-verificação (D-015-E) antes de chamar `editarEmpresa`. Toast de sucesso/erro; trata `FORBIDDEN`/`CONFLICT`.

## 5. Reuso (anti-fabricação)
| Precisa | Reutilizar de |
|---|---|
| Sequência de Server Action sensível + `withAudit` | `companies/actions/create-company.ts` (USP-012) |
| Validadores de campo (CNPJ, trims, `type`) | `schemas/create-company.schema.ts` |
| Guarda P2002 `companies_cnpj_key` → `CONFLICT` | `create-company.ts:156-163` |
| Predicado "responsável ATIVO" (P-004) | `add-responsible.ts:60-72` |
| Evento `COMPANY_UPDATED` | `@/modules/audit` (já catalogado) |
| Gate de rota (responsável ativo → 404) | `(app)/empresa/[empresaId]/responsaveis/page.tsx` |
| Form client + Server Action + toast | `components/create-company-form.tsx` |
