# USP-011 — Cadastro de cliente de serviço (papel) — Spec

> **Modo ICE — esta spec é um ADAPTADOR.** Não re-deriva requisitos: resolve os ponteiros do
> card da USP-011 na matriz de conexões para os artefatos-fonte (intent + expectations). A fonte
> da verdade é `docs/IDSD/ice-portal-asonseg/`.

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

- **Bloqueios ativos:** nenhum. `#118` está **Ready**; `#120` depende de `#119` (sequência de dev, não "Blocked" de board).
- **D-002 (jurídico):** gate de **produção** do termo da finalidade 4 — **não** bloqueia o desenvolvimento desta US.
- **Fundação já existe:** `Role.CLIENT`, `ConsentPurpose.SERVICE_HIRING`, `PURPOSE_ROLE_MAP.SERVICE_HIRING→CLIENT`,
  `PersonRoleGrant`, `RoleGrantStatus`, `requireActiveConsent`, `grantConsent`, `withAudit`, `getCurrentPerson`,
  `activateAdditionalRole` (padrão de referência), `loadTerm`. **Falta criar:** `ClientProfile` + migration,
  `CLIENT_ROLE_ACTIVATED`, `ensureClientRole` + domínio puro de idempotência, testes/facts.
- **Veredito:** ✅ liberado para Tasks.
