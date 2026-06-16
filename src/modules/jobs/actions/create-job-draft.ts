'use server';

import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { isJobDedupViolation } from '../domain/dedup';
import { draftJobSchema, type DraftJobInput } from '../schemas/publish-job.schema';

export interface CreateJobDraftResult {
  jobId: string;
  status: 'DRAFT';
}

/**
 * Salva uma vaga como **rascunho** (USP-020 / E-003 / AC-020-4). O rascunho nasce
 * em `DRAFT` e NÃO entra na fila de moderação — fica disponível para edição/submit.
 *
 * Sequência canônica (runbook-server-action):
 *  1. Valida input com Zod (rascunho: só `companyId` + `title` obrigatórios — L-003 só no submit).
 *  2. Resolve Pessoa autenticada (status revalidado — ADR-0030) → UNAUTHENTICATED.
 *  3. Gate P-006: o ator deve ser responsável ATIVO da Empresa → FORBIDDEN (antes de persistir).
 *  4. withAudit(JOB_DRAFT_SAVED): `tx.job.create` em DRAFT atomicamente (ADR-0020/0023).
 *  5. Retorno ActionResult. P2002 no índice de dedup → CONFLICT (P-003). Nunca `throw`.
 */
export async function createJobDraft(
  rawInput: DraftJobInput,
): Promise<ActionResult<CreateJobDraftResult>> {
  const log = childLogger({ module: 'jobs', action: 'createJobDraft' });

  // 1. Validação (rascunho).
  const parsed = draftJobSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // 2. Pessoa autenticada.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // 3. Gate P-006: só responsável ATIVO da Empresa pode publicar em nome dela.
  const actorGrant = await prisma.personCompanyGrant.findFirst({
    where: {
      personId: person.id,
      companyId: data.companyId,
      grantType: 'RESPONSIBLE',
      status: 'ACTIVE',
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!actorGrant) {
    return fail('FORBIDDEN', 'Você não é responsável ativo desta Empresa.');
  }

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  // 4. Persistência atômica do rascunho + auditoria.
  try {
    const created = await withAudit(
      AuditEvent.JOB_DRAFT_SAVED,
      async (tx, audit) => {
        const job = await tx.job.create({
          data: {
            companyId: data.companyId,
            authorPersonId: person.id,
            title: data.title,
            areaId: data.areaId ?? null,
            description: data.description ?? null,
            requirements: data.requirements ?? null,
            workRegime: data.workRegime ?? null,
            location: data.location ?? null,
            benefits: data.benefits ?? null,
            salary: data.salary ?? null,
            validUntil: data.validUntil ? new Date(data.validUntil) : null,
            status: 'DRAFT',
          },
          select: { id: true, companyId: true, title: true, status: true },
        });

        audit.entityType = 'job';
        audit.entityId = job.id;
        audit.after = { status: job.status, companyId: job.companyId, title: job.title };

        return job;
      },
      {
        actorUserId: person.supabaseUserId,
        actorPersonId: person.id,
        ip,
        userAgent,
        context: { companyId: data.companyId },
      },
    );

    log.info({ actorPersonId: person.id, jobId: created.id }, 'jobs:draft_saved');
    return ok({ jobId: created.id, status: 'DRAFT' });
  } catch (err) {
    // Dedup exata (P-003): já existe vaga viva idêntica (título+Empresa+área).
    if (isJobDedupViolation(err)) {
      return fail('CONFLICT', 'Já existe uma vaga com este título nesta área para a Empresa.');
    }
    const errCode = err instanceof Error ? (err as NodeJS.ErrnoException).code ?? err.message : String(err);
    log.error({ errCode }, 'jobs:draft_failed');
    return fail('INTERNAL', 'Não foi possível salvar o rascunho. Tente novamente mais tarde.');
  }
}
