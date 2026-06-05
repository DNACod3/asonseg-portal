'use server';

import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/server';
import { clientIp } from '@/shared/lib/clientIp';
import { prisma } from '@/shared/lib/prisma';
import { container } from '@/shared/container';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { AuditEvent, withAudit } from '@/modules/audit';
import { EMAIL_SENDER_TOKEN } from '@/shared/lib/email/email-sender.port';
import { CAPTCHA_VERIFIER_TOKEN } from '../ports/captchaVerifier';
import {
  registerPersonSchema,
  type RegisterPersonInput,
  type PublicRole,
} from '../schemas/registerPerson';

// ── Constantes de consentimento PORTAL_ACCESS ─────────────────────────────────
// Termos aprovados pela diretoria/jurídico (D-004 cleared).
// Hash SHA-256 de legal/consent-terms/portal-access/v1.0.md.
const PORTAL_ACCESS_TERM_VERSION = 'portal-access@v1.0';
const PORTAL_ACCESS_TERM_HASH = 'b9791c01cdf4cf5177d33a8938693671b97ab7f24293665f70024ea83006a0d2';

export interface RegisterPersonResult {
  personId: string;
  role: PublicRole;
}

/**
 * TX1 do auto-cadastro (USP-001 / E-001).
 *
 * Persiste em transação única:
 *   1. Pessoa no banco (cpf único, email_login único — ADR-0021)
 *   2. PersonRoleGrant com status AWAITING_CONSENT
 *   3. Consent PORTAL_ACCESS (base legal mínima)
 *   4. AuditLog PERSON_CREATED_PUBLIC + CONSENT_GRANTED
 *
 * O papel fica AWAITING_CONSENT até a TX2 (acceptRoleConsent), quando o
 * consentimento da finalidade é persistido e o grant é ativado (ADR-0020).
 */
