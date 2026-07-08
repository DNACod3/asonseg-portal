'use server';

import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { editJobSchema, type EditJobInput } from '../schemas/publish-job.schema';
import { requireActiveResponsible } from '../server/require-active-responsible';

export interface EditJobResult {
  jobId: string;
  status: 'DRAFT';
}

/** Conflito de concorrência otimista — vaga não estava mais `ACTIVE` no momento do write. */
class EditConflictError extends Error {}

const EDITABLE_FIELDS = [
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
] as const;

/**
 * Edita uma vaga `ACTIVE` (USP-023 / E-001 / AC-023-1 / P-001 / D-006). **Exceção
 * arquitetural documentada (D1, design §3.5)**: grava os campos de conteúdo **e**
 * muda `status: ACTIVE → DRAFT` **atomicamente**, fora do `transitionContent` (que
 * não expõe hook para mutar campos da entidade) — dentro de UM único
 * `withAudit(JOB_EDITED_AFTER_APPROVAL)`, com `updateMany({ where: { id,
 * status: 'ACTIVE' } })` como concorrência otimista (a precondição `status=ACTIVE`
 * é o guard efetivo da transição; a legalidade da aresta `ACTIVE→DRAFT` é da FSM).
 * `editJob` é a **única** exceção a "toda escrita de `Job.status` passa por
 * `transitionContent`/adapter" — guardada estaticamente por U23-MN-07
 * (`no-out-of-band-status-write.test.ts`): fora daqui e do adapter, nenhuma escrita
 * de status; aqui, só com `status: 'ACTIVE'` no `where`.
 *
 * A UI encadeia `submitJobForModeration({ jobId })` em sucesso (`DRAFT→IN_MODERATION`).
 * `published_at` é preservado na re-aprovação pelo adapter (T1) — não é tocado aqui.
 */
export async function editJob(rawInput: EditJobInput): Promise<ActionResult<EditJobResult>> {
  const log = childLogger({ module: 'jobs', action: 'editJob' });

  const parsed = editJobSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { jobId, ...fields } = parsed.data;

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

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
    },
  });
  if (!job) {
    return fail('NOT_FOUND', 'Vaga não encontrada.');
  }

  if (!(await requireActiveResponsible(person.id, job.companyId))) {
    return fail('FORBIDDEN', 'Você não é responsável ativo desta Empresa.');
  }

  if (job.status !== 'ACTIVE') {
    return fail('CONFLICT', 'Só é possível editar uma vaga ativa.');
  }

  try {
    // Único ponto de escrita de Job.status fora do adapter (exceção U23-MN-07):
    // `status: 'ACTIVE'` SEMPRE no `where` — nunca um write incondicional.
    await withAudit(
      AuditEvent.JOB_EDITED_AFTER_APPROVAL,
      async (tx, audit) => {
        const result = await tx.job.updateMany({
          where: { id: jobId, status: 'ACTIVE' },
          data: { ...fields, status: 'DRAFT', lastStatusChangeAt: new Date() },
        });
        if (result.count !== 1) {
          throw new EditConflictError();
        }
        audit.entityType = 'JOB';
        audit.entityId = jobId;
        audit.before = { ...pick(job, EDITABLE_FIELDS), status: 'ACTIVE' };
        audit.after = { ...fields, status: 'DRAFT' };
      },
      { actorUserId: person.supabaseUserId, actorPersonId: person.id, context: { companyId: job.companyId } },
    );
  } catch (err) {
    if (err instanceof EditConflictError) {
      return fail('CONFLICT', 'Só é possível editar uma vaga ativa.');
    }
    log.error({ err, jobId }, 'jobs:edit_failed');
    return fail('INTERNAL', 'Não foi possível salvar a edição. Tente novamente mais tarde.');
  }

  log.info({ actorPersonId: person.id, jobId }, 'jobs:edited_after_approval');
  return ok({ jobId, status: 'DRAFT' });
}

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}
