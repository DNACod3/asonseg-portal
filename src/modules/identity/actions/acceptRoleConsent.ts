'use server';

import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { acceptRoleConsentSchema, ROLE_PURPOSE_MAP, type AcceptRoleConsentInput } from '../schemas/registerPerson';

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
  const ip = clientIp(hdrs);
  const ipOrNull = ip === 'unknown' ? null : ip;
  const userAgent = hdrs.get('user-agent') ?? null;

  try {
    await withAudit(
      AuditEvent.CONSENT_GRANTED,
      async (tx, audit) => {
        const consentId = crypto.randomUUID();

        const grant = await tx.personRoleGrant.findFirst({
          where: { personId: input.personId, role: input.role, status: 'AWAITING_CONSENT' },
          select: { id: true },
        });
        if (!grant) {
          throw Object.assign(new Error('GRANT_NOT_FOUND'), { code: 'GRANT_NOT_FOUND' });
        }

        await tx.consent.create({
          data: {
            id: consentId,
            personId: input.personId,
            purpose: ROLE_PURPOSE_MAP[input.role],
            termVersion: input.termVersion,
            termContentHash: input.termContentHash,
            acceptedIp: ipOrNull,
            userAgent,
          },
        });

        await tx.personRoleGrant.update({
          where: { id: grant.id },
          data: { status: 'ACTIVE', activatedAt: new Date() },
        });

        await tx.auditLog.create({
          data: {
            action: AuditEvent.ROLE_GRANT_ACTIVATED,
            actorPersonId: input.personId,
            entityType: 'person_role_grant',
            entityId: grant.id,
            ip: ipOrNull,
            userAgent,
            after: { role: input.role, status: 'ACTIVE' },
          },
          select: { id: true },
        });

        audit.entityType = 'consent';
        audit.entityId = consentId;
        audit.after = {
          purpose: ROLE_PURPOSE_MAP[input.role],
          termVersion: input.termVersion,
          grantActivated: true,
        };
      },
      { actorPersonId: input.personId, ip: ipOrNull ?? undefined, userAgent: userAgent ?? undefined },
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
