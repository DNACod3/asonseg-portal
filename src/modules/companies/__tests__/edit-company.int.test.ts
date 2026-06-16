import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da Server Action editarEmpresa (USP-015).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — valida edição persistida, rebaixamento atômico de
 * isVerified em campo identitário (P-001), CNPJ único no UPDATE (P-005), permissão
 * de responsável ATIVO (P-004) e auditoria before/after.
 * Mocks: next/headers (IP/UA), session (pessoa autenticada).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.1', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { editarEmpresa } = await import('../actions/edit-company');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

// CNPJs válidos distintos para os cenários.
const CNPJ_A = '11222333000181';
const CNPJ_B = '11444777000161';
const CNPJ_OUTRA = '45997418000153';

skipIfNoDb('editarEmpresa — integração', () => {
  let ownerId = '';
  let strangerId = '';
  let companyId = '';
  let otherCompanyId = '';

  function personFixture(id: string): CurrentPerson {
    return {
      id,
      supabaseUserId: '00000000-0000-0000-0000-000000000001',
      fullName: 'Pessoa Int',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['CANDIDATE'],
      phone: null,
      fullAddress: null,
    };
  }

  async function cleanupCompany(cnpj: string) {
    const stale = await prisma.company.findUnique({ where: { cnpj }, select: { id: true } });
    if (stale) {
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: stale.id } });
      await prisma.company.delete({ where: { id: stale.id } });
    }
  }

  beforeAll(async () => {
    await cleanupCompany(CNPJ_A);
    await cleanupCompany(CNPJ_B);
    await cleanupCompany(CNPJ_OUTRA);

    const owner = await prisma.person.create({
      data: { fullName: 'Dono Empresa Int', status: 'ATIVO' },
      select: { id: true },
    });
    ownerId = owner.id;
    const stranger = await prisma.person.create({
      data: { fullName: 'Estranho Int', status: 'ATIVO' },
      select: { id: true },
    });
    strangerId = stranger.id;

    const other = await prisma.company.create({
      data: {
        cnpj: CNPJ_OUTRA,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Mercado Sol Ltda',
        nomeFantasia: 'Mercado Sol',
        setor: 'Comércio',
        isVerified: true,
        createdBy: ownerId,
      },
      select: { id: true },
    });
    otherCompanyId = other.id;
  });

  beforeEach(async () => {
    // Recria a Empresa alvo verificada + grant ativo do dono antes de cada teste.
    await cleanupCompany(CNPJ_A);
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ_A,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Padaria Aurora Alimentos Ltda',
        nomeFantasia: 'Padaria Aurora',
        setor: 'Alimentação',
        descricao: 'Pães',
        isVerified: true,
        createdBy: ownerId,
      },
      select: { id: true },
    });
    companyId = company.id;
    await prisma.personCompanyGrant.create({
      data: {
        personId: ownerId,
        companyId,
        grantType: 'RESPONSIBLE',
        grantedBy: ownerId,
        status: 'ACTIVE',
      },
    });
    mockPerson = personFixture(ownerId);
  });

  afterAll(async () => {
    await cleanupCompany(CNPJ_A);
    await cleanupCompany(CNPJ_B);
    if (otherCompanyId) {
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: otherCompanyId } });
      await prisma.company.delete({ where: { id: otherCompanyId } }).catch(() => {});
    }
    await prisma.person.deleteMany({ where: { id: { in: [ownerId, strangerId] } } });
  });

  function baseInput() {
    return {
      empresaId: companyId,
      cnpj: CNPJ_A,
      type: 'SIMPLES_NACIONAL' as const,
      razaoSocial: 'Padaria Aurora Alimentos Ltda',
      nomeFantasia: 'Padaria Aurora',
      setor: 'Alimentação',
      descricao: 'Pães',
    };
  }

  it('happy não-identitário: persiste e mantém isVerified (E-001)', async () => {
    const result = await editarEmpresa({ ...baseInput(), descricao: 'Pães artesanais e cafés' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.downgraded).toBe(false);
    expect(result.data.isVerified).toBe(true);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { descricao: true, isVerified: true },
    });
    expect(company).toMatchObject({ descricao: 'Pães artesanais e cafés', isVerified: true });
  });

  it('identitário: muda nome fantasia → rebaixa isVerified na mesma transação (P-001)', async () => {
    const result = await editarEmpresa({ ...baseInput(), nomeFantasia: 'Padaria Aurora & Cia' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.downgraded).toBe(true);
    expect(result.data.isVerified).toBe(false);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { nomeFantasia: true, isVerified: true },
    });
    expect(company).toMatchObject({ nomeFantasia: 'Padaria Aurora & Cia', isVerified: false });
  });

  it('identitário: muda CNPJ para um livre → rebaixa isVerified', async () => {
    const result = await editarEmpresa({ ...baseInput(), cnpj: CNPJ_B });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.downgraded).toBe(true);
    expect(result.data.isVerified).toBe(false);
  });

  it('FORBIDDEN: quem não é responsável ATIVO não edita (P-004 / bypass D-003)', async () => {
    mockPerson = personFixture(strangerId);
    const result = await editarEmpresa({ ...baseInput(), descricao: 'invasão' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { descricao: true },
    });
    expect(company?.descricao).toBe('Pães'); // inalterado
  });

  it('CONFLICT: CNPJ que pertence a outra Empresa bloqueia (P-005)', async () => {
    const result = await editarEmpresa({ ...baseInput(), cnpj: CNPJ_OUTRA });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONFLICT');

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { cnpj: true, isVerified: true },
    });
    expect(company).toMatchObject({ cnpj: CNPJ_A, isVerified: true }); // inalterado
  });

  it('CONFLICT via guarda P2002: corrida escapa da pré-checagem de CNPJ (D-015-D)', async () => {
    // Simula a janela de corrida entre a pré-checagem (passo 5) e o UPDATE: a
    // consulta de unicidade por CNPJ não enxerga o concorrente (retorna null),
    // mas a constraint única dispara no UPDATE dentro da transação → P2002.
    // O spy só intercepta a pré-checagem (`where.cnpj`); o `before` (`where.id`)
    // e o `update` (em `tx`, fora do spy) seguem reais contra o Postgres.
    const realFindUnique = prisma.company.findUnique.bind(prisma.company);
    const spy = vi.spyOn(prisma.company, 'findUnique').mockImplementation((args) => {
      const where = (args as { where?: { cnpj?: string } }).where;
      if (where?.cnpj === CNPJ_OUTRA) {
        return Promise.resolve(null) as ReturnType<typeof prisma.company.findUnique>;
      }
      return realFindUnique(args);
    });

    try {
      const result = await editarEmpresa({ ...baseInput(), cnpj: CNPJ_OUTRA });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('CONFLICT');
    } finally {
      spy.mockRestore();
    }

    // Transação revertida: a Empresa permanece com o CNPJ original e verificada.
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { cnpj: true, isVerified: true },
    });
    expect(company).toMatchObject({ cnpj: CNPJ_A, isVerified: true });
  });

  it('NOT_FOUND: empresaId inexistente', async () => {
    const result = await editarEmpresa({
      ...baseInput(),
      empresaId: '99999999-9999-9999-9999-999999999999',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('audit: COMPANY_UPDATED registra before/after', async () => {
    await editarEmpresa({ ...baseInput(), nomeFantasia: 'Padaria Aurora Nova' });
    const entry = await prisma.auditLog.findFirst({
      where: { action: 'COMPANY_UPDATED', entityType: 'company', entityId: companyId },
      orderBy: { occurredAt: 'desc' },
      select: { before: true, after: true },
    });
    expect(entry).not.toBeNull();
    expect((entry?.before as Record<string, unknown>)?.nomeFantasia).toBe('Padaria Aurora');
    expect((entry?.after as Record<string, unknown>)?.nomeFantasia).toBe('Padaria Aurora Nova');
    expect((entry?.after as Record<string, unknown>)?.isVerified).toBe(false);
  });
});
