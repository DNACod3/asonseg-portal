'use server';

import { getCurrentPerson } from '@/modules/identity';
import { transitionContent, ContentKind, ContentStatus } from '@/modules/moderation';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { isJobDedupViolation } from '../domain/dedup';
import { submitJobSchema, type SubmitJobInput } from '../schemas/publish-job.schema';

export interface SubmitJobResult {
  jobId: string;
  status: ContentStatus;
}

/**
 * Submete uma vaga à moderação (USP-020 / E-001 / AC-020-1). Aceita um rascunho
 * existente (`{ jobId }`) ou um formulário completo (cria DRAFT + transiciona numa só
 * chamada). A vaga vai de `DRAFT` a `IN_MODERATION` via `transitionContent`
 * (ContentKind.JOB, AUTHOR_ACTION), que grava `CONTENT_SUBMITTED_TO_MODERATION` no
 * audit (L-004) na mesma transação da troca de status (ADR-0011 / ADR-0020).
 *
 * Sequência canônica (runbook-server-action):
 *  1. Valida input com Zod completo (L-003 + validade futura E-004/E-005) → VALIDATION.
 *  2. Resolve Pessoa autenticada (ADR-0030) → UNAUTHENTICATED.
 *  3. Gate P-006 (responsável ATIVO da Empresa), **antes** de persistir → FORBIDDEN (anti-bypass D-005).
 *  4. Persiste/recupera a vaga em DRAFT (form direto cria; P2002 no dedup → CONFLICT, P-003).
 *  5. `transitionContent(JOB, jobId, IN_MODERATION, AUTHOR_ACTION)` — propaga INVALID_TRANSITION
 *     (submit concorrente, ADR-0011 R3) / NOT_FOUND.
 *  6. Retorno ActionResult. Nunca `throw`.
 */
export async function submitJobForModeration(
  rawInput: SubmitJobInput,
): Promise<ActionResult<SubmitJobResult>> {
  const log = childLogger({ module: 'jobs', action: 'submitJobForModeration' });

  // 1. Validação.
  const parsed = submitJobSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // 2. Pessoa autenticada.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  let jobId: string;

  if ('jobId' in data) {
    // 4a. Submissão de rascunho existente.
    const job = await prisma.job.findUnique({
      where: { id: data.jobId },
      select: { id: true, companyId: true },
    });
    if (!job) {
      return fail('NOT_FOUND', 'Vaga não encontrada.');
    }
    // 3. Gate P-006 sobre a Empresa da vaga.
    if (!(await isActiveResponsible(person.id, job.companyId))) {
      return fail('FORBIDDEN', 'Você não é responsável ativo desta Empresa.');
    }
    jobId = job.id;
  } else {
    // 3. Gate P-006 ANTES de persistir (anti-bypass D-005).
    if (!(await isActiveResponsible(person.id, data.companyId))) {
      return fail('FORBIDDEN', 'Você não é responsável ativo desta Empresa.');
    }
    // 4b. Form direto: cria a vaga em DRAFT (a transição faz o submit + auditoria).
    try {
      const created = await prisma.job.create({
        data: {
          companyId: data.companyId,
          authorPersonId: person.id,
          title: data.title,
          areaId: data.areaId,
          description: data.description,
          requirements: data.requirements,
          workRegime: data.workRegime,
          location: data.location,
          benefits: data.benefits ?? null,
          salary: data.salary ?? null,
          validUntil: new Date(data.validUntil),
          status: 'DRAFT',
        },
        select: { id: true },
      });
      jobId = created.id;
    } catch (err) {
      if (isJobDedupViolation(err)) {
        return fail('CONFLICT', 'Já existe uma vaga com este título nesta área para a Empresa.');
      }
      const errCode = err instanceof Error ? (err as NodeJS.ErrnoException).code ?? err.message : String(err);
      log.error({ errCode }, 'jobs:submit_create_failed');
      return fail('INTERNAL', 'Não foi possível enviar a vaga. Tente novamente mais tarde.');
    }
  }

  // 5. Transição DRAFT → IN_MODERATION (grava CONTENT_SUBMITTED_TO_MODERATION — E-001/L-004).
  const transition = await transitionContent({
    contentKind: ContentKind.JOB,
    contentId: jobId,
    to: ContentStatus.IN_MODERATION,
    trigger: 'AUTHOR_ACTION',
    actorPersonId: person.id,
  });
  if (!transition.ok) {
    return transition;
  }

  log.info({ actorPersonId: person.id, jobId }, 'jobs:submitted_to_moderation');
  return ok({ jobId, status: transition.data.to });
}

/** Gate P-006: a Pessoa é responsável ATIVO (não revogado) da Empresa? */
async function isActiveResponsible(personId: string, companyId: string): Promise<boolean> {
  const grant = await prisma.personCompanyGrant.findFirst({
    where: {
      personId,
      companyId,
      grantType: 'RESPONSIBLE',
      status: 'ACTIVE',
      revokedAt: null,
    },
    select: { id: true },
  });
  return grant != null;
}
