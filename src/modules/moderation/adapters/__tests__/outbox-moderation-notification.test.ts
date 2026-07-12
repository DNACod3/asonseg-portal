// Unit do adapter real OutboxModerationNotification (USP-057) — substitui o
// stub GAP-3/USP-044. Exercita a regra de negócio com um `tx` fake (Prisma
// mockado); o caminho ponta a ponta com Postgres real está em
// `../../__tests__/outbox-moderation-notification.int.test.ts`.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from '@/shared/env';
import { container } from '@/shared/container';
import { EMAIL_SENDER_TOKEN } from '@/shared/lib/email/email-sender.port';

const prismaOutboxCreate = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/prisma', () => ({
  prisma: { outbox: { create: (...a: unknown[]) => prismaOutboxCreate(...a) } },
}));

import { OutboxModerationNotification } from '../outbox-moderation-notification';
import { ContentKind, ContentStatus, type ModerationDecisionNotice } from '@/modules/moderation';

const CONTENT_ID = '00000000-0000-0000-0000-000000000010';
const ACTOR = '00000000-0000-0000-0000-0000000000aa';
const MOTIVO = 'Faltou descrever as atividades exercidas no cargo anterior';

function fakeTx() {
  return {
    job: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    candidateProfile: { findUnique: vi.fn() },
    person: { findUnique: vi.fn() },
    outbox: { create: vi.fn() },
  };
}

