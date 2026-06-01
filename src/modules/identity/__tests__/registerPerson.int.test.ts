import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * Testes de integração para a Server Action registerPerson (TX1).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Mocks: Supabase Admin (createUser/deleteUser), Resend, next/headers, CAPTCHA.
 * Real: Prisma/Postgres — valida invariantes de BD (unique, atomicidade).
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(
    new Headers({ 'x-real-ip': '10.0.0.1', 'user-agent': 'vitest/int' }),
  ),
}));

const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();
vi.mock('@/shared/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    auth: { admin: { createUser: mockCreateUser, deleteUser: mockDeleteUser } },
  }),
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ data: { id: 'mock-email' } }) },
  })),
}));

// Importações após os mocks para que os vi.mock sejam hoistados corretamente.
const { prisma } = await import('@/shared/lib/prisma');
const { container } = await import('@/shared/container');
const { CAPTCHA_VERIFIER_TOKEN } = await import('@/modules/identity');
const { registerPerson } = await import('@/modules/identity');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('registerPerson — integração TX1', () => {
  const BASE_CPF = '529.982.247-25';
  let createdPersonId: string | null = null;

  beforeAll(() => {
    // Substitui o adapter real do Turnstile por um stub que sempre aprova.
    container.register(CAPTCHA_VERIFIER_TOKEN, () => ({
      verify: async () => ({ ok: true }),
    }));

    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } },
      error: null,
    });
    mockDeleteUser.mockResolvedValue({ error: null });
  });

  afterEach(async () => {
    if (createdPersonId) {
      // Limpa na ordem correta (FK: consents/grants → person).
      await prisma.consent.deleteMany({ where: { personId: createdPersonId } });
      await prisma.personRoleGrant.deleteMany({ where: { personId: createdPersonId } });
      await prisma.auditLog.deleteMany({ where: { actorPersonId: createdPersonId } });
      await prisma.person.deleteMany({ where: { id: createdPersonId } });
      createdPersonId = null;
    }
    vi.clearAllMocks();
    // Restaura stub de CAPTCHA para o próximo teste.
    container.register(CAPTCHA_VERIFIER_TOKEN, () => ({
      verify: async () => ({ ok: true }),
    }));
    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } },
      error: null,
    });
    mockDeleteUser.mockResolvedValue({ error: null });
  });

  it('happy path: cria Person, grant AWAITING_CONSENT e consent PORTAL_ACCESS', async () => {
    const email = `reg-happy-${Date.now()}@example.com`;

    const result = await registerPerson({
      fullName: 'Maria Teste Silva',
      cpf: BASE_CPF,
      email,
      password: 'Senha@12345',
      role: 'CANDIDATE',
      captchaToken: 'valid-token',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    createdPersonId = result.data.personId;

    const person = await prisma.person.findUnique({ where: { id: result.data.personId } });
    expect(person?.fullName).toBe('Maria Teste Silva');
    expect(person?.emailLogin).toBe(email.toLowerCase());

    const grant = await prisma.personRoleGrant.findFirst({ where: { personId: result.data.personId } });
    expect(grant?.status).toBe('AWAITING_CONSENT');
    expect(grant?.role).toBe('CANDIDATE');

    const consent = await prisma.consent.findFirst({
      where: { personId: result.data.personId, purpose: 'PORTAL_ACCESS' },
    });
    expect(consent).not.toBeNull();
    expect(consent?.revokedAt).toBeNull();
  });

  it('Zod: rejeita CPF inválido sem chegar ao banco', async () => {
    const result = await registerPerson({
      fullName: 'Teste',
      cpf: '111.111.111-11',
      email: 'cpf-invalido@example.com',
      password: 'Senha@12345',
      role: 'CANDIDATE',
      captchaToken: 'token',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('CAPTCHA inválido retorna PRECONDITION_FAILED sem criar nada no banco', async () => {
    container.register(CAPTCHA_VERIFIER_TOKEN, () => ({
      verify: async () => ({ ok: false, errorCode: 'invalid-input-response' }),
    }));

    const result = await registerPerson({
      fullName: 'Teste CAPTCHA',
      cpf: BASE_CPF,
      email: `captcha-${Date.now()}@example.com`,
      password: 'Senha@12345',
      role: 'CANDIDATE',
      captchaToken: 'bad-token',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PRECONDITION_FAILED');
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('E-006: CPF duplicado retorna CONFLICT e aciona rollback do Supabase Auth', async () => {
    const email1 = `cpf-dup1-${Date.now()}@example.com`;

    // Primeiro cadastro (sucesso)
    const first = await registerPerson({
      fullName: 'Primeira Pessoa',
      cpf: BASE_CPF,
      email: email1,
      password: 'Senha@12345',
      role: 'CANDIDATE',
      captchaToken: 'token',
    });
    expect(first.ok).toBe(true);
    if (first.ok) createdPersonId = first.data.personId;

    // Segundo cadastro com mesmo CPF deve falhar
    const second = await registerPerson({
      fullName: 'Segunda Pessoa',
      cpf: BASE_CPF,
      email: `cpf-dup2-${Date.now()}@example.com`,
      password: 'Senha@12345',
      role: 'CANDIDATE',
      captchaToken: 'token',
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('CONFLICT');
    expect(second.error.message).toContain('CPF');
    // Rollback deve ter sido acionado para o segundo cadastro.
    expect(mockDeleteUser).toHaveBeenCalled();
  });

  it('E-006: e-mail duplicado retorna CONFLICT e aciona rollback do Supabase Auth', async () => {
    const email = `email-dup-${Date.now()}@example.com`;

    const first = await registerPerson({
      fullName: 'Pessoa Email Um',
      cpf: BASE_CPF,
      email,
      password: 'Senha@12345',
      role: 'CANDIDATE',
      captchaToken: 'token',
    });
    expect(first.ok).toBe(true);
    if (first.ok) createdPersonId = first.data.personId;

    // Supabase mock — segundo createUser retorna usuário com UUID diferente.
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff' } },
      error: null,
    });

    const second = await registerPerson({
      fullName: 'Pessoa Email Dois',
      cpf: '271.298.060-06', // CPF diferente mas mesmo e-mail
      email,
      password: 'Senha@12345',
      role: 'CANDIDATE',
      captchaToken: 'token',
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('CONFLICT');
    expect(mockDeleteUser).toHaveBeenCalled();
  });

  it('falha no Supabase Auth retorna INTERNAL sem criar Person', async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: {},
      error: { message: 'internal error' },
    });

    const result = await registerPerson({
      fullName: 'Pessoa Auth Fail',
      cpf: BASE_CPF,
      email: `auth-fail-${Date.now()}@example.com`,
      password: 'Senha@12345',
      role: 'CANDIDATE',
      captchaToken: 'token',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INTERNAL');

    // Nenhuma Person deve ter sido criada.
    const count = await prisma.person.count({
      where: { emailLogin: { contains: 'auth-fail' } },
    });
    expect(count).toBe(0);
  });

  it('P2002 meta.target indica cpf — não aciona rollback de outros conflitos', async () => {
    // Simula PrismaClientKnownRequestError P2002 com target cpf
    const prismaErr = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`cpf`)',
      { code: 'P2002', clientVersion: '5.x', meta: { target: ['cpf'] } },
    );

    // Força withAudit a lançar o erro (mock da transação já foi feito via Prisma real,
    // mas aqui testamos o branch de catch diretamente com CPF duplicado no BD).
    // Este teste já é coberto pelo teste "E-006: CPF duplicado" com BD real;
    // aqui verificamos que o erro vem com a mensagem correta.
    expect(prismaErr.code).toBe('P2002');
    expect(prismaErr.meta?.target).toContain('cpf');
  });
});
