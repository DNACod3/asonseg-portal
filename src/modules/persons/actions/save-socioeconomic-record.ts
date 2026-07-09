'use server';

import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { canManageSocioeconomicRecord } from '../domain/socioeconomic-record';
import {
  socioeconomicRecordSchema,
  type SocioeconomicRecordInput,
} from '../schemas/socioeconomic-record.schema';

export interface SaveSocioeconomicRecordResult {
  personId: string;
}

/**
 * Cadastra/edita a ficha socioeconômica de uma Pessoa (USP-036 / SOC-01).
 *
 * Sequência canônica de Server Action sensível (project-guideline §9):
 *  1. Zod (`socioeconomicRecordSchema`) — todos os 4 campos declarados opcionais;
 *  2. sessão — `getCurrentPerson` (ADR-0030, papéis ATIVOS);
 *  3. `requirePermission` (inline) — guarda de papel `canManageSocioeconomicRecord`
 *     (SOCIAL_ASSISTANT/BOARD; SOC-036-MN-01: qualquer outro papel é `FORBIDDEN`
 *     ANTES de qualquer leitura/escrita da ficha — nenhum campo sensível chega a
 *     ser tocado);
 *  4. consentimento — **N/A** (Assumption #2 da spec: legítimo interesse/mandato
 *     institucional; a Pessoa-alvo pode não ter credencial, então não há como
 *     exigir consentimento ativo do titular aqui);
 *  4b. pré-condição — Pessoa-alvo existe (`NOT_FOUND` se não). A mesma leitura
 *      resolve se já existe ficha (decide `SOCIAL_SHEET_CREATED` vs.
 *      `SOCIAL_SHEET_UPDATED` — `withAudit` fixa o evento antes de entrar na
 *      transação, então a decisão precisa vir de uma leitura prévia, não de
 *      dentro do callback);
 *  5. `withAudit(SOCIAL_SHEET_CREATED|SOCIAL_SHEET_UPDATED)` — `upsert` por
 *     `personId` (PK=FK, 1 ficha por Pessoa) na MESMA transação do evento de
 *     auditoria (SOC-036-MN-02: falha ao gravar o audit faz rollback do upsert,
 *     atomicidade de `withAudit`/ADR-0020).
 *
 * `audit.after` **não** grava os valores sensíveis em claro — apenas os nomes
 * dos campos presentes no input (design.md §Risks: minimização de PII no log,
 * mesmo com a redação automática de `normalizeJson`).
 *
 * Nunca lança: retorna sempre `ActionResult<SaveSocioeconomicRecordResult>`.
 */
export async function saveSocioeconomicRecord(
  rawInput: SocioeconomicRecordInput,
): Promise<ActionResult<SaveSocioeconomicRecordResult>> {
  const log = childLogger({ module: 'persons', action: 'saveSocioeconomicRecord' });

  // 1. Validação de input (Zod).
  const parsed = socioeconomicRecordSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { personId, incomeBracket, socialBenefit, housingSituation, familyComposition } =
    parsed.data;

  // 2. Operador da sessão.
  const operator = await getCurrentPerson();
  if (!operator) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // 3. requirePermission (inline, SOC-036-MN-01): nenhum campo é lido/escrito
  //    antes desta checagem.
  if (!canManageSocioeconomicRecord(operator.roles)) {
    log.warn(
      { actorPersonId: operator.id, roles: operator.roles, targetId: personId },
      'persons:save_socioeconomic_record_forbidden',
    );
    return fail(
      'FORBIDDEN',
      'Apenas assistentes sociais ou diretoria podem acessar a ficha socioeconômica.',
    );
  }

  // 4b. Pré-condição: Pessoa-alvo existe. A mesma leitura resolve se já há
  //     ficha (decide o evento de auditoria — create vs. update).
  const target = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, socioeconomicRecord: { select: { personId: true } } },
  });
  if (!target) {
    return fail('NOT_FOUND', 'Pessoa não encontrada.');
  }
  const event = target.socioeconomicRecord
    ? AuditEvent.SOCIAL_SHEET_UPDATED
    : AuditEvent.SOCIAL_SHEET_CREATED;

  // Nomes dos campos presentes no input (para o `after` minimizado — não os valores).
  const fieldsPresent = Object.entries({
    incomeBracket,
    socialBenefit,
    housingSituation,
    familyComposition,
  })
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  // 5. Persistência + auditoria atômica.
  try {
    await withAudit(
      event,
      async (tx, audit) => {
        await tx.socioeconomicRecord.upsert({
          where: { personId },
          create: {
            personId,
            incomeBracket: incomeBracket ?? null,
            socialBenefit: socialBenefit ?? null,
            housingSituation: housingSituation ?? null,
            familyComposition: familyComposition ?? null,
            updatedByPersonId: operator.id,
          },
          update: {
            incomeBracket: incomeBracket ?? null,
            socialBenefit: socialBenefit ?? null,
            housingSituation: housingSituation ?? null,
            familyComposition: familyComposition ?? null,
            updatedByPersonId: operator.id,
          },
          select: { personId: true },
        });

        // Minimização de PII (design.md §Risks): só nomes de campos alterados/
        // flags de presença — nunca os valores sensíveis em claro no audit_log.
        audit.entityType = 'socioeconomic_record';
        audit.entityId = personId;
        audit.after = { personId, fieldsPresent };
      },
      {
        actorUserId: operator.supabaseUserId,
        actorPersonId: operator.id,
        ip,
        userAgent,
        context: { route: '/social/pessoas/[personId]/ficha' },
      },
    );

    log.info({ actorPersonId: operator.id, targetId: personId, event }, 'persons:socioeconomic_record_saved');
    return ok({ personId });
  } catch (err) {
    log.error({ err, targetId: personId }, 'persons:save_socioeconomic_record_failed');
    return fail('INTERNAL', 'Não foi possível salvar a ficha. Tente novamente mais tarde.');
  }
}
