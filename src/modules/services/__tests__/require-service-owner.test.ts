// Unit de `requireServiceOwner` (USP-032 / T032-1 / SVC032-MN-02) — dono = autor
// OU responsável ativo da Empresa. Prisma mockado (sem banco); o caminho real
// contra Postgres é exercitado indiretamente via `edit-service.int.test.ts` /
// `lifecycle-service.int.test.ts` / `submit-service.int.test.ts` (recheck de
// ownership no submit por serviceId).

import { describe, it, expect, beforeEach, vi } from 'vitest';

const serviceState = vi.hoisted(() => ({ findUnique: vi.fn() }));
const grantState = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    service: { findUnique: (...a: unknown[]) => serviceState.findUnique(...a) },
    personCompanyGrant: { findFirst: (...a: unknown[]) => grantState.findFirst(...a) },
  },
}));

const { requireServiceOwner } = await import('../server/require-service-owner');

const OWNER = '11111111-1111-4111-8111-111111111111';
const RESPONSIBLE = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const COMPANY_ID = '44444444-4444-4444-4444-444444444444';
const SERVICE_ID = '55555555-5555-4555-8555-555555555555';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireServiceOwner', () => {
  it('autor do serviço → ok (PF, sem companyId)', async () => {
    serviceState.findUnique.mockResolvedValue({ authorPersonId: OWNER, companyId: null });
    const result = await requireServiceOwner(OWNER, SERVICE_ID);
    expect(result).toEqual({ ok: true, companyId: null });
    expect(grantState.findFirst).not.toHaveBeenCalled(); // autor decide sem consultar grants
  });

  it('responsável ativo da Empresa (não o autor) → ok', async () => {
    serviceState.findUnique.mockResolvedValue({ authorPersonId: OWNER, companyId: COMPANY_ID });
    grantState.findFirst.mockResolvedValue({ id: 'grant-1' });
    const result = await requireServiceOwner(RESPONSIBLE, SERVICE_ID);
    expect(result).toEqual({ ok: true, companyId: COMPANY_ID });
    expect(grantState.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          personId: RESPONSIBLE,
          companyId: COMPANY_ID,
          grantType: 'RESPONSIBLE',
          status: 'ACTIVE',
          revokedAt: null,
        }),
      }),
    );
  });

  it('terceiro sem vínculo → false (SVC032-MN-02)', async () => {
    serviceState.findUnique.mockResolvedValue({ authorPersonId: OWNER, companyId: COMPANY_ID });
    grantState.findFirst.mockResolvedValue(null);
    const result = await requireServiceOwner(STRANGER, SERVICE_ID);
    expect(result).toEqual({ ok: false, companyId: COMPANY_ID });
  });

  it('PF (companyId nulo) e não é o autor → false sem consultar grants', async () => {
    serviceState.findUnique.mockResolvedValue({ authorPersonId: OWNER, companyId: null });
    const result = await requireServiceOwner(STRANGER, SERVICE_ID);
    expect(result).toEqual({ ok: false, companyId: null });
    expect(grantState.findFirst).not.toHaveBeenCalled();
  });

  it('serviço inexistente → false, companyId null (não vaza existência)', async () => {
    serviceState.findUnique.mockResolvedValue(null);
    const result = await requireServiceOwner(OWNER, SERVICE_ID);
    expect(result).toEqual({ ok: false, companyId: null });
  });
});
