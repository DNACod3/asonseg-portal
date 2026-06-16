'use server';

import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { identityFieldsChanged } from '../domain/company-edit';
import { editCompanySchema, type EditCompanyInput } from '../schemas/edit-company.schema';

/**
 * Identifica a violação de unicidade de CNPJ (índice `companies_cnpj_key`) numa
 * corrida concorrente. O Prisma 5.x sinaliza via `code === 'P2002'` + `meta.target`
 * (`['cnpj']`); a mensagem **não** carrega o nome do índice, então casar string na
 * mensagem é frágil — usamos o código estruturado do erro (D-015-D / P-005).
 */
function isCnpjUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error) || (err as { code?: unknown }).code !== 'P2002') {
    return false;
  }
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target)
    ? target.includes('cnpj')
    : String(target ?? '').includes('cnpj');
}

export interface EditCompanyResult {
  companyId: string;
  /** Estado da verificação após a edição. */
  isVerified: boolean;
  /** `true` se a edição rebaixou a verificação (mudou campo identitário). */
  downgraded: boolean;
}

/**
 * Edita os dados cadastrais de uma Empresa (USP-015).
 *
 * Sequência canônica (runbook-server-action):
 *  1. Valida input com Zod (normaliza/valida dígitos do CNPJ; `empresaId` uuid).
 *  2. Resolve Pessoa autenticada (status revalidado — ADR-0030).
 *  3. Carrega a Empresa alvo (`before`) — NOT_FOUND se não existe.
 *  4. Permissão (P-004): o ator deve ser responsável ATIVO da Empresa → FORBIDDEN.
 *  5. Pré-condição CNPJ único (P-005 / ADR-0021): se o CNPJ mudou e pertence a
 *     outra Empresa → CONFLICT.
 *  6. withAudit(COMPANY_UPDATED) atomicamente (ADR-0020/0023):
 *     - `downgrade = identityFieldsChanged(before, after)` (regra pura, D-015-B).
 *     - `tx.company.update` aplica os campos + `isVerified:false` SSE `downgrade`
 *       (mesma transação, P-001 — blindagem de RP-005).
 *     - audit `before`/`after` com o par completo (campos + isVerified) — E-003/D-004.
 *     - P2002 em `companies_cnpj_key` → CONFLICT (guarda de concorrência, D-015-D).
 *  7. Retorno ActionResult<EditCompanyResult>. Nunca `throw`; nunca model cru.
 */
export async function editarEmpresa(
  rawInput: EditCompanyInput,
): Promise<ActionResult<EditCompanyResult>> {
  const log = childLogger({ module: 'companies', action: 'editarEmpresa' });

  // 1. Validação.
  const parsed = editCompanySchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const data = parsed.data;

  // 2. Pessoa autenticada.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // 3. Carrega a Empresa alvo (before).
  const before = await prisma.company.findUnique({
    where: { id: data.empresaId },
    select: {
      id: true,
      cnpj: true,
      type: true,
      razaoSocial: true,
      nomeFantasia: true,
      setor: true,
      descricao: true,
      endereco: true,
      isVerified: true,
    },
  });
  if (!before) {
    return fail('NOT_FOUND', 'Empresa não encontrada.');
  }

  // 4. Permissão (P-004): só responsável ATIVO da Empresa pode editar.
  const actorGrant = await prisma.personCompanyGrant.findFirst({
    where: {
      personId: person.id,
      companyId: data.empresaId,
      grantType: 'RESPONSIBLE',
      status: 'ACTIVE',
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!actorGrant) {
    return fail('FORBIDDEN', 'Você não é responsável ativo desta Empresa.');
  }

  // 5. Pré-condição CNPJ único (P-005): só checa quando o CNPJ mudou.
  if (data.cnpj !== before.cnpj) {
    const cnpjOwner = await prisma.company.findUnique({
      where: { cnpj: data.cnpj },
      select: { id: true },
    });
    if (cnpjOwner && cnpjOwner.id !== before.id) {
      return fail('CONFLICT', 'Este CNPJ já está cadastrado em outra Empresa.');
    }
  }

  // Decisão de rebaixamento (regra pura, D-015-B). `downgrade` só rebaixa de fato
  // se a Empresa estava verificada — idempotente quando já era false.
  const downgrade = identityFieldsChanged(before, data);
  const willDowngrade = downgrade && before.isVerified;

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  // 6. Persistência atômica: edição + rebaixamento + auditoria na mesma transação.
  try {
    const updated = await withAudit(
      AuditEvent.COMPANY_UPDATED,
      async (tx, audit) => {
        const company = await tx.company.update({
          where: { id: before.id },
          data: {
            cnpj: data.cnpj,
            type: data.type,
            razaoSocial: data.razaoSocial,
            nomeFantasia: data.nomeFantasia,
            setor: data.setor,
            descricao: data.descricao ?? null,
            endereco: data.endereco ?? null,
            ...(willDowngrade ? { isVerified: false } : {}),
          },
          select: {
            id: true,
            cnpj: true,
            type: true,
            razaoSocial: true,
            nomeFantasia: true,
            setor: true,
            descricao: true,
            endereco: true,
            isVerified: true,
          },
        });

        audit.entityType = 'company';
        audit.entityId = company.id;
        audit.before = {
          cnpj: before.cnpj,
          type: before.type,
          razaoSocial: before.razaoSocial,
          nomeFantasia: before.nomeFantasia,
          setor: before.setor,
          descricao: before.descricao,
          endereco: before.endereco,
          isVerified: before.isVerified,
        };
        audit.after = {
          cnpj: company.cnpj,
          type: company.type,
          razaoSocial: company.razaoSocial,
          nomeFantasia: company.nomeFantasia,
          setor: company.setor,
          descricao: company.descricao,
          endereco: company.endereco,
          isVerified: company.isVerified,
        };

        return company;
      },
      {
        actorUserId: person.supabaseUserId,
        actorPersonId: person.id,
        ip,
        userAgent,
        context: { route: `/empresa/${before.id}/editar` },
      },
    );

    log.info(
      { actorPersonId: person.id, companyId: updated.id, downgraded: willDowngrade },
      'companies:updated',
    );

    return ok({
      companyId: updated.id,
      isVerified: updated.isVerified,
      downgraded: willDowngrade,
    });
  } catch (err) {
    // Corrida de CNPJ duplicado (P2002 / D-015-D): a unicidade dispara no UPDATE
    // quando a pré-checagem (passo 5) não enxergou o concorrente.
    if (isCnpjUniqueViolation(err)) {
      return fail('CONFLICT', 'Este CNPJ já está cadastrado em outra Empresa.');
    }
    const errCode = err instanceof Error ? (err as NodeJS.ErrnoException).code ?? err.message : String(err);
    log.error({ errCode }, 'companies:edit_failed');
    return fail('INTERNAL', 'Não foi possível salvar as alterações. Tente novamente mais tarde.');
  }
}
