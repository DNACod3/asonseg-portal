# USP-010 — Cadastro de prestador de serviço (papel) — Specification

> **Issue:** #110 · **Épico:** #231 (Épico 2 — Cadastros Públicos) · **Prioridade:** Must
> **Feature pai:** [`cadastros-publicos`](../spec.md) · **Origem (fonte da verdade a montante):** PRD `docs/prd/prd-asonseg-portal-mvp.md` USP-010 · **Spec ICE:** `docs/IDSD/ice-portal-asonseg/` (intent/expectations/matriz)
> **Fase 4 · Unidade U1 (refactor).** As ACs de comportamento (`E-001..E-003`, `P-003..P-005`) vêm da matriz/expectations — IDs canônicos a montante, **não** reescritos aqui.

## Situação (2026-07-08): USP-010 JÁ IMPLEMENTADA — esta unidade é um REFACTOR ao Design System

USP-010 está **totalmente implementada e verde** em `src/modules/persons/` (schema `ProviderProfile` **sem CNPJ** — ADR-0031, `enum CompanyType` expandido, Server Action `activateProviderRole`, schema Zod `provider.ts`, componente `provider-form.tsx`) e na rota `(app)/prestador`. O que **falta** é a adoção do **Design System** extraído na Fase 1 (AD-014) e já aplicado às telas das Fases 1/2/3 (AD-015/AD-016/AD-019). Esta unidade **refatora as telas de prestador ao DS**, exatamente no molde da unidade U1 da Fase 3 (refactor da USP-009, AD-019): **style-only** (markup/classes → primitivas de `@/shared/ui` + tokens), **preservando** todo o comportamento (RHF/Zod/Server Actions, gate LGPD, fluxo de ativação de papel sem moderação). Os testes verdes existentes são a **âncora de preservação** (testes negativos que devem continuar passando **sem alteração**).

> **Planejada "como se nova" para completude do spec** (ACs E-001..E-003 / P-003..P-005 abaixo, contrato da matriz/expectations), mas o **design e as tasks têm como alvo um refactor que preserva comportamento** (ver [`design.md`](./design.md) / [`tasks.md`](./tasks.md)).

## Problem Statement

`provider-form.tsx` e `(app)/prestador/page.tsx` foram escritos na Fase 2 (antes do restyle sistemático das telas de cadastro) e usam classes Tailwind de paleta fixa cruas (`border-gray-300`, `focus:border-blue-500`, `focus:ring-blue-200`, `text-red-600`, `text-gray-700`, `bg-blue-600`, `bg-emerald-50 border-emerald-200 text-emerald-800`, `bg-gray-50`, `accent-blue-600`, `text-gray-900`…) e strings de classe locais (`inputClass`/`labelClass`/`errorClass`) em vez das primitivas `@/shared/ui` (`Button`/`Input`/`Label`/`Textarea`/`LgpdBox`) e dos tokens semânticos. Isso quebra a consistência visual (light/dark, foco, tipografia) já uniformizada nas outras telas de cadastro público (candidato USP-009, empresa USP-012) e deixa a tela de prestador fora do DS.

## Goals

- [ ] **G1 (refactor)** — Reestilizar `provider-form.tsx` com as primitivas de `@/shared/ui` + `selectClass`/`errorClass` por token (padrão `candidate-form.tsx`/`job-form.tsx`), **sem** classe de paleta fixa crua.
- [ ] **G2 (refactor)** — Reestilizar `(app)/prestador/page.tsx` ao padrão de tela de cadastro do DS (`StepIcon` + `FormHeader` + `FormCard` + caixa de erro por token), como `(app)/candidato/page.tsx`/`(app)/empresa/cadastrar`.
- [ ] **G3 (preservação)** — **Zero mudança de comportamento**: todas as suítes verdes de USP-010 (component/unit/integração/E2E) continuam passando **sem edição** (âncora negativa).
- [ ] **G4 (preservação semântica)** — Gate LGPD (submit bloqueado sem aceite, P-003), a copy "agora você OFERECE serviços" (P-004) e a **ausência de campo de CNPJ** + CTA de MEI → `/empresa` (E-002/ADR-0031) permanecem intactos.
- [ ] **G5 (consistência DS)** — Nenhuma utilidade Tailwind de paleta fixa (`{bg,text,border,ring,accent}-{gray,red,blue,emerald,…}-NNN`) permanece nos dois arquivos reestilizados.

## Out of Scope

