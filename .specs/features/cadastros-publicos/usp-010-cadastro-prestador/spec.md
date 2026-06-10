# USP-010 — Cadastro de prestador de serviço (papel) — Spec

> **Modo ICE — adaptador, não geração.** Esta spec RESOLVE o card da USP-010 na
> matriz de conexões; não re-deriva requisitos. Fonte da verdade:
> - Intent: [`docs/IDSD/ice-portal-asonseg/intents/intent-USP-010.md`](../../../../docs/IDSD/ice-portal-asonseg/intents/intent-USP-010.md)
> - Expectations: [`docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-010.md`](../../../../docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-010.md)
> - Card: `matriz-conexoes.md` §USP-010 · **ADR-0031** (revisão do CNPJ MEI, 2026-06-10)
> - Issue: #110 · Épico #231 (Cadastros Públicos) · Subs: #112, #114, #116
>
> **⚠️ Revisão 2026-06-10 (ADR-0031):** a premissa F1/P-001 foi revertida pelo dono do intent.
> O CNPJ MEI **não** é mais atributo do prestador PF — passa a residir em `companies` via fluxo
> USP-012. P-001 e P-002 foram **revogados**; E-002/D-003 reescritos. O `ProviderProfile` **não**
> tem campo de CNPJ.

## 1. História

Como Pessoa autenticada, quero ativar o papel de **prestador de serviço PF** e registrar
meu perfil (foto, descrição, região), para que eu possa publicar serviços em meu nome (USP-029).

## 2. Sizing

**Large** (piso ICE: USP ICED + carrega must-not P-003/P-004/P-005). Design-adapter e Tasks
obrigatórios. Não elegível a Quick/Medium.

## 3. Requisitos rastreáveis (EARS — de `expectations-USP-010.md`)

| ID | Tipo | Requisito | Origem |
|---|---|---|---|
| **E-001** | success | WHEN a Pessoa autenticada solicita ativar o papel prestador PF **com aceite do termo da finalidade 3 (oferta de serviço)**, o sistema DEVE ativar o papel imediatamente, persistir o consentimento `SERVICE_OFFERING` (versão+data+IP) e gravar auditoria — **em transação única**. | AC-010-1 (ajustado) |
| **E-002** | success | WHEN o prestador quer registrar dados fiscais (CNPJ MEI próprio), o sistema DEVE **redirecioná-lo ao fluxo de cadastro de Empresa (USP-012)**, que cria uma `Company type=MEI` com o prestador como responsável. A USP-010 **não coleta nem persiste CNPJ**. | AC-010-2 (reescrito — ADR-0031) |
| **E-003** | success | WHEN o papel prestador é ativado, o sistema DEVE redirecionar para o próximo passo "publicar primeiro serviço" (USP-029) ou para o painel do prestador. | novo |
| **P-003** | must-not | NÃO PODE ativar o papel prestador sem que o consentimento `SERVICE_OFFERING` esteja persistido **na mesma transação**. | toca F2 |
| **P-004** | must-not | NÃO PODE ativar o papel sem que a tela explicite **"agora você OFERECE serviços"** (distinguindo do papel cliente, que CONTRATA). | toca F3 |
| **P-005** | must-not | NÃO PODE ativar o papel prestador em Pessoa sem credencial (USP-002 sem USP-003). Prestador precisa logar. | — |
| ~~P-001~~ | ~~must-not~~ | **REVOGADO (ADR-0031)** — CNPJ MEI agora vive em `companies`. | — |
| ~~P-002~~ | ~~must-not~~ | **REVOGADO (ADR-0031)** — não existe mais "prestador PF com MEI declarado"; quem tem MEI é Empresa MEI. | — |
| **L-001** | limite | Submit da ativação ≤ 2s p95. | perf |
| **L-002** | limite | Termo da finalidade 3 é a versão vigente no momento (`service-offering@v1.0`). | USP-043 |

## 4. Critérios de pronto do dono do intent

- **D-001:** Pessoa real ativa o papel prestador em ≤ 60s do clique; tela final mostra "próximo passo: publicar serviço".
- **D-002 (gate jurídico):** termo da finalidade 3 aprovado pelo jurídico **antes de produção**. Artefato técnico já existe (`legal/consent-terms/service-offering/v1.0.md`); aprovação formal é gate de release, não de merge.
- **D-003 (reescrito — ADR-0031):** ao optar por registrar o MEI, o prestador é **redirecionado ao fluxo USP-012** e o sistema cria uma `Company type=MEI` com ele como responsável; o `ProviderProfile` permanece **sem** campo de CNPJ.
- **D-004:** inspeção visual: texto distingue "oferecer" de "contratar" (P-004).

## 5. Escopo — o que NÃO entra (anti-fabricação, fronteiras do card)

- **Sem moderação do papel/perfil:** o card só aponta eventos `ROLE_ACTIVATED`/`CONSENT_GIVEN`; **não** `CONTENT_SUBMITTED_TO_MODERATION`. Por ADR-0015 o papel é ativo imediatamente. A moderação incide sobre o **serviço** (USP-016/USP-029). → **Nenhuma integração com `@/modules/moderation` nesta US.**
- **CNPJ MEI não é coletado nesta US:** declarar MEI **redireciona** ao fluxo USP-012 (cadastrar Empresa MEI). A USP-010 não tem campo de CNPJ nem cria Company — só linka/encaminha (ADR-0031).
- **Form de Empresa (USP-012)** e a escolha do regime tributário na UI de Empresa: pertencem à USP-012. A USP-010 só dispara o redirect.
- **Upload de foto difere para Fase 4:** o bucket `provider-photos` é entregável da **Fase 4** (TD §5). `photoStoragePath` existe no model, mas a UI/infra de upload entra na Fase 4 (espelha o CV diferido p/ USP-040 na USP-009). Placeholder na tela.
- **Publicar serviço (USP-029):** downstream; aqui só o "próximo passo".

## 6. Gaps / decisões

- **GAP-A — DISSOLVIDO (ADR-0031).** Não há mais campo `cnpjMei` no `ProviderProfile`; o model do TD §4.5 (sem CNPJ) fica **correto como está**. Nenhum desvio de schema.
- **Expansão de `CompanyType` (decisão 2026-06-10):** enum `companies` passa de `{CNPJ_REGULAR, MEI}` para regime tributário `{MEI, SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL, SA}` (migration mapeia o default existente). Entregue em #112; a UI que escolhe o regime é da USP-012.
- **GAP-B — upload de foto diferido p/ Fase 4.** `photoStoragePath` permanece nullable.

## 7. Módulos tocados

`persons` (ProviderProfile, action, schema, form, page) · `identity` (papel PROVIDER — reusa `activateAdditionalRole`) · `consents` (`SERVICE_OFFERING` — infra pronta) · `audit` (evento `PROVIDER_ROLE_ACTIVATED`) · `companies` (enum `CompanyType` expandido; redirect reusa USP-012).
