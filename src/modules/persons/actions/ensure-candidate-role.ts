import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AuditEvent } from '@/modules/audit';

export interface EnsureCandidateRoleArgs {
  personId: string;
  /** Termo da finalidade SOCIAL_REFERRAL_TO_JOB carregado e validado pelo chamador (loadTerm). */
  term: { version: string; hash: string };
  ip: string | null;
  userAgent: string | null;
}

export interface EnsureCandidateRoleResult {
  /** true = papel ativado agora; false = já estava ativo (no-op idempotente). */
  activated: boolean;
  grantId: string;
}

/**
 * Helper transacional de ativação automática do papel CANDIDATE por
 * encaminhamento institucional (USP-037 / AC-037-2). Espelha
 * `ensureClientRole` (grant lifecycle + consent + audit, mesma tx do
 * chamador), com duas divergências documentadas (design.md do agregado
 * `Referral`):
 *
 *  1. **Sem gate `PORTAL_ACCESS`**: diferente de `ensureClientRole`, este
 *     helper NÃO exige o consentimento-base `PORTAL_ACCESS` — uma Pessoa
 *     cadastrada pela AS sem credencial (sem e-mail/senha) precisa poder ser
 *     encaminhada (EC-2). A base legal do papel é o próprio consentimento
 *     tácito `SOCIAL_REFERRAL_TO_JOB` registrado abaixo.
 *  2. **Finalidade**: `SOCIAL_REFERRAL_TO_JOB` (tácito), não `JOB_APPLICATION`
 *     (aceite self-service) nem `SERVICE_HIRING`.
 *
 * Deve ser chamado DENTRO da transação do chamador (`createReferral` /
 * `withAudit`), nunca abre transação própria (ADR-0020). Idempotente: papel
 * já ATIVO → no-op (nenhum evento/consent duplicado).
 */
export async function ensureCandidateRole(
  tx: Prisma.TransactionClient,
  { personId, term, ip, userAgent }: EnsureCandidateRoleArgs,
): Promise<EnsureCandidateRoleResult> {
  // Passo 1 — idempotência: releitura defensiva dentro da tx (fecha corrida de
  // duplo submit). `take` limita a cardinalidade (bounded pelo enum `Role`).
  const activeRoles = (
    await tx.personRoleGrant.findMany({
      where: { personId, status: 'ACTIVE' },
      select: { role: true },
      take: 20,
    })
  ).map((g) => g.role);

  if (activeRoles.includes('CANDIDATE')) {
    const grant = await tx.personRoleGrant.findFirst({
      where: { personId, role: 'CANDIDATE', status: 'ACTIVE' },
      select: { id: true },
    });
    return { activated: false, grantId: grant?.id ?? '' };
  }

  // Passo 2 — cria/reaproveita grant em AWAITING_CONSENT (ADR-0020: intermediário obrigatório).
  const existingGrant = await tx.personRoleGrant.findFirst({
    where: { personId, role: 'CANDIDATE' },
    orderBy: { activatedAt: 'desc' },
    select: { id: true },
  });
  const grantId = existingGrant?.id ?? crypto.randomUUID();
  if (!existingGrant) {
    await tx.personRoleGrant.create({
      data: { id: grantId, personId, role: 'CANDIDATE', status: 'AWAITING_CONSENT' },
      select: { id: true },
    });
  }

  // Passo 3 — consent SOCIAL_REFERRAL_TO_JOB (tácito) na MESMA transação, ANTES de ACTIVE.
  const newConsentId = crypto.randomUUID();
  const activeConsent = await tx.consent.findFirst({
    where: { personId, purpose: 'SOCIAL_REFERRAL_TO_JOB', revokedAt: null },
    select: { id: true },
  });
  if (!activeConsent) {
    await tx.consent.create({
      data: {
        id: newConsentId,
        personId,
        purpose: 'SOCIAL_REFERRAL_TO_JOB',
        termVersion: term.version,
        termContentHash: term.hash,
        acceptedIp: ip,
        userAgent,
        context: { via: 'referral' },
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
        after: { purpose: 'SOCIAL_REFERRAL_TO_JOB', termVersion: term.version, via: 'referral' },
      },
      select: { id: true },
    });
  }

  // Passo 4 — upsert CandidateProfile (perfil leve, DRAFT — presença mínima de candidato).
  await tx.candidateProfile.upsert({
    where: { personId },
    create: { personId },
    update: {},
    select: { personId: true },
  });

  // Passo 5 — só agora CANDIDATE vira ACTIVE (consent já persistido acima).
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
    select: { id: true },
  });

  // Passo 6 — CANDIDATE_ROLE_ACTIVATED apenas quando há ativação real (nunca no no-op).
  await tx.auditLog.create({
    data: {
      action: AuditEvent.CANDIDATE_ROLE_ACTIVATED,
      actorPersonId: personId,
      entityType: 'person_role_grant',
      entityId: grantId,
      ip,
      userAgent,
      after: {
        role: 'CANDIDATE',
        status: 'ACTIVE',
        purpose: 'SOCIAL_REFERRAL_TO_JOB',
        termVersion: term.version,
        consentId: activeConsent?.id ?? newConsentId,
        via: 'referral',
      },
    },
    select: { id: true },
  });

  return { activated: true, grantId };
}
