# Rastreabilidade EARS → Fact — USP-023 Editar vaga (pausar, arquivar, renovar)

Fonte: `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-023.md` · `.specs/features/vagas/usp-023-editar-vaga/spec.md` ·
`.specs/features/vagas/usp-023-editar-vaga/design.md`. Regenerado por skill-tdad em T0 (substitui geração anterior stale).

**N/A (resolvido pelo dono do intent, ver spec.md Out of Scope):** P-002 (teto de nº de prorrogações — livre) ·
P-004 (notificar candidatos na re-moderação — sem).

**Cobertura: 11/11 requisitos ativos com fact** (E-001..E-005, P-001, P-003, P-005/D-005, P-006, L-003, U23-MN-07).

| Req | Tipo EARS | Texto (resumo) | Tipo de fact | Cenário BDD | Path-alvo do teste | Status |
|---|---|---|---|---|---|---|
| E-001 / AC-023-1 | WHEN…SHALL | editar vaga ACTIVE → DRAFT + auditoria before/after | integração | `@ac-023-1` | `src/modules/jobs/__tests__/edit-job.int.test.ts` | Red |
| E-005 / P-001 / D-006 | WHEN…SHALL NOT | published_at preservado na re-aprovação | integração | `@ac-023-1 @e-005 @p-001` | `src/modules/jobs/__tests__/edit-job.int.test.ts` + `published-at.int.test.ts` | Red |
| P-001 (1ª ativação) | WHEN…SHALL | published_at=now() na 1ª ativação | integração | `@ac-023-1 @p-001` | `src/modules/jobs/__tests__/published-at.int.test.ts` | Red |
| P-005 / D-005 (editJob) | IF…THEN | não-responsável → FORBIDDEN sem escrita | integração | `@ac-023-1 @p-005` | `src/modules/jobs/__tests__/edit-job.int.test.ts` | Red |
| E-001 (precondição) | IF…THEN | vaga não-ACTIVE recusa edição | integração | `@ac-023-1` (borda) | `src/modules/jobs/__tests__/edit-job.int.test.ts` | Red |
| E-002 / AC-023-2 | WHEN…SHALL | pausar ACTIVE→PAUSED + JOB_PAUSED, some da busca | integração | `@ac-023-2` | `src/modules/jobs/__tests__/pause-job.int.test.ts` | Red |
| E-002 (despausar) | WHEN…SHALL | despausar PAUSED→ACTIVE + JOB_UNPAUSED, sem re-moderação | integração | `@ac-023-2` | `src/modules/jobs/__tests__/pause-job.int.test.ts` | Red |
| P-003 | WHEN…SHALL NOT | detalhe PAUSED mostra mensagem, sem candidatar-se | integração + e2e | `@ac-023-2 @p-003` | `src/modules/jobs/__tests__/get-paused-job-notice.int.test.ts` + `e2e` | Red |
| P-005 / D-005 (pause/unpause) | IF…THEN | não-responsável → FORBIDDEN | integração | `@ac-023-2 @p-005` | `src/modules/jobs/__tests__/pause-job.int.test.ts` | Red |
| E-003 / AC-023-3 | WHEN…SHALL | arquivar ACTIVE→ARCHIVED + JOB_ARCHIVED, sai de listagens | integração | `@ac-023-3` | `src/modules/jobs/__tests__/archive-job.int.test.ts` | Red |
| P-006 | WHEN…SHALL NOT | ARCHIVED→ACTIVE recusado (INVALID_TRANSITION) | integração | `@ac-023-3 @p-006` | `src/modules/jobs/__tests__/archive-job.int.test.ts` | Red |
| P-005 / D-005 (archive) | IF…THEN | não-responsável → FORBIDDEN | integração | `@ac-023-3 @p-005` | `src/modules/jobs/__tests__/archive-job.int.test.ts` | Red |
| E-004 / AC-023-4 | WHEN…SHALL | prorrogar validade sem re-moderação + JOB_VALIDITY_EXTENDED | integração | `@ac-023-4` | `src/modules/jobs/__tests__/extend-job-validity.int.test.ts` | Red |
| E-004 (validação) | IF…THEN | data passada/>180d → VALIDATION | integração + unit | `@ac-023-4` (borda) | `src/modules/jobs/__tests__/extend-job-validity.int.test.ts` | Red |
| E-004 (repetição) | WHEN…SHALL | 3 prorrogações seguidas aceitas (P-002 N/A) | integração | `@ac-023-4` | `src/modules/jobs/__tests__/extend-job-validity.int.test.ts` | Red |
| P-005 / D-005 (extend) | IF…THEN | não-responsável → FORBIDDEN | integração | `@ac-023-4 @p-005` | `src/modules/jobs/__tests__/extend-job-validity.int.test.ts` | Red |
| L-003 | SHALL (ubíquo) | toda transição auditada (responsável, data/hora, motivo opcional) | integração | todas acima | `src/modules/jobs/__tests__/*.int.test.ts` (assert de `audit_log`) | Red |
| U23-MN-07 | SHALL NOT (ubíquo) | sem escrita de Job.status fora de adapter/editJob | unit (guarda estática `node:fs`) | `@u23-mn-07` | `src/modules/jobs/__tests__/no-out-of-band-status-write.test.ts` | Red |
| eventTypeFor kind-aware (infra T1) | SHALL | mapeia JOB PAUSED/ARCHIVED/UNPAUSED/EXPIRED | unit + integração | (infra, sem AC próprio) | `src/modules/moderation/__tests__/*.spec.ts` | Red |
| Painel (G7) | WHEN…SHALL | lista vagas da Empresa com ações contextuais | integração + e2e | `@painel` | `src/modules/jobs/__tests__/list-company-jobs.int.test.ts` + e2e | Red |
| Painel / P-005 | IF…THEN | não-responsável → 404 sem revelar Empresa | integração + e2e | `@painel @p-005` | `src/modules/jobs/__tests__/list-company-jobs.int.test.ts` + e2e | Red |
| Fluxo editar (UI) | WHEN…SHALL | editJob → submitJobForModeration encadeados | e2e | `@painel` | `e2e/jobs/*.spec.ts` | Red |

