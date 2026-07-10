import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import type { EmailSender, EmailMessage } from '@/shared/lib/email/email-sender.port';

/**
 * Integração do dispatcher assíncrono do Outbox (USP-044 / T3). Requer Postgres
 * local (`supabase start`). Cobre AC-044-D2/D3/D4/D5 e os must-nots de unidade:
 * U44-MN-01 (concorrência — exercita o lock real `FOR UPDATE SKIP LOCKED`,
 * L-010), U44-MN-03 (poison + isolamento de falha) e U44-MN-04 (log só
 * metadado, nunca corpo/PII).
 *
 * `beforeEach` zera TODA linha `topic='email'` da tabela — isolamento total
 * entre testes (o motor varre a fila inteira, não é escopável por CNPJ como
 * Job/Company); seguro por rodar contra um Postgres de teste efêmero, sem
 * tráfego concorrente de outra origem (fileParallelism:false, TESTING/L-010).
 */

interface LoggedCall {
  level: 'info' | 'warn' | 'error';
  obj?: unknown;
  msg?: string;
}
const loggedCalls: LoggedCall[] = [];

vi.mock('@/shared/lib/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/logger')>();
  return {
    ...actual,
    childLogger: () => ({
      info: (obj: unknown, msg?: string) => {
        loggedCalls.push({ level: 'info', obj, msg });
      },
      warn: (obj: unknown, msg?: string) => {
        loggedCalls.push({ level: 'warn', obj, msg });
      },
      error: (obj: unknown, msg?: string) => {
        loggedCalls.push({ level: 'error', obj, msg });
      },
    }),
  };
});

const { prisma } = await import('@/shared/lib/prisma');
const { dispatchOutbox, MAX_ATTEMPTS } = await import('../dispatch-outbox');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);
const CNPJ = '11444777000360';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fake da porta `EmailSender` — nunca toca Resend/rede. Configurável por teste. */
function makeFakeSender(opts: { ok?: boolean; delayMs?: number } = {}): {
  sender: EmailSender;
  calls: Record<string, number>;
} {
  const calls: Record<string, number> = {};
  const sender: EmailSender = {
    async send(message: EmailMessage) {
      calls[message.to] = (calls[message.to] ?? 0) + 1;
      if (opts.delayMs) await delay(opts.delayMs);
      return { ok: opts.ok ?? true, id: 'fake-id' };
    },
  };
  return { sender, calls };
}

