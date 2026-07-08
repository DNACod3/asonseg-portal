/**
 * Ator de sistema (Pessoa) para eventos de auditoria sem operador humano — hoje
 * só o job de expiração automática de vaga (USP-024 / `SYSTEM_JOB`).
 * `transitionContent` exige um `actorPersonId: string`; embora
 * `audit_log.actor_person_id` seja nullable e sem FK (comentário do schema:
 * "eventos sem ator, ex.: cron de expiração/purge"), seedamos uma Person real
 * (`prisma/seeds/reference.ts`, idempotente) para que a trilha de auditoria
 * tenha um `id` resolvível — coerente com qualquer join futuro (ADR-0004).
 */
export const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001';
