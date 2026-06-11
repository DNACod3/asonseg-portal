import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AuditEvent } from '@/modules/audit';
import { decideClientActivation } from '../domain/client';

export interface EnsureClientRoleArgs {
  personId: string;
  /** Termo da finalidade SERVICE_HIRING carregado e validado pelo chamador (loadTerm). */
  term: { version: string; hash: string };
  ip: string | null;
  userAgent: string | null;
}

export interface EnsureClientRoleResult {
  /** true = papel ativado agora; false = já estava ativo (no-op idempotente). */
  activated: boolean;
  grantId: string;
}

/**
 * Helper transacional de ativação automática do papel CLIENT (USP-011 / CAD-09).
 *
 * Deve ser chamado DENTRO da transação do chamador (USP-033 / `withAudit`), nunca
 * abre transação própria (ADR-0020). O chamador é responsável por:
 *   - resolver a Pessoa autenticada da sessão (P-003);
 *   - exibir e obter aceite explícito do termo SERVICE_HIRING (P-002);
 *   - carregar e validar o termo server-side (`loadTerm`) antes de passar aqui (P-001).
 *
 * Invariante P-001: o grant CLIENT nunca chega a ACTIVE sem o Consent SERVICE_HIRING
 * persistido na MESMA transação. A ordem é: AWAITING_CONSENT → consent → ACTIVE.
 */
export async function ensureClientRole(
  tx: Prisma.TransactionClient,
  { personId, term, ip, userAgent }: EnsureClientRoleArgs,
): Promise<EnsureClientRoleResult> {
  // Passo 1 — idempotência: releitura defensiva dentro da tx (fecha corrida de duplo submit).
  const alreadyActive = await tx.personRoleGrant.findFirst({
    where: { personId, role: 'CLIENT', status: 'ACTIVE' },
    select: { id: true },
  });
  if (alreadyActive) {
    return { activated: false, grantId: alreadyActive.id };
  }

  const { needsActivation } = decideClientActivation(
    (
      await tx.personRoleGrant.findMany({
        where: { personId, status: 'ACTIVE' },
        select: { role: true },
      })
    ).map((g) => g.role),
  );
  if (!needsActivation) {
    const grant = await tx.personRoleGrant.findFirst({
      where: { personId, role: 'CLIENT' },
      select: { id: true },
    });
    return { activated: false, grantId: grant?.id ?? '' };
  }

  // Passo 2 — cria/reaproveita grant em AWAITING_CONSENT (ADR-0020: intermediário obrigatório).
  const existingGrant = await tx.personRoleGrant.findFirst({
    where: { personId, role: 'CLIENT' },
    orderBy: { activatedAt: 'desc' },
    select: { id: true },
  });
  const grantId = existingGrant?.id ?? crypto.randomUUID();
  if (!existingGrant) {
    await tx.personRoleGrant.create({
      data: { id: grantId, personId, role: 'CLIENT', status: 'AWAITING_CONSENT' },
      select: { id: true },
    });
  }

  // Passo 3 — P-001: consent SERVICE_HIRING na MESMA transação, ANTES de ACTIVE.
  const newConsentId = crypto.randomUUID();
  const activeConsent = await tx.consent.findFirst({
    where: { personId, purpose: 'SERVICE_HIRING', revokedAt: null },
    select: { id: true },
  });
  if (!activeConsent) {
    await tx.consent.create({
      data: {
        id: newConsentId,
        personId,
        purpose: 'SERVICE_HIRING',
        termVersion: term.version,
        termContentHash: term.hash,
        acceptedIp: ip,
        userAgent,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        action: AuditEvent.CONSENT_GRANTED,
        actorPersonId: personId,
        entityType: 'consent',
        entityId: newConsentId,
        ip,
        userAgent,
        after: { purpose: 'SERVICE_HIRING', termVersion: term.version, via: 'client_role_activation' },
      },
      select: { id: true },
    });
  }

  // Passo 4 — upsert ClientProfile (perfil leve, sem dados obrigatórios).
  await tx.clientProfile.upsert({
    where: { personId },
    create: { personId },
    update: {},
    select: { personId: true },
  });

  // Passo 5 — só agora CLIENT vira ACTIVE (P-001: consent já persistido acima).
  await tx.personRoleGrant.update({
    where: { id: grantId },
    data: {
      status: 'ACTIVE',
      activatedAt: new Date(),
      activatedBy: personId,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
    },
  });

  // Passo 6 — CLIENT_ROLE_ACTIVATED apenas quando há ativação real (nunca no no-op).
  await tx.auditLog.create({
    data: {
      action: AuditEvent.CLIENT_ROLE_ACTIVATED,
      actorPersonId: personId,
      entityType: 'person_role_grant',
      entityId: grantId,
      ip,
      userAgent,
      after: {
        role: 'CLIENT',
        status: 'ACTIVE',
        purpose: 'SERVICE_HIRING',
        termVersion: term.version,
        consentId: activeConsent?.id ?? newConsentId,
      },
    },
    select: { id: true },
  });

  return { activated: true, grantId };
}
