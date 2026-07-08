# USP-009 — Cadastro de candidato (papel) — Specification

> **Issue:** [#31](https://github.com/DNACod3/asonseg-portal/issues/31) · **Épico:** #231 (Épico 2 — Cadastros Públicos) · **Prioridade:** P1 (Must)
> **Feature pai:** [`cadastros-publicos`](../spec.md) · **Origem (fonte da verdade a montante):** PRD `docs/prd/prd-asonseg-portal-mvp.md` USP-009 · **Spec ICE:** `docs/IDSD/ice-portal-asonseg/matriz-conexoes.md`
> **Fase 3 · Unidade U1 (refactor).** As ACs de comportamento (`CAD-01..CAD-05`) vêm verbatim do PRD/issue — IDs canônicos a montante, **não** reescritos aqui.

## Situação (2026-07-08): USP-009 JÁ IMPLEMENTADA — esta unidade é um REFACTOR ao Design System

USP-009 está **totalmente implementada e verde** em `src/modules/persons/` (schema `CandidateProfile`, domain, schemas Zod, Server Actions, adapter de moderação, UI) e na rota `(app)/candidato`. O que **falta** é a adoção do **Design System** extraído na Fase 1 (AD-014) e já aplicado às telas das Fases 1 e 2 (AD-015/AD-016). Esta unidade **refatora as telas de candidato ao DS**, exatamente no molde das unidades de refactor das Fases 1/2: **style-only** (markup/classes → primitivas de `@/shared/ui` + tokens), **preservando** todo o comportamento (RHF/Zod/Server Actions, gate LGPD, máquina de estados de moderação). Os testes verdes existentes são a **âncora de preservação** (testes negativos que devem continuar passando sem alteração).

> **Planejada "como se nova" para completude do spec** (ACs CAD-01..05 abaixo, contrato do PRD), mas o **design e as tasks têm como alvo um refactor que preserva comportamento** (ver [`design.md`](./design.md) / [`tasks.md`](./tasks.md)).

## Problem Statement

As telas de candidato (`(app)/candidato/page.tsx` e `persons/components/candidate-form.tsx`) foram escritas **antes** da fundação de Design System (AD-014) e usam classes Tailwind de paleta fixa cruas (`bg-blue-600`, `text-red-600`, `bg-amber-*`, `bg-gray-50`, `text-gray-900`…) e strings de classe locais (`inputClass`/`labelClass`/`errorClass`) em vez das primitivas `@/shared/ui` (`Input`, `Label`, `Textarea`, `Button`, `LgpdBox`) e dos tokens semânticos. Isso quebra a consistência visual (light/dark, foco, tipografia) já uniformizada nas Fases 1/2 e deixa a última tela de cadastro público do MVP fora do DS.

## Goals

- [ ] **G1 (refactor)** — Reestilizar `candidate-form.tsx` com as primitivas de `@/shared/ui` + `selectClass` por token (padrão `job-form.tsx`), **sem** classe de paleta fixa crua.
- [ ] **G2 (refactor)** — Reestilizar `(app)/candidato/page.tsx` ao padrão de tela de cadastro do DS (`StepIcon` + `FormHeader` + `FormCard` + caixa de erro por token), como `(app)/empresa/cadastrar`.
- [ ] **G3 (preservação)** — **Zero mudança de comportamento**: todas as suítes verdes de USP-009 (component/unit/integração/E2E) continuam passando **sem edição** (âncora negativa).
- [ ] **G4 (preservação semântica)** — Gate LGPD (submit bloqueado sem aceite) e transição de moderação **exclusivamente** via `transitionContent()` permanecem intactos — nenhuma alteração na semântica de consentimento/moderação.
- [ ] **G5 (consistência DS)** — Nenhuma utilidade Tailwind de paleta fixa (`{bg,text,border,ring,accent}-{gray,red,blue,amber,…}-NNN`) permanece nos dois arquivos reestilizados.

## Out of Scope

| Item | Razão |
|---|---|
| Alterar Server Actions / schemas / domain / adapter (`activate-candidate-role`, `submit-candidate-for-moderation`, `schemas/candidate`, `domain/candidate`, `adapters/prisma-candidate-profile-status`) | Já canônicos (`getCurrentPerson`/ADR-0030, `transitionContent`, `withAudit`, `ActionResult`, barrel). Refactor é **style-only**; backend não muda (ver design §"Sem mudança de backend"). |
| Extração de CV por IA (parsing, pré-preenchimento, upload) | USP-040 (`cv-extraction`). O ponto de integração/placeholder no form é **mantido como está**. |
| Aprovação pelo coordenador (fila, e-mail, visibilidade na busca) — AC CAD-04 | Módulo `moderation` (USP-016+) e notificações. Aqui só a **transição de saída** DRAFT→IN_MODERATION (já implementada). |
| Busca de candidatos por empresas / View Model para empregador | Épico `candidaturas-busca-candidatos` (USP-027/028). |
| Introduzir uma primitiva `Select` no DS | O DS não tem `Select` (só `Input`/`Textarea`); o padrão do projeto é `<select>` nativo estilizado por `selectClass` token (`job-form.tsx`). Manter o padrão; criar primitiva seria escopo de fundação (AD-014). |
| Novos campos, nova taxonomia, nova migração | Nada de dados muda; é restyle. |

---

## Assumptions & Open Questions

Modo autônomo (loop): ambiguidades resolvidas como **assumptions** com default + rationale. Nenhum item tem owner externo bloqueante → **Entry Gate aberto** (ver [tasks.md](./tasks.md) §0).

| Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|
| DS não tem token `warning`/`amber` para a caixa "perfil em rascunho" | agent | Caixa **neutra** de superfície (`border-border bg-background`, `text-fg`/`text-fg-muted`) com o botão de ação como `Button variant="primary"` (é `bg-cta`, laranja) | DS só expõe `primary/secondary/cta/success/danger`; caixa neutra + CTA preserva a afordância "rascunho → enviar" sem inventar token; espelha as sub-caixas informativas de `job-form.tsx` | y (default aplicado) |
| DS não tem token `info`/`blue` para a caixa `role="status"` "em moderação" | agent | Caixa tintada em **primary** via `color-mix(in srgb, var(--color-primary) 10%, transparent)` + `border-primary` + `text-primary` | `primary` já é azul (#2563eb); espelha o padrão de caixa de sucesso/erro tintada por `color-mix` de `job-form.tsx`; preserva o azul/informativo e o `role="status"` | y |
| Caixa de erro (`role="alert"`) do form e da página | agent | Caixa tintada em **danger** (`color-mix(... --color-danger 10% ...)` + `text-danger`), idêntica a `create-company-form.tsx`/`job-form.tsx` | Padrão de erro já canônico nas Fases 1/2 | y |
| Layout da página `(app)/candidato` | agent | Adotar `StepIcon` + `FormHeader` + `FormCard` (centralizado, `max-w-lg`), como `(app)/empresa/cadastrar/page.tsx` | Uniformiza com as outras telas de cadastro público; continua style-only (a página só faz `requireActivePerson` + carrega dados + renderiza o form) | y |
| Ícone do `StepIcon` da página | agent | Reusar um SVG inline do protótipo/DS (ex.: usuário/candidato); `variant="orange"` como as telas de cadastro | Coerência visual; sem dependência externa | y |
| Backend precisa de mudança de consistência? | agent | **Não.** Actions já usam `getCurrentPerson()` (ADR-0030), `transitionContent`, `withAudit`, `ActionResult`; o import direto de action `'use server'` no Client Component é o escape-hatch RSC já documentado (idêntico a `job-form.tsx`, AD-013/T-A1) | Evita risco de regressão; refactor fica 100% style-only | y |
| `CandidateForm.test.tsx` precisa mudar? | agent | **Não** — deve passar **inalterado** após o restyle (âncora negativa) | Se uma query quebrar (label/role/checkbox/status), é regressão de contrato-DOM a corrigir no componente, não no teste | y |

**Open questions:** none — todas resolvidas ou logadas acima.

---

## Requisitos & Acceptance Criteria

### ACs de comportamento (verbatim do PRD/issue #31 — IDs canônicos a montante; JÁ IMPLEMENTADAS, preservar)

| Req | AC (verbatim) | Status atual | Preservação nesta unidade |
|---|---|---|---|
| **CAD-01** | QUANDO a Pessoa submete o cadastro com escolaridade, área de interesse principal e telefone preenchidos ENTÃO o sistema DEVE ativar o papel de candidato com status "rascunho" (DRAFT) para o conteúdo do perfil/CV. | ✅ Implementada (verde) | Comportamento inalterado — âncora: `candidate-actions*.test`, `candidate-schema.test`, `CandidateForm.test`. |
| **CAD-02** | QUANDO a Pessoa anexa CV (PDF/DOC/DOCX até 5MB) ENTÃO o sistema DEVE invocar extração automática por IA e pré-preencher campos (ver USP-040). | 🟡 Parcial (placeholder) | Placeholder mantido como está (USP-040). |
| **CAD-03** | QUANDO o candidato envia o perfil para moderação ENTÃO o sistema DEVE alterar o status para "em moderação" (IN_MODERATION) e enfileirar para o coordenador — via `transitionContent()`. | ✅ Implementada (verde) | Inalterado — âncora: `candidate-actions*.test` (DRAFT→IN_MODERATION, INVALID_TRANSITION). |
| **CAD-04** | QUANDO o perfil é aprovado pelo coordenador ENTÃO o sistema DEVE ativar o candidato (visível na busca) e enviar e-mail. | 🔴 Fora (coordenador/e-mail) | Fora de escopo (USP-016/notificações). |
| **CAD-05** | QUANDO a Pessoa ativa o papel ENTÃO o sistema DEVE registrar consentimento LGPD ativo para `PORTAL_ACCESS` e `JOB_APPLICATION` (e `CV_AI_EXTRACTION` quando houver anexo). | ✅ Implementada (verde) | Gate de aceite preservado — âncora: `CandidateForm.test` (submit bloqueado sem aceite), `candidate-actions*.test` (CONSENT_REQUIRED). |

### Requisitos de refactor (locais desta unidade)

| Req | Requisito | Independent Test |
|---|---|---|
| **CAD-R1** | O `candidate-form.tsx` usa as primitivas `@/shared/ui` (`Input`/`Label`/`Textarea`/`Button`/`LgpdBox`) e `selectClass` por token; caixas de erro/status/rascunho por token — **sem** classe de paleta fixa. | `CandidateForm.test.tsx` verde inalterado + guard de tokens (CAD-MN-03). |
| **CAD-R2** | A página `(app)/candidato` usa `StepIcon`+`FormHeader`+`FormCard` e caixa de erro por token — sem paleta fixa. | Build/typecheck verde + E2E `candidato.spec.ts` verde + guard de tokens. |
| **CAD-R3** | Comportamento idêntico: todas as suítes de USP-009 passam sem edição. | Suítes component/unit/integração/E2E verdes sem diff nos testes. |

## Independent Test (do PRD)

Autenticar uma Pessoa, preencher escolaridade + área de interesse + telefone, aceitar o termo, submeter e verificar `CandidateProfile.publicationStatus = DRAFT`; enviar para moderação e verificar `IN_MODERATION`. Após o refactor, o **mesmo** teste passa **e** as telas renderizam com as primitivas do DS (verificação visual + guard de tokens). Coberto autoritativamente por `candidate-actions.int.test.ts` + `CandidateForm.test.tsx` (decisão de pirâmide em `e2e/candidato.spec.ts`).

## Módulos tocados

`persons` (só UI: `components/candidate-form.tsx` + rota `(app)/candidato/page.tsx`) · consome `@/shared/ui` (DS). **Não** toca `consents`/`moderation`/`audit`/`identity`/schema/actions.

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer neste refactor. Cada um exige teste negativo que assegura que o resultado proibido não ocorre (ver [validate.md] §6b). CAD-MN-01/02 são ancorados em suítes **verdes já existentes** (preservação); CAD-MN-03 é a prohibição nova específica do refactor DS.

| ID | QUANDO [contexto] ENTÃO o sistema NÃO DEVE… | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| **CAD-MN-01** | QUANDO o aceite do termo `JOB_APPLICATION` não está marcado (1ª ativação) ENTÃO o form NÃO DEVE habilitar/submeter o cadastro | Ativação de candidato sem consentimento LGPD (fracasso de resultado F2/CAD-05) | T1 | `CandidateForm.test.tsx` — "desabilita o envio até o aceite (CAD-05)" (verde, inalterado) |
| **CAD-MN-02** | QUANDO o perfil é enviado para moderação ENTÃO o sistema NÃO DEVE alterar `publicationStatus` por `prisma.update` direto ou qualquer via que não seja `transitionContent()` | Contornar a máquina de estados/auditoria de moderação (ADR-0011) | T1 (UI não introduz caminho de status) | `candidate-actions.test.ts` / `.int.test.ts` — DRAFT→IN_MODERATION via `transitionContent` + INVALID_TRANSITION (verde, inalterado) |
| **CAD-MN-03** | QUANDO as telas de candidato são reestilizadas ENTÃO elas NÃO DEVEM conter utilidades Tailwind de paleta fixa (`{bg,text,border,ring,accent,fill,stroke}-{gray,slate,zinc,neutral,stone,red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose}-NNN`) | Deriva do Design System (análogo a DS-MN-02 da AD-014) — perda da consistência light/dark por token | T1, T2 | T3 — guard estático `candidate-ds-tokens.guard.test.ts` (padrão `no-external-verify.test.ts`) |

---

## Requirement Traceability

| Requirement ID | Story/Origem | Phase | Status |
|---|---|---|---|
| CAD-01 | PRD USP-009 | Implementado | Verified (preservar) |
| CAD-02 | PRD USP-009 | USP-040 | Deferred |
| CAD-03 | PRD USP-009 | Implementado | Verified (preservar) |
| CAD-04 | PRD USP-009 | USP-016/notif. | Out of scope |
| CAD-05 | PRD USP-009 | Implementado | Verified (preservar) |
| CAD-R1 | Refactor DS (form) | Tasks (T1) | Pending |
| CAD-R2 | Refactor DS (página) | Tasks (T2) | Pending |
| CAD-R3 | Preservação | Tasks (T1–T3) | Pending |
| CAD-MN-01 | Must-not (LGPD) | Tasks (T1) | Pending |
| CAD-MN-02 | Must-not (moderação) | Tasks (T1) | Pending |
| CAD-MN-03 | Must-not (DS drift) | Tasks (T3) | Pending |

**ID format:** IDs de comportamento `CAD-NN` são canônicos do PRD a montante; must-nots `CAD-MN-NN`; requisitos de refactor locais `CAD-RN`.

**Coverage:** 11 total · 5 de refactor/must-not mapeados a T1–T3 · CAD-01/03/05 preservados por suítes existentes · CAD-02/04 fora.

---

## Success Criteria

- [ ] `candidate-form.tsx` e `(app)/candidato/page.tsx` reestilizados às primitivas `@/shared/ui` + tokens (paridade visual com as telas de cadastro das Fases 1/2).
- [ ] Guard `candidate-ds-tokens.guard.test.ts` verde (0 utilidades de paleta fixa nos 2 arquivos).
- [ ] Suítes de USP-009 (`candidate-schema.test`, `candidate-actions.test`, `candidate-actions.int.test`, `CandidateForm.test`, `e2e/candidato.spec`) **verdes sem edição**.
- [ ] `npm run typecheck` · `npm run lint` · `npm run build` verdes; sem regressão em nenhuma suíte.
