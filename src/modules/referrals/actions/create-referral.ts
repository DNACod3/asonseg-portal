'use server';

import { headers } from 'next/headers';
import { requirePermission } from '@/modules/identity';
import { AuditEvent, withAudit, recordAuditEvent } from '@/modules/audit';
import { loadTerm, TermLoaderError } from '@/modules/consents';
import { ensureCandidateRole } from '@/modules/persons';
import { createReferralApplication, isJobOpenForApplication, ApplyConflictError } from '@/modules/jobs';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { hojeSaoPaulo } from '@/shared/lib/time';
import type { EmailMessage } from '@/shared/lib/email/email-sender.port';
import { isProfessionalSummaryRequired } from '../domain/referral-rules';
import { createReferralSchema, type CreateReferralInput } from '../schemas/referral.schema';

export interface CreateReferralResult {
  referralId: string;
  applicationId: string;
}

/** Vaga deixou de estar ACTIVE entre o pré-check e a persistência (REF-MN-02 / EC-3). */
class ReferralPreconditionError extends Error {}

/**
 * Encaminha institucionalmente uma Pessoa já cadastrada para uma vaga ativa
 * (USP-037 / SOC-03, SOC-04). Ação sensível — sequência canônica (CLAUDE.md):
 *
 * Zod → `requirePermission('REFER_PERSON_TO_JOB')` (REF-MN-04) → pré-condições
 * fora da tx (resumo profissional quando sem CV — REF-MN-03; vaga ACTIVE —
 * pré-check de UX; duplicata de candidatura ativa — pré-check de UX) →
 * `loadTerm('SOCIAL_REFERRAL_TO_JOB')` → `withAudit(REFERRAL_CREATED)`:
 * `ensureCandidateRole` (aceite tácito, AC-037-2) → **revalida** a vaga ACTIVE
 * dentro da tx (garantia real de REF-MN-02, fecha a janela EC-3) → `INSERT
 * referral` → `createReferralApplication` (candidatura vinculada, AC-037-5;
 * garantia real de REF-MN-01 é o índice único parcial `uq_application_active`,
 * via `ApplyConflictError`/P2002) → `APPLICATION_CREATED` secundário →
 * enfileira `referral-notification` no Outbox quando a Pessoa tem `emailLogin`
 * (EC-2: sem e-mail, encaminhamento OK, sem linha no Outbox). Nunca lança.
 */
