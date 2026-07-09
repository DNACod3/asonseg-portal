'use server';

import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { isServiceDedupViolation } from '../domain/dedup';
import { isOwnedServicePhotoPath } from '../domain/photo-path';
import { draftServiceSchema, type DraftServiceInput } from '../schemas/publish-service.schema';
import { requireServiceAuthorization } from '../server/require-service-authorization';

export interface CreateServiceDraftResult {
  serviceId: string;
  status: 'DRAFT';
}

/**
 * Salva um serviço como **rascunho** (USP-029 / AC-029-3). O rascunho nasce em
 * `DRAFT` e NÃO entra na fila de moderação — fica disponível para edição/submit.
 * Espelha `createJobDraft` (`@/modules/jobs`).
 *
 * Sequência canônica (runbook-server-action):
 *  1. Valida input com Zod (rascunho: só `title` obrigatório — L-003 só no submit).
 *  2. Resolve Pessoa autenticada (ADR-0030) → UNAUTHENTICATED.
 *  3. Gate de autorização (papel PROVIDER + responsável ativo da Empresa quando
 *     `companyId` setado + consentimento SERVICE_OFFERING) → FORBIDDEN/CONSENT_REQUIRED
 *     (SVC029-MN-02/MN-03), **antes** de persistir.
 *  4. withAudit(SERVICE_DRAFT_SAVED): `tx.service.create` em DRAFT atomicamente,
 *     com até 3 fotos já enviadas (`uploadServicePhoto`).
 *  5. Retorno ActionResult. P2002 no índice de dedup → CONFLICT. Nunca `throw`.
 */
export async function createServiceDraft(
  rawInput: DraftServiceInput,
): Promise<ActionResult<CreateServiceDraftResult>> {
  const log = childLogger({ module: 'services', action: 'createServiceDraft' });

  // 1. Validação (rascunho).
  const parsed = draftServiceSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // 2. Pessoa autenticada.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // 3. Gate de autorização — antes de qualquer escrita (anti-bypass).
  const authorization = await requireServiceAuthorization(person.id, person.roles, data.companyId);
  if (!authorization.ok) {
    return authorization;
  }

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;
  const photoStoragePaths = data.photoStoragePaths ?? [];

  // 3b. Posse+formato de cada photoStoragePath (F3/MN-F3) — antes de qualquer
  //     escrita. Bloqueia foto de terceiro e path malformado (ex.: `../`).
  if (!photoStoragePaths.every((p) => isOwnedServicePhotoPath(p, person.id))) {
    return fail('VALIDATION', 'Foto inválida. Reenvie as fotos do serviço.');
  }

  // 4. Persistência atômica do rascunho (+ fotos) + auditoria.
  try {
    const created = await withAudit(
      AuditEvent.SERVICE_DRAFT_SAVED,
      async (tx, audit) => {
        const service = await tx.service.create({
          data: {
            authorPersonId: person.id,
            companyId: data.companyId ?? null,
            title: data.title,
            categoryId: data.categoryId ?? null,
            description: data.description ?? null,
            priceMin: data.priceMin ?? null,
            priceMax: data.priceMax ?? null,
            priceUnit: data.priceUnit ?? null,
            regionId: data.regionId ?? null,
            availabilityDescription: data.availabilityDescription ?? null,
            status: 'DRAFT',
            photos: {
              create: photoStoragePaths.map((storagePath, position) => ({ storagePath, position })),
            },
          },
          select: { id: true, companyId: true, title: true, status: true },
        });

        // Mesmo entityType da via FSM (`transitionContent` → ContentKind.SERVICE),
        // para o histórico de auditoria do serviço não fragmentar entre kinds.
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

    log.info({ actorPersonId: person.id, serviceId: created.id }, 'services:draft_saved');
    return ok({ serviceId: created.id, status: 'DRAFT' });
  } catch (err) {
    // Dedup exata (espelha P-003/ADR-0021): já existe serviço vivo idêntico
    // (autor+categoria+título).
    if (isServiceDedupViolation(err)) {
      return fail('CONFLICT', 'Já existe um serviço com este título nesta categoria.');
    }
    const errCode = err instanceof Error ? (err as NodeJS.ErrnoException).code ?? err.message : String(err);
    log.error({ errCode }, 'services:draft_failed');
    return fail('INTERNAL', 'Não foi possível salvar o rascunho. Tente novamente mais tarde.');
  }
}
