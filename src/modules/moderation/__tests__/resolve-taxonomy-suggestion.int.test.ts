import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração das Server Actions approveTaxonomySuggestion /
 * rejectTaxonomySuggestion (USP-019 / T4). Requer Postgres local
 * (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — cobre aprovar (SUGG-03), rejeitar/DELETE com
 * before-state no log (SUGG-04/SUGG-MN-05), permissão negada sem mudança de
 * estado (SUGG-MN-02), `id` inexistente/já resolvido (NOT_FOUND) e o `kind`
 * SERVICE_CATEGORY (SUGG-08).
 *
 * Mocks: next/headers (IP/UA), identity/server/session (operador
 * autenticado — `requirePermission` importa `getCurrentPerson` deste módulo).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.6', 'user-agent': 'vitest/int' })),
}));

let mockOperator: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockOperator),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { approveTaxonomySuggestion, rejectTaxonomySuggestion } = await import(
  '../actions/resolve-taxonomy-suggestion'
);
const { listApprovedJobAreas } = await import('@/modules/jobs');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const NAME_PREFIX = 'Resolve Int';

function coordinator(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Coordenadora Resolve Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['COORDINATOR'],
    phone: null,
    fullAddress: null,
  };
}

function candidateNoPermission(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Candidata Resolve Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['CANDIDATE'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('resolveTaxonomySuggestion — integração (USP-019 / T4)', () => {
  let coordinatorId = '';
  let candidateId = '';

  async function cleanup() {
    await prisma.jobArea.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
    await prisma.serviceCategory.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
  }

  async function seedJobArea(name: string): Promise<string> {
    const row = await prisma.jobArea.create({
      data: { name, isSuggestion: true, suggestedBy: candidateId },
      select: { id: true },
    });
    return row.id;
  }

  async function seedServiceCategory(name: string): Promise<string> {
    const row = await prisma.serviceCategory.create({
      data: { name, isSuggestion: true, suggestedBy: candidateId },
      select: { id: true },
    });
    return row.id;
  }

  beforeAll(async () => {
    await cleanup();
    coordinatorId = crypto.randomUUID();
    candidateId = crypto.randomUUID();
    await prisma.person.create({ data: { id: coordinatorId, fullName: 'Coordenadora Resolve Int', status: 'ATIVO' } });
    await prisma.person.create({ data: { id: candidateId, fullName: 'Candidata Resolve Int', status: 'ATIVO' } });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: { in: [coordinatorId, candidateId] } } });
  });

  afterEach(async () => {
    mockOperator = null;
    await cleanup();
  });

  it('SUGG-03: aprovar ⇒ isSuggestion=false + approvedAt/By + 1 CATEGORY_APPROVED + aparece em listApprovedJobAreas', async () => {
    mockOperator = coordinator(coordinatorId);
    const name = `${NAME_PREFIX} Jardinagem`;
    const id = await seedJobArea(name);

    const res = await approveTaxonomySuggestion({ kind: 'JOB_AREA', id });
    expect(res.ok).toBe(true);

    const row = await prisma.jobArea.findUnique({ where: { id } });
    expect(row).toMatchObject({ isSuggestion: false, approvedBy: coordinatorId });
    expect(row?.approvedAt).not.toBeNull();

    const audits = await prisma.auditLog.findMany({ where: { action: 'CATEGORY_APPROVED', entityId: id } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ entityType: 'job_area', actorPersonId: coordinatorId });

    const approved = await listApprovedJobAreas();
    expect(approved.map((a) => a.name)).toContain(name);
  });

  it('SUGG-04/SUGG-MN-05: rejeitar ⇒ linha removida + 1 CATEGORY_SUGGESTION_REJECTED (before-state), fora do select', async () => {
    mockOperator = coordinator(coordinatorId);
    const name = `${NAME_PREFIX} Costura`;
    const id = await seedJobArea(name);

    const res = await rejectTaxonomySuggestion({ kind: 'JOB_AREA', id, reason: 'Duplicata de outra área' });
    expect(res.ok).toBe(true);

    const row = await prisma.jobArea.findUnique({ where: { id } });
    expect(row).toBeNull(); // DELETE — não fica pendente nem selecionável

    const audits = await prisma.auditLog.findMany({
      where: { action: 'CATEGORY_SUGGESTION_REJECTED', entityId: id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      entityType: 'job_area',
      actorPersonId: coordinatorId,
      justification: 'Duplicata de outra área',
    });
    expect((audits[0]?.before as Record<string, unknown> | null)?.name).toBe(name); // before-state preservado

    const approved = await listApprovedJobAreas();
    expect(approved.map((a) => a.name)).not.toContain(name);
  });

  it('rejeitar sem motivo: justification fica null (motivo opcional)', async () => {
    mockOperator = coordinator(coordinatorId);
    const id = await seedJobArea(`${NAME_PREFIX} SemMotivo`);

    const res = await rejectTaxonomySuggestion({ kind: 'JOB_AREA', id });
    expect(res.ok).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CATEGORY_SUGGESTION_REJECTED', entityId: id },
    });
    expect(audit?.justification).toBeNull();
  });

  it('SUGG-MN-02: aprovar sem APPROVE_CATEGORY_SUGGESTION ⇒ FORBIDDEN, estado inalterado', async () => {
    mockOperator = candidateNoPermission(candidateId);
    const id = await seedJobArea(`${NAME_PREFIX} Forbidden Approve`);

    const res = await approveTaxonomySuggestion({ kind: 'JOB_AREA', id });
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const row = await prisma.jobArea.findUnique({ where: { id } });
    expect(row?.isSuggestion).toBe(true);
    const audits = await prisma.auditLog.count({ where: { entityId: id } });
    expect(audits).toBe(0);
  });

  it('SUGG-MN-02: rejeitar sem APPROVE_CATEGORY_SUGGESTION ⇒ FORBIDDEN, linha preservada', async () => {
    mockOperator = candidateNoPermission(candidateId);
    const id = await seedJobArea(`${NAME_PREFIX} Forbidden Reject`);

    const res = await rejectTaxonomySuggestion({ kind: 'JOB_AREA', id });
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const row = await prisma.jobArea.findUnique({ where: { id } });
    expect(row).not.toBeNull();
  });

  it('id inexistente ⇒ NOT_FOUND (aprovar e rejeitar)', async () => {
    mockOperator = coordinator(coordinatorId);
    const bogusId = crypto.randomUUID();

    const approveRes = await approveTaxonomySuggestion({ kind: 'JOB_AREA', id: bogusId });
    expect(approveRes).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });

    const rejectRes = await rejectTaxonomySuggestion({ kind: 'JOB_AREA', id: bogusId });
    expect(rejectRes).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('id já resolvido (aprovado) ⇒ NOT_FOUND na 2ª aprovação/rejeição', async () => {
    mockOperator = coordinator(coordinatorId);
    const id = await seedJobArea(`${NAME_PREFIX} JaResolvido`);

    const first = await approveTaxonomySuggestion({ kind: 'JOB_AREA', id });
    expect(first.ok).toBe(true);

    const second = await approveTaxonomySuggestion({ kind: 'JOB_AREA', id });
    expect(second).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });

    const rejectAfterApprove = await rejectTaxonomySuggestion({ kind: 'JOB_AREA', id });
    expect(rejectAfterApprove).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('SUGG-08: SERVICE_CATEGORY aprova e rejeita com a mesma semântica', async () => {
    mockOperator = coordinator(coordinatorId);

    const approveId = await seedServiceCategory(`${NAME_PREFIX} Jardinagem Serviço`);
    const approveRes = await approveTaxonomySuggestion({ kind: 'SERVICE_CATEGORY', id: approveId });
    expect(approveRes.ok).toBe(true);
    const approvedRow = await prisma.serviceCategory.findUnique({ where: { id: approveId } });
    expect(approvedRow?.isSuggestion).toBe(false);

    const rejectId = await seedServiceCategory(`${NAME_PREFIX} Costura Serviço`);
    const rejectRes = await rejectTaxonomySuggestion({ kind: 'SERVICE_CATEGORY', id: rejectId });
    expect(rejectRes.ok).toBe(true);
    const rejectedRow = await prisma.serviceCategory.findUnique({ where: { id: rejectId } });
    expect(rejectedRow).toBeNull();
  });
});