## Facts (bloco para o Kickoff Gate)

- AC-023-1 (editJob happy + FORBIDDEN + precondição) → `src/modules/jobs/__tests__/edit-job.int.test.ts`
- E-005/P-001/D-006 (published_at preservado) → `edit-job.int.test.ts` + `published-at.int.test.ts`
- AC-023-2 (pause/unpause) → `src/modules/jobs/__tests__/pause-job.int.test.ts`
- P-003 (detalhe pausado) → `src/modules/jobs/__tests__/get-paused-job-notice.int.test.ts` + `e2e`
- AC-023-3 (archive + P-006 terminal) → `src/modules/jobs/__tests__/archive-job.int.test.ts`
- AC-023-4 (extend) → `src/modules/jobs/__tests__/extend-job-validity.int.test.ts`
- U23-MN-07 (guarda estática) → `src/modules/jobs/__tests__/no-out-of-band-status-write.test.ts`
- Painel (lista + confinamento) → `src/modules/jobs/__tests__/list-company-jobs.int.test.ts` + `e2e`
- eventTypeFor kind-aware (infra) → `src/modules/moderation/__tests__/*.spec.ts`
- E2E fluxos → `.specs/features/vagas/usp-023-editar-vaga/tests/e2e/usp-023-editar-vaga.e2e.ts` (mover p/ `e2e/jobs/`)

## Lacunas / decisões pendentes

Nenhuma. Todas as ambiguidades foram resolvidas em modo autônomo em `spec.md` (Assumptions & Open
Questions) — entry gate limpo, nenhum item de owner externo.