| Item | Razão |
|---|---|
| Alterar Server Action / schema / domain (`activate-provider-role`, `schemas/provider`) | Já canônicos (`getCurrentPerson`/ADR-0030, `requireActiveConsent`, `withAudit`, `ActionResult`, barrel). Refactor é **style-only**; backend não muda (ver design §"Sem mudança de backend"). |
| Coletar/persistir CNPJ MEI, ou criar `Company type=MEI` a partir daqui | ADR-0031: o CNPJ MEI vive em `companies` via fluxo USP-012. A UI só **redireciona** (`/empresa`). Introduzir campo de CNPJ **violaria** o invariante E-002 (âncora `provider-schema.test`/`ProviderForm.test`). |
| Upload de foto do prestador (bucket `provider-photos`) | GAP-B — diferido; o placeholder desabilitado (`getByLabelText(/foto do perfil/i)` disabled) é **mantido como está**. |
| Publicar/moderar serviço (`servicos`) | USP-029/USP-016. Aqui só a ativação do papel + perfil em DRAFT; **sem** `transitionContent` (papel ativo imediatamente, ADR-0015). |
| Introduzir uma primitiva `Select` no DS | O DS não tem `Select` (só `Input`/`Textarea`); o padrão do projeto é `<select>` nativo estilizado por `selectClass` token (`candidate-form.tsx`/`job-form.tsx`). Manter o padrão; criar primitiva seria escopo de fundação (AD-014). |
| Novos campos, nova taxonomia, nova migração | Nada de dados muda; é restyle. |

---

## Assumptions & Open Questions

Modo autônomo (loop): ambiguidades resolvidas como **assumptions** com default + rationale. Nenhum item tem owner externo bloqueante → **Entry Gate aberto** (ver [tasks.md](./tasks.md) §0).

| Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|
| Caixa P-004 "agora você OFERECE serviços" (hoje `emerald`) | agent | Caixa tintada em **success** por token: `border-success` + `bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)]` + `text-success` | `success` é o token verde do DS (AD-014); emerald→success é o mapeamento mais fiel; preserva a afirmação positiva **e** a copy P-004 (a cor é secundária ao texto) | y |
| Caixa E-003 "papel ativado / publicar primeiro serviço" (hoje `emerald` + `role="status"`) | agent | Caixa tintada em **success** (idem acima); CTA como `Button asChild variant="primary"` envolvendo o `<Link href="/servicos/novo">` | Mantém `role="status"` + nome/href do link (Radix Slot funde no `<a>`); preserva a afordância "próximo passo" | y |
| Caixa de erro (`role="alert"`) do form e da página (hoje `bg-red-*`) | agent | Caixa tintada em **danger** (`color-mix(... --color-danger 10% ...)` + `text-danger`), idêntica a `candidate-form.tsx`/`create-company-form.tsx` | Padrão de erro já canônico nas Fases 1/2/3 | y |
| Caixa E-002 do MEI (hoje `border-gray-200 bg-white`) + CTA `/empresa` | agent | Caixa **neutra** de superfície (`border-border bg-surface text-fg-muted`); CTA como `Button asChild variant="secondary"` envolvendo `<Link href="/empresa">` | Preserva o link `role="link"` name "Registrar meu MEI…" href `/empresa` (E-002); nota informativa neutra espelha `job-form.tsx` | y |
| DS não tem primitiva `Select` para região | agent | `<select className={selectClass}>` por token (padrão `candidate-form.tsx`) | Coerência com as demais telas; criar `Select` é escopo de fundação | y |
| Layout da página `(app)/prestador` | agent | `StepIcon variant="orange"` (SVG inline de prestador) + `FormHeader` + `FormCard` centralizado (`max-w-lg`), como `(app)/candidato/page.tsx` | Uniformiza com as telas de cadastro público; continua style-only | y |
| Backend precisa de mudança de consistência? | agent | **Não.** Action já usa `getCurrentPerson()` (ADR-0030), `requireActiveConsent` (PORTAL_ACCESS + SERVICE_OFFERING), `withAudit`, `ActionResult`; import direto da action `'use server'` no Client Component é o escape-hatch RSC já documentado (idêntico a `candidate-form.tsx`, AD-013/T-A1) | Evita risco de regressão; refactor fica 100% style-only | y |
| Testes de USP-010 precisam mudar? | agent | **Não** — `ProviderForm.test`, `provider-actions*`, `provider-schema`, `e2e/prestador.spec` devem passar **inalterados** (âncora negativa) | Se uma query quebrar (label/role/checkbox/link/href/copy), é regressão de contrato-DOM a corrigir no componente, nunca no teste | y |

**Open questions:** none — todas resolvidas ou logadas acima.

---

## Requisitos & Acceptance Criteria

