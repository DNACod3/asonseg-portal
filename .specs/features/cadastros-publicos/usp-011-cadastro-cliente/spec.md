# USP-011 — Cadastro de cliente de serviço (papel) — Spec

> **Modo ICE — esta spec é um ADAPTADOR.** Não re-deriva requisitos: resolve os ponteiros do
> card da USP-011 na matriz de conexões para os artefatos-fonte (intent + expectations). A fonte
> da verdade é `docs/IDSD/ice-portal-asonseg/`.
> **Fase 4 · Unidade U1 — reconciliação (não é refactor, não é net-new de código).**

## Situação (2026-07-08): USP-011 JÁ IMPLEMENTADA — esta unidade é uma RECONCILIAÇÃO

Toda a fronteira de escopo desta US está **implementada e verde**: o schema `ClientProfile` (`prisma/schema.prisma`, migration `usp011_client_profile`), a regra pura `decideClientActivation` (`persons/domain/client.ts`), o helper transacional idempotente `ensureClientRole(tx, …)` (`persons/actions/ensure-client-role.ts`), o evento `CLIENT_ROLE_ACTIVATED` no catálogo, os exports no barrel `@/modules/persons`, e os testes (`client-domain.test.ts`, `ensure-client-role.int.test.ts`). Os status de board `#119 In progress` / `#120 Backlog` desta spec estavam **defasados** — ambos estão **DONE**.

**Portanto esta unidade U1 não produz código novo nem refatora estilo** (USP-011 **não tem UI** — não há superfície de Design System a reestilizar). O trabalho de Fase 4 é **verificar** que o helper + schema + evento seguem íntegros e verdes, e **fixar por escrito** a decisão de escopo abaixo, para que a USP-033 (unidade separada da Fase 4) o consuma com segurança. Se a verificação achar um gap, aí sim vira task de correção (fix→re-verify).

## Decisão de escopo (Fase 4) — o papel cliente NÃO tem cadastro self-service

**Decidido e alinhado ao intent + expectations + comentário do schema `ClientProfile`:** o papel cliente é o **mais leve** — **não** há tela/formulário de cadastro próprio, **não** há Server Action standalone. Ele é **ativado automaticamente** na 1ª manifestação de interesse (USP-033), **dentro** da transação de `services.manifestarInteresse` (ADR-0020), que compõe: ativação do papel CLIENT + persistência do consentimento da finalidade 4 (`SERVICE_HIRING`) + criação da manifestação — tudo atômico. A **exibição do termo** e o **aceite explícito** (P-002) e o **gate jurídico D-002** vivem na **USP-033 / no release**, não aqui. O entregável desta US é o **helper reutilizável** `ensureClientRole(tx, …)` + o **perfil leve** `ClientProfile` (sem `publicationStatus`/moderação — CLIENT não é moderado, ADR-0011/0008) + o **evento de auditoria**. Introduzir qualquer UI de "cadastrar-se como cliente" **contraria** o intent (fricção zero) e está **fora de escopo**.

## Card (matriz de conexões)

`docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` — USP-011:

- **Upstream:** USP-001 ou USP-006, USP-043 (consentimento "contratação de serviço" = finalidade 4)
- **Downstream:** USP-033 (manifestar interesse — chama a ativação)
- **ADRs:** ADR-0011, ADR-0013 · **ADRs técnicos:** ADR-0020 (ativação+consentimento+manifestação atômicos), ADR-0023
- **Schemas (TD §4.5):** `role_grants`, `consents`, `service_interests` — + `client_profiles` (perfil leve, ADR-0008 / TD §2.2)
- **Endpoints (TD §4.4):** ativação automática **dentro** de `services.manifestarInteresse`
- **Eventos (TD §4.6):** `ROLE_ACTIVATED`, `CONSENT_GIVEN` (no código: `CLIENT_ROLE_ACTIVATED` + `CONSENT_GRANTED`)
- **Runbooks:** runbook-server-action, runbook-consent-gate · **Fase:** 2
- **Riscos:** RP-003 · **Deps/Q-abertas:** D-002 (gate jurídico do termo da finalidade 4)

