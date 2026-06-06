import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import type { CurrentPerson } from '../server/session';

/**
 * Testes de integração da Server Action registerPersonByAssistant (USP-002).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Mocks: next/headers (IP/UA) e ../server/session (operador AS autenticado).
 * Real: Prisma/Postgres — valida persistência, ausência de credencial (P-002),
 * grant, auditoria (PERSON_CREATED_BY_AS + PERSON_CPF_EXCEPTION_GRANTED).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.7', 'user-agent': 'vitest/int' })),
}));

const OP_ID = 'aaaaaaaa-1111-2222-3333-444444444444';
const OP_SUPA = 'bbbbbbbb-1111-2222-3333-555555555555';

// Operador mutável por teste (default: assistente social ativa).
let mockOperator: CurrentPerson | null = {
  id: OP_ID,
  supabaseUserId: OP_SUPA,
  fullName: 'Assistente Social Teste',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['SOCIAL_ASSISTANT'],
  phone: null,
  fullAddress: null,
};

vi.mock('../server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockOperator),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { registerPersonByAssistant } = await import('../actions/register-person-by-assistant');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('registerPersonByAssistant — integração', () => {
  const VALID_CPF = '529.982.247-25';
  const VALID_CPF_DIGITS = VALID_CPF.replace(/\D/g, '');
  const VALID_JUSTIFICATION =
    'Pessoa idosa sem qualquer documento; atendimento presencial na sede da ASONSEG.';
  const createdIds: string[] = [];

  function asOperator() {
    mockOperator = {
      id: OP_ID,
      supabaseUserId: OP_SUPA,
      fullName: 'Assistente Social Teste',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['SOCIAL_ASSISTANT'],
      phone: null,
      fullAddress: null,
    };
  }

  /** Remove resíduo do CPF fixo (único ponto de colisão entre runs). */
  async function cleanResidualByCpf() {
    const stale = await prisma.person.findMany({
      where: { cpf: VALID_CPF_DIGITS },
      select: { id: true },
    });
    for (const { id } of stale) {
      await prisma.personRoleGrant.deleteMany({ where: { personId: id } });
      await prisma.person.deleteMany({ where: { id } });
    }
  }

  beforeAll(async () => {
    await cleanResidualByCpf();
  });

  afterEach(async () => {
    // Limpa Persons criadas (consents/grants → person). audit_log é append-only
    // (não se apaga; sem FK para person), então fica fora da limpeza.
    for (const id of createdIds) {
      await prisma.personRoleGrant.deleteMany({ where: { personId: id } });
      await prisma.person.deleteMany({ where: { id } });
    }
    createdIds.length = 0;
    asOperator();
  });

  it('happy path com CPF: cria Pessoa SEM credencial, com operador AS e auditoria', async () => {
    const result = await registerPersonByAssistant({ fullName: 'Maria Assistida', cpf: VALID_CPF });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.cpfException).toBe(false);
    createdIds.push(result.data.personId);

    const person = await prisma.person.findUnique({ where: { id: result.data.personId } });
    expect(person?.fullName).toBe('Maria Assistida');
    expect(person?.cpf).toBe(VALID_CPF_DIGITS);
    expect(person?.cpfExceptionJustification).toBeNull();
    expect(person?.createdByPersonId).toBe(OP_ID);
    // P-002: Pessoa sem credencial — não loga por nenhuma rota.
    expect(person?.supabaseUserId).toBeNull();
    expect(person?.emailLogin).toBeNull();

    // P-005: auditoria com operador (AS) registrado.
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'PERSON_CREATED_BY_AS', entityId: result.data.personId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorPersonId).toBe(OP_ID);

    // E-004: evidência do consentimento em papel registrada no `after`.
    const paperConsent = (audit?.after as Record<string, unknown> | null)?.paperConsent as
      | Record<string, unknown>
      | undefined;
    expect(paperConsent).toMatchObject({
      purpose: 'SOCIAL_ASSISTANCE',
      termVersion: 'social-assistance@v1.0',
      consentChannel: 'PAPER',
    });
    // Sem data informada → assume a data do cadastro (string YYYY-MM-DD).
    expect(paperConsent?.signedOnPaperAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('E-004: data da assinatura informada é gravada na evidência', async () => {
    const result = await registerPersonByAssistant({
      fullName: 'Com Data Assinatura',
      cpf: VALID_CPF,
      signedOnPaperAt: '2026-05-20',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdIds.push(result.data.personId);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'PERSON_CREATED_BY_AS', entityId: result.data.personId },
    });
    const paperConsent = (audit?.after as Record<string, unknown> | null)?.paperConsent as
      | Record<string, unknown>
      | undefined;
    expect(paperConsent?.signedOnPaperAt).toBe('2026-05-20');
  });

  it('exceção de CPF: cria Pessoa sem CPF, grava justificativa e evento dedicado', async () => {
    const result = await registerPersonByAssistant({
      fullName: 'João Exceção',
      cpfException: true,
      cpfExceptionJustification: VALID_JUSTIFICATION,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.cpfException).toBe(true);
    createdIds.push(result.data.personId);

    const person = await prisma.person.findUnique({ where: { id: result.data.personId } });
    expect(person?.cpf).toBeNull();
    expect(person?.cpfExceptionJustification).toBe(VALID_JUSTIFICATION);

    // Evento dedicado com a justificativa na coluna própria (não-redigida — F3).
    const excAudit = await prisma.auditLog.findFirst({
      where: { action: 'PERSON_CPF_EXCEPTION_GRANTED', entityId: result.data.personId },
    });
    expect(excAudit).not.toBeNull();
    expect(excAudit?.justification).toBe(VALID_JUSTIFICATION);
    expect(excAudit?.actorPersonId).toBe(OP_ID);
  });

  it('papel pretendido: cria grant AWAITING_CONSENT (ativa só com consentimento — ADR-0020)', async () => {
    const result = await registerPersonByAssistant({
      fullName: 'Pedro Candidato',
      cpf: VALID_CPF,
      role: 'CANDIDATE',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdIds.push(result.data.personId);

    const grant = await prisma.personRoleGrant.findFirst({
      where: { personId: result.data.personId },
    });
    expect(grant?.role).toBe('CANDIDATE');
    expect(grant?.status).toBe('AWAITING_CONSENT');
  });

  it('permissão negada: papel não-AS recebe FORBIDDEN e nada é criado', async () => {
    mockOperator = {
      id: 'cccccccc-1111-2222-3333-666666666666',
      supabaseUserId: 'dddddddd-1111-2222-3333-777777777777',
      fullName: 'Candidato Comum',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['CANDIDATE'],
      phone: null,
      fullAddress: null,
    };

    const result = await registerPersonByAssistant({ fullName: 'Tentativa Indevida', cpf: VALID_CPF });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');

    const count = await prisma.person.count({ where: { cpf: VALID_CPF_DIGITS } });
    expect(count).toBe(0);

    // D-004: a tentativa indevida (papel sem privilégio) gera log de auditoria imutável.
    const denial = await prisma.auditLog.findFirst({
      where: {
        action: 'PERSON_ASSISTED_EXCEPTION_DENIED',
        actorPersonId: 'cccccccc-1111-2222-3333-666666666666',
      },
      orderBy: { occurredAt: 'desc' },
    });
    expect(denial).not.toBeNull();
    expect((denial?.after as Record<string, unknown> | null)?.vector).toBe('ASSISTED_ACTION');
  });

  it('não autenticado: getCurrentPerson nulo recebe UNAUTHENTICATED', async () => {
    mockOperator = null;

    const result = await registerPersonByAssistant({ fullName: 'Anônimo', cpf: VALID_CPF });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAUTHENTICATED');
  });

  it('Zod: exceção sem justificativa retorna VALIDATION sem tocar o banco', async () => {
    const result = await registerPersonByAssistant({
      fullName: 'Sem Justificativa',
      cpfException: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('CPF duplicado retorna CONFLICT', async () => {
    const first = await registerPersonByAssistant({ fullName: 'Primeira', cpf: VALID_CPF });
    expect(first.ok).toBe(true);
    if (first.ok) createdIds.push(first.data.personId);

    const second = await registerPersonByAssistant({ fullName: 'Segunda', cpf: VALID_CPF });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('CONFLICT');
    expect(second.error.message).toContain('CPF');
  });
});
