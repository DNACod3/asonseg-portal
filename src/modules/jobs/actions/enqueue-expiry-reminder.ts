import { prisma } from '@/shared/lib/prisma';
import { childLogger } from '@/shared/lib/logger';

/** Conflito de concorrência otimista — o lembrete já foi enfileirado por outra execução. */
class ReminderAlreadySentError extends Error {}

/**
 * Payload leve gravado na Outbox (`topic='email'`) — **não** é um `EmailMessage`
 * já-renderizado (esses têm destinatário/dados resolvidos no momento do enqueue,
 * ex. `responsible-link-pending`). Aqui só o essencial para o dispatcher da
 * **USP-044** (downstream, fora de escopo) montar o e-mail no momento da entrega,
 * buscando a vaga/responsável então — desacopla o produtor (cron) do template.
 */
export type JobExpiryReminderPayload = {
  kind: 'JOB_EXPIRY_D3';
  jobId: string;
};

/**
 * Enfileira o aviso de expiração próxima (D-3) de UMA vaga na Outbox, marcando
 * `expiryReminderSentAt` na MESMA transação (USP-024 / T4 / E-003 / U24-MN-07).
 * Idempotente: `updateMany({ where: { id, expiryReminderSentAt: null } })` só casa
 * na 1ª vez — uma corrida/reexecução perde a condição e não duplica a linha Outbox.
 *
 * Retorna `true` se enfileirou agora, `false` se já havia sido enfileirado antes
 * (no-op, não é erro).
 */
export async function enqueueExpiryReminder(jobId: string): Promise<boolean> {
  const log = childLogger({ module: 'jobs', action: 'enqueueExpiryReminder' });
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.job.updateMany({
        where: { id: jobId, expiryReminderSentAt: null },
        data: { expiryReminderSentAt: new Date() },
      });
      if (result.count !== 1) {
        throw new ReminderAlreadySentError();
      }
      const payload: JobExpiryReminderPayload = { kind: 'JOB_EXPIRY_D3', jobId };
      await tx.outbox.create({ data: { topic: 'email', payload } });
    });
    log.info({ jobId }, 'jobs:expiry_reminder_enqueued');
    return true;
  } catch (err) {
    if (err instanceof ReminderAlreadySentError) {
      return false;
    }
    log.error({ err, jobId }, 'jobs:expiry_reminder_failed');
    throw err;
  }
}
