'use server';

import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { transitionContent, ContentKind, ContentStatus } from '@/modules/moderation';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { isServiceDedupViolation } from '../domain/dedup';
import { isOwnedServicePhotoPath } from '../domain/photo-path';
import { submitServiceSchema, type SubmitServiceInput } from '../schemas/publish-service.schema';
import { requireServiceAuthorization } from '../server/require-service-authorization';
import { requireServiceOwner } from '../server/require-service-owner';

export interface SubmitServiceResult {
  serviceId: string;
  status: ContentStatus;
}

/**
 * Submete um serviço à moderação (USP-029 / AC-029-2). Aceita um rascunho
 * existente (`{ serviceId }`) ou um formulário completo (cria DRAFT + transiciona
 * numa só chamada). O serviço vai de `DRAFT` a `IN_MODERATION` via
 * `transitionContent` (ContentKind.SERVICE, AUTHOR_ACTION) — nunca escrita direta
 * de `status:'ACTIVE'` (SVC029-MN-01). Espelha `submitJobForModeration`.
 *
 * Sequência canônica (runbook-server-action):
 *  1. Valida input com Zod completo (AC-029-3) → VALIDATION.
 *  2. Resolve Pessoa autenticada (ADR-0030) → UNAUTHENTICATED.
 *  3. Gate de autorização **antes** de qualquer escrita (anti-bypass, SVC029-MN-02/03):
 *     - `{ serviceId }`: recheca **ownership** do rascunho (`requireServiceOwner`) —
 *       uma Pessoa não pode terminar de submeter o rascunho alheio.
 *     - Form completo: papel PROVIDER + responsável ativo da Empresa (quando
 *       `companyId`) + consentimento SERVICE_OFFERING (`requireServiceAuthorization`).
 *  4. Persiste/recupera o serviço em DRAFT (form direto cria; P2002 no dedup → CONFLICT).
 *  5. `transitionContent(SERVICE, serviceId, IN_MODERATION, AUTHOR_ACTION)` — propaga
 *     INVALID_TRANSITION (submit concorrente) / NOT_FOUND.
 *  6. Retorno ActionResult. Nunca `throw`.
 */
export async function submitServiceForModeration(
  rawInput: SubmitServiceInput,
): Promise<ActionResult<SubmitServiceResult>> {
  const log = childLogger({ module: 'services', action: 'submitServiceForModeration' });

  // 1. Validação.
  const parsed = submitServiceSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // 2. Pessoa autenticada.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  let serviceId: string;

  if ('serviceId' in data) {
    // 3a. Recheck de ownership do rascunho existente (anti-bypass: submeter o
    //     rascunho alheio não é permitido mesmo sendo PROVIDER ativo).
    const owner = await requireServiceOwner(person.id, data.serviceId);
    if (!owner.ok) {
      return fail('FORBIDDEN', 'Você não é o dono deste serviço.');
    }
    serviceId = data.serviceId;
  } else {
    // 3b. Gate de autorização ANTES de persistir (anti-bypass).
    const authorization = await requireServiceAuthorization(person.id, person.roles, data.companyId);
    if (!authorization.ok) {
      return authorization;
    }

    // 4b. Form direto: cria o serviço em DRAFT auditando a criação
    //     (SERVICE_DRAFT_SAVED, simétrico a createServiceDraft); a transição
    //     abaixo grava o submit + auditoria.
    const hdrs = await headers();
    const rawIp = clientIp(hdrs);
    const ip = rawIp === 'unknown' ? null : rawIp;
    const userAgent = hdrs.get('user-agent') ?? null;
    const photoStoragePaths = data.photoStoragePaths ?? [];

    // 3c. Posse+formato de cada photoStoragePath (F3/MN-F3) — antes de
    //     qualquer escrita. Só o ramo form-direto recebe paths; o ramo
    //     `{ serviceId }` (submeter rascunho existente) já validou na criação.
    if (!photoStoragePaths.every((p) => isOwnedServicePhotoPath(p, person.id))) {
      return fail('VALIDATION', 'Foto inválida. Reenvie as fotos do serviço.');
    }
    try {
      const created = await withAudit(
        AuditEvent.SERVICE_DRAFT_SAVED,
        async (tx, audit) => {
          const service = await tx.service.create({
            data: {
              authorPersonId: person.id,
              companyId: data.companyId ?? null,
              title: data.title,
              categoryId: data.categoryId,
              description: data.description,
              priceMin: data.priceMin ?? null,
              priceMax: data.priceMax ?? null,
              priceUnit: data.priceUnit,
              regionId: data.regionId,
              availabilityDescription: data.availabilityDescription,
              status: 'DRAFT',
              photos: {
                create: photoStoragePaths.map((storagePath, position) => ({ storagePath, position })),
              },
            },
            select: { id: true, companyId: true, title: true, status: true },
          });

          audit.entityType = 'SERVICE';
          audit.entityId = service.id;
          audit.after = { status: service.status, companyId: service.companyId, title: service.title };

          return service;
        },
        {
          actorUserId: person.supabaseUserId,
          actorPersonId: person.id,
          ip,
          userAgent,
          context: { companyId: data.companyId ?? null },
        },
      );
      serviceId = created.id;
    } catch (err) {
      if (isServiceDedupViolation(err)) {
        return fail('CONFLICT', 'Já existe um serviço com este título nesta categoria.');
      }
      const errCode = err instanceof Error ? (err as NodeJS.ErrnoException).code ?? err.message : String(err);
      log.error({ errCode }, 'services:submit_create_failed');
      return fail('INTERNAL', 'Não foi possível enviar o serviço. Tente novamente mais tarde.');
    }
  }

  // 5. Transição DRAFT → IN_MODERATION (grava CONTENT_SUBMITTED_TO_MODERATION).
  const transition = await transitionContent({
    contentKind: ContentKind.SERVICE,
    contentId: serviceId,
    to: ContentStatus.IN_MODERATION,
    trigger: 'AUTHOR_ACTION',
    actorPersonId: person.id,
  });
  if (!transition.ok) {
    return transition;
  }

  log.info({ actorPersonId: person.id, serviceId }, 'services:submitted_to_moderation');
  return ok({ serviceId, status: transition.data.to });
}
