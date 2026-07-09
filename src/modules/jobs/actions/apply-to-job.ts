'use server';

import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { requireActiveConsent } from '@/modules/consents';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { hojeSaoPaulo } from '@/shared/lib/time';
import type { EmailMessage } from '@/shared/lib/email/email-sender.port';
import { isJobOpenForApplication, isProfileApplicable } from '../domain/application-rules';
import { ApplyConflictError } from '../domain/apply-errors';
import { applyToJobSchema, type ApplyToJobInput } from '../schemas/application.schema';

export interface ApplyToJobResult {
  applicationId: string;
}

/**
 * Candidata a Pessoa autenticada (papel candidato ativo) a uma vaga ativa (USP-025 /
 * CAN-01). Self-service — sem `requirePermission` (A-4): não há `PermissionId` de
 * candidatura no catálogo; o gate é sessão + `CandidateProfile.publicationStatus
 * ACTIVE` + consentimento `JOB_APPLICATION`.
 *
 * Sequência: Zod → `getCurrentPerson` → `requireActiveConsent(JOB_APPLICATION)` →
 * pré-condições (perfil ACTIVE, vaga aberta, sem candidatura ativa já existente) →
 * `withAudit(APPLICATION_CREATED)`: cria a `Application` (`viaEncaminhamento=false`)
 * + enfileira o e-mail de confirmação no `Outbox` (guardado por `emailLogin`
 * presente) na mesma transação (AD-007). A **garantia real** de unicidade é o
 * índice único parcial `uq_application_active` (USP-025 T1): o pré-check (E5) é só
 * UX amigável — sob corrida, `P2002` vira `CONFLICT` (CAN-025-MN-01). Nunca lança.
 */
export async function applyToJob(rawInput: ApplyToJobInput): Promise<ActionResult<ApplyToJobResult>> {
  const log = childLogger({ module: 'jobs', action: 'applyToJob' });

  const parsed = applyToJobSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { jobId } = parsed.data;

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  const consent = await requireActiveConsent(person.id, 'JOB_APPLICATION');
  if (!consent.active) {
    return fail(
      'CONSENT_REQUIRED',
      'É necessário aceitar o consentimento de candidatura a vagas antes de continuar.',
    );
  }

  const profile = await prisma.candidateProfile.findUnique({
    where: { personId: person.id },
    select: { publicationStatus: true },
  });
  if (!isProfileApplicable(profile)) {
    return fail('PRECONDITION_FAILED', 'Seu perfil de candidato não está ativo.');
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      title: true,
      status: true,
      validUntil: true,
      company: { select: { isVerified: true, nomeFantasia: true } },
    },
  });
  if (!job) {
    return fail('NOT_FOUND', 'Vaga não encontrada.');
  }
  if (!isJobOpenForApplication({ status: job.status, validUntil: job.validUntil, companyIsVerified: job.company.isVerified }, hojeSaoPaulo())) {
    return fail('PRECONDITION_FAILED', 'Esta vaga não está mais disponível.');
  }

  // Pré-check de UX (não é a garantia — ver docstring). Sob corrida, ambas as
  // requisições podem passar aqui; o índice único parcial decide no COMMIT.
  const existingActive = await prisma.application.findFirst({
    where: { jobId, candidatePersonId: person.id, cancelledAt: null },
    select: { id: true },
  });
  if (existingActive) {
    return fail('CONFLICT', 'Você já se candidatou a esta vaga.');
  }

  try {
    const applicationId = await withAudit(
      AuditEvent.APPLICATION_CREATED,
      async (tx, audit) => {
        let created;
        try {
          created = await tx.application.create({
            data: { jobId, candidatePersonId: person.id, viaEncaminhamento: false },
            select: { id: true },
          });
        } catch (err) {
          if (err instanceof Error && (err as { code?: string }).code === 'P2002') {
            throw new ApplyConflictError();
          }
          throw err;
        }

        const me = await tx.person.findUnique({
          where: { id: person.id },
          select: { emailLogin: true, fullName: true },
        });
        if (me?.emailLogin) {
          const message = {
            to: me.emailLogin,
            template: 'application-confirmation',
            data: {
              candidatoNome: me.fullName,
              vagaTitulo: job.title,
              empresaNome: job.company.nomeFantasia ?? 'Empresa',
            },
          } satisfies EmailMessage;
          await tx.outbox.create({ data: { topic: 'email', payload: message } });
        }

        audit.entityType = 'APPLICATION';
        audit.entityId = created.id;
        audit.after = { jobId, candidatePersonId: person.id, viaEncaminhamento: false };
        return created.id;
      },
      { actorUserId: person.supabaseUserId, actorPersonId: person.id, context: { jobId } },
    );

    log.info({ actorPersonId: person.id, jobId, applicationId }, 'jobs:application_created');
    return ok({ applicationId });
  } catch (err) {
    if (err instanceof ApplyConflictError || (err instanceof Error && (err as { code?: string }).code === 'P2002')) {
      return fail('CONFLICT', 'Você já se candidatou a esta vaga.');
    }
    log.error({ err, jobId }, 'jobs:apply_to_job_failed');
    return fail('INTERNAL', 'Não foi possível registrar sua candidatura. Tente novamente mais tarde.');
  }
}
