'use server';

import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { formatSaoPaulo } from '@/shared/lib/time';
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

// ── Termo de atendimento social (finalidade 6 — ADR-0013) ─────────────────────
// Evidência do consentimento colhido em PAPEL (E-004). Espelha o registro
// canônico de `src/modules/consents/domain/terms-registry.ts` (SOCIAL_ASSISTANCE)
// e `legal/consent-terms/social-assistance/v1.0.md`. A redação do atestado vive em
// `legal/consent-terms/social-assistance/evidence-statement-v1.0.md` (aprovado — D-002 liberado em 2026-06-05).
const SOCIAL_ASSISTANCE_TERM_VERSION = 'social-assistance@v1.0';
const SOCIAL_ASSISTANCE_TERM_HASH =
  '6d15978756b5f6b943c977dfdf1f9fb0dbe492eae013f5f03069fce5ca4c2c6f';

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
 *   3. Consentimento — o termo de atendimento social é assinado em PAPEL fora do
 *      sistema (ADR-0013 finalidade 6); não há `requireActiveConsent`. Em vez
 *      disso registramos a EVIDÊNCIA da coleta (E-004) no `after` do audit do
 *      cadastro: data, responsável (AS), referência ao termo e versão.
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

  // Contexto da request (IP, user-agent). Resolvido antes do gate de permissão
  // porque também alimenta o log de tentativa indevida (D-004) e a auditoria do
  // cadastro (P-005 — operador sempre registrado).
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent');

  // 2. requirePermission (inline): a Pessoa autenticada precisa ser AS ou
  //    diretoria. `getCurrentPerson()` revalida status no DB (ADR-0030) e devolve
  //    apenas papéis ATIVOS. Defesa em profundidade: a rota `(app)` também gateia,
  //    mas a action se protege contra chamada direta (D-004).
  const operator = await getCurrentPerson();
  if (!operator) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }
  if (!canRegisterAssisted(operator.roles)) {
    // D-004: a tentativa indevida (papel sem privilégio chamando a action direto)
    // gera log de AUDITORIA imutável, além do log de aplicação. Best-effort: a
    // falha na gravação não mascara o FORBIDDEN nem lança.
    try {
      await prisma.auditLog.create({
        data: {
          action: AuditEvent.PERSON_ASSISTED_EXCEPTION_DENIED,
          actorUserId: operator.supabaseUserId,
          actorPersonId: operator.id,
          ip,
          userAgent,
          entityType: 'person',
          after: { vector: 'ASSISTED_ACTION', attemptedRoles: operator.roles },
        },
        select: { id: true },
      });
    } catch (auditErr) {
      log.error({ err: auditErr }, 'assisted-register:denial-audit-failed');
    }
    log.warn(
      { actorPersonId: operator.id, roles: operator.roles },
      'assisted-register:forbidden',
    );
    return fail(
      'FORBIDDEN',
      'Apenas assistentes sociais ou diretoria podem realizar o cadastro assistido.',
    );
  }

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

        // E-004: data da assinatura física do termo. Quando a AS não informa,
        // usamos a data do cadastro (atendimento presencial), no fuso de SP.
        const signedOnPaperAt =
          input.signedOnPaperAt ?? formatSaoPaulo(new Date(), 'yyyy-MM-dd');

        audit.entityType = 'person';
        audit.entityId = personId;
        audit.after = {
          personId,
          role: input.role ?? null,
          hasCpf: Boolean(input.cpf),
          cpfException: input.cpfException,
          credentialLess: true,
          createdByPersonId: operator.id,
          // E-004: evidência do consentimento de atendimento social colhido em
          // papel (finalidade 6 — ADR-0013). Sem PII (data/termo/versão/canal);
          // o responsável (AS) é o `actorPersonId` do próprio evento.
          paperConsent: {
            purpose: 'SOCIAL_ASSISTANCE',
            termVersion: SOCIAL_ASSISTANCE_TERM_VERSION,
            termContentHash: SOCIAL_ASSISTANCE_TERM_HASH,
            consentChannel: 'PAPER',
            signedOnPaperAt,
          },
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
