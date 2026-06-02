'use server';

import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { headers } from 'next/headers';
import { AuditEvent, withAudit } from '@/modules/audit';
import { getCurrentPerson } from '@/modules/identity';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import type { ConsentPurpose } from '../domain/purposes';
import { roleForPurpose } from '../domain/purpose-role-map';
import { requireActiveConsent } from '../domain/require-active-consent';
import { loadTerm, TermLoaderError } from '../adapters/term-loader';
import { grantConsentSchema, type GrantConsentInput } from '../schemas/consent';

export interface GrantConsentResult {
  consentId: string;
  purpose: ConsentPurpose;
  termVersion: string;
  /** `true` se já havia consentimento ativo na versão vigente (idempotência). */
  alreadyActive: boolean;
  /** `true` se um grant de papel foi reativado pelo aceite (P-006). */
  roleReactivated: boolean;
}

/**
 * Registra o consentimento da Pessoa autenticada para uma finalidade (LGP-01).
 *
 * Sequência canônica de Server Action:
 *  1. valida entrada (Zod);
 *  2. autentica o titular (consente por si — `getCurrentPerson`);
 *  3. carrega o termo vigente e **valida o hash** (bloqueia se adulterado/ausente);
 *  4. idempotência: se já há consentimento ativo na versão vigente, não duplica;
 *  5. persiste o `Consent` (titular, finalidade, versão, hash, IP, user-agent) e,
 *     se a finalidade tem papel vinculado em estado não-ativo, **reativa** o grant
 *     (P-006 — re-aceite restaura o papel) — tudo em `withAudit('CONSENT_GRANTED')`.
 *
 * Nunca lança: retorna sempre `ActionResult`.
 */
export async function grantConsent(
  rawInput: GrantConsentInput,
): Promise<ActionResult<GrantConsentResult>> {
  const log = childLogger({ module: 'consents', action: 'grantConsent' });

  const parsed = grantConsentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { purpose } = parsed.data;

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // Termo vigente + integridade (prova LGPD): hash divergente/arquivo ausente bloqueia.
  let term;
  try {
    term = await loadTerm(purpose);
  } catch (err) {
    if (err instanceof TermLoaderError) {
      log.error({ purpose, code: err.code }, 'consent:term_unavailable');
      return fail(
        'PRECONDITION_FAILED',
        'Termo desta finalidade indisponível no momento. Tente novamente mais tarde.',
      );
    }
    throw err;
  }

  // Idempotência: consentimento já ativo na versão vigente ⇒ não duplica (#37).
  // A pré-checagem cobre o caso comum (re-clique/re-render); a corrida real (duas
  // grants simultâneas) é fechada no banco pelo índice único parcial
  // `consents_active_purpose_unique (person_id, purpose) WHERE revoked_at IS NULL`
  // (migration 20260602190000) — a 2ª insere e recebe P2002, tratado abaixo.
  const existing = await requireActiveConsent(person.id, purpose);
  if (existing.active) {
    return ok({
      consentId: existing.consentId,
      purpose,
      termVersion: term.version,
      alreadyActive: true,
      roleReactivated: false,
    });
  }

  const hdrs = await headers();
  const rawClientIp = clientIp(hdrs);
  const ip = rawClientIp === 'unknown' ? null : rawClientIp;
  const userAgent = hdrs.get('user-agent') ?? null;
  const consentId = crypto.randomUUID();
  const role = roleForPurpose(purpose);

  try {
    const roleReactivated = await withAudit(
      AuditEvent.CONSENT_GRANTED,
      async (tx, audit) => {
        await tx.consent.create({
          data: {
            id: consentId,
            personId: person.id,
            purpose,
            termVersion: term.version,
            termContentHash: term.hash,
            acceptedIp: ip,
            userAgent,
          },
          select: { id: true },
        });

        // P-006: re-aceite reativa um grant de papel pendente/revogado, sem re-cadastro.
        let reactivated = false;
        if (role) {
          const grant = await tx.personRoleGrant.findFirst({
            where: {
              personId: person.id,
              role,
              status: { in: ['AWAITING_CONSENT', 'INACTIVE', 'REVOKED'] },
            },
            orderBy: { activatedAt: 'desc' },
            select: { id: true },
          });
          if (grant) {
            await tx.personRoleGrant.update({
              where: { id: grant.id },
              data: {
                status: 'ACTIVE',
                activatedAt: new Date(),
                revokedAt: null,
                revokedBy: null,
                revocationReason: null,
              },
            });
            await tx.auditLog.create({
              data: {
                action: AuditEvent.ROLE_GRANT_ACTIVATED,
                actorPersonId: person.id,
                entityType: 'person_role_grant',
                entityId: grant.id,
                ip,
                userAgent,
                after: { role, status: 'ACTIVE', via: 'consent_grant' },
              },
              select: { id: true },
            });
            reactivated = true;
          }
        }

        audit.entityType = 'consent';
        audit.entityId = consentId;
        audit.after = {
          purpose,
          termVersion: term.version,
          role: role ?? null,
          roleReactivated: reactivated,
        };
        return reactivated;
      },
      {
        actorPersonId: person.id,
        ip,
        userAgent,
        context: { route: '/consentimentos' },
      },
    );

    log.info({ personId: person.id, purpose, roleReactivated }, 'consent:granted');
    return ok({ consentId, purpose, termVersion: term.version, alreadyActive: false, roleReactivated });
  } catch (err) {
    // P2002 = violação do índice único parcial de consentimento ativo: outra grant
    // concorrente venceu a corrida. Trata como idempotente (sem erro ao titular).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const winner = await requireActiveConsent(person.id, purpose);
      if (winner.active) {
        log.info({ personId: person.id, purpose }, 'consent:grant_race_resolved');
        return ok({
          consentId: winner.consentId,
          purpose,
          termVersion: term.version,
          alreadyActive: true,
          roleReactivated: false,
        });
      }
    }
    log.error({ err, purpose }, 'consent:grant_failed');
    return fail('INTERNAL', 'Não foi possível registrar o consentimento. Tente novamente.');
  }
}
