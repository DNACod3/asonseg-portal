# USP-009 — Cadastro de candidato — Tasks

> Deriva de [`design.md`](./design.md). 1 task = 1 PR (squash). Estimate total = **20h** (= 4+3+7+6, bate com o board).
> Status do board (2026-06-10): #36 **Ready** · #41/#44/#46 **Backlog**.
> **Atualização 2026-06-10 (USP-016 mergeada):** GAP-1 destravado — #44 deixa de estar bloqueada; ganha trabalho de integração com `moderation` (ContentKind + adapter + container). GAP-3 resolvido (ContentStatus já no schema).

## Grafo de dependências

```
#36 (schema) ──▶ #41 (domain+schemas) ──▶ #44 (server actions) ──▶ #46 (UI)
                                              │
                                              └─ depende de @/modules/moderation (USP-016 ✅ mergeada):
                                                 transitionContent + ContentKind.CANDIDATE_PROFILE
                                                 + PrismaCandidateProfileStatusRepository + dispatch no container
```

Cadeia linear: cada task desbloqueia a próxima ao fechar (cascade do protocolo OpenWolf, regra 5). A dependência externa de #44 (moderation) **já está satisfeita**.

---

## T1 — #36 · feat(persons): model CandidateProfile + migration  ·  ~3h (era 4h) · In Progress