export async function registerPerson(
  rawInput: RegisterPersonInput,
): Promise<ActionResult<RegisterPersonResult>> {
  // 0. D-004 (USP-002): a marca "Pessoa sem documento — exceção" é privilégio
  //    institucional do cadastro assistido. Tentar injetá-la pelo fluxo público é
  //    rejeitado de forma determinística e registrado na auditoria imutável. O Zod
  //    faria `strip` silencioso do campo; esta checagem o torna um erro auditável.
  if (
    rawInput !== null &&
    typeof rawInput === 'object' &&
    ('cpfException' in rawInput || 'cpfExceptionJustification' in rawInput)
  ) {
    const denialHdrs = await headers();
    const denialIp = clientIp(denialHdrs);
    try {
      await prisma.auditLog.create({
        data: {
          action: AuditEvent.PERSON_ASSISTED_EXCEPTION_DENIED,
          ip: denialIp !== 'unknown' ? denialIp : null,
          userAgent: denialHdrs.get('user-agent') ?? null,
          after: { vector: 'PUBLIC_SELF_REGISTRATION' },
        },
        select: { id: true },
      });
    } catch (auditErr) {
      console.error('[registerPerson] Falha ao auditar tentativa de exceção indevida:', auditErr);
    }
    return fail('FORBIDDEN', 'Operação não permitida por este fluxo de cadastro.');
  }

  // 1. Validação de input
  const parsed = registerPersonSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  // 2. Contexto da request (IP, user-agent para audit e CAPTCHA)
  const hdrs = await headers();
  const ip = clientIp(hdrs);
  const userAgent = hdrs.get('user-agent') ?? null;

  // 3. Verificação CAPTCHA (fail-closed — ADR-0014 / P-005)
  const captcha = container.resolve(CAPTCHA_VERIFIER_TOKEN);
  const captchaResult = await captcha.verify(input.captchaToken, ip !== 'unknown' ? ip : undefined);
  if (!captchaResult.ok) {
    return fail('PRECONDITION_FAILED', 'CAPTCHA inválido ou expirado. Tente novamente.');
  }

  // 4. Criar credencial no Supabase Auth (hash bcrypt gerenciado pelo provedor — P-003)
  const supabase = createSupabaseAdminClient();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    if (authError?.message?.toLowerCase().includes('already')) {
      return fail('CONFLICT', 'E-mail já está em uso. Faça login ou use outro e-mail.');
    }
    return fail('INTERNAL', 'Erro ao criar credencial. Tente novamente mais tarde.');
  }

  const supabaseUserId = authUser.user.id;

  // 5. TX1: Pessoa + grant AWAITING_CONSENT + consent PORTAL_ACCESS + audit
  try {
    const personId = crypto.randomUUID();
    const grantId = crypto.randomUUID();
    const consentPortalId = crypto.randomUUID();

    const person = await withAudit(
      AuditEvent.PERSON_CREATED_PUBLIC,
      async (tx, audit) => {
        const createdPerson = await tx.person.create({
          data: {
            id: personId,
            supabaseUserId,
            fullName: input.fullName,
            cpf: input.cpf,
            emailLogin: input.email,
          },
          select: { id: true, fullName: true, emailLogin: true },
        });

        await tx.personRoleGrant.create({
          data: {
            id: grantId,
            personId,
            role: input.role,
            status: 'AWAITING_CONSENT',
          },
        });

        await tx.consent.create({
          data: {
            id: consentPortalId,
            personId,
            purpose: 'PORTAL_ACCESS',
            termVersion: PORTAL_ACCESS_TERM_VERSION,
            termContentHash: PORTAL_ACCESS_TERM_HASH,
            acceptedIp: ip !== 'unknown' ? ip : null,
            userAgent,
          },
        });

        await tx.auditLog.create({
          data: {
            action: AuditEvent.CONSENT_GRANTED,
            actorPersonId: personId,
            entityType: 'consent',
            entityId: consentPortalId,
            ip: ip !== 'unknown' ? ip : null,
            userAgent,
            after: { purpose: 'PORTAL_ACCESS', termVersion: PORTAL_ACCESS_TERM_VERSION },
          },
          select: { id: true },
        });

        audit.entityType = 'person';
        audit.entityId = personId;
        audit.after = {
          personId,
          role: input.role,
          supabaseUserId,
          consentPurpose: 'PORTAL_ACCESS',
        };

        return createdPerson;
      },
      { ip: ip !== 'unknown' ? ip : undefined, userAgent: userAgent ?? undefined },
    );

    // 6. E-mail de boas-vindas via porta EmailSender (best-effort, fora da
    // transação — falha não reverte o cadastro). A porta nunca lança; o `try`
    // protege apenas contra falha na resolução do adapter.
    try {
      const emailSender = container.resolve(EMAIL_SENDER_TOKEN);
      const sent = await emailSender.send({
        to: person.emailLogin!,
        template: 'welcome',
        data: { nome: person.fullName, papel: ROLE_LABEL[input.role] },
      });
      if (!sent.ok) {
        console.error('[registerPerson] Falha ao enviar e-mail de boas-vindas (provedor).');
      }
    } catch (emailErr) {
      console.error('[registerPerson] Falha ao enviar e-mail de boas-vindas:', emailErr);
    }

    return ok({ personId, role: input.role });
  } catch (err) {
    // Conflito de CPF ou e-mail (unique constraint — ADR-0021 / E-006)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      await supabase.auth.admin
        .deleteUser(supabaseUserId)
        .catch((rollbackErr) =>
          console.error('[registerPerson] Falha no rollback da credencial Supabase:', rollbackErr),
        );

      const rawTarget = err.meta?.target;
      const targets = (
        Array.isArray(rawTarget) ? rawTarget : [String(rawTarget ?? '')]
      ).join(',');

      if (targets.includes('cpf')) {
        return fail('CONFLICT', 'CPF já está cadastrado no portal.');
      }
      if (targets.includes('email_login') || targets.includes('emailLogin')) {
        return fail('CONFLICT', 'E-mail já está em uso. Faça login ou use outro e-mail.');
      }
      return fail('CONFLICT', 'Dados já cadastrados. Verifique CPF e e-mail.');
    }

    await supabase.auth.admin
      .deleteUser(supabaseUserId)
      .catch((rollbackErr) =>
        console.error('[registerPerson] Falha no rollback da credencial Supabase:', rollbackErr),
      );

    console.error('[registerPerson] Erro inesperado na TX1:', err);
    return fail('INTERNAL', 'Erro interno. Tente novamente mais tarde.');
  }
}

// ── Helpers privados ──────────────────────────────────────────────────────────

// Rótulo amigável do papel, usado no e-mail de boas-vindas (template `welcome`).
const ROLE_LABEL: Record<PublicRole, string> = {
  CANDIDATE: 'candidato(a)',
  PROVIDER: 'prestador(a) de serviços',
  CLIENT: 'cliente',
};
