'use server';

import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { updateJobDraftSchema, type UpdateJobDraftInput } from '../schemas/publish-job.schema';
import { requireActiveResponsible } from '../server/require-active-responsible';

export interface UpdateJobDraftResult {
  jobId: string;
  /** Sempre igual ao status lido antes do write — este fluxo nunca transiciona (MN-02). */
  status: 'DRAFT' | 'AWAITING_ADJUSTMENTS';
}

/** Conflito de concorrência otimista — a vaga não estava mais `DRAFT`/`AWAITING_ADJUSTMENTS`. */
class UpdateDraftConflictError extends Error {}

const EDITABLE_DRAFT_FIELDS = [
  'title',
  'areaId',
  'description',
  'requirements',
  'workRegime',
  'location',
  'benefits',
  'salary',
  'contractType',
  'regionId',
  'educationLevelRequired',
  'salaryMin',
  'salaryMax',
  'salaryVisible',
  'validUntil',
] as const;

/**
 * Edita os campos informativos de uma vaga `DRAFT`/`AWAITING_ADJUSTMENTS`
 * **preservando o status** (USP-054 / EMP-2 / A-1). Diferente de `editJob` (que só
 * aceita `ACTIVE` e rebaixa a `DRAFT` atomicamente — exceção arquitetural documentada
 * D1/§3.5), este fluxo **não toca a FSM**: submeter/reenviar é a ação separada
 * `submitJobForModeration` (A-2). `status` nunca aparece no `data:` do write — só no
 * `where:` como guarda de concorrência otimista (USP054-MN-01/MN-02, U23-MN-07 segue
 * verde: a varredura estática só olha `data:`).
 *
 * Sequência canônica (CLAUDE.md — Server Action sensível):
 *  1. Zod (`updateJobDraftSchema`) → VALIDATION.
 *  2. Pessoa autenticada (ADR-0030) → UNAUTHENTICATED.
 *  3. Carrega a vaga → NOT_FOUND.
 *  4. `requireActiveResponsible` (P-005) → FORBIDDEN, **antes** de qualquer escrita
 *     (USP054-MN-03 — nem-executa nem revela para não-responsável).
 *  5. Precondição: `status ∈ {DRAFT, AWAITING_ADJUSTMENTS}` → CONFLICT.
 *  6. `withAudit(JOB_DRAFT_SAVED)`: `updateMany({ where: { id, status: { in: [...] } },
 *     data: { ...campos, SEM status } })`; `count !== 1` → conflito otimista (USP054-E3).
 *
 * Nunca lança — retorna `ActionResult`.
 */
export async function updateJobDraft(
  rawInput: UpdateJobDraftInput,
): Promise<ActionResult<UpdateJobDraftResult>> {
  const log = childLogger({ module: 'jobs', action: 'updateJobDraft' });

  // 1. Validação.
  const parsed = updateJobDraftSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { jobId, validUntil, ...fields } = parsed.data;

  // 2. Pessoa autenticada.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // 3. Carrega a vaga (para companyId/status/snapshot de auditoria).
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      companyId: true,
      status: true,
      title: true,
      areaId: true,
      description: true,
      requirements: true,
      workRegime: true,
      location: true,
      benefits: true,
      salary: true,
      contractType: true,
      regionId: true,
      educationLevelRequired: true,
      salaryMin: true,
      salaryMax: true,
      salaryVisible: true,
      validUntil: true,
    },
  });
  if (!job) {
    return fail('NOT_FOUND', 'Vaga não encontrada.');
  }

  // 4. Gate P-005 — responsável ATIVO da Empresa, antes de qualquer escrita (anti-bypass D-005).
  if (!(await requireActiveResponsible(person.id, job.companyId))) {
    return fail('FORBIDDEN', 'Você não é responsável ativo desta Empresa.');
  }

  // 5. Precondição: só rascunho/aguardando ajustes é editável por este fluxo.
  if (job.status !== 'DRAFT' && job.status !== 'AWAITING_ADJUSTMENTS') {
    return fail('CONFLICT', 'Só é possível editar uma vaga em rascunho ou aguardando ajustes.');
  }

  try {
    // 6. Único write: SEM `status` no `data:` (U23-MN-07/USP054-MN-01 seguem verdes).
    await withAudit(
      AuditEvent.JOB_DRAFT_SAVED,
      async (tx, audit) => {
        const result = await tx.job.updateMany({
          where: { id: jobId, status: { in: ['DRAFT', 'AWAITING_ADJUSTMENTS'] } },
          data: { ...fields, validUntil: new Date(validUntil) },
        });
        if (result.count !== 1) {
          throw new UpdateDraftConflictError();
        }
        audit.entityType = 'JOB';
        audit.entityId = jobId;
        audit.before = { ...pick(job, EDITABLE_DRAFT_FIELDS), status: job.status };
        audit.after = { ...fields, validUntil, status: job.status };
      },
      { actorUserId: person.supabaseUserId, actorPersonId: person.id, context: { companyId: job.companyId } },
    );
  } catch (err) {
    if (err instanceof UpdateDraftConflictError) {
      return fail('CONFLICT', 'Só é possível editar uma vaga em rascunho ou aguardando ajustes.');
    }
    log.error({ err, jobId }, 'jobs:update_draft_failed');
    return fail('INTERNAL', 'Não foi possível salvar a edição. Tente novamente mais tarde.');
  }

  log.info({ actorPersonId: person.id, jobId }, 'jobs:draft_updated');
  return ok({ jobId, status: job.status });
}

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}
