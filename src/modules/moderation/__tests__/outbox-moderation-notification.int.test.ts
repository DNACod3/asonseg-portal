// Integração do enqueue de e-mail de decisão de moderação (USP-057 / REL-1 /
// MOD-4) — exercita `transitionContent` com o container REAL (adapter
// `OutboxModerationNotification`, sem override de MODERATION_NOTIFICATION_TOKEN)
// contra Postgres local. Requer `supabase start` + `.env.local` (DATABASE_URL).
// Complementa (sem substituir) `transition-content.int.test.ts` — aquele
// arquivo cobre a máquina de estados com um spy de notificação; este cobre o
// enqueue real no Outbox produzido pelo adapter desta US.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { container } from '@/shared/container';
import { resolveOutboxEmail } from '@/shared/lib/outbox/resolve-outbox-email';
import type { EmailMessage } from '@/shared/lib/email/email-sender.port';

// A revalidação da home (`to === ACTIVE`) chama `next/cache.revalidatePath` por
// baixo — vira spy pelo mesmo motivo dos demais testes de integração de
// moderação (evita next/cache fora de um request Next real).
const homeRevalidateSpy = vi.hoisted(() => vi.fn());
vi.mock('@/modules/reporting', () => ({
  revalidateHomeIndicators: homeRevalidateSpy,
}));

import {
  transitionContent,
  ContentKind,
  ContentStatus,
  CACHE_INVALIDATION_TOKEN,
  type CacheInvalidationPort,
} from '@/modules/moderation';

const hasDb = Boolean(process.env.DATABASE_URL);
const ACTOR = '00000000-0000-0000-0000-0000000000aa'; // moderador (autor ≠ moderador)
const MOTIVO = 'Faltou descrever as atividades exercidas no cargo anterior';

const lastEmailRow = () =>
  prisma.outbox.findFirst({
    where: { topic: 'email' },
    orderBy: { createdAt: 'desc' },
    select: { payload: true },
  });

const emailCount = () => prisma.outbox.count({ where: { topic: 'email' } });

async function seedCandidate(headline: string | null, emailLogin: string, status: 'IN_MODERATION' | 'ACTIVE') {
  const p = await prisma.person.create({
    data: { fullName: 'USP057 Candidato Int', status: 'ATIVO', emailLogin },
    select: { id: true },
  });
  await prisma.candidateProfile.create({
    data: { personId: p.id, headline, publicationStatus: status },
  });
  return p.id;
}

