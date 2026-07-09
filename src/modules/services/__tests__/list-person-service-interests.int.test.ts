import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Testes de integração de `listPersonServiceInterests` (USP-039 / T4 —
 * dimensão "manifestações" do painel consolidado). Requer Postgres local
 * (`supabase start`). Exercita o `where: { clientPersonId }` real (direção
 * inversa de `listProviderInterests` — lição AD-021).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listPersonServiceInterests } = await import('../queries/list-person-service-interests');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('listPersonServiceInterests — integração', () => {
  let providerId = '';
  let serviceId = '';
  let targetPersonId = '';
  let otherPersonId = '';
  let emptyPersonId = '';

  async function cleanup() {
    await prisma.serviceInterest.deleteMany({ where: { service: { authorPersonId: providerId || undefined } } });
    await prisma.service.deleteMany({ where: { authorPersonId: providerId || undefined } });
    const stale = await prisma.person.findMany({
      where: { fullName: { startsWith: 'Consolidado Interests Int' } },
      select: { id: true },
    });
    if (stale.length > 0) {
      await prisma.person.deleteMany({ where: { id: { in: stale.map((p) => p.id) } } });
    }
  }

  beforeAll(async () => {
    const stale = await prisma.person.findMany({
      where: { fullName: { startsWith: 'Consolidado Interests Int' } },
      select: { id: true },
    });
    if (stale.length > 0) {
      await prisma.serviceInterest.deleteMany({ where: { clientPersonId: { in: stale.map((p) => p.id) } } });
      await prisma.service.deleteMany({ where: { authorPersonId: { in: stale.map((p) => p.id) } } });
      await prisma.person.deleteMany({ where: { id: { in: stale.map((p) => p.id) } } });
    }

    const provider = await prisma.person.create({
      data: { fullName: 'Consolidado Interests Int Prestador', status: 'ATIVO' },
      select: { id: true },
    });
    providerId = provider.id;

    const service = await prisma.service.create({
      data: {
        authorPersonId: providerId,
        title: 'Consolidado Interests Int Serviço',
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    serviceId = service.id;

    const [target, other, empty] = await Promise.all([
      prisma.person.create({
        data: { fullName: 'Consolidado Interests Int Alvo', status: 'ATIVO' },
        select: { id: true },
      }),
      prisma.person.create({
        data: { fullName: 'Consolidado Interests Int Outro', status: 'ATIVO' },
        select: { id: true },
      }),
      prisma.person.create({
        data: { fullName: 'Consolidado Interests Int Vazio', status: 'ATIVO' },
        select: { id: true },
      }),
    ]);
    targetPersonId = target.id;
    otherPersonId = other.id;
    emptyPersonId = empty.id;

    await prisma.serviceInterest.createMany({
      data: [
        { serviceId, clientPersonId: targetPersonId, interestedAt: new Date('2026-07-01T10:00:00Z') },
        {
          serviceId,
          clientPersonId: targetPersonId,
          interestedAt: new Date('2026-06-01T10:00:00Z'),
          cancelledAt: new Date('2026-06-05T10:00:00Z'),
        },
        // manifestação de outra Pessoa — não deve aparecer no escopo do alvo.
        { serviceId, clientPersonId: otherPersonId, interestedAt: new Date('2026-07-02T10:00:00Z') },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('retorna manifestação ativa e cancelada do alvo com `active` correto', async () => {
    const rows = await listPersonServiceInterests(targetPersonId);
    expect(rows).toHaveLength(2);

    const active = rows.find((r) => r.cancelledAt === null);
    const cancelled = rows.find((r) => r.cancelledAt !== null);
    expect(active?.active).toBe(true);
    expect(cancelled?.active).toBe(false);
    expect(active?.serviceTitle).toBe('Consolidado Interests Int Serviço');
    expect(active?.providerName).toBe('Consolidado Interests Int Prestador');
    expect(active?.serviceId).toBe(serviceId);
  });

  it('ordena a manifestação ativa antes da cancelada (NULLS FIRST)', async () => {
    const rows = await listPersonServiceInterests(targetPersonId);
    expect(rows).toHaveLength(2);

    // Ordenação documentada: ativas primeiro (cancelledAt asc, null primeiro),
    // depois interestedAt desc. Asserção posicional — pega regressão para NULLS LAST.
    expect(rows[0]?.active).toBe(true);
    expect(rows[0]?.cancelledAt).toBeNull();
    expect(rows[1]?.active).toBe(false);
    expect(rows[1]?.cancelledAt).not.toBeNull();
  });

  it('escopo clientPersonId: manifestação de outra Pessoa não aparece', async () => {
    const rows = await listPersonServiceInterests(targetPersonId);
    expect(rows).toHaveLength(2);

    const otherRows = await listPersonServiceInterests(otherPersonId);
    expect(otherRows).toHaveLength(1);
    expect(otherRows[0]?.active).toBe(true);
  });

  it('Pessoa sem manifestação → []', async () => {
    const rows = await listPersonServiceInterests(emptyPersonId);
    expect(rows).toEqual([]);
  });
});