### ACs de comportamento (da matriz/expectations — IDs canônicos a montante; JÁ IMPLEMENTADAS, preservar)

| Req | AC (resumo) | Status atual | Preservação nesta unidade |
|---|---|---|---|
| **E-001** | WHEN a Pessoa autenticada ativa o papel prestador PF **com aceite do termo SERVICE_OFFERING (finalidade 3)** ENTÃO o sistema ativa o papel imediatamente, persiste o consentimento (versão+data+IP) e audita — em transação única. | ✅ Implementada (verde) | Inalterado — âncora: `provider-actions*.test` (happy path, `PROVIDER_ROLE_ACTIVATED`), `activateAdditionalRole` (USP-006). |
| **E-002** | WHEN o prestador quer registrar CNPJ MEI ENTÃO o sistema **redireciona ao fluxo de Empresa (USP-012)** — a USP-010 **não coleta nem persiste CNPJ** (ADR-0031). | ✅ Implementada (verde) | Inalterado — âncora: `ProviderForm.test` (sem campo CNPJ; CTA MEI → `/empresa`), `provider-schema.test` (`cnpjMei` descartado). |
| **E-003** | WHEN o papel é ativado ENTÃO o sistema mostra o próximo passo "publicar primeiro serviço" (USP-029). | ✅ Implementada (verde) | Inalterado — âncora: `ProviderForm.test` (CTA "publicar primeiro serviço" href `/servicos/novo`). |
| **P-003** | NÃO PODE ativar o papel prestador sem o consentimento `SERVICE_OFFERING` persistido **na mesma transação**. | ✅ Implementada (verde) | Gate de aceite preservado — âncora: `ProviderForm.test` (submit bloqueado sem aceite), `provider-actions*.test` (CONSENT_REQUIRED). |
| **P-004** | NÃO PODE ativar o papel sem que a tela explicite **"agora você OFERECE serviços"** (distinguindo do papel cliente, que CONTRATA). | ✅ Implementada (verde) | Copy preservada — âncora: `ProviderForm.test` ("agora você OFERECE serviços" + "contrata"). |
| **P-005** | NÃO PODE ativar o papel prestador em Pessoa sem credencial (precisa logar). | ✅ Implementada (verde) | Preservado — âncora: `provider-actions*.test` (UNAUTHENTICATED sem sessão); rota `(app)/prestador` sob `requireActivePerson`. |

### Requisitos de refactor (locais desta unidade)

| Req | Requisito | Independent Test |
|---|---|---|
| **PRV-R1** | O `provider-form.tsx` usa as primitivas `@/shared/ui` (`Button`/`Input`/`Label`/`Textarea`/`LgpdBox`) e `selectClass`/`errorClass` por token; caixas de erro/afirmação/MEI por token — **sem** classe de paleta fixa. | `ProviderForm.test.tsx` verde inalterado + guard de tokens (PRV-MN-01). |
| **PRV-R2** | A página `(app)/prestador` usa `StepIcon`+`FormHeader`+`FormCard` e caixa de erro por token — sem paleta fixa. | Build/typecheck verde + E2E `prestador.spec.ts` verde + guard de tokens. |
| **PRV-R3** | Comportamento idêntico: todas as suítes de USP-010 passam sem edição. | Suítes component/unit/integração/E2E verdes sem diff nos testes. |

## Independent Test (do PRD)

Autenticar uma Pessoa, aceitar o termo `SERVICE_OFFERING`, ativar o papel de prestador e verificar `ProviderProfile.publicationStatus = DRAFT` + consentimento `SERVICE_OFFERING` ativo + `PROVIDER_ROLE_ACTIVATED` auditado; a tela distingue OFERECER de CONTRATAR (P-004) e **não** coleta CNPJ (E-002). Após o refactor, o **mesmo** teste passa **e** as telas renderizam com as primitivas do DS (verificação visual + guard de tokens). Coberto autoritativamente por `provider-actions.int.test.ts` + `ProviderForm.test.tsx` (decisão de pirâmide em `e2e/prestador.spec.ts`).

## Módulos tocados

`persons` (só UI: `components/provider-form.tsx` + rota `(app)/prestador/page.tsx`) · consome `@/shared/ui` (DS). **Não** toca `consents`/`audit`/`identity`/schema/action/domain.

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer neste refactor. Cada um exige teste negativo que assegura que o resultado proibido não ocorre. PRV-MN-P003/P004/E002 são ancorados em suítes **verdes já existentes** (preservação); **PRV-MN-01** é a proibição **nova** específica do refactor DS.

