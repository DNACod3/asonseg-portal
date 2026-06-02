'use server';

import { headers } from 'next/headers';
import { AuditEvent, withAudit } from '@/modules/audit';
import { getCurrentPerson } from '@/modules/identity';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import type { ConsentPurpose } from '../domain/purposes';
import { roleForPurpose } from '../domain/purpose-role-map';
import { revokeConsentSchema, type RevokeConsentInput } from '../schemas/consent';

const DEFAULT_REASON = 'Revogação de consentimento solicitada pelo titular.';

export interface RevokeConsentResult {
  purpose: ConsentPurpose;
  /** Quantos registros de consentimento foram marcados como revogados. */
  consentsRevoked: number;
  /** `true` se o papel vinculado foi desativado em cascata (REVOKED). */
  roleRevoked: boolean;
  /** `true` se a finalidade já estava revogada (operação idempotente, sem efeito). */
  alreadyRevoked: boolean;
}

/**
 * Revoga o consentimento da Pessoa autenticada para uma finalidade (LGP-04 / ADR-0025).
 *
 *  - preenche `revokedAt`/`revokedReason` no(s) registro(s) vigente(s);
 *  - cascateia o `PersonRoleGrant` vinculado (matriz ADR-0025) para `REVOKED`,
 *    **preservando os dados de perfil** (sem exclusão — ADR-0008) e **sem afetar
 *    outras finalidades** (P-002);
 *  - tudo em `withAudit('CONSENT_REVOKED')` (justificativa obrigatória);
 *  - **idempotente**: finalidade já revogada ⇒ ok sem novo efeito nem auditoria.
 *
 * A transação auditada só é aberta quando há de fato algo a revogar — assim o
 * `audit_log` (append-only, 1 ano) não recebe um `CONSENT_REVOKED` espúrio em
 * revogação de finalidade inexistente/já revogada.
 *
 * Nunca lança: retorna sempre `ActionResult`.
 */
export async function revokeConsent(
  rawInput: RevokeConsentInput,
): Promise<ActionResult<RevokeConsentResult>> {
  const log = childLogger({ module: 'consents', action: 'revokeConsent' });

  const parsed = revokeConsentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { purpose, reason } = parsed.data;

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  const role = roleForPurpose(purpose);
  const justification = reason && reason.length > 0 ? reason : DEFAULT_REASON;

  // Pré-checagem (leitura): decide idempotência/NOT_FOUND sem auditar um no-op.
  const activeConsent = await prisma.consent.findFirst({
    where: { personId: person.id, purpose, revokedAt: null },
    select: { id: true },
  });
  if (!activeConsent) {
    const anyConsent = await prisma.consent.findFirst({
      where: { personId: person.id, purpose },
      select: { id: true },
    });
    if (anyConsent) {
      return ok({ purpose, consentsRevoked: 0, roleRevoked: false, alreadyRevoked: true });
    }
    return fail('NOT_FOUND', 'Nenhum consentimento desta finalidade foi encontrado.');
  }

  const hdrs = await headers();
  const rawClientIp = clientIp(hdrs);
  const ip = rawClientIp === 'unknown' ? null : rawClientIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  try {
    const result = await withAudit(
      AuditEvent.CONSENT_REVOKED,
      async (tx, audit) => {
        // Revoga todos os registros vigentes (não revogados) da finalidade.
        const revoked = await tx.consent.updateMany({
          where: { personId: person.id, purpose, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: justification },
        });

        // Cascata determinística (ADR-0025): desativa o papel vinculado, se houver.
        let roleRevoked = false;
        if (role && revoked.count > 0) {
          const cascaded = await tx.personRoleGrant.updateMany({
            where: { personId: person.id, role, status: 'ACTIVE' },
            data: {
              status: 'REVOKED',
              revokedAt: new Date(),
              revokedBy: person.id,
              revocationReason: justification,
            },
          });
          if (cascaded.count > 0) {
            roleRevoked = true;
            await tx.auditLog.create({
              data: {
                action: AuditEvent.ROLE_GRANT_REVOKED,
                actorPersonId: person.id,
                entityType: 'person_role_grant',
                entityId: null,
                ip,
                userAgent,
                after: { role, status: 'REVOKED', via: 'consent_revoke' },
                justification,
              },
              select: { id: true },
            });
          }
        }

        audit.entityType = 'consent';
        audit.justification = justification;
        audit.before = { purpose, role: role ?? null };
        audit.after = { purpose, consentsRevoked: revoked.count, roleRevoked };
        return { consentsRevoked: revoked.count, roleRevoked };
      },
      {
        actorPersonId: person.id,
        ip,
        userAgent,
        context: { route: '/consentimentos' },
      },
    );

    log.info(
      { personId: person.id, purpose, consentsRevoked: result.consentsRevoked, roleRevoked: result.roleRevoked },
      'consent:revoked',
    );
    return ok({
      purpose,
      consentsRevoked: result.consentsRevoked,
      roleRevoked: result.roleRevoked,
      alreadyRevoked: false,
    });
  } catch (err) {
    log.error({ err, purpose }, 'consent:revoke_failed');
    return fail('INTERNAL', 'Não foi possível revogar o consentimento. Tente novamente.');
  }
}