function baseNotice(overrides: Partial<ModerationDecisionNotice> = {}): ModerationDecisionNotice {
  return {
    contentKind: ContentKind.JOB,
    contentId: CONTENT_ID,
    from: ContentStatus.IN_MODERATION,
    to: ContentStatus.ACTIVE,
    actorPersonId: ACTOR,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OutboxModerationNotification — gate (USP057-MN-01)', () => {
  it('notice PAUSED→ACTIVE (não é decisão do moderador) → nenhum tx.outbox.create', async () => {
    const tx = fakeTx();
    await new OutboxModerationNotification().sendModerationDecision(tx as never, {
      ...baseNotice(),
      from: ContentStatus.PAUSED,
      to: ContentStatus.ACTIVE,
    });
    expect(tx.outbox.create).not.toHaveBeenCalled();
    expect(tx.job.findUnique).not.toHaveBeenCalled();
  });

  it('notice ACTIVE→PAUSED (não é decisão do moderador) → nenhum tx.outbox.create', async () => {
    const tx = fakeTx();
    await new OutboxModerationNotification().sendModerationDecision(tx as never, {
      ...baseNotice(),
      from: ContentStatus.ACTIVE,
      to: ContentStatus.PAUSED,
    });
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  it('reenvio do autor (AWAITING_ADJUSTMENTS→IN_MODERATION) → nenhum tx.outbox.create', async () => {
    const tx = fakeTx();
    await new OutboxModerationNotification().sendModerationDecision(tx as never, {
      ...baseNotice(),
      from: ContentStatus.AWAITING_ADJUSTMENTS,
      to: ContentStatus.IN_MODERATION,
    });
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  it('inativação (ACTIVE→INACTIVATED) → nenhum tx.outbox.create', async () => {
    const tx = fakeTx();
    await new OutboxModerationNotification().sendModerationDecision(tx as never, {
      ...baseNotice(),
      from: ContentStatus.ACTIVE,
      to: ContentStatus.INACTIVATED,
    });
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });
});

describe('OutboxModerationNotification — happy path (USP057-01..05)', () => {
  it('@usp057-01 JOB aprovado: enfileira moderation-approved via tx, SEM motivo', async () => {
    const tx = fakeTx();
    tx.job.findUnique.mockResolvedValue({ title: 'Auxiliar Administrativo', authorPersonId: 'author-1' });
    tx.person.findUnique.mockResolvedValue({ emailLogin: 'author@example.com', fullName: 'João Autor' });

    await new OutboxModerationNotification().sendModerationDecision(tx as never, baseNotice());

    expect(tx.outbox.create).toHaveBeenCalledTimes(1);
    const arg = tx.outbox.create.mock.calls[0]?.[0] as { data: { topic: string; payload: Record<string, unknown> } };
    expect(arg.data.topic).toBe('email');
    expect(arg.data.payload).toMatchObject({
      to: 'author@example.com',
      template: 'moderation-approved',
      data: {
        autorNome: 'João Autor',
        tipoConteudo: 'vaga',
        tituloConteudo: 'Auxiliar Administrativo',
        areaUrl: `${env.NEXT_PUBLIC_SITE_URL}/empresa`,
      },
    });
    expect((arg.data.payload.data as Record<string, unknown>).motivo).toBeUndefined();
  });

  it('@usp057-02 JOB devolvido: enfileira moderation-returned COM o motivo', async () => {
    const tx = fakeTx();
    tx.job.findUnique.mockResolvedValue({ title: 'Auxiliar Administrativo', authorPersonId: 'author-1' });
    tx.person.findUnique.mockResolvedValue({ emailLogin: 'author@example.com', fullName: 'João Autor' });

    await new OutboxModerationNotification().sendModerationDecision(tx as never, {
      ...baseNotice(),
      to: ContentStatus.AWAITING_ADJUSTMENTS,
      justification: MOTIVO,
    });

    const arg = tx.outbox.create.mock.calls[0]?.[0] as { data: { payload: Record<string, unknown> } };
    expect(arg.data.payload).toMatchObject({ template: 'moderation-returned', data: { motivo: MOTIVO } });
  });

  it('@usp057-03 SERVICE rejeitado: enfileira moderation-rejected COM o motivo e área /prestador', async () => {
    const tx = fakeTx();
    tx.service.findUnique.mockResolvedValue({ title: 'Aulas de Reforço', authorPersonId: 'author-2' });
    tx.person.findUnique.mockResolvedValue({ emailLogin: 'prestador@example.com', fullName: 'Ana Prestadora' });

    await new OutboxModerationNotification().sendModerationDecision(tx as never, {
      ...baseNotice(),
      contentKind: ContentKind.SERVICE,
      to: ContentStatus.REJECTED,
      justification: MOTIVO,
    });

    const arg = tx.outbox.create.mock.calls[0]?.[0] as { data: { payload: Record<string, unknown> } };
    expect(arg.data.payload).toMatchObject({
      template: 'moderation-rejected',
      to: 'prestador@example.com',
      data: { tipoConteudo: 'serviço', motivo: MOTIVO, areaUrl: `${env.NEXT_PUBLIC_SITE_URL}/prestador` },
    });
  });

  it('@usp057-04 CANDIDATE_PROFILE aprovado: authorPersonId = contentId; headline como título; área /candidato', async () => {
    const tx = fakeTx();
    tx.candidateProfile.findUnique.mockResolvedValue({ headline: 'Analista Financeiro' });
    tx.person.findUnique.mockResolvedValue({ emailLogin: 'candidato@example.com', fullName: 'Maria Candidata' });

    await new OutboxModerationNotification().sendModerationDecision(tx as never, {
      ...baseNotice(),
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: 'person-1',
    });

    expect(tx.candidateProfile.findUnique).toHaveBeenCalledWith({
      where: { personId: 'person-1' },
      select: { headline: true },
    });
    expect(tx.person.findUnique).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      select: { emailLogin: true, fullName: true },
    });
    const arg = tx.outbox.create.mock.calls[0]?.[0] as { data: { payload: Record<string, unknown> } };
    expect(arg.data.payload).toMatchObject({
      template: 'moderation-approved',
      to: 'candidato@example.com',
      data: {
        tipoConteudo: 'perfil de candidato',
        tituloConteudo: 'Analista Financeiro',
        areaUrl: `${env.NEXT_PUBLIC_SITE_URL}/candidato`,
      },
    });
  });

  it('@usp057-04 CANDIDATE_PROFILE sem headline: título usa fallback "Perfil de candidato"', async () => {
    const tx = fakeTx();
    tx.candidateProfile.findUnique.mockResolvedValue({ headline: null });
    tx.person.findUnique.mockResolvedValue({ emailLogin: 'candidato@example.com', fullName: 'Maria Candidata' });

    await new OutboxModerationNotification().sendModerationDecision(tx as never, {
      ...baseNotice(),
      contentKind: ContentKind.CANDIDATE_PROFILE,
      contentId: 'person-1',
    });

    const arg = tx.outbox.create.mock.calls[0]?.[0] as { data: { payload: Record<string, unknown> } };
    expect((arg.data.payload.data as Record<string, unknown>).tituloConteudo).toBe('Perfil de candidato');
  });
});

describe('OutboxModerationNotification — no-op (USP057-07)', () => {
  it('CV (fixture, sem autor real): no-op sem consultar conteúdo/pessoa e sem enfileirar', async () => {
    const tx = fakeTx();
    await new OutboxModerationNotification().sendModerationDecision(tx as never, {
      ...baseNotice(),
      contentKind: ContentKind.CV,
    });
    expect(tx.outbox.create).not.toHaveBeenCalled();
    expect(tx.person.findUnique).not.toHaveBeenCalled();
  });

  it('conteúdo não encontrado (JOB deletado/inexistente): no-op sem enfileirar', async () => {
    const tx = fakeTx();
    tx.job.findUnique.mockResolvedValue(null);
    await new OutboxModerationNotification().sendModerationDecision(tx as never, baseNotice());
    expect(tx.outbox.create).not.toHaveBeenCalled();
    expect(tx.person.findUnique).not.toHaveBeenCalled();
  });

  it('autor sem emailLogin: no-op sem enfileirar (decisão conclui normalmente fora daqui)', async () => {
    const tx = fakeTx();
    tx.job.findUnique.mockResolvedValue({ title: 'Vaga X', authorPersonId: 'author-1' });
    tx.person.findUnique.mockResolvedValue({ emailLogin: null, fullName: 'João Autor' });
    await new OutboxModerationNotification().sendModerationDecision(tx as never, baseNotice());
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  it('autor (Person) não encontrado: no-op sem enfileirar', async () => {
    const tx = fakeTx();
    tx.job.findUnique.mockResolvedValue({ title: 'Vaga X', authorPersonId: 'author-1' });
    tx.person.findUnique.mockResolvedValue(null);
    await new OutboxModerationNotification().sendModerationDecision(tx as never, baseNotice());
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });
});

describe('OutboxModerationNotification — must-nots (USP057-MN-02/03/04)', () => {
  it('@usp057-mn-02 usa o tx recebido (fakeTx.outbox.create) — NUNCA o prisma global', async () => {
    const tx = fakeTx();
    tx.job.findUnique.mockResolvedValue({ title: 'Vaga X', authorPersonId: 'author-1' });
    tx.person.findUnique.mockResolvedValue({ emailLogin: 'author@example.com', fullName: 'João' });

    await new OutboxModerationNotification().sendModerationDecision(tx as never, baseNotice());

    expect(tx.outbox.create).toHaveBeenCalledTimes(1);
    expect(prismaOutboxCreate).not.toHaveBeenCalled();
  });

  it('@usp057-mn-03 nunca resolve o EmailSender — só enfileira, não envia/despacha', async () => {
    const tx = fakeTx();
    tx.job.findUnique.mockResolvedValue({ title: 'Vaga X', authorPersonId: 'author-1' });
    tx.person.findUnique.mockResolvedValue({ emailLogin: 'author@example.com', fullName: 'João' });
    const resolveSpy = vi.spyOn(container, 'resolve');

    await new OutboxModerationNotification().sendModerationDecision(tx as never, baseNotice());

    expect(resolveSpy).not.toHaveBeenCalledWith(EMAIL_SENDER_TOKEN);
    resolveSpy.mockRestore();
  });

  it('@usp057-mn-04 payload.data não carrega actorPersonId nem qualquer dado do moderador', async () => {
    const tx = fakeTx();
    tx.job.findUnique.mockResolvedValue({ title: 'Vaga X', authorPersonId: 'author-1' });
    tx.person.findUnique.mockResolvedValue({ emailLogin: 'author@example.com', fullName: 'João' });

    await new OutboxModerationNotification().sendModerationDecision(tx as never, {
      ...baseNotice(),
      to: ContentStatus.REJECTED,
      justification: MOTIVO,
    });

    const arg = tx.outbox.create.mock.calls[0]?.[0] as { data: { payload: { data: Record<string, unknown> } } };
    const data = arg.data.payload.data;
    expect(Object.keys(data).sort()).toEqual(['areaUrl', 'autorNome', 'motivo', 'tipoConteudo', 'tituloConteudo']);
    expect(data).not.toHaveProperty('actorPersonId');
  });
});
