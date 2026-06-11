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
 *
 * Pré-condição (AC #118-2): o consentimento-base `PORTAL_ACCESS` deve estar ativo
 * (criado no cadastro). Se ausente, o helper lança `PORTAL_ACCESS_CONSENT_MISSING`
 * antes de qualquer escrita, abortando a transação do chamador.
 */
export async function ensureClientRole(
  tx: Prisma.TransactionClient,
  { personId, term, ip, userAgent }: EnsureClientRoleArgs,
): Promise<EnsureClientRoleResult> {
  // Passo 1 — idempotência: releitura defensiva dentro da tx (fecha corrida de
  // duplo submit). A decisão é a regra pura `decideClientActivation` sobre os
  // papéis ATIVOS da Pessoa — uma única leitura. `take` limita a cardinalidade
  // (bounded pelo enum `Role`), conforme a convenção de paginação obrigatória.
  const activeRoles = (
    await tx.personRoleGrant.findMany({
      where: { personId, status: 'ACTIVE' },
      select: { role: true },
      take: 20,
    })
  ).map((g) => g.role);

  const { needsActivation } = decideClientActivation(activeRoles);
  if (!needsActivation) {
    const grant = await tx.personRoleGrant.findFirst({
      where: { personId, role: 'CLIENT', status: 'ACTIVE' },
      select: { id: true },
    });
    return { activated: false, grantId: grant?.id ?? '' };
  }

  // Passo 2 — P-001 (PORTAL_ACCESS): o consentimento-base do cadastro deve estar
  // ativo (criado no registro — em geral já existe). Verificação defensiva, antes
  // de qualquer escrita: se ausente, aborta a tx do chamador (invariante do fluxo —
  // design §2 passo 3 / AC #118-2). Não fabrica o consent-base aqui.
  const portalConsent = await tx.consent.findFirst({
    where: { personId, purpose: 'PORTAL_ACCESS', revokedAt: null },
    select: { id: true },
  });
  if (!portalConsent) {
    throw Object.assign(new Error('PORTAL_ACCESS_CONSENT_MISSING'), {
      code: 'PORTAL_ACCESS_CONSENT_MISSING',
    });
  }

  // Passo 3 — cria/reaproveita grant em AWAITING_CONSENT (ADR-0020: intermediário obrigatório).
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

  // Passo 4 — P-001: consent SERVICE_HIRING na MESMA transação, ANTES de ACTIVE.
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

  // Passo 5 — upsert ClientProfile (perfil leve, sem dados obrigatórios).
  await tx.clientProfile.upsert({
    where: { personId },
    create: { personId },
    update: {},
    select: { personId: true },
  });

  // Passo 6 — só agora CLIENT vira ACTIVE (P-001: consent já persistido acima).
  // `activatedAt: new Date()` grava o instante em UTC (timestamptz) — conversão p/
  // America/Sao_Paulo só na borda de exibição (espelha activate-additional-role.ts).
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

  // Passo 7 — CLIENT_ROLE_ACTIVATED apenas quando há ativação real (nunca no no-op).
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
