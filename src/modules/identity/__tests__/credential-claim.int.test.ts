import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '../server/session';

/**
 * Testes de integração das Server Actions de reivindicação de credencial (USP-003).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — valida persistência, claim PENDING/VERIFIED, vínculo de
 * credencial e auditoria (CREDENTIAL_CLAIM_REQUESTED / CREDENTIAL_CLAIM_VERIFIED).
 * Mocks: next/headers (IP/UA), ../server/session (operador), Supabase Admin
 * (criação de usuário/link — sem rede), e a porta EmailSender (boas-vindas).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest/int' })),
}));

// Operador mutável por teste (default: assistente social ativa).
const OP_ID = 'a1a1a1a1-1111-2222-3333-444444444444';
const OP_SUPA = 'b2b2b2b2-1111-2222-3333-555555555555';
let mockOperator: CurrentPerson | null = null;
function asApprover() {
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

vi.mock('../server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockOperator),
}));

// Supabase Admin fake: registra o e-mail criado e devolve um userId determinístico.
const createdAuthEmails: string[] = [];
const deletedAuthUserIds: string[] = [];
let nextAuthUserId = 'c3c3c3c3-1111-2222-3333-666666666666';
let createUserShouldFail: 'already' | 'other' | null = null;
// Best-effort do e-mail de boas-vindas: quando true, generateLink falha (sem
// token) — a ativação NÃO deve reverter, apenas não envia o e-mail.
let generateLinkShouldFail = false;

vi.mock('@/shared/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    auth: {
      admin: {
        createUser: vi.fn(async ({ email }: { email: string }) => {
          if (createUserShouldFail === 'already') {
            return { data: { user: null }, error: { message: 'User already registered' } };
          }
          if (createUserShouldFail === 'other') {
            return { data: { user: null }, error: { message: 'boom' } };
          }
          createdAuthEmails.push(email);
          return { data: { user: { id: nextAuthUserId } }, error: null };
        }),
        generateLink: vi.fn(async () => {
          if (generateLinkShouldFail) {
            return { data: { properties: null }, error: { message: 'link boom' } };
          }
          return {
            data: { properties: { hashed_token: 'fake-hashed-token' } },
            error: null,
          };
        }),
        deleteUser: vi.fn(async (id: string) => {
          deletedAuthUserIds.push(id);
          return { data: {}, error: null };
        }),
      },
    },
  }),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { container } = await import('@/shared/container');
const { EMAIL_SENDER_TOKEN } = await import('@/shared/lib/email/email-sender.port');
const { CAPTCHA_VERIFIER_TOKEN } = await import('../ports/captchaVerifier');
const { requestCredentialClaim } = await import('../actions/request-credential-claim');
const { verifyCredentialClaim } = await import('../actions/verify-credential-claim');

// CAPTCHA do fluxo público (ADR-0014): stub controlável por teste.
let captchaOk = true;
function registerCaptchaStub() {
  container.register(CAPTCHA_VERIFIER_TOKEN, () => ({
    verify: async () => ({ ok: captchaOk }),
  }));
}

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('reivindicação de credencial — integração', () => {
  const VALID_CPF = '529.982.247-25';
  const VALID_CPF_DIGITS = VALID_CPF.replace(/\D/g, '');
  const REQUESTED_EMAIL = 'reivindica.usp003@example.com';
  const sentEmails: { to: string; template: string }[] = [];
  const createdPersonIds: string[] = [];

  /** Cria uma Pessoa pré-cadastrada (USP-002): ATIVA, sem credencial. */
  async function preRegisteredPerson(cpf: string | null = VALID_CPF_DIGITS) {
    const person = await prisma.person.create({
      data: { id: crypto.randomUUID(), fullName: 'Pessoa Pré-cadastrada', cpf },
      select: { id: true },
    });
    createdPersonIds.push(person.id);
    return person.id;
  }

  beforeAll(async () => {
    // Fake da porta de e-mail (boas-vindas) — sem rede.
    container.register(EMAIL_SENDER_TOKEN, () => ({
      send: async (msg: { to: string; template: string }) => {
        sentEmails.push({ to: msg.to, template: msg.template });
        return { ok: true, id: 'fake' };
      },
    }));
    registerCaptchaStub();
    // Limpa resíduos do e-mail/CPF fixos (únicos pontos de colisão entre runs).
    await prisma.person.deleteMany({ where: { emailLogin: REQUESTED_EMAIL } });
    const stale = await prisma.person.findMany({
      where: { cpf: VALID_CPF_DIGITS },
      select: { id: true },
    });
    for (const { id } of stale) await prisma.person.deleteMany({ where: { id } });
  });

  afterEach(async () => {
    for (const id of createdPersonIds) {
      await prisma.person.deleteMany({ where: { id } }); // cascade remove claims
    }
    createdPersonIds.length = 0;
    createdAuthEmails.length = 0;
    deletedAuthUserIds.length = 0;
    sentEmails.length = 0;
    createUserShouldFail = null;
    generateLinkShouldFail = false;
    captchaOk = true;
    nextAuthUserId = crypto.randomUUID();
    mockOperator = null;
  });

  // ── requestCredentialClaim ──────────────────────────────────────────────────

  it('request happy path: cria claim PENDING vinculada à Pessoa, com auditoria (E-001)', async () => {
    const personId = await preRegisteredPerson();

    const result = await requestCredentialClaim({
      cpf: VALID_CPF,
      requestedEmail: REQUESTED_EMAIL,
      verificationMethod: 'AS_CONFIRMATION',
      captchaToken: 'captcha-ok',
    });

    expect(result.ok).toBe(true);

    const claim = await prisma.credentialClaim.findFirst({ where: { personId } });
    expect(claim).not.toBeNull();
    expect(claim?.status).toBe('PENDING');
    expect(claim?.requestedEmail).toBe(REQUESTED_EMAIL);
    expect(claim?.verificationMethod).toBe('AS_CONFIRMATION');

    // P-002: não criou Pessoa nova (continua só a pré-cadastrada).
    expect(await prisma.person.count({ where: { cpf: VALID_CPF_DIGITS } })).toBe(1);

    // Auditoria do pedido, sem PII (e-mail não vai no `after`).
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CREDENTIAL_CLAIM_REQUESTED', entityId: claim?.id },
    });
    expect(audit).not.toBeNull();
    expect((audit?.after as Record<string, unknown> | null)?.personId).toBe(personId);
  });

  it('request anti-enumeração (P-006): CPF sem Pessoa elegível responde genérico e NÃO cria claim', async () => {
    const result = await requestCredentialClaim({
      cpf: VALID_CPF, // nenhuma Pessoa com esse CPF
      requestedEmail: REQUESTED_EMAIL,
      verificationMethod: 'AS_CONFIRMATION',
      captchaToken: 'captcha-ok',
    });
    expect(result.ok).toBe(true);
    // HYG-02: escopado às fixtures do teste (requestedEmail), não uma contagem global —
    // preserva a propriedade de segurança (zero claim para este pedido) sem depender de volume.
    expect(await prisma.credentialClaim.count({ where: { requestedEmail: REQUESTED_EMAIL } })).toBe(0);
  });

  it('request com CAPTCHA inválido é bloqueado e NÃO cria claim (ADR-0014)', async () => {
    const personId = await preRegisteredPerson();
    captchaOk = false;

    const result = await requestCredentialClaim({
      cpf: VALID_CPF,
      requestedEmail: REQUESTED_EMAIL,
      verificationMethod: 'AS_CONFIRMATION',
      captchaToken: 'captcha-ruim',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PRECONDITION_FAILED');
    // Fail-closed antes de qualquer efeito: nenhuma claim para a Pessoa.
    expect(await prisma.credentialClaim.count({ where: { personId } })).toBe(0);
  });

  it('request com e-mail já em uso é bloqueado (E-003)', async () => {
    // Pessoa COM credencial ocupando o e-mail.
    const occupant = await prisma.person.create({
      data: {
        id: crypto.randomUUID(),
        fullName: 'Dona do E-mail',
        supabaseUserId: crypto.randomUUID(),
        emailLogin: REQUESTED_EMAIL,
      },
      select: { id: true },
    });
    createdPersonIds.push(occupant.id);
    await preRegisteredPerson();

    const result = await requestCredentialClaim({
      cpf: VALID_CPF,
      requestedEmail: REQUESTED_EMAIL,
      verificationMethod: 'AS_CONFIRMATION',
      captchaToken: 'captcha-ok',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONFLICT');
  });

  // ── verifyCredentialClaim ───────────────────────────────────────────────────

  it('verify sem permissão é negado (P-005) e não ativa credencial', async () => {
    const personId = await preRegisteredPerson();
    const claim = await prisma.credentialClaim.create({
      data: { personId, requestedEmail: REQUESTED_EMAIL, verificationMethod: 'AS_CONFIRMATION' },
      select: { id: true },
    });
    mockOperator = {
      id: crypto.randomUUID(),
      supabaseUserId: crypto.randomUUID(),
      fullName: 'Voluntário',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['VOLUNTEER'],
      phone: null,
      fullAddress: null,
    };

    const result = await verifyCredentialClaim({
      claimId: claim.id,
      verificationMethod: 'AS_CONFIRMATION',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');

    const person = await prisma.person.findUnique({ where: { id: personId } });
    expect(person?.supabaseUserId).toBeNull(); // não ativou
    const stillPending = await prisma.credentialClaim.findUnique({ where: { id: claim.id } });
    expect(stillPending?.status).toBe('PENDING');
  });

  it('verify ativa credencial, marca VERIFIED, audita meio e envia boas-vindas (E-002 / P-001)', async () => {
    const personId = await preRegisteredPerson();
    const claim = await prisma.credentialClaim.create({
      data: { personId, requestedEmail: REQUESTED_EMAIL, verificationMethod: 'AS_CONFIRMATION' },
      select: { id: true },
    });
    asApprover();

    const result = await verifyCredentialClaim({
      claimId: claim.id,
      verificationMethod: 'IN_PERSON', // meio efetivamente usado (sobrescreve)
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.personId).toBe(personId);

    // Credencial vinculada à MESMA Pessoa (P-002 — não duplicou).
    const person = await prisma.person.findUnique({ where: { id: personId } });
    expect(person?.supabaseUserId).toBe(nextAuthUserId);
    expect(person?.emailLogin).toBe(REQUESTED_EMAIL);
    expect(createdAuthEmails).toContain(REQUESTED_EMAIL);

    // Claim VERIFICADA com verificador, data e meio efetivo.
    const verified = await prisma.credentialClaim.findUnique({ where: { id: claim.id } });
    expect(verified?.status).toBe('VERIFIED');
    expect(verified?.verifiedByPersonId).toBe(OP_ID);
    expect(verified?.verifiedAt).toBeInstanceOf(Date);
    expect(verified?.verificationMethod).toBe('IN_PERSON');

    // Auditoria com verificador + meio (sem PII).
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CREDENTIAL_CLAIM_VERIFIED', entityId: claim.id },
    });
    expect(audit?.actorPersonId).toBe(OP_ID);
    expect((audit?.after as Record<string, unknown> | null)?.verificationMethod).toBe('IN_PERSON');

    // E-mail de boas-vindas com link de definição de senha.
    expect(sentEmails).toEqual([{ to: REQUESTED_EMAIL, template: 'credential-claim-welcome' }]);
  });

  it('verify de solicitação inexistente retorna NOT_FOUND', async () => {
    asApprover();
    const result = await verifyCredentialClaim({
      claimId: crypto.randomUUID(),
      verificationMethod: 'AS_CONFIRMATION',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('verify de claim já processada (não-PENDING) é bloqueado', async () => {
    const personId = await preRegisteredPerson();
    const claim = await prisma.credentialClaim.create({
      data: {
        personId,
        requestedEmail: REQUESTED_EMAIL,
        verificationMethod: 'AS_CONFIRMATION',
        status: 'VERIFIED',
      },
      select: { id: true },
    });
    asApprover();

    const result = await verifyCredentialClaim({
      claimId: claim.id,
      verificationMethod: 'AS_CONFIRMATION',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PRECONDITION_FAILED');
  });

  it('verify concorrente da MESMA claim: só uma ativa (guard atômico), a outra PRECONDITION_FAILED', async () => {
    const personId = await preRegisteredPerson();
    const claim = await prisma.credentialClaim.create({
      data: { personId, requestedEmail: REQUESTED_EMAIL, verificationMethod: 'AS_CONFIRMATION' },
      select: { id: true },
    });
    asApprover();

    // Dois aprovadores confirmam ao mesmo tempo (corrida — P-005).
    const [a, b] = await Promise.all([
      verifyCredentialClaim({ claimId: claim.id, verificationMethod: 'AS_CONFIRMATION' }),
      verifyCredentialClaim({ claimId: claim.id, verificationMethod: 'IN_PERSON' }),
    ]);

    const oks = [a, b].filter((r) => r.ok);
    const fails = [a, b].filter((r) => !r.ok);
    expect(oks).toHaveLength(1);
    expect(fails).toHaveLength(1);
    const loser = fails[0];
    if (loser && !loser.ok) {
      expect(loser.error.code).toBe('PRECONDITION_FAILED');
    }

    // Exatamente uma transição: claim VERIFIED, Pessoa com credencial.
    const verified = await prisma.credentialClaim.findUnique({ where: { id: claim.id } });
    expect(verified?.status).toBe('VERIFIED');
    const person = await prisma.person.findUnique({ where: { id: personId } });
    expect(person?.supabaseUserId).toBe(nextAuthUserId);

    // O perdedor desfez sua credencial órfã no provedor (rollback compensatório).
    expect(deletedAuthUserIds).toHaveLength(1);
  });

  it('verify com falha ao gerar o link de boas-vindas: ativa mesmo assim, sem e-mail (best-effort)', async () => {
    const personId = await preRegisteredPerson();
    const claim = await prisma.credentialClaim.create({
      data: { personId, requestedEmail: REQUESTED_EMAIL, verificationMethod: 'AS_CONFIRMATION' },
      select: { id: true },
    });
    asApprover();
    generateLinkShouldFail = true;

    const result = await verifyCredentialClaim({
      claimId: claim.id,
      verificationMethod: 'AS_CONFIRMATION',
    });

    // Falha do e-mail (fora da transação) NÃO reverte a ativação.
    expect(result.ok).toBe(true);
    const verified = await prisma.credentialClaim.findUnique({ where: { id: claim.id } });
    expect(verified?.status).toBe('VERIFIED');
    const person = await prisma.person.findUnique({ where: { id: personId } });
    expect(person?.supabaseUserId).toBe(nextAuthUserId);
    // Sem token de link → nenhum e-mail enviado.
    expect(sentEmails).toHaveLength(0);
  });
});