| ID | QUANDO [contexto] ENTÃO o sistema NÃO DEVE… | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| **PRV-MN-P004** | QUANDO a tela de ativação do prestador é renderizada ENTÃO ela NÃO DEVE omitir a copy "agora você OFERECE serviços" que a distingue do papel cliente (CONTRATA) | UX confusa prestador↔cliente (fracasso de resultado F3) | T1 | `ProviderForm.test.tsx` — "P-004: exibe copy …" (verde, inalterado) |
| **PRV-MN-P003** | QUANDO o aceite do termo `SERVICE_OFFERING` não está marcado (1ª ativação) ENTÃO o form NÃO DEVE habilitar/submeter a ativação | Ativação de papel sem consentimento LGPD (F2) | T1 | `ProviderForm.test.tsx` — "P-003: desabilita o envio até o aceite" (verde) + `provider-actions*.test` CONSENT_REQUIRED |
| **PRV-MN-E002** | QUANDO o restyle é aplicado ENTÃO a tela NÃO DEVE introduzir campo de CNPJ e o CTA de MEI NÃO DEVE deixar de apontar ao fluxo de Empresa (`/empresa`) | Reintroduzir "prestador PF com CNPJ" revogado por ADR-0031 | T1 | `ProviderForm.test.tsx` — "E-002/ADR-0031: NÃO possui campo de CNPJ e CTA de MEI navega a `/empresa`" (verde) + `provider-schema.test` |
| **PRV-MN-01** | QUANDO as telas de prestador são reestilizadas ENTÃO elas NÃO DEVEM conter utilidades Tailwind de paleta fixa (`{bg,text,border,ring,accent,fill,stroke,divide,outline,placeholder,from,to,via}-{gray,slate,zinc,neutral,stone,red,orange,amber,yellow,lime,green,emerald,teal,cyan,sky,blue,indigo,violet,purple,fuchsia,pink,rose}-NNN`) | Deriva do Design System (análogo a DS-MN-02 da AD-014 / CAD-MN-03 da USP-009) — perda da consistência light/dark por token | T1, T2 | T3 — guard estático `provider-ds-tokens.guard.test.ts` (padrão `no-external-verify.test.ts`) |

---

## Requirement Traceability

| Requirement ID | Story/Origem | Phase | Status |
|---|---|---|---|
| E-001 (board CAD-06) | expectations-USP-010 | Implementado | Verified (preservar) |
| E-002 (board CAD-07) | expectations-USP-010 · ADR-0031 | Implementado | Verified (preservar) |
| E-003 (board CAD-08) | expectations-USP-010 | Implementado | Verified (preservar) |
| P-003 | expectations-USP-010 | Implementado | Verified (preservar) |
| P-004 | expectations-USP-010 | Implementado | Verified (preservar) |
| P-005 | expectations-USP-010 | Implementado | Verified (preservar) |
| PRV-R1 | Refactor DS (form) | Tasks (T1) | Pending |
| PRV-R2 | Refactor DS (página) | Tasks (T2) | Pending |
| PRV-R3 | Preservação | Tasks (T1–T3) | Pending |
| PRV-MN-P004 | Must-not (UX OFERECE) | Tasks (T1) | Pending (âncora verde) |
| PRV-MN-P003 | Must-not (LGPD) | Tasks (T1) | Pending (âncora verde) |
| PRV-MN-E002 | Must-not (sem CNPJ / ADR-0031) | Tasks (T1) | Pending (âncora verde) |
| PRV-MN-01 | Must-not (DS drift) | Tasks (T3) | Pending |

**ID format:** IDs de comportamento `E-NNN`/`P-NNN` são canônicos das expectations a montante (board CAD-06..08 mapeado); requisitos de refactor locais `PRV-RN`; must-not novo `PRV-MN-01`.

**Coverage:** 13 total · E-001..E-003 + P-003..P-005 preservados por suítes existentes · PRV-R1/R2/R3 + PRV-MN-01 mapeados a T1–T3.

---

## Success Criteria

- [ ] `provider-form.tsx` e `(app)/prestador/page.tsx` reestilizados às primitivas `@/shared/ui` + tokens (paridade visual com candidato/empresa).
- [ ] Guard `provider-ds-tokens.guard.test.ts` verde (0 utilidades de paleta fixa nos 2 arquivos) e discriminante.
- [ ] Suítes de USP-010 (`provider-schema.test`, `provider-actions.test`, `provider-actions.int.test`, `ProviderForm.test`, `e2e/prestador.spec`) **verdes sem edição** — E-001/E-002/E-003 + P-003/P-004/P-005 preservados.
- [ ] `npm run typecheck` · `npm run lint` · `npm run build` verdes; sem regressão em nenhuma suíte.
