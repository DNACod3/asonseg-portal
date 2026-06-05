'use server';

import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { AuditEvent, withAudit } from '@/modules/audit';
import { getCurrentPerson } from '../server/session';
import { canRegisterAssisted } from '../domain/assisted-registration';
import {
  registerByAssistantSchema,
  type RegisterByAssistantInput,
} from '../schemas/register-by-assistant.schema';

export interface RegisterByAssistantResult {
  personId: string;
  /** `true` quando a Pessoa foi criada sob a marca de exceção de CPF. */
  cpfException: boolean;
}

/**
 * Cadastro assistido de Pessoa pela assistente social (USP-002 / IDN-04..06).
 *
 * Porta de entrada institucional alternativa à USP-001: cria uma Pessoa **sem
 * credencial** (não loga — P-002), opcionalmente **sem CPF** mediante exceção
 * justificada (E-002 / F3), referenciável em encaminhamentos/ficha/relatórios.
 *
 * Sequência canônica (project-guideline §9):
 *   1. Zod (`registerByAssistantSchema`)
 *   2. `requirePermission` — inline: apenas SOCIAL_ASSISTANT/BOARD (P-001/P-005)
 *   3. Consentimento — N/A: o termo de atendimento social é assinado em papel
 *      fora do sistema (ADR-0013 finalidade 6 / E-004), sem captura eletrônica
 *      no MVP, então não há `requireActiveConsent` aqui.
 *   4. Pré-condições — unicidade de CPF garantida pelo índice único (catch P2002)
 *   5. `withAudit('PERSON_CREATED_BY_AS')` — Pessoa + grant opcional + evento
 *      dedicado de exceção, tudo em uma transação.
 *
 * Nunca lança: retorna sempre `ActionResult<RegisterByAssistantResult>`.
 */
export async function registerPersonByAssistant(
  rawInput: RegisterByAssistantInput,
): Promise<ActionResult<RegisterByAssistantResult>> {
  const log = childLogger({ module: 'identity', action: 'registerPersonByAssistant' });

  // 1. Validação de input.
  const parsed = registerByAssistantSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  // 2. requirePermission (inline): a Pessoa autenticada precisa ser AS ou
  //    diretoria. `getCurrentPerson()` revalida status no DB (ADR-0030) e devolve
  //    apenas papéis ATIVOS. Defesa em profundidade: a rota `(app)` também gateia,
  //    mas a action se protege contra chamada direta (D-004).
  const operator = await getCurrentPerson();
  if (!operator) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }
  if (!canRegisterAssisted(operator.roles)) {
    log.warn(
      { actorPersonId: operator.id, roles: operator.roles },
      'assisted-register:forbidden',
    );
    return fail(
      'FORBIDDEN',
      'Apenas assistentes sociais ou diretoria podem realizar o cadastro assistido.',
    );
  }

  // 4. Contexto da request para auditoria (P-005 — operador sempre registrado).
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent');

  // 5. Persistência + auditoria atômica.
  try {
    const personId = crypto.randomUUID();

    await withAudit(
      AuditEvent.PERSON_CREATED_BY_AS,
      async (tx, audit) => {
        await tx.person.create({
          data: {
            id: personId,
            // Sem credencial: P-002 — Pessoa não loga por nenhuma rota.
            supabaseUserId: null,
            emailLogin: null,
            fullName: input.fullName,
            cpf: input.cpf ?? null,
            cpfExceptionJustification: input.cpfException
              ? input.cpfExceptionJustification
              : null,
            phone: input.phone ?? null,
            birthDate: input.birthDate ? new Date(input.birthDate) : null,
            fullAddress: input.fullAddress ?? null,
            createdByPersonId: operator.id,
          },
          select: { id: true },
        });

        // Papel pretendido (opcional): grant AWAITING_CONSENT — ativa só quando o
        // consentimento da finalidade for registrado (ADR-0020), via USP-003
        // (reivindicação de credencial) ou termo em papel. Mesmo padrão da USP-001.
        if (input.role) {
          await tx.personRoleGrant.create({
            data: {
              personId,
              role: input.role,
              status: 'AWAITING_CONSENT',
            },
          });
        }

        // Exceção de CPF: evento dedicado com a justificativa na coluna própria
        // (não-redigida). Não vai no `after` porque a chave
        // `cpfExceptionJustification` casa com o denylist de PII e seria redigida
        // a [REDACTED], destruindo a defensabilidade LGPD (F3).
        if (input.cpfException) {
          await tx.auditLog.create({
            data: {
              action: AuditEvent.PERSON_CPF_EXCEPTION_GRANTED,
              actorUserId: operator.supabaseUserId,
              actorPersonId: operator.id,
              entityType: 'person',
              entityId: personId,
              ip,
              userAgent,
              justification: input.cpfExceptionJustification,
              after: { personId, cpfException: true },
            },
            select: { id: true },
          });
        }

        audit.entityType = 'person';
        audit.entityId = personId;
        audit.after = {
          personId,
          role: input.role ?? null,
          hasCpf: Boolean(input.cpf),
          cpfException: input.cpfException,
          credentialLess: true,
          createdByPersonId: operator.id,
        };

        return personId;
      },
      {
        actorUserId: operator.supabaseUserId,
        actorPersonId: operator.id,
        ip,
        userAgent,
      },
    );

    log.info({ actorPersonId: operator.id, personId }, 'assisted-register:created');
    return ok({ personId, cpfException: input.cpfException });
  } catch (err) {
    // Conflito de CPF (índice único — ADR-0021).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const rawTarget = err.meta?.target;
      const targets = (Array.isArray(rawTarget) ? rawTarget : [String(rawTarget ?? '')]).join(',');
      if (targets.includes('cpf')) {
        return fail('CONFLICT', 'CPF já está cadastrado no portal.');
      }
      return fail('CONFLICT', 'Dados já cadastrados. Verifique o CPF informado.');
    }

    log.error({ err }, 'assisted-register:unexpected');
    return fail('INTERNAL', 'Erro interno. Tente novamente mais tarde.');
  }
}
