'use server';

import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { withAudit } from '@/modules/audit/withAudit';
import { AuditEvent } from '@/modules/audit/events';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { acceptRoleConsentSchema, type AcceptRoleConsentInput } from '../schemas/registerPerson';

export interface AcceptRoleConsentResult {
  personId: string;
  role: string;
  activated: true;
}

/**
 * TX2 do auto-cadastro (USP-001 / E-001b).
 *
 * Aceite explícito do termo da finalidade do papel — persiste em transação única:
 *   1. Consent da finalidade do papel (JOB_APPLICATION, SERVICE_OFFERING, etc.)
 *   2. PersonRoleGrant → status ACTIVE
 *   3. AuditLog CONSENT_GRANTED + ROLE_GRANT_ACTIVATED
 *
 * Invariante (ADR-0020 / P-002): o grant nunca chega a ACTIVE sem o consent
 * da finalidade estar persistido na MESMA transação.
 */
export async function acceptRoleConsent(
  rawInput: AcceptRoleConsentInput,
): Promise<ActionResult<AcceptRoleConsentResult>> {
  const parsed = acceptRoleConsentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  const hdrs = await headers();
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  try {
    await withAudit(
      AuditEvent.CONSENT_GRANTED,
      async (tx, audit) => {
        const consentId = crypto.randomUUID();

        // Verificar que o grant existe e ainda está AWAITING_CONSENT
        const grant = await tx.personRoleGrant.findFirst({
          where: { personId: input.personId, role: input.role, status: 'AWAITING_CONSENT' },
          select: { id: true },
        });
        if (!grant) {
          throw Object.assign(new Error('GRANT_NOT_FOUND'), { code: 'GRANT_NOT_FOUND' });
        }

        // INSERT consent da finalidade
        await tx.consent.create({
          data: {
            id: consentId,
            personId: input.personId,
            purpose: {
              CANDIDATE: 'JOB_APPLICATION',
              PROVIDER: 'SERVICE_OFFERING',
              CLIENT: 'SERVICE_HIRING',
            }[input.role] as 'JOB_APPLICATION' | 'SERVICE_OFFERING' | 'SERVICE_HIRING',
            termVersion: input.termVersion,
            termContentHash: input.termContentHash,
            acceptedIp: ip,
            userAgent,
          },
        });

        // Ativar o grant na MESMA transação (invariante ADR-0020 / P-002)
        await tx.personRoleGrant.update({
          where: { id: grant.id },
          data: { status: 'ACTIVE', activatedAt: new Date() },
        });

        // Segundo evento de audit para ativação do papel
        await tx.auditLog.create({
          data: {
            action: AuditEvent.ROLE_GRANT_ACTIVATED,
            actorPersonId: input.personId,
            entityType: 'person_role_grant',
            entityId: grant.id,
            ip,
            userAgent,
            after: { role: input.role, status: 'ACTIVE' },
          },
          select: { id: true },
        });

        audit.entityType = 'consent';
        audit.entityId = consentId;
        audit.after = {
          purpose: input.role,
          termVersion: input.termVersion,
          grantActivated: true,
        };
      },
      { actorPersonId: input.personId, ip, userAgent },
    );

    return ok({ personId: input.personId, role: input.role, activated: true });
  } catch (err) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'GRANT_NOT_FOUND') {
      return fail(
        'NOT_FOUND',
        'Grant de papel não encontrado ou já ativado. Recarregue a página.',
      );
    }
    console.error('[acceptRoleConsent] Erro na TX2:', err);
    return fail('INTERNAL', 'Erro interno. Tente novamente mais tarde.');
  }
}