skipIfNoDb('dispatchOutbox — integração (USP-044)', () => {
  let authorId = '';
  let companyId = '';

  async function cleanupCompany() {
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.personCompanyGrant.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
  }

  beforeAll(async () => {
    await cleanupCompany();
    const author = await prisma.person.create({
      data: { fullName: 'Autor Dispatch Outbox Int', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;
  });

  beforeEach(async () => {
    loggedCalls.length = 0;
    await prisma.outbox.deleteMany({ where: { topic: 'email' } });
    await cleanupCompany();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Dispatch Outbox Int Ltda',
        nomeFantasia: 'Dispatch Outbox Int',
        setor: 'Comércio',
        createdBy: authorId,
        isVerified: true,
      },
      select: { id: true },
    });
    companyId = company.id;
  });

  afterAll(async () => {
    await prisma.outbox.deleteMany({ where: { topic: 'email' } });
    await cleanupCompany();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  async function createOutboxRow(payload: unknown, attempts = 0): Promise<string> {
    const row = await prisma.outbox.create({
      data: { topic: 'email', payload: payload as Prisma.InputJsonValue, attempts },
      select: { id: true },
    });
    return row.id;
  }

  it('@ac-044-d2 linha EmailMessage completa → fake chamado com a mensagem, processedAt setado', async () => {
    const payload: EmailMessage = {
      to: 'destino-d2@dispatch-outbox-int.example.com',
      template: 'referral-notification',
      data: { pessoaNome: 'João', vagaTitulo: 'Vaga D2', empresaNome: 'ACME' },
    };
    const id = await createOutboxRow(payload);
    const { sender, calls } = makeFakeSender({ ok: true });

    const result = await dispatchOutbox({ emailSender: sender });

    expect(result).toMatchObject({ sent: 1, failed: 0, skipped: 0, claimed: 1 });
    expect(calls['destino-d2@dispatch-outbox-int.example.com']).toBe(1);
    const row = await prisma.outbox.findUnique({ where: { id }, select: { processedAt: true, attempts: true } });
    expect(row?.processedAt).not.toBeNull();
    expect(row?.attempts).toBe(0);
  });

  it('@ac-044-d3 linha JOB_EXPIRY_D3 (com vaga+responsável seed) → hidratada e enviada', async () => {
    const responsible = await prisma.person.create({
      data: { fullName: 'Responsável Dispatch Int', status: 'ATIVO', emailLogin: 'resp-dispatch-int@example.com' },
      select: { id: true },
    });
    await prisma.personCompanyGrant.create({
      data: { personId: responsible.id, companyId, grantType: 'RESPONSIBLE', grantedBy: responsible.id, status: 'ACTIVE' },
    });
    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga D3 Dispatch Int', status: 'ACTIVE' },
      select: { id: true },
    });
    const id = await createOutboxRow({ kind: 'JOB_EXPIRY_D3', jobId: job.id });
    const { sender, calls } = makeFakeSender({ ok: true });

    const result = await dispatchOutbox({ emailSender: sender });

    expect(result).toMatchObject({ sent: 1, failed: 0, skipped: 0, claimed: 1 });
    expect(calls['resp-dispatch-int@example.com']).toBe(1);
    const row = await prisma.outbox.findUnique({ where: { id }, select: { processedAt: true } });
    expect(row?.processedAt).not.toBeNull();

    await prisma.personCompanyGrant.deleteMany({ where: { personId: responsible.id } });
    await prisma.person.deleteMany({ where: { id: responsible.id } });
  });

  it('@ac-044-d4 envio falha ({ok:false}) → attempts incrementado, lastError gravado, processedAt nulo', async () => {
    const payload: EmailMessage = {
      to: 'destino-d4@dispatch-outbox-int.example.com',
      template: 'referral-notification',
      data: { pessoaNome: 'João', vagaTitulo: 'Vaga D4', empresaNome: 'ACME' },
    };
    const id = await createOutboxRow(payload);
    const { sender } = makeFakeSender({ ok: false });

    const result = await dispatchOutbox({ emailSender: sender });

    expect(result).toMatchObject({ sent: 0, failed: 1, skipped: 0, claimed: 1 });
    const row = await prisma.outbox.findUnique({ where: { id }, select: { processedAt: true, attempts: true, lastError: true } });
    expect(row?.processedAt).toBeNull();
    expect(row?.attempts).toBe(1);
    expect(row?.lastError).toBeTruthy();
  });

  it('@ac-044-d5 JOB_EXPIRY_D3 com jobId inexistente → skipped, processedAt setado, sem retry', async () => {
    const id = await createOutboxRow({ kind: 'JOB_EXPIRY_D3', jobId: '00000000-0000-0000-0000-000000000000' });
    const { sender, calls } = makeFakeSender({ ok: true });

    const result = await dispatchOutbox({ emailSender: sender });

    expect(result).toMatchObject({ sent: 0, failed: 0, skipped: 1, claimed: 1 });
    expect(Object.keys(calls)).toHaveLength(0);
    const row = await prisma.outbox.findUnique({ where: { id }, select: { processedAt: true, attempts: true } });
    expect(row?.processedAt).not.toBeNull();
    expect(row?.attempts).toBe(0);
  });

  it('U44-MN-01 (concorrência, L-010): duas execuções concorrentes → cada linha enviada no máximo 1×, soma dos envios = total de linhas', async () => {
    const N = 6;
    const ids: string[] = [];
    for (let i = 0; i < N; i++) {
      const payload: EmailMessage = {
        to: `concorrencia-${i}@dispatch-outbox-int.example.com`,
        template: 'referral-notification',
        data: { pessoaNome: `Pessoa ${i}`, vagaTitulo: 'Vaga Concorrência', empresaNome: 'ACME' },
      };
      ids.push(await createOutboxRow(payload));
    }
    // Delay artificial no envio força overlap real entre as duas execuções: a
    // 2ª execução chega no `FOR UPDATE SKIP LOCKED` de uma linha enquanto a 1ª
    // ainda segura o lock (dentro do `await send`). Exercita o lock do
    // Postgres, não um pré-check de aplicação (L-010) — o dispatcher não tem
    // pré-check nenhum que pudesse mascarar a corrida.
    const { sender, calls } = makeFakeSender({ ok: true, delayMs: 40 });

    const [r1, r2] = await Promise.all([
      dispatchOutbox({ emailSender: sender }),
      dispatchOutbox({ emailSender: sender }),
    ]);

    // Garantia de nível de banco: a soma dos envios das duas execuções é
    // exatamente N — nunca mais (nenhuma linha enviada 2×), nunca menos
    // (nenhuma linha perdida). Afirmação no estado do DB / contagem do fake.
    expect(r1.sent + r2.sent).toBe(N);
    for (let i = 0; i < N; i++) {
      expect(calls[`concorrencia-${i}@dispatch-outbox-int.example.com`]).toBe(1);
    }
    const rows = await prisma.outbox.findMany({ where: { id: { in: ids } }, select: { processedAt: true } });
    expect(rows.every((r) => r.processedAt !== null)).toBe(true);
  });

  it('U44-MN-03 (poison): linha com attempts=MAX_ATTEMPTS NÃO é selecionada (nunca re-tentada)', async () => {
    const payload: EmailMessage = {
      to: 'poison@dispatch-outbox-int.example.com',
      template: 'referral-notification',
      data: { pessoaNome: 'Poison', vagaTitulo: 'Vaga Poison', empresaNome: 'ACME' },
    };
    const id = await createOutboxRow(payload, MAX_ATTEMPTS);
    const { sender, calls } = makeFakeSender({ ok: true });

    const result = await dispatchOutbox({ emailSender: sender });

    expect(result).toMatchObject({ sent: 0, failed: 0, skipped: 0, claimed: 0 });
    expect(calls['poison@dispatch-outbox-int.example.com']).toBeUndefined();
    const row = await prisma.outbox.findUnique({ where: { id }, select: { processedAt: true, attempts: true } });
    expect(row?.processedAt).toBeNull();
    expect(row?.attempts).toBe(MAX_ATTEMPTS);
  });

  it('U44-MN-03 (isolamento): linha malformada no meio do lote NÃO impede o envio das demais', async () => {
    const malformedId = await createOutboxRow({ nem: 'template', nao: 'kind' });
    await delay(5); // garante createdAt estritamente posterior → ordem determinística no lote
    const payload: EmailMessage = {
      to: 'apos-malformado@dispatch-outbox-int.example.com',
      template: 'referral-notification',
      data: { pessoaNome: 'Depois', vagaTitulo: 'Vaga Depois', empresaNome: 'ACME' },
    };
    const goodId = await createOutboxRow(payload);
    const { sender, calls } = makeFakeSender({ ok: true });

    const result = await dispatchOutbox({ emailSender: sender });

    expect(result).toMatchObject({ sent: 1, failed: 1, skipped: 0, claimed: 2 });
    expect(calls['apos-malformado@dispatch-outbox-int.example.com']).toBe(1);
    const malformedRow = await prisma.outbox.findUnique({ where: { id: malformedId }, select: { attempts: true, processedAt: true } });
    expect(malformedRow?.attempts).toBe(1);
    expect(malformedRow?.processedAt).toBeNull();
    const goodRow = await prisma.outbox.findUnique({ where: { id: goodId }, select: { processedAt: true } });
    expect(goodRow?.processedAt).not.toBeNull();
  });

  it('U44-MN-04: log não contém corpo/data/PII em claro — só metadado', async () => {
    const payload: EmailMessage = {
      to: 'log-check@dispatch-outbox-int.example.com',
      template: 'referral-notification',
      data: { pessoaNome: 'Segredo Nome', vagaTitulo: 'Vaga Log', empresaNome: 'ACME Confidencial' },
    };
    await createOutboxRow(payload);
    const { sender } = makeFakeSender({ ok: true });

    await dispatchOutbox({ emailSender: sender });

    expect(loggedCalls.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(loggedCalls);
    expect(serialized).not.toContain('log-check@dispatch-outbox-int.example.com');
    expect(serialized).not.toContain('Segredo Nome');
    expect(serialized).not.toContain('ACME Confidencial');
    for (const call of loggedCalls) {
      if (call.obj && typeof call.obj === 'object') {
        expect(Object.keys(call.obj as object)).not.toContain('data');
        expect(Object.keys(call.obj as object)).not.toContain('to');
      }
    }
  });
});