## Spec = Intent + Expectations (fonte)

- Intent: `docs/IDSD/ice-portal-asonseg/intents/intent-USP-011.md`
- Expectations: `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-011.md`

### Requisitos: CAD-09, CAD-10

### Cenários de sucesso (expectations)

- **E-001:** WHEN a Pessoa autenticada manifesta interesse pela 1ª vez (USP-033), THEN o sistema DEVE — numa
  **transação única** — ativar o papel cliente + persistir o consentimento da finalidade 4 (versão+data+IP) +
  criar a manifestação. O termo da finalidade 4 é exibido explicitamente antes do clique final (scroll-to-accept,
  igual à USP-006). *(parte UI/transação = USP-033; esta US entrega o helper reutilizável + schema)*
- **E-002:** WHEN o papel cliente já está ativo, THEN prosseguir direto, sem mostrar o termo de novo (idempotência).

### Proibições — must-not (expectations)

- **P-001 (toca F1):** NÃO ativar o papel cliente sem o consentimento da finalidade 4 persistido **na mesma transação**.
- **P-002 (toca F2):** NÃO coletar consentimento implícito — termo exibido + aceite explícito obrigatórios *(UI = USP-033)*.
- **P-003:** NÃO ativar o papel em Pessoa sem credencial (precisa estar logada).

### Critérios de aceite do board (#118) — recorte desta US

- QUANDO a Pessoa autenticada manifesta interesse pela 1ª vez ENTÃO o papel cliente é ativado automaticamente, sem formulário adicional.
- QUANDO o papel é ativado automaticamente ENTÃO registrar consentimento LGPD ativo para `PORTAL_ACCESS` e `SERVICE_HIRING`.
- QUANDO a Pessoa já possui o papel cliente ativo ENTÃO tratar de forma **idempotente**, sem duplicar papel nem consentimento.

### Limites

- **L-001:** ativação + manifestação ≤ 2s p95. **L-002:** termo da finalidade 4 é curto (UI = USP-033).

## Fronteira de escopo desta US (#118)

Esta US entrega **(a)** o schema `ClientProfile` (#119) e **(b)** o helper transacional **idempotente**
`ensureClientRole(tx, …)` + evento de auditoria (#120). A **exibição do termo**, a **composição da transação**
e a **criação da manifestação** pertencem à **USP-033** (`services.manifestarInteresse`), que consome este helper.
Por isso P-002/E-001(UI) e o gate jurídico **D-002** são verificados na USP-033 / no release, não aqui.

## Gate de entrada (kickoff) — veredito

- **Bloqueios ativos:** nenhum. Sinais de bloqueio do gate ICE (Q-aberta dono/técnico, ADR Proposed, pré-condição, premissa aberta): **nenhum** — a matriz aponta `Q-abertas: —`.
- **D-002 (jurídico):** gate de **produção** do termo da finalidade 4 — **não** bloqueia o desenvolvimento desta US (verifica-se na USP-033/release).
- **Estado da implementação (reconciliado 2026-07-08):** **DONE e verde**. `ClientProfile` + migration ✅, `CLIENT_ROLE_ACTIVATED` no catálogo ✅, `decideClientActivation` (domínio) ✅, `ensureClientRole(tx, …)` ✅, exports no barrel `@/modules/persons` ✅, testes `client-domain.test.ts` + `ensure-client-role.int.test.ts` ✅. Fundação consumida (`Role.CLIENT`, `ConsentPurpose.SERVICE_HIRING`, `PersonRoleGrant`, `requireActiveConsent`, `withAudit`, `getCurrentPerson`) intacta.
- **Veredito:** ✅ liberado — como **reconciliação/verificação** (ver [tasks.md](./tasks.md)); nenhum código novo esperado salvo se a verificação achar gap.
