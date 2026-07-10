import { prisma } from '@/shared/lib/prisma';
import { childLogger } from '@/shared/lib/logger';
import type { EmailMessage } from '@/shared/lib/email/email-sender.port';

/** Dias de antecedência do aviso D-3 — o único `kind` hidratado por esta query hoje. */
const REMINDER_DAYS_BEFORE_EXPIRY = 3;

/**
 * Hidrata o payload leve `{kind:'JOB_EXPIRY_D3', jobId}` — enfileirado por
 * `enqueueExpiryReminder`/`runJobExpiration` (USP-024) — num `EmailMessage`
 * `job-expiry` completo, para o dispatcher assíncrono do Outbox (USP-044 /
 * AC-044-D3). Carrega a vaga + o responsável ATIVO da Empresa com `emailLogin`
 * (mesma relação `Job → Company → person_company_grants → Person` usada em
 * `add-responsible.ts`, USP-012/013), `select` explícito + `take` (CLAUDE.md).
 *
 * Retorna `null` — no-op gracioso (AC-044-D5) — quando a vaga não existe mais
 * (excluída fisicamente, cenário raro) ou nenhum responsável ATIVO da Empresa
 * tem e-mail cadastrado; o dispatcher marca a linha como processada sem
 * re-tentar. Nunca lança.
 */
export async function resolveJobExpiryEmail(jobId: string): Promise<EmailMessage | null> {
  const log = childLogger({ module: 'jobs', query: 'resolveJobExpiryEmail' });

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      title: true,
      company: {
        select: {
          nomeFantasia: true,
          grants: {
            where: {
              grantType: 'RESPONSIBLE',
              status: 'ACTIVE',
              revokedAt: null,
              person: { emailLogin: { not: null } },
            },
            select: { person: { select: { emailLogin: true } } },
            take: 1,
          },
        },
      },
    },
  });

  if (!job) {
    log.info({ jobId }, 'jobs:job_expiry_email_skipped_job_not_found');
    return null;
  }

  const to = job.company.grants[0]?.person.emailLogin;
  if (!to) {
    log.info({ jobId }, 'jobs:job_expiry_email_skipped_no_responsible_email');
    return null;
  }

  return {
    to,
    template: 'job-expiry',
    data: {
      empresaNome: job.company.nomeFantasia,
      vagaTitulo: job.title,
      // Este resolver só hidrata o kind 'JOB_EXPIRY_D3' (aviso a exatamente D-3
      // dias, enfileirado por `enqueueDueExpiryReminders`) — a contagem é fixa.
      diasRestantes: REMINDER_DAYS_BEFORE_EXPIRY,
    },
  } satisfies EmailMessage;
}
