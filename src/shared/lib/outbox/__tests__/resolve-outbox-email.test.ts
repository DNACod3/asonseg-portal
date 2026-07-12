import { describe, it, expect, vi } from 'vitest';
import { resolveOutboxEmail } from '../resolve-outbox-email';
import { isClaimable, MAX_ATTEMPTS } from '../dispatch-outbox';
import type { EmailMessage } from '@/shared/lib/email/email-sender.port';

// FACTS (USP-044 / T3) — discriminação do payload cru do Outbox e a regra de
// cap que exclui linha poison da seleção (U44-MN-03).
describe('resolveOutboxEmail', () => {
  it('@ac-044-d2 payload com template conhecido → passthrough como EmailMessage', async () => {
    const payload: EmailMessage = {
      to: 'candidato@example.com',
      template: 'application-confirmation',
      data: { candidatoNome: 'Maria', vagaTitulo: 'Vaga X', empresaNome: 'ACME' },
    };

    const message = await resolveOutboxEmail(payload);

    expect(message).toEqual(payload);
  });

  it('@usp057-05 payload com template moderation-approved/-returned/-rejected → passthrough (AC-044-D2)', async () => {
    const approved: EmailMessage = {
      to: 'autor@example.com',
      template: 'moderation-approved',
      data: { autorNome: 'Maria', tipoConteudo: 'vaga', tituloConteudo: 'Vaga X', areaUrl: 'https://portal.test/empresa' },
    };
    const returned: EmailMessage = {
      to: 'autor@example.com',
      template: 'moderation-returned',
      data: {
        autorNome: 'Maria',
        tipoConteudo: 'vaga',
        tituloConteudo: 'Vaga X',
        motivo: 'Faltou informação',
        areaUrl: 'https://portal.test/empresa',
      },
    };
    const rejected: EmailMessage = {
      to: 'autor@example.com',
      template: 'moderation-rejected',
      data: {
        autorNome: 'Maria',
        tipoConteudo: 'vaga',
        tituloConteudo: 'Vaga X',
        motivo: 'Não compatível',
        areaUrl: 'https://portal.test/empresa',
      },
    };

    await expect(resolveOutboxEmail(approved)).resolves.toEqual(approved);
    await expect(resolveOutboxEmail(returned)).resolves.toEqual(returned);
    await expect(resolveOutboxEmail(rejected)).resolves.toEqual(rejected);
  });

  it('@ac-044-d3 payload {kind:JOB_EXPIRY_D3} → delega ao hidratador injetado', async () => {
    const jobExpiryResolver = vi.fn().mockResolvedValue({
      to: 'responsavel@example.com',
      template: 'job-expiry',
      data: { empresaNome: 'ACME', vagaTitulo: 'Vaga X', diasRestantes: 3 },
    } satisfies EmailMessage);

    const message = await resolveOutboxEmail({ kind: 'JOB_EXPIRY_D3', jobId: 'job-1' }, { jobExpiryResolver });

    expect(jobExpiryResolver).toHaveBeenCalledTimes(1);
    expect(jobExpiryResolver).toHaveBeenCalledWith('job-1');
    expect(message).toMatchObject({ template: 'job-expiry' });
  });

  it('@ac-044-d5 hidratador retorna null → propaga null (no-op gracioso)', async () => {
    const jobExpiryResolver = vi.fn().mockResolvedValue(null);

    const message = await resolveOutboxEmail({ kind: 'JOB_EXPIRY_D3', jobId: 'job-inexistente' }, { jobExpiryResolver });

    expect(message).toBeNull();
  });

  it('payload malformado (nem template nem kind conhecido) → lança (tratado como falha da linha pelo chamador)', async () => {
    await expect(resolveOutboxEmail({ foo: 'bar' })).rejects.toThrow(/malformado/);
  });

  it('payload não-objeto → lança', async () => {
    await expect(resolveOutboxEmail('string-solta')).rejects.toThrow(/malformado/);
    await expect(resolveOutboxEmail(null)).rejects.toThrow(/malformado/);
  });

  it('payload {kind:JOB_EXPIRY_D3} sem jobId válido → lança', async () => {
    const jobExpiryResolver = vi.fn();
    await expect(resolveOutboxEmail({ kind: 'JOB_EXPIRY_D3' }, { jobExpiryResolver })).rejects.toThrow(/jobId/);
    expect(jobExpiryResolver).not.toHaveBeenCalled();
  });
});

// FACT (U44-MN-03) — a decisão `attempts < MAX_ATTEMPTS` que exclui a linha
// poison da seleção do dispatcher (regra de cap pura, sem DB).
describe('isClaimable — regra de cap (U44-MN-03)', () => {
  it(`attempts abaixo de MAX_ATTEMPTS (${MAX_ATTEMPTS}) é reivindicável`, () => {
    expect(isClaimable(0)).toBe(true);
    expect(isClaimable(MAX_ATTEMPTS - 1)).toBe(true);
  });

  it(`attempts igual ou acima de MAX_ATTEMPTS (${MAX_ATTEMPTS}) NÃO é reivindicável (poison)`, () => {
    expect(isClaimable(MAX_ATTEMPTS)).toBe(false);
    expect(isClaimable(MAX_ATTEMPTS + 1)).toBe(false);
  });
});
