# Rastreabilidade EARS → Fact — USP-009 Cadastro de candidato (#31)

Fonte: PRD USP-009 · issue #31 · `matriz-conexoes.md` (CAD-01..CAD-05). Gerado por skill-tdad.
Atualizado 2026-06-10 (USP-016 mergeada → CAD-03 destravado).
**Cobertura: 5/5 requisitos com fact** (CAD-02 diferido USP-040, CAD-04 fora/USP-016 — rastreados).
Todos os facts em status **Red** (gerados, falhando por ausência de implementação).

| Req | Tipo EARS | Texto (verbatim) | Tipo de fact | Cenário BDD | Path-alvo do teste | Status |
|----|-----------|------------------|--------------|-------------|--------------------|--------|
| CAD-01 | WHEN…DEVE | QUANDO a Pessoa submete o cadastro com escolaridade, área de interesse principal e telefone preenchidos ENTÃO o sistema DEVE ativar o papel de candidato com status "rascunho" (DRAFT) para o conteúdo do perfil/CV. | integração | `@cad-01 @happy-path` | `modules/persons/__tests__/activate-candidate-role.int.test.ts::CAD-01 happy path` | Red |
| CAD-01 | (validação) | (idem — campos obrigatórios) | schema Zod + unit | `@cad-01 @validacao` | `modules/persons/schemas/candidate.ts` + `…::validação Zod` | Red |
| CAD-01 | (permissão) | (idem — ação autenticada própria) | integração | `@cad-01 @permissao` | `…::permissão / autenticação` | Red |
| CAD-01 | (idempotência) | (idem — reativar não duplica) | integração | `@cad-01 @idempotencia` | `…::idempotência (concorrência)` | Red |
| CAD-02 | WHEN…DEVE | QUANDO a Pessoa anexa CV (PDF/DOC/DOCX até 5MB) ENTÃO o sistema DEVE invocar extração automática por IA e pré-preencher campos para validação (ver USP-040). | integração (diferido) | `@cad-02 @diferido-usp-040` | `…::CAD-02 (it.todo)` → testado na **USP-040** | Red (diferido) |
| CAD-03 | WHEN…DEVE | QUANDO o candidato envia o perfil para moderação ENTÃO o sistema DEVE alterar o status para "em moderação" (IN_MODERATION) e enfileirar para o coordenador — via `transitionContent()`. | integração | `@cad-03 @happy-path` / `@cad-03 @borda` | `modules/persons/__tests__/submit-candidate-for-moderation.int.test.ts::DRAFT→IN_MODERATION` + `::INVALID_TRANSITION` | Red |
| CAD-04 | WHEN…DEVE | QUANDO o perfil é aprovado pelo coordenador ENTÃO o sistema DEVE ativar o candidato (visível na busca) e enviar e-mail. | integração (fora) | `@cad-04 @diferido-usp-016` | `…::CAD-04 (it.todo)` → fluxo do coordenador na **USP-016** | Red (fora de escopo) |
| CAD-05 | WHEN…DEVE | QUANDO a Pessoa ativa o papel ENTÃO o sistema DEVE registrar consentimento LGPD ativo para `PORTAL_ACCESS` e `JOB_APPLICATION` (e `CV_AI_EXTRACTION` quando houver anexo de CV). | integração | `@cad-05 @happy-path` / `@cad-05 @borda` | `…::CAD-05 consentimento` | Red |
| CAD-05 | (UI) | (idem — bloqueio de submit sem aceite) | componente | `@cad-05 @ui` | `modules/persons/components/__tests__/candidate-form.test.tsx::bloqueia submit sem consentimento` | Red |
| EDGE | IF…THEN | rejeitar submissão sem escolaridade/área/telefone (Zod); idempotência ao reativar papel; bloquear sem aceite de consentimento. | schema Zod + integração | `@cad-01 @validacao`, `@cad-01 @idempotencia`, `@cad-05 @borda` | (ver linhas CAD-01/CAD-05 acima) | Red |

## Facts (bloco para o corpo do issue — Kickoff Gate, §22/§23)

- CAD-01 (happy path) → `modules/persons/__tests__/activate-candidate-role.int.test.ts::CAD-01 happy path`
- CAD-01 (Zod) → `modules/persons/schemas/candidate.ts` + `…::validação Zod`
- CAD-01 (permissão) → `…::permissão / autenticação`
- CAD-01 (idempotência) → `…::idempotência (concorrência)`
- CAD-05 (consentimento) → `…::CAD-05 consentimento`
- CAD-05 (UI) → `modules/persons/components/__tests__/candidate-form.test.tsx`
- CAD-02 (diferido) → `it.todo` → coberto na USP-040
- CAD-03 → `…submit-candidate-for-moderation.int.test.ts::DRAFT→IN_MODERATION` / `::INVALID_TRANSITION` (USP-016 ✅)
- CAD-04 (fora) → `it.todo` → coberto na USP-016 (coordenador) + US de e-mail
- E2E (apoio, não Top 8) → `tests/e2e/usp-009-cadastro-candidato.e2e.ts`

Artefatos:
- BDD: `tests/bdd/usp-009-cadastro-candidato.feature` (12 cenários)
- Vitest red: `tests/unit/usp-009-cadastro-candidato.spec.ts`
- E2E (apoio): `tests/e2e/usp-009-cadastro-candidato.e2e.ts`

## Lacunas / decisões (atualizado 2026-06-10 — USP-016 mergeada)

- **GAP-1 — ✅ RESOLVIDO.** `transitionContent()` existe (`@/modules/moderation`). CAD-03 vira fact red real.
  Trabalho de integração herdado pela #44: `ContentKind.CANDIDATE_PROFILE` + transições + adapter
  `PrismaCandidateProfileStatusRepository` + despacho por `ContentKind` no `container.ts` (ver `../design.md` §4).
- **GAP-2 — 🟡 reduzido.** A submissão é auditada pelo próprio `transitionContent` (`CONTENT_SUBMITTED_TO_MODERATION`).
  Resta só o evento de **ativação** `CANDIDATE_ROLE_ACTIVATED` — adicionar ao catálogo em #44 (os facts o assumem).
- **CAD-02 / CAD-04** são diferidos por design (USP-040 / USP-016 coordenador) — não são lacuna de cobertura
  desta US, mas estão marcados para não serem confundidos com "não testados".
