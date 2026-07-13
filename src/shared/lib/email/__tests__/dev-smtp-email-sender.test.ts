import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DevSmtpEmailSender, type DevSmtpTransport } from '../dev-smtp-email-sender';

/**
 * Testes do adapter `DevSmtpEmailSender` (USP-060 / AUTH-9 / HYG-04, HYG-07).
 * Transporte SMTP injetado pelo construtor — sem Mailpit real (mesmo padrão
 * de `ResendEmailSender`/`ResendClient`).
 */

const sendMailMock = vi.fn();
const fakeTransport: DevSmtpTransport = { sendMail: sendMailMock };

const infoSpy = vi.fn();
const errorSpy = vi.fn();
vi.mock('@/shared/lib/logger', () => ({
  childLogger: () => ({ info: infoSpy, error: errorSpy }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  sendMailMock.mockResolvedValue({ messageId: 'dev-smtp-123' });
});

describe('DevSmtpEmailSender', () => {
  it('entrega com sucesso: { ok: true, id } com o transporte injetado', async () => {
    const sender = new DevSmtpEmailSender(fakeTransport);

    const result = await sender.send({ to: 'maria@example.com', template: 'welcome', data: { nome: 'Maria' } });

    expect(result).toEqual({ ok: true, id: 'dev-smtp-123' });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const payload = sendMailMock.mock.calls[0]?.[0] as { to: string; subject: string; html: string; text: string };
    expect(payload.to).toBe('maria@example.com');
    expect(payload.html).toContain('Maria');
  });

  it('falha do transporte (ex.: Mailpit fora do ar): { ok: false } sem lançar (contrato EmailSender)', async () => {
    sendMailMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const sender = new DevSmtpEmailSender(fakeTransport);

    const result = await sender.send({ to: 'joao@example.com', template: 'welcome', data: { nome: 'João' } });

    expect(result).toEqual({ ok: false });
  });

  it('HYG-MN-04/U44-MN-04 (negativo): não loga o destinatário nem o corpo renderizado no envio bem-sucedido', async () => {
    await new DevSmtpEmailSender(fakeTransport).send({
      to: 'sigiloso@example.com',
      template: 'password-reset',
      data: { nome: 'Sigiloso', resetUrl: 'https://portal.test/redefinir-senha?token_hash=SEGREDO', expiraEmHoras: 24 },
    });

    const loggedPayloads = [...infoSpy.mock.calls, ...errorSpy.mock.calls].map((call) => JSON.stringify(call[0]));
    for (const payload of loggedPayloads) {
      expect(payload).not.toContain('sigiloso@example.com');
      expect(payload).not.toContain('SEGREDO');
      expect(payload).not.toContain('Sigiloso');
    }
  });

  it('HYG-MN-04/U44-MN-04 (negativo): não loga o destinatário nem o corpo na falha de envio', async () => {
    sendMailMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await new DevSmtpEmailSender(fakeTransport).send({
      to: 'sigiloso@example.com',
      template: 'password-reset',
      data: { nome: 'Sigiloso', resetUrl: 'https://portal.test/redefinir-senha?token_hash=SEGREDO', expiraEmHoras: 24 },
    });

    const loggedPayloads = [...infoSpy.mock.calls, ...errorSpy.mock.calls].map((call) => JSON.stringify(call[0]));
    for (const payload of loggedPayloads) {
      expect(payload).not.toContain('sigiloso@example.com');
      expect(payload).not.toContain('SEGREDO');
    }
  });
});
