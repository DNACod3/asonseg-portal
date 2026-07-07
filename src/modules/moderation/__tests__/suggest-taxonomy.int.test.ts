import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da Server Action suggestTaxonomy (USP-019 / T3).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — cobre criação pendente + auditoria na mesma tx
 * (SUGG-01/SUGG-MN-04), não-selecionabilidade (SUGG-02/SUGG-MN-01), dedup
 * normalizado caso/acento (SUGG-05/SUGG-MN-03), edges de validação e o `kind`
 * SERVICE_CATEGORY (SUGG-08).
 *
 * Mocks: identity/server/session (Pessoa autenticada — `suggestTaxonomy` usa
 * `getCurrentPerson`, não `requireActivePerson`).
 */

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { suggestTaxonomy } = await import('../actions/suggest-taxonomy');
const { listApprovedJobAreas } = await import('@/modules/jobs');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const NAME_PREFIX = 'Sugestao Int';

function personFixture(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Pessoa Sugestão Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['CANDIDATE'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('suggestTaxonomy — integração (USP-019 / T3)', () => {
  let personId = '';

  async function cleanup() {
    await prisma.jobArea.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
    await prisma.serviceCategory.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
  }

  beforeAll(async () => {
    await cleanup();
    const person = await prisma.person.create({
      data: { fullName: 'Pessoa Sugestão Int', status: 'ATIVO' },
      select: { id: true },
    });
    personId = person.id;
    mockPerson = personFixture(personId);
  });

  afterAll(async () => {
    await cleanup();
    if (personId) await prisma.person.deleteMany({ where: { id: personId } });
  });

  afterEach(async () => {
    mockPerson = personFixture(personId);
    await cleanup();
  });

  it('SUGG-01/SUGG-MN-04: cria JobArea pendente + 1 audit CATEGORY_SUGGESTED na mesma tx', async () => {
    const name = `${NAME_PREFIX} Jardinagem`;
    const res = await suggestTaxonomy({ kind: 'JOB_AREA', name });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const row = await prisma.jobArea.findUnique({ where: { id: res.data.id } });
    expect(row).toMatchObject({ name, isSuggestion: true, suggestedBy: personId, approvedAt: null });

    const audits = await prisma.auditLog.findMany({
      where: { action: 'CATEGORY_SUGGESTED', entityId: res.data.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ entityType: 'job_area', actorPersonId: personId });
  });

  it('SUGG-08: SERVICE_CATEGORY segue a mesma semântica', async () => {
    const name = `${NAME_PREFIX} Jardinagem Serviço`;
    const res = await suggestTaxonomy({ kind: 'SERVICE_CATEGORY', name });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const row = await prisma.serviceCategory.findUnique({ where: { id: res.data.id } });
    expect(row).toMatchObject({ name, isSuggestion: true, suggestedBy: personId });

    const audits = await prisma.auditLog.count({
      where: { action: 'CATEGORY_SUGGESTED', entityId: res.data.id },
    });
    expect(audits).toBe(1);
  });

  it('SUGG-05/SUGG-MN-03: variação de caso/acento de nome existente ⇒ CONFLICT, sem 2ª linha', async () => {
    const name = `${NAME_PREFIX} Tecnologia`;
    const first = await suggestTaxonomy({ kind: 'JOB_AREA', name });
    expect(first.ok).toBe(true);

    const before = await prisma.jobArea.count({ where: { name: { startsWith: NAME_PREFIX } } });

    const second = await suggestTaxonomy({ kind: 'JOB_AREA', name: `  ${name.toUpperCase()}  ` });
    expect(second).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });

    const after = await prisma.jobArea.count({ where: { name: { startsWith: NAME_PREFIX } } });
    expect(after).toBe(before); // nenhuma linha nova
  });

  it('SUGG-02/SUGG-MN-01: sugestão criada NÃO aparece em listApprovedJobAreas', async () => {
    const name = `${NAME_PREFIX} Costura`;
    const res = await suggestTaxonomy({ kind: 'JOB_AREA', name });
    expect(res.ok).toBe(true);

    const approved = await listApprovedJobAreas();
    expect(approved.map((a) => a.name)).not.toContain(name);
  });

  it.each(['', '  ', 'x', 'y'.repeat(61)])(
    'edges de tamanho/vazio "%s" ⇒ VALIDATION',
    async (name) => {
      const res = await suggestTaxonomy({ kind: 'JOB_AREA', name });
      expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    },
  );

  it('2ª inserção de mesmo casing exato (corrida) ⇒ CONFLICT sem 500', async () => {
    const name = `${NAME_PREFIX} Rc ${crypto.randomUUID().slice(0, 8)}`;
    const [a, b] = await Promise.all([
      suggestTaxonomy({ kind: 'JOB_AREA', name }),
      suggestTaxonomy({ kind: 'JOB_AREA', name }),
    ]);

    const oks = [a, b].filter((r) => r.ok);
    const fails = [a, b].filter((r) => !r.ok);
    expect(oks).toHaveLength(1);
    expect(fails).toHaveLength(1);
    if (fails[0] && !fails[0].ok) {
      expect(fails[0].error.code).toBe('CONFLICT');
    }
  });

  it('sem sessão (getCurrentPerson nulo) ⇒ UNAUTHENTICATED', async () => {
    mockPerson = null;
    const res = await suggestTaxonomy({ kind: 'JOB_AREA', name: `${NAME_PREFIX} Sem Sessão` });
    expect(res).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });
});