- **What:** model Prisma `CandidateProfile` (referenciando o `ContentStatus` existente) + relações reversas + migration. O `enum ContentStatus` **não** faz mais parte desta task (entregue pela USP-016).
- **Where:** `prisma/schema.prisma`; migration em `prisma/migrations/`.
- **Depends on:** fundação de `Person`/`Role` (Fase 1) — já existe.
- **Reuses:** `Person`, `JobArea` (já no schema); `enum ContentStatus` (USP-016); contrato verbatim de `technical-design.md §2.2`.
- **Nota de estimativa:** reduzida de 4h → ~3h porque o `ContentStatus` (parte do plano original da #36) já veio da USP-016; resta só model + relações + migration.
- **Done when:**
  - [ ] Model `CandidateProfile` com todos os campos (incl. `cv*`) e `@@index([publicationStatus])`.
  - [ ] `publicationStatus` **referencia** o enum `ContentStatus` já existente no schema (USP-016) — **não redeclarar** (GAP-3 resolvido).
  - [ ] Relações reversas em `Person` (`candidateProfile?`) e `JobArea` (`candidateProfiles[]`) — GAP-4.
  - [ ] Migration aplicável via `prisma migrate`; `prisma generate` sem erro.
- **Tests:** N/A direto — validação por migration + typecheck. Smoke `supabase db reset` / `prisma migrate` local.
- **Gate:** `npm run typecheck` ✓ · migration aplica em DB limpo ✓.

## T2 — #41 · feat(persons): schemas e domain do cadastro de candidato  ·  3h · Backlog

- **What:** Zod schema + enum/tipos/regras puras do cadastro.
- **Where:** `src/modules/persons/schemas/candidate.ts`, `src/modules/persons/domain/candidate.ts`, barrel `index.ts`.
- **Depends on:** #36.
- **Reuses:** Zod 3.x; convenção de mensagens PT-BR e `domain/` sem IO (vide `inactivate-person`).
- **Done when:**
  - [ ] Schema rejeita ausência de `educationLevel`/`primaryAreaOfInterestId`/`phone` com mensagens PT-BR.
  - [ ] Opcionais aceitos; tipos derivados via `z.infer`.
  - [ ] `enum EducationLevel` + `normalizePhone()` (puro) no domain.
  - [ ] Export via barrel `@/modules/persons`.
- **Tests:** **unit** — `usp-009` em `persons/__tests__/`: validação Zod (happy + faltando cada obrigatório) · `normalizePhone`. (red antes da impl — ver skill-tdad.)
- **Gate:** `npm run typecheck` ✓ · `npm run lint` ✓ · unit verde após impl.

## T3 — #44 · feat(persons): ativar candidato e enviar perfil para moderação  ·  7h · Backlog ✅ destravada

- **What:** Server Actions `activateCandidateRole` (→ CandidateProfile DRAFT) e `submitCandidateForModeration` (→ IN_MODERATION via `transitionContent`) + **integração do CandidateProfile na máquina de estados de `moderation`**.
- **Where:** `src/modules/persons/actions/activate-candidate-role.ts`, `.../submit-candidate-for-moderation.ts`, `src/modules/persons/adapters/prisma-candidate-profile-status.ts`, `__tests__/`, barrel; edita `src/modules/moderation/domain/content-status.ts` (enum+TRANSITIONS) e `src/shared/container.ts` (dispatch).
- **Depends on:** #36, #41; `@/modules/moderation` (USP-016 ✅), `@/modules/consents`, `@/modules/audit`, `@/modules/identity` (todos existem).
- **Reuses:** `requirePermission`, `requireActiveConsent`/`grantConsent`, `withAudit`, `ActionResult`, **`transitionContent` + `ContentKind`/`ContentStatus` + `ContentStatusRepository`/`CONTENT_STATUS_REPOSITORY_TOKEN`** (`@/modules/moderation`).
- **Done when:**
  - [ ] `activateCandidateRole`: sequência canônica (Zod → `requirePermission` → `requireActiveConsent` PORTAL_ACCESS + JOB_APPLICATION → idempotência → `withAudit('CANDIDATE_ROLE_ACTIVATED', upsert DRAFT)`).
  - [ ] Evento `CANDIDATE_ROLE_ACTIVATED` adicionado ao catálogo `@/modules/audit/events` (GAP-2; o de submissão **não** é necessário — `transitionContent` emite `CONTENT_SUBMITTED_TO_MODERATION`).
  - [ ] **Integração moderation:** `ContentKind.CANDIDATE_PROFILE` + transições em `TRANSITIONS`; adapter `PrismaCandidateProfileStatusRepository implements ContentStatusRepository` sobre `candidate_profiles`; refatorar `container.ts` para despacho por `ContentKind` (fixture como default dos kinds não aterrissados).
  - [ ] `submitCandidateForModeration`: valida permissão/propriedade → `transitionContent({contentKind: CANDIDATE_PROFILE, contentId: personId, to: IN_MODERATION, trigger: 'AUTHOR_ACTION', actorPersonId})`. **Nunca** `prisma.update` de status (a auditoria é feita pelo próprio `transitionContent`).
  - [ ] Retorno `ActionResult<T>`; nunca `throw`; nunca retornar model Prisma cru. Idempotência: reativar não duplica.
- **Tests:** **integração** (`*.int.test.ts`): `activateCandidateRole` (happy · Zod · permissão · consentimento ausente · idempotência); `submitCandidateForModeration` (DRAFT→IN_MODERATION, NOT_FOUND, INVALID_TRANSITION) — reusar padrão de `moderation/__tests__/transition-content.int.test.ts` com seed real em `candidate_profiles`. Adapter: teste de `loadStatus`/`updateStatus` (concorrência otimista).
- **Gate:** `npm run typecheck` ✓ · `npm run lint` ✓ · integração verde · **sem regressão** nos testes de `moderation` (JOB/CV/SERVICE continuam na fixture após o dispatch).

## T4 — #46 · feat(persons): tela de cadastro de candidato (formulário + consentimento)  ·  6h · Backlog

- **What:** Página/rota autenticada com form RHF+Zod, aceite de consentimento e envio para moderação.
- **Where:** `src/app/(app)/candidato/page.tsx`, `src/modules/persons/components/candidate-form.tsx` (+ campos de consentimento).
- **Depends on:** #44. (UI de anexo/extração de CV → USP-040.)
- **Reuses:** padrão `force-dynamic` + `requireActivePerson()` (`(app)/consentimentos/page.tsx`); shadcn/ui + Tailwind; `zodResolver` + `candidateSchema` (#41).
- **Done when:**
  - [ ] Form valida no cliente (Zod) e exibe erros PT-BR.
  - [ ] Submit bloqueado sem aceite de `PORTAL_ACCESS` + `JOB_APPLICATION`.
  - [ ] Submit chama `activateCandidateRole`; trata `ActionResult` (toast PT-BR).
  - [ ] Botão "Enviar para moderação" → `submitCandidateForModeration`; reflete DRAFT → IN_MODERATION.
  - [ ] Placeholder de integração para upload/extração de CV (USP-040).
- **Tests:** **componente** — render do form · bloqueio de submit sem consentimento · exibição de erros de validação.
- **Gate:** `npm run typecheck` ✓ · `npm run lint` ✓ · testes de componente verdes.

---

## Definition of Done (US #31)

- [ ] CAD-01, CAD-03, CAD-05 + EDGE implementados e cobertos por testes (CAD-02 → USP-040; CAD-04 → USP-016/coordenador + e-mail).
- [ ] Sub-tasks #36/#41/#44/#46 fechadas e PRs merged (squash).
- [ ] Sem regressão em `typecheck`/`lint`/testes (incl. suíte de `moderation`); CI build + E2E verdes.
- [ ] GAP-1 ✅ (USP-016) e GAP-3 ✅ (ContentStatus no schema) resolvidos; GAP-2 (evento `CANDIDATE_ROLE_ACTIVATED`) e GAP-4 (relações reversas) entregues em #44/#36.

## Facts (Kickoff Gate)

Testes-fonte **gerados** (skill-tdad, 2026-06-10) em [`tests/`](./tests/) — todos em status **Red**:
- BDD: [`tests/bdd/usp-009-cadastro-candidato.feature`](./tests/bdd/usp-009-cadastro-candidato.feature) — 12 cenários, tags `@cad-01..@cad-05`.
- Vitest red: [`tests/unit/usp-009-cadastro-candidato.spec.ts`](./tests/unit/usp-009-cadastro-candidato.spec.ts) — roda red limpo (8 failed por `not implemented` + 9 todo).
- E2E (apoio, não Top 8): conectado em [`e2e/candidato.spec.ts`](../../../../../e2e/candidato.spec.ts) na fase Execute — spec real e executável no CI (trava o confinamento da rota; fluxo completo coberto em unit/int, por decisão de pirâmide).
- Matriz: [`tests/traceability.md`](./tests/traceability.md) — cobertura 5/5 requisitos (CAD-02 diferido USP-040, CAD-03 bloqueado USP-016, CAD-04 fora/USP-016).

Na fase Execute, mover/conectar os facts aos paths-alvo de cada task (`modules/persons/__tests__/`, `schemas/`, `components/__tests__/`).
