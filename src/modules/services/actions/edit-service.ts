'use server';

import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { editServiceSchema, type EditServiceInput } from '../schemas/publish-service.schema';
import { requireServiceOwner } from '../server/require-service-owner';

export interface EditServiceResult {
  serviceId: string;
  status: 'DRAFT';
}

/** Conflito de concorrência otimista — serviço não estava mais `ACTIVE` no momento do write. */
class EditConflictError extends Error {}

const EDITABLE_FIELDS = [
  'title',
  'categoryId',
  'description',
  'priceMin',
  'priceMax',
  'priceUnit',
  'regionId',
  'availabilityDescription',
] as const;

/**
 * Edita um serviço `ACTIVE` (USP-032 / AC-032-1 / SVC032-MN-03). **Exceção
 * arquitetural documentada** (espelha `editJob`, D1/design USP-023 §3.5): grava
 * os campos de conteúdo **e** muda `status: ACTIVE → DRAFT` **atomicamente**,
 * fora do `transitionContent` (que não expõe hook para mutar campos da
 * entidade) — dentro de UM único `withAudit(SERVICE_EDITED_AFTER_APPROVAL)`,
 * com `updateMany({ where: { id, status: 'ACTIVE' } })` como concorrência
 * otimista (a precondição `status=ACTIVE` é o guard efetivo da transição).
 * `editService` é a **única** exceção a "toda escrita de `Service.status` passa
 * por `transitionContent`/adapter" — guardada estaticamente por SVC032-MN-01
 * (`no-out-of-band-status-write.test.ts`): fora daqui e do adapter, nenhuma
 * escrita de status; aqui, só com `status: 'ACTIVE'` no `where`.
 *
 * A UI encadeia `submitServiceForModeration({ serviceId })` em sucesso
 * (`DRAFT→IN_MODERATION`, forçando nova moderação — AC-032-1/SVC032-MN-03).
 * `published_at` é preservado na re-aprovação pelo adapter (USP-029/T029-3) —
 * não é tocado aqui.
 */
export async function editService(rawInput: EditServiceInput): Promise<ActionResult<EditServiceResult>> {
  const log = childLogger({ module: 'services', action: 'editService' });

  const parsed = editServiceSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { serviceId, ...fields } = parsed.data;

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      status: true,
      title: true,
      categoryId: true,
      description: true,
      priceMin: true,
      priceMax: true,
      priceUnit: true,
      regionId: true,
      availabilityDescription: true,
    },
  });
  if (!service) {
    return fail('NOT_FOUND', 'Serviço não encontrado.');
  }

  // Ownership ANTES de qualquer escrita (anti-bypass, SVC032-MN-02): autor OU
  // responsável ativo da Empresa em cujo nome o serviço foi publicado.
  const owner = await requireServiceOwner(person.id, serviceId);
  if (!owner.ok) {
    return fail('FORBIDDEN', 'Você não é o dono deste serviço.');
  }

  if (service.status !== 'ACTIVE') {
    return fail('CONFLICT', 'Só é possível editar um serviço ativo.');
  }

  try {
    // Único ponto de escrita de Service.status fora do adapter (exceção
    // SVC032-MN-01): `status: 'ACTIVE'` SEMPRE no `where` — nunca um write incondicional.
    await withAudit(
      AuditEvent.SERVICE_EDITED_AFTER_APPROVAL,
      async (tx, audit) => {
        const result = await tx.service.updateMany({
          where: { id: serviceId, status: 'ACTIVE' },
          data: { ...fields, status: 'DRAFT', lastStatusChangeAt: new Date() },
        });
        if (result.count !== 1) {
          throw new EditConflictError();
        }
        audit.entityType = 'SERVICE';
        audit.entityId = serviceId;
        audit.before = { ...pick(service, EDITABLE_FIELDS), status: 'ACTIVE' };
        audit.after = { ...fields, status: 'DRAFT' };
      },
      { actorUserId: person.supabaseUserId, actorPersonId: person.id, context: { companyId: owner.companyId } },
    );
  } catch (err) {
    if (err instanceof EditConflictError) {
      return fail('CONFLICT', 'Só é possível editar um serviço ativo.');
    }
    log.error({ err, serviceId }, 'services:edit_failed');
    return fail('INTERNAL', 'Não foi possível salvar a edição. Tente novamente mais tarde.');
  }

  log.info({ actorPersonId: person.id, serviceId }, 'services:edited_after_approval');
  return ok({ serviceId, status: 'DRAFT' });
}

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}