export async function createReferral(
  rawInput: CreateReferralInput,
): Promise<ActionResult<CreateReferralResult>> {
  const log = childLogger({ module: 'referrals', action: 'createReferral' });

  const parsed = createReferralSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados do encaminhamento inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { personId, jobId, professionalSummary, justification } = parsed.data;

  const authz = await requirePermission('REFER_PERSON_TO_JOB');
  if (!authz.ok) return authz;
  const actor = authz.data.person;

  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      fullName: true,
      emailLogin: true,
      candidateProfile: { select: { cvStoragePath: true } },
    },
  });
  if (!person) {
    return fail('NOT_FOUND', 'Pessoa ou vaga não encontrada.');
  }

  const hasCv = person.candidateProfile?.cvStoragePath != null;
  if (isProfessionalSummaryRequired(hasCv, professionalSummary)) {
    return fail('VALIDATION', 'Informe o resumo profissional: a Pessoa não possui CV anexo.');
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
    return fail('NOT_FOUND', 'Pessoa ou vaga não encontrada.');
  }
  if (
    !isJobOpenForApplication(
      { status: job.status, validUntil: job.validUntil, companyIsVerified: job.company.isVerified },
      hojeSaoPaulo(),
    )
  ) {
    return fail('PRECONDITION_FAILED', 'A vaga não está mais ativa e não pode receber encaminhamentos.');
  }

  // Pré-check de UX (não é a garantia — ver docstring). Sob corrida, a garantia
  // real é o índice único parcial `uq_application_active` (P2002 dentro da tx).
  const existingActive = await prisma.application.findFirst({
    where: { jobId, candidatePersonId: personId, cancelledAt: null },
    select: { id: true },
  });
  if (existingActive) {
    return fail('CONFLICT', 'Esta Pessoa já possui uma candidatura ativa para esta vaga.');
  }

  let term;
  try {
    term = await loadTerm('SOCIAL_REFERRAL_TO_JOB');
  } catch (err) {
    if (err instanceof TermLoaderError) {
      log.error({ code: err.code }, 'referrals:create_referral_term_unavailable');
      return fail(
        'PRECONDITION_FAILED',
        'Termo de encaminhamento institucional indisponível no momento. Tente novamente mais tarde.',
      );
    }
    throw err;
  }

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  try {
    const { referralId, applicationId } = await withAudit(
      AuditEvent.REFERRAL_CREATED,
      async (tx, audit) => {
        await ensureCandidateRole(tx, {
          personId,
          term: { version: term.version, hash: term.hash },
          ip,
          userAgent,
        });

        // Revalidação @persist (garantia real de REF-MN-02 / fecha EC-3): a vaga
        // pode ter deixado de estar ACTIVE entre o pré-check e este ponto.
        const jobAtPersist = await tx.job.findUnique({
          where: { id: jobId },
          select: { status: true, validUntil: true, company: { select: { isVerified: true } } },
        });
        if (
          !jobAtPersist ||
          !isJobOpenForApplication(
            {
              status: jobAtPersist.status,
              validUntil: jobAtPersist.validUntil,
              companyIsVerified: jobAtPersist.company.isVerified,
            },
            hojeSaoPaulo(),
          )
        ) {
          throw new ReferralPreconditionError();
        }

        const referral = await tx.referral.create({
          data: { personId, jobId, referrerPersonId: actor.id, justification, professionalSummary },
          select: { id: true },
        });

        const { applicationId: createdApplicationId } = await createReferralApplication(tx, {
          jobId,
          candidatePersonId: personId,
          referralId: referral.id,
        });

        await recordAuditEvent(
          tx,
          AuditEvent.APPLICATION_CREATED,
          {
            entityType: 'APPLICATION',
            entityId: createdApplicationId,
            after: { jobId, candidatePersonId: personId, viaEncaminhamento: true, viaReferralId: referral.id },
          },
          { actorUserId: actor.supabaseUserId, actorPersonId: actor.id, ip, userAgent, context: { jobId } },
        );

        if (person.emailLogin) {
          const message = {
            to: person.emailLogin,
            template: 'referral-notification',
            data: {
              pessoaNome: person.fullName,
              vagaTitulo: job.title,
              empresaNome: job.company.nomeFantasia ?? 'Empresa',
            },
          } satisfies EmailMessage;
          await tx.outbox.create({ data: { topic: 'email', payload: message } });
        }

        audit.entityType = 'REFERRAL';
        audit.entityId = referral.id;
        audit.after = { personId, jobId, referrerPersonId: actor.id, justification, professionalSummary };

        return { referralId: referral.id, applicationId: createdApplicationId };
      },
      {
        actorUserId: actor.supabaseUserId,
        actorPersonId: actor.id,
        ip,
        userAgent,
        context: { jobId, personId },
      },
    );

    log.info({ actorPersonId: actor.id, personId, jobId, referralId }, 'referrals:referral_created');
    return ok({ referralId, applicationId });
  } catch (err) {
    if (err instanceof ApplyConflictError || (err instanceof Error && (err as { code?: string }).code === 'P2002')) {
      return fail('CONFLICT', 'Esta Pessoa já possui uma candidatura ativa para esta vaga.');
    }
    if (err instanceof ReferralPreconditionError) {
      return fail('PRECONDITION_FAILED', 'A vaga não está mais ativa e não pode receber encaminhamentos.');
    }
    log.error({ err, personId, jobId }, 'referrals:create_referral_failed');
    return fail('INTERNAL', 'Erro ao processar o encaminhamento.');
  }
}