describe.skipIf(!hasDb)('USP-057 — OutboxModerationNotification (integração, container real)', () => {
  const createdPersonIds: string[] = [];

  beforeEach(() => {
    homeRevalidateSpy.mockClear();
    // Só a invalidação de cache é substituída (evita next/cache fora de
    // request); MODERATION_NOTIFICATION_TOKEN **não** é sobrescrito — usa o
    // binding real do container (OutboxModerationNotification, USP-057).
    container.register(
      CACHE_INVALIDATION_TOKEN,
      () => ({ revalidateForContent: vi.fn().mockResolvedValue(undefined) }) as unknown as CacheInvalidationPort,
    );
  });

  afterEach(async () => {
    if (createdPersonIds.length > 0) {
      await prisma.person.deleteMany({ where: { id: { in: createdPersonIds } } });
      createdPersonIds.length = 0;
    }
  });

  it('@usp057-01 @usp057-05 aprovar: enfileira 1 linha Outbox moderation-approved, to=emailLogin, passthrough válido', async () => {
    const email = `usp057-approve-${randomUUID()}@example.com`;
    const personId = await seedCandidate('Analista Financeiro', email, 'IN_MODERATION');
    createdPersonIds.push(personId);

    const res = await transitionContent({
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: personId,
      to: ContentStatus.ACTIVE,
      trigger: 'MODERATOR_ACTION',
      actorPersonId: ACTOR,
    });
    expect(res.ok).toBe(true);

    const row = await lastEmailRow();
    expect(row).not.toBeNull();
    const payload = row?.payload as { to: string; template: string; data: Record<string, unknown> };
    expect(payload.template).toBe('moderation-approved');
    expect(payload.to).toBe(email);
    expect(payload.data).toMatchObject({ tituloConteudo: 'Analista Financeiro' });
    expect(payload.data.motivo).toBeUndefined();

    const resolved = await resolveOutboxEmail(row?.payload);
    expect(resolved).toMatchObject({ template: 'moderation-approved', to: email } satisfies Partial<EmailMessage>);
  });

  it('@usp057-02 @usp057-05 devolver com motivo: enfileira moderation-returned com o motivo no corpo', async () => {
    const email = `usp057-return-${randomUUID()}@example.com`;
    const personId = await seedCandidate('Auxiliar de RH', email, 'IN_MODERATION');
    createdPersonIds.push(personId);

    const res = await transitionContent({
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: personId,
      to: ContentStatus.AWAITING_ADJUSTMENTS,
      trigger: 'MODERATOR_ACTION',
      justification: MOTIVO,
      actorPersonId: ACTOR,
    });
    expect(res.ok).toBe(true);

    const row = await lastEmailRow();
    const payload = row?.payload as { to: string; template: string; data: Record<string, unknown> };
    expect(payload.template).toBe('moderation-returned');
    expect(payload.to).toBe(email);
    expect(payload.data.motivo).toBe(MOTIVO);

    const resolved = await resolveOutboxEmail(row?.payload);
    expect(resolved).toMatchObject({ template: 'moderation-returned' } satisfies Partial<EmailMessage>);
  });

  it('@usp057-03 @usp057-05 rejeitar com motivo: enfileira moderation-rejected com o motivo no corpo', async () => {
    const email = `usp057-reject-${randomUUID()}@example.com`;
    const personId = await seedCandidate('Auxiliar Administrativo', email, 'IN_MODERATION');
    createdPersonIds.push(personId);

    const res = await transitionContent({
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: personId,
      to: ContentStatus.REJECTED,
      trigger: 'MODERATOR_ACTION',
      justification: MOTIVO,
      actorPersonId: ACTOR,
    });
    expect(res.ok).toBe(true);

    const row = await lastEmailRow();
    const payload = row?.payload as { to: string; template: string; data: Record<string, unknown> };
    expect(payload.template).toBe('moderation-rejected');
    expect(payload.to).toBe(email);
    expect(payload.data.motivo).toBe(MOTIVO);

    const resolved = await resolveOutboxEmail(row?.payload);
    expect(resolved).toMatchObject({ template: 'moderation-rejected' } satisfies Partial<EmailMessage>);
  });

  it('@usp057-06 @usp057-mn-01 reenvio do autor (AWAITING_ADJUSTMENTS→IN_MODERATION, AUTHOR_ACTION) NÃO enfileira e-mail', async () => {
    const email = `usp057-resubmit-${randomUUID()}@example.com`;
    const personId = await seedCandidate('Vendedor', email, 'IN_MODERATION');
    createdPersonIds.push(personId);
    // Estado de partida do teste: já devolvido para ajustes (não via transitionContent,
    // para isolar o cenário — o teste de devolução já cobre esse enqueue).
    await prisma.candidateProfile.update({
      where: { personId },
      data: { publicationStatus: 'AWAITING_ADJUSTMENTS' },
    });

    const before = await emailCount();

    // Reenvio do autor: from=AWAITING_ADJUSTMENTS (≠ IN_MODERATION) → gate MN-01
    // exclui o enqueue mesmo a transição tendo sucesso (CONTENT_SUBMITTED_TO_MODERATION).
    const res = await transitionContent({
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: personId,
      to: ContentStatus.IN_MODERATION,
      trigger: 'AUTHOR_ACTION',
      actorPersonId: personId,
    });
    expect(res.ok).toBe(true);

    const after = await emailCount();
    expect(after).toBe(before); // USP057-MN-01: nenhuma linha nova
  });
});
