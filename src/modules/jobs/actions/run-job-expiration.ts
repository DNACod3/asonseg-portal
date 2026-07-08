import { transitionContent, ContentKind, ContentStatus } from '@/modules/moderation';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { hojeSaoPaulo } from '@/shared/lib/time';
import { SYSTEM_ACTOR_ID } from '@/shared/system-actor';
import { enqueueExpiryReminder } from './enqueue-expiry-reminder';

/** `take` por página (obrigatório, CLAUDE.md); volume MVP é pequeno (<30 vagas). */
const BATCH_SIZE = 100;

/** Trava de segurança contra loop sem fim (nunca deveria disparar em uso normal). */
const MAX_ITERATIONS = 1000;

/** Dias de antecedência do aviso D-3 (USP-024 / E-003 / P2). */
const REMINDER_DAYS_BEFORE_EXPIRY = 3;

export interface RunJobExpirationResult {
  /** Vagas efetivamente transicionadas para EXPIRED. */
  expired: number;
  /** Vagas ACTIVE vencidas encontradas (inclui as que perderam a corrida — INVALID_TRANSITION). */
  scanned: number;
}

/**
 * Materializa `EXPIRED` em toda vaga `ACTIVE` cuja validade já passou (USP-024 / E-001 / T3).
 * A busca/detalhe públicos (USP-021/022) já ocultam a vaga on-read — este job é o outro lado
 * da defesa em profundidade (P-001/G2): faz o `status` persistido refletir a realidade.
 *
 * Pagina por `status='ACTIVE' AND validUntil < hoje(SP)` (re-consultando a cada iteração —
 * itens já transicionados saem naturalmente do filtro, sem precisar de offset/cursor) e chama
 * `transitionContent(JOB, EXPIRED, SYSTEM_JOB, SYSTEM_ACTOR_ID)` por vaga — cada uma sua
 * transação (concorrência otimista R3). Idempotente: reexecução não re-seleciona vaga já
 * `EXPIRED` (filtro `status=ACTIVE`); uma corrida perde com `INVALID_TRANSITION`, tratado como
 * no-op (não é erro). Nunca exclui fisicamente vaga nem candidaturas (P-005).
 */
export async function runJobExpiration(): Promise<RunJobExpirationResult> {
  const log = childLogger({ module: 'jobs', action: 'runJobExpiration' });

  let expired = 0;
  let scanned = 0;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // "Hoje" recalculado a cada página — P-002: mesma fronteira America/Sao_Paulo da query
    // on-read (`hojeSaoPaulo()`), determinística mesmo cruzando meia-noite BRT durante a execução.
    const hoje = hojeSaoPaulo();
    const batch = await prisma.job.findMany({
      where: { status: 'ACTIVE', validUntil: { lt: hoje } },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;
    scanned += batch.length;

    for (const job of batch) {
      const result = await transitionContent({
        contentKind: ContentKind.JOB,
        contentId: job.id,
        to: ContentStatus.EXPIRED,
        trigger: 'SYSTEM_JOB',
        actorPersonId: SYSTEM_ACTOR_ID,
      });
      if (result.ok) {
        expired++;
      } else if (result.error.code !== 'INVALID_TRANSITION') {
        // INVALID_TRANSITION = corrida perdida (no-op, U24-MN-07); qualquer outro erro é real.
        log.error({ jobId: job.id, error: result.error }, 'jobs:expire_job_failed');
      }
    }

    if (batch.length < BATCH_SIZE) break; // última página
  }

  await enqueueDueExpiryReminders(log);

  log.info({ expired, scanned }, 'jobs:run_job_expiration_completed');
  return { expired, scanned };
}

/**
 * Passo de aviso D-3 (USP-024 / T4 / E-003, P2): enfileira o lembrete de toda vaga
 * `ACTIVE` cuja validade cai em exatamente {@link REMINDER_DAYS_BEFORE_EXPIRY} dias
 * (America/Sao_Paulo) e que ainda não recebeu lembrete (`expiryReminderSentAt IS NULL`).
 * Mesma fronteira temporal de `runJobExpiration`/`hojeSaoPaulo()` (P-002).
 */
async function enqueueDueExpiryReminders(log: ReturnType<typeof childLogger>): Promise<void> {
  const reminderDate = hojeSaoPaulo();
  reminderDate.setUTCDate(reminderDate.getUTCDate() + REMINDER_DAYS_BEFORE_EXPIRY);

  const dueJobs = await prisma.job.findMany({
    where: { status: 'ACTIVE', validUntil: reminderDate, expiryReminderSentAt: null },
    select: { id: true },
    take: BATCH_SIZE,
  });

  for (const job of dueJobs) {
    try {
      await enqueueExpiryReminder(job.id);
    } catch (err) {
      log.error({ err, jobId: job.id }, 'jobs:expiry_reminder_step_failed');
    }
  }
}
