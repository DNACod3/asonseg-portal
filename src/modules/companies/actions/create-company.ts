'use server';

import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { requireActiveConsent } from '@/modules/consents';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import {
  createCompanySchema,
  type CreateCompanyInput,
} from '../schemas/create-company.schema';

export interface CreateCompanyResult {
  companyId: string;
  cnpj: string;
  razaoSocial: string;
}

/**
 * Cadastra uma Empresa e cria o vínculo RESPONSIBLE para a Pessoa autenticada (USP-012).
 *
 * Sequência canônica:
 *  1. Valida input com Zod (normaliza e valida dígitos do CNPJ)
 *  2. Resolve Pessoa autenticada (status revalidado — ADR-0030)
 *  3. requireActiveConsent: PORTAL_ACCESS deve estar ativo
 *  4. Pré-condição: CNPJ único (AC-012-3 → instrução de "solicitar inclusão")
 *  5. withAudit(COMPANY_CREATED) atomicamente:
 *     - cria Company (isVerified=false — AC-012-4)
 *     - cria PersonCompanyGrant RESPONSIBLE (AC-012-1)
 *     - persiste Consent COMPANY_REPRESENTATION (AC-012-5 — ADR-0020)
 */
export async function createCompany(
  rawInput: CreateCompanyInput,
): Promise<ActionResult<CreateCompanyResult>> {
  const log = childLogger({ module: 'companies', action: 'createCompany' });

  // 1. Validação.
  const parsed = createCompanySchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // 2. Pessoa autenticada.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // 3. PORTAL_ACCESS deve estar ativo (pré-condição de acesso geral).
  const { active: portalConsentActive } = await requireActiveConsent(person.id, 'PORTAL_ACCESS');
  if (!portalConsentActive) {
    return fail('CONSENT_REQUIRED', 'Consentimento de acesso ao portal é necessário.');
  }

  // 4. CNPJ único (AC-012-3).
  const existing = await prisma.company.findUnique({
    where: { cnpj: data.cnpj },
    select: { id: true },
  });
  if (existing) {
    return fail(
      'CONFLICT',
      'Este CNPJ já está cadastrado no portal. Para solicitar sua inclusão como responsável, entre em contato com os responsáveis atuais da Empresa.',
    );
  }

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  // 5. Persistência atômica.
  try {
    const company = await withAudit(
      AuditEvent.COMPANY_CREATED,
      async (tx, audit) => {
        // Guard de concorrência: constraint unique no banco captura corrida de CNPJ
        // entre o findUnique acima e o create abaixo — tratado no catch (P2002).
        const created = await tx.company.create({
          data: {
            cnpj: data.cnpj,
            type: data.type,
            razaoSocial: data.razaoSocial,
            nomeFantasia: data.nomeFantasia,
            setor: data.setor,
            descricao: data.descricao ?? null,
            endereco: data.endereco ?? null,
            isVerified: false, // AC-012-4: aguarda aprovação da 1ª vaga (USP-017)
            createdBy: person.id,
          },
        });

        // Grant RESPONSIBLE automático (AC-012-1).
        await tx.personCompanyGrant.create({
          data: {
            personId: person.id,
            companyId: created.id,
            grantType: 'RESPONSIBLE',
            grantedBy: person.id,
          },
        });

        // Consent COMPANY_REPRESENTATION na mesma transação (AC-012-5 / ADR-0020).
        await tx.consent.create({
          data: {
            personId: person.id,
            purpose: 'COMPANY_REPRESENTATION',
            termVersion: data.companyRepresentationTermVersion,
            termContentHash: data.companyRepresentationTermHash,
            acceptedIp: ip,
            userAgent,
            context: { route: '/empresa/cadastrar', companyId: created.id },
          },
        });

        audit.entityType = 'company';
        audit.entityId = created.id;
        audit.after = {
          cnpj: created.cnpj,
          razaoSocial: created.razaoSocial,
          isVerified: false,
          responsiblePersonId: person.id,
        };

        return created;
      },
      {
        actorUserId: person.supabaseUserId,
        actorPersonId: person.id,
        ip,
        userAgent,
        context: { route: '/empresa/cadastrar' },
      },
    );

    log.info(
      { actorPersonId: person.id, companyId: company.id },
      'companies:created',
    );

    return ok({ companyId: company.id, cnpj: company.cnpj, razaoSocial: company.razaoSocial });
  } catch (err) {
    // Corrida de CNPJ duplicado (P2002).
    if (err instanceof Error && err.message.includes('companies_cnpj_key')) {
      return fail(
        'CONFLICT',
        'Este CNPJ já está cadastrado no portal. Para solicitar sua inclusão como responsável, entre em contato com os responsáveis atuais da Empresa.',
      );
    }
    log.error({ err }, 'companies:create_failed');
    return fail('INTERNAL', 'Não foi possível cadastrar a Empresa. Tente novamente mais tarde.');
  }
}
