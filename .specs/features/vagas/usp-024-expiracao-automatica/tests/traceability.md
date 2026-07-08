# Rastreabilidade EARS → Fact — USP-024 Expiração automática de vaga

Fonte: `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-024.md` ·
`.specs/features/vagas/usp-024-expiracao-automatica/spec.md` · `design.md`. Gerado por skill-tdad (T0).

**Cobertura: 14/14 requisitos ativos com fact** (E-001..E-004, P-001, P-002, P-004, P-005, L-001..L-003,
U24-MN-06, U24-MN-07).

| Req | Tipo EARS | Texto (resumo) | Tipo de fact | Cenário BDD | Path-alvo do teste | Status |
|---|---|---|---|---|---|---|
| E-001 / AC-024-1 | WHEN…SHALL | cron expira ACTIVE vencida via transitionContent(SYSTEM_JOB) + JOB_EXPIRED | integração | `@ac-024-1 @e-001` | `src/modules/jobs/__tests__/run-job-expiration.int.test.ts` | Red |
| E-001 (preservação) | WHEN…SHALL | vaga vigente/já-EXPIRED inalteradas | integração | `@ac-024-1` | `run-job-expiration.int.test.ts` | Red |
| E-001 (vazio) | WHEN…SHALL | sem vagas vencidas → `{expired:0}` sem erro | integração | `@ac-024-1` (borda) | `run-job-expiration.int.test.ts` | Red |
| E-001 (não-ACTIVE) | IF…THEN | PAUSED/DRAFT/ARCHIVED vencida não é expirada | integração | `@ac-024-1` (Esquema) | `run-job-expiration.int.test.ts` | Red |
| U24-MN-07 (expiração) | SHALL NOT | reexecução sobre EXPIRED não re-expira/duplica auditoria | integração | `@ac-024-1 @u24-mn-07` | `run-job-expiration.int.test.ts` | Red |
| E-002 / P-001 | WHEN…SHALL NOT | vaga ACTIVE vencida (job não rodou) excluída da busca | integração | `@e-002 @p-001` | `src/modules/jobs/__tests__/expired-on-read.int.test.ts` | Red |
| E-002 / P-001 / P-004 | WHEN…SHALL NOT | idem no detalhe → "vaga encerrada", sem botão candidatar | integração | `@e-002 @p-001 @p-004` | `expired-on-read.int.test.ts` | Red |
| P-002 | WHEN…SHALL NOT | fronteira SP, não UTC; hoje(job)===hoje(query) | unit + integração | `@p-002` | `src/modules/jobs/__tests__/validade.spec.ts` + `run-job-expiration.int.test.ts` | Red |
| P-002 (borda) | WHEN…SHALL | validUntil exatamente hoje mantém ACTIVE | integração | `@p-002` (borda) | `run-job-expiration.int.test.ts` | Red |
| P-005 | WHEN…SHALL NOT | sem exclusão física de vaga/candidaturas | integração | `@p-005` | `run-job-expiration.int.test.ts` | Red |
| U24-MN-06 | WHEN…SHALL NOT | sem CRON_SECRET correto → 401, zero transições | integração | `@u24-mn-06` | `src/app/api/cron/expire-jobs/route.int.test.ts` | Red |
| L-001/L-003 (cron) | WHEN…SHALL | 503 sem env; 200 com resumo + log; 500 + log.error no erro | integração | (borda/happy-path) | `route.int.test.ts` | Red |
| E-003 | WHEN…SHALL | vaga D-3 sem lembrete → 1 linha Outbox + coluna marcada | integração | `@e-003 @u24-mn-07` | `src/modules/jobs/__tests__/expiry-reminder.int.test.ts` | Red |
| U24-MN-07 (reminder) | SHALL NOT | 2ª execução não reenfileira | integração | `@e-003 @u24-mn-07` (borda) | `expiry-reminder.int.test.ts` | Red |
| E-004 / P-003 | WHEN…SHALL | `diasAteExpiracao` correto por fuso; badge "expira em N dias" no painel | unit + e2e | `@e-004 @p-003` | `validade.spec.ts` + `tests/e2e/usp-024-expiracao-automatica.e2e.ts` | Red |

## Facts (bloco para o Kickoff Gate)

- AC-024-1 (happy + preservação + idempotência) → `src/modules/jobs/__tests__/run-job-expiration.int.test.ts`
- P-001/E-002 (defesa on-read) → `src/modules/jobs/__tests__/expired-on-read.int.test.ts`
- P-002 (timezone) → `src/modules/jobs/__tests__/validade.spec.ts` + `run-job-expiration.int.test.ts`
- P-005 (sem exclusão física) → `run-job-expiration.int.test.ts`
- U24-MN-06 + observabilidade → `src/app/api/cron/expire-jobs/route.int.test.ts`
- E-003/U24-MN-07 (reminder) → `src/modules/jobs/__tests__/expiry-reminder.int.test.ts`
- E-004/P-003 (badge) → `validade.spec.ts` (unit) + e2e (mover p/ `e2e/jobs/`, depende do painel USP-023)
- eventTypeFor(EXPIRED) (infra, compartilhada com USP-023/T1) → `src/modules/moderation/__tests__/transition-content.int.test.ts` (já coberto)

## Lacunas / decisões pendentes

Nenhuma ativa. P2 fora desta US (UAT pós-merge, conforme spec.md): entrega efetiva do e-mail D-3
(USP-044), dashboard operacional (USP-042/D-005), bloqueio da *ação* de candidatura a vaga expirada
(USP-025 — must-not herdado). `SYSTEM_ACTOR_ID` (ator do `SYSTEM_JOB`) resolvido no design (seed em
`seeds/reference.ts`) — não bloqueia, owner interno.
