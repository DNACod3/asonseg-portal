# Rastreabilidade EARS → Fact — USP-010 Cadastro de prestador de serviço (#110)

Fonte: `expectations-USP-010.md` · issue #110 · `matriz-conexoes.md` §USP-010. Gerado por skill-tdad (2026-06-10).
**Revisão 2026-06-10 (ADR-0031):** P-001 e P-002 **REVOGADOS** (CNPJ MEI passa a residir em `companies` via USP-012). E-002 e D-003 reescritos como **redirect**.
**Cobertura: 6/6 requisitos vigentes com fact** (E-001, E-002-redirect, E-003, P-003, P-004, P-005).
Todos os facts em status **Red**.
**Diferença vs. USP-009:** papel ativo imediatamente, SEM moderação (ADR-0015); CNPJ MEI fora da US (ADR-0031).

| Req | Tipo EARS | Texto (verbatim de expectations) | Tipo de fact | Cenário BDD | Path-alvo do teste | Status |
|----|-----------|------------------|--------------|-------------|--------------------|--------|
| E-001 | WHEN…SHALL | WHEN a Pessoa autenticada solicita ativar o papel prestador PF com aceite do termo da finalidade 3, the system SHALL ativar o papel imediatamente e persistir o consentimento SERVICE_OFFERING (versão+data+IP) **atômico à ativação do papel** (`activateAdditionalRole`); o ProviderProfile DRAFT + auditoria `PROVIDER_ROLE_ACTIVATED` são gravados na transação encadeada de `activateProviderRole` (consent verificado, não regravado). | integração | `@e-001 @happy-path` | `modules/persons/__tests__/provider-actions.int.test.ts::E-001 happy path` | Red |
| E-001 | (permissão) | (idem — ação autenticada própria; P-005) | integração | `@e-001 @permissao` | `…::permissão / autenticação` | Red |
| E-001 | (idempotência) | (idem — reativar não duplica papel/perfil/consent) | integração | `@e-001 @idempotencia` | `…::idempotência (concorrência)` | Red |
| E-002 | WHEN…SHALL (ADR-0031) | WHEN o prestador quer registrar dados fiscais (CNPJ MEI), the system SHALL redirecioná-lo ao fluxo USP-012 (cria Company type=MEI). A USP-010 não coleta/persiste CNPJ. | componente + integração | `@e-002 @redirect` / `@e-002 @must-not` | `modules/persons/__tests__/ProviderForm.test.tsx::CTA MEI → USP-012` + `…::perfil sem CNPJ` | Red |
| E-003 | WHEN…SHALL | WHEN o papel prestador é ativado, the system SHALL redirecionar para "publicar primeiro serviço" (USP-029) ou painel do prestador. | componente | `@e-003 @happy-path` | `…::ProviderForm.test.tsx::CTA próximo passo` | Red |
| P-003 | must-not | NÃO PODE ativar o papel prestador sem que o consentimento SERVICE_OFFERING esteja persistido na mesma transação. | integração | `@p-003 @borda` / `@p-003 @atomicidade` | `…::P-003 consentimento` | Red |
| P-004 | must-not | NÃO PODE ativar o papel sem que a tela explicite "agora você OFERECE serviços". | componente | `@p-004 @ui` | `…::ProviderForm.test.tsx::copy P-004` + `::bloqueia submit` | Red |
| P-005 | must-not | NÃO PODE ativar o papel prestador em Pessoa sem credencial. | integração | `@p-005 @must-not` | `…::permissão / autenticação` (UNAUTHENTICATED) | Red |
| ~~P-001~~ | ~~must-not~~ | **REVOGADO (ADR-0031)** — CNPJ MEI agora em `companies`. | — | — | — | Revogado |
| ~~P-002~~ | ~~must-not~~ | **REVOGADO (ADR-0031)** — sem "prestador PF com MEI"; quem tem MEI é Empresa MEI. | — | — | — | Revogado |

## Facts (bloco para o corpo do issue — Kickoff Gate, §22/§23)

- E-001 (happy path) → `modules/persons/__tests__/provider-actions.int.test.ts::E-001 happy path`
- E-001 (permissão/P-005) → `…::permissão / autenticação`
- E-001 (idempotência) → `…::idempotência (concorrência)`
- E-002 (redirect MEI) → `modules/persons/__tests__/ProviderForm.test.tsx::CTA MEI → USP-012` + `…::perfil sem CNPJ`
- E-003 (próximo passo) → `…::ProviderForm.test.tsx::CTA próximo passo`
- P-003 (atomicidade/consent) → `…::P-003 consentimento`
- P-004 (copy/UI) → `…::ProviderForm.test.tsx::copy P-004`
- P-005 (credencial) → `…::permissão / autenticação`

Artefatos:
- BDD: `tests/bdd/usp-010-cadastro-prestador.feature` (tags `@e-001`..`@p-005`)
- Vitest red: `tests/unit/usp-010-cadastro-prestador.spec.ts`
- E2E (apoio, não Top 8): `e2e/prestador.spec.ts` (confinamento da rota `/prestador` — acesso sem sessão → `/login`).

## Lacunas / decisões

- **ADR-0031 (2026-06-10)** — reverte F1/P-001/P-002 da USP-010: CNPJ MEI em `companies` via fluxo USP-012; `ProviderProfile` sem CNPJ; `CompanyType` expandido para regime tributário. Card, intent, expectations e ledger de premissas atualizados.
- **GAP-A dissolvido** — `ProviderProfile` do TD §4.5 (sem CNPJ) está correto; nenhum desvio de schema.
- **GAP-B — upload de foto diferido p/ Fase 4** (bucket `provider-photos`, TD §5). `photoStoragePath` nullable; UI com placeholder.
- **Expansão de `CompanyType`** entregue em #112; a UI que escolhe o regime tributário pertence à USP-012.
- **D-002 (gate jurídico)** do termo `service-offering@v1.0`: pendência de **release**, não de merge.
- **Sem moderação:** nenhum fact de `transitionContent`/`IN_MODERATION` (ADR-0015).
