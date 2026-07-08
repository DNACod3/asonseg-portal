import { headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { AuditEvent, recordAuditEvent } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { viewClientForProvider, type ProviderInterestView } from '../views/client-for-provider.view';

/** Tamanho de página do inbox de manifestações do prestador (L-002 — `take` obrigatório). */
export const PROVIDER_INTERESTS_PAGE_SIZE = 20;

export interface ProviderInterestsResult {
  interests: ProviderInterestView[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * `select` explícito (SVC035-MN-02) — carrega **só** a PII permitida ao
 * prestador (nome, telefone, e-mail do cliente) + a referência ao serviço.
 * `cpf`/`birthDate`/`fullAddress` NUNCA aparecem aqui: é estruturalmente
 * impossível vazá-los no payload Flight/RSC. `clientPersonId` é só o FK usado
 * para auditar o acesso — não é PII em si.
 */
const providerInterestSelect = {
  id: true,
  clientPersonId: true,
  interestedAt: true,
  service: { select: { id: true, title: true } },
  client: { select: { fullName: true, phone: true, emailLogin: true } },
} satisfies Prisma.ServiceInterestSelect;

/**
 * Lista as manifestações de interesse **ativas** de todos os serviços de um
 * prestador — inbox agregado (USP-035 / AC-035-1), espelhando `listJobApplicants`
 * (AD-018: "empregador vê candidatos"). Divergência de forma vs. o precedente
 * por-vaga: um prestador PF é uma Pessoa, não tem contexto `empresaId`/`jobId`
 * externo a validar, então o escopo é só `service.authorPersonId = viewer.id`
 * (SVC035-MN-01 — barreira no `where`, não há id de serviço vindo do input).
 *
 * Sequência (leitura sensível, mesmo espírito least-privilege + auditoria da
 * canônica de escrita, adaptado):
 *  1. SELECT restrito das manifestações ativas (`cancelledAt: null`) escopadas
 *     ao prestador, paginado no banco (SVC035-MN-03 — canceladas nunca entram
 *     no `where`; D4 — não filtra pelo status do serviço, o vínculo é com a
 *     manifestação).
 *  2. Mapeia por `viewClientForProvider` (AC-035-2 — só o View Model sai).
 *  3. Audita 1 `SENSITIVE_FIELD_VIEWED` por cliente exibido, na MESMA
 *     transação (espelha AD-018) — evento já existe no catálogo, não é
 *     acoplado a um evento primário porque não há um "INTERESTS_VIEWED"
 *     no catálogo (nem é criado um — só se reusa o secundário existente).
 *
 * Nunca lança — sempre `ActionResult`.
 */
export async function listProviderInterests(
  viewer: CurrentPerson,
  page = 1,
): Promise<ActionResult<ProviderInterestsResult>> {
  const log = childLogger({ module: 'services', query: 'listProviderInterests' });

  const safePage = Math.max(1, Math.trunc(page));
  const skip = (safePage - 1) * PROVIDER_INTERESTS_PAGE_SIZE;
  // SVC035-MN-01: ownership é a própria barreira do `where` — nenhum id externo
  // de serviço vem do input a validar. SVC035-MN-03/D4: canceladas nunca entram;
  // status do serviço não filtra (o prestador ainda quer contatar quem o procurou).
  const where = {
    service: { authorPersonId: viewer.id },
    cancelledAt: null,
  } satisfies Prisma.ServiceInterestWhereInput;

  const [rows, total] = await Promise.all([
    prisma.serviceInterest.findMany({
      where,
      orderBy: { interestedAt: 'desc' },
      take: PROVIDER_INTERESTS_PAGE_SIZE,
      skip,
      select: providerInterestSelect,
    }),
    prisma.serviceInterest.count({ where }),
  ]);

  const interests = rows.map((row) =>
    viewClientForProvider({
      interestId: row.id,
      clientName: row.client.fullName,
      phone: row.client.phone,
      email: row.client.emailLogin,
      interestedAt: row.interestedAt,
      service: row.service,
    }),
  );

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;
  const ctx = { actorPersonId: viewer.id, ip, userAgent, context: { route: '/prestador/manifestacoes' } };

  try {
    await prisma.$transaction(async (tx) => {
      // 1 SENSITIVE_FIELD_VIEWED por cliente exibido, sequencial na mesma tx
      // (guideline §13 — nada de `Promise.all` dentro de um `tx`).
      for (const row of rows) {
        await recordAuditEvent(
          tx,
          AuditEvent.SENSITIVE_FIELD_VIEWED,
          {
            entityType: 'person',
            entityId: row.clientPersonId,
            context: { viewedFields: ['phone', 'email'], via: 'provider_interests' },
          },
          ctx,
        );
      }
    });
  } catch (err) {
    log.error({ err, viewerId: viewer.id }, 'services:list_provider_interests_audit_failed');
    return fail('INTERNAL', 'Erro interno. Tente novamente mais tarde.');
  }

  return ok({ interests, total, page: safePage, pageSize: PROVIDER_INTERESTS_PAGE_SIZE });
}
