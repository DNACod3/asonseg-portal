# Rastreabilidade EARS → Fact — USP-011 Cadastro de cliente de serviço (papel) (#118)

Fonte: `expectations-USP-011.md` · `intent-USP-011.md` · issue #118 · `matriz-conexoes.md` §USP-011. Gerado por skill-tdad (2026-06-11).
Requisitos: **CAD-09, CAD-10**.
**Recorte de escopo (#118):** entrega o schema `ClientProfile` (#119) e o helper transacional idempotente `ensureClientRole(tx, …)` + evento `CLIENT_ROLE_ACTIVATED` (#120). A exibição do termo (E-001-UI/P-002), a transação única e a criação da manifestação pertencem à **USP-033** — marcados `@fora-desta-us`.
**Cobertura (server desta US): 4/4 requisitos máquina-verificáveis com fact** (E-001-server, E-002, P-001, regra pura). E-001-UI · P-002 · P-003 · L-001/L-002 → cobertos por USP-033 (E2E/carga).
Todos os facts desta US em status **Red**.
**Diferença vs. USP-009/010:** helper que recebe `tx` (sem Server Action standalone); sem moderação/`publicationStatus` (perfil leve, ADR-0008/0011); ativação automática.

| Req | Tipo EARS | Texto (verbatim de expectations) | Tipo de fact | Cenário BDD | Path-alvo do teste | Status |
|----|-----------|------------------|--------------|-------------|--------------------|--------|
| E-001 (server) | WHEN…SHALL | WHEN a Pessoa autenticada manifesta interesse pela 1ª vez, the system SHALL — numa transação única — ativar o papel cliente + persistir o consentimento da finalidade 4 (versão+data+IP) + criar a manifestação. | integração | `@e-001 @happy-path` | `modules/persons/__tests__/ensure-client-role.int.test.ts::E-001 primeira ativação` | Red |
| AC #118-1 | WHEN…SHALL | QUANDO manifesta interesse pela 1ª vez ENTÃO ativa o papel cliente automaticamente, sem formulário adicional. | integração | `@e-001 @happy-path` | `…::ativa CLIENT sem input de perfil` | Red |
| AC #118-2 | WHEN…SHALL | QUANDO o papel é ativado automaticamente ENTÃO registrar consentimento ativo para PORTAL_ACCESS e SERVICE_HIRING. | integração | `@e-001 @lgpd` | `…::persiste consents SERVICE_HIRING + PORTAL_ACCESS` | Red |
| P-001 | must-not | NÃO PODE ativar o papel cliente sem o consentimento da finalidade 4 persistido na mesma transação. | integração | `@e-001 @p-001 @atomicidade` | `…::atomicidade — rollback se consent falhar` | Red |
| E-002 / AC #118-3 | WHEN…SHALL | WHEN o papel cliente já está ativo, the system SHALL prosseguir direto, sem mostrar o termo de novo (idempotência, sem duplicar papel/consent). | integração | `@e-002 @idempotencia` | `…::idempotência — no-op quando já ativo` | Red |
| E-002 (auditoria) | (derivado) | Evento `CLIENT_ROLE_ACTIVATED` emitido só quando há ativação real. | integração | `@e-002 @auditoria` | `…::emite CLIENT_ROLE_ACTIVATED só na ativação real` | Red |
| E-002 (domínio) | (derivado) | Regra pura `decideClientActivation`: needsActivation = papel CLIENT ausente. | unit | `@e-002 @dominio @unit` | `modules/persons/domain/__tests__/client.spec.ts::decideClientActivation` | Red |
| schema | THE SYSTEM SHALL (ubíquo) | Model `ClientProfile` (personId PK, cityId?, createdAt) conforme TD §2.2 / ADR-0008. | migration + typecheck | — | `prisma/schema.prisma` + migration `…_usp011_client_profile` | Red (a validar) |
| E-001-UI | WHEN…SHALL | Termo da finalidade 4 exibido (scroll-to-accept) antes do clique final. | E2E (USP-033) | `@e-001-ui @fora-desta-us` | `e2e/usp-033-manifestar-interesse.e2e.ts` | Fora desta US |
| P-002 | must-not | NÃO PODE coletar consentimento implícito sem exibir o termo e exigir aceite explícito. | E2E (USP-033) | `@p-002 @fora-desta-us` | `e2e/usp-033-*` | Fora desta US |
| P-003 | must-not | NÃO PODE ativar o papel cliente em Pessoa sem credencial (precisa logar). | integração (USP-033) | `@p-003 @fora-desta-us` | `e2e/usp-033-*` (UNAUTHENTICATED) | Fora desta US |
| L-001 | WHILE/limite | Ativação automática + manifestação ≤ 2s p95. | carga/observabilidade (USP-033) | `@l-001 @fora-desta-us` | — | Fora desta US |
| L-002 | limite/UX | Termo da finalidade 4 é curto. | E2E (USP-033) | — | `e2e/usp-033-*` | Fora desta US |

## Lacunas / decisões pendentes

- **Assinatura de `ensureClientRole`** (Q-aberta de design, `design.md §2`): recomendada `(tx, { personId, term, ip, userAgent })` em vez de `(tx, personId)` para satisfazer P-001 sem `loadTerm`/`headers()` dentro do helper. **Confirmar com Tech Lead** na implementação de #120.
- **D-002 (gate jurídico):** o termo da finalidade 4 (`SERVICE_HIRING`) precisa estar aprovado pelo jurídico antes de **produção** (não bloqueia o dev desta US).
- **`cityId`** em `ClientProfile` é coluna UUID nullable **sem FK** (não há model `City`). FK fica para US futura quando `City` existir.

## Facts (bloco para o corpo do issue — Kickoff Gate, §22/§23)

- E-001 (happy path) → `modules/persons/__tests__/ensure-client-role.int.test.ts::E-001 primeira ativação`
- AC #118-2 (consents) → `…::persiste consents SERVICE_HIRING + PORTAL_ACCESS`
- P-001 (atomicidade) → `…::atomicidade — rollback se consent falhar`
- E-002 (idempotência) → `…::idempotência — no-op quando já ativo`
- E-002 (auditoria condicional) → `…::emite CLIENT_ROLE_ACTIVATED só na ativação real`
- E-002 (domínio) → `modules/persons/domain/__tests__/client.spec.ts::decideClientActivation`
- schema ClientProfile → `prisma/schema.prisma` + migration `…_usp011_client_profile` (#119)
- E-001-UI · P-002 · P-003 · L-001/L-002 → **USP-033** (E2E/carga), fora desta US
