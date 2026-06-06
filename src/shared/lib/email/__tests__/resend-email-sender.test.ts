import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from '@/shared/env';
import { ResendEmailSender, type ResendClient } from '../resend-email-sender';
import { renderWelcomeEmail } from '../templates/welcome';
import { renderPasswordResetEmail } from '../templates/password-reset';
import { renderCredentialClaimWelcomeEmail } from '../templates/credential-claim-welcome';

/**
 * Testes da infra de e-mail (USP-005 / #69): adapter Resend com client mockado
 * (sucesso e erro de provedor) + renderização dos templates (PT-BR, fuga de HTML).
 */

type SendPayload = { from: string; to: string; subject: string; html: string; text: string };

const sendMock = vi.fn();
const fakeClient: ResendClient = { emails: { send: sendMock } };

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue({ data: { id: 'email-123' }, error: null });
});

describe('ResendEmailSender', () => {
  it('envia boas-vindas com remetente do env e devolve o id do provedor', async () => {
    const sender = new ResendEmailSender(fakeClient);

    const result = await sender.send({ to: 'maria@example.com', template: 'welcome', data: { nome: 'Maria' } });

    expect(result).toEqual({ ok: true, id: 'email-123' });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = sendMock.mock.calls[0]?.[0] as SendPayload;
    expect(payload.from).toBe(env.EMAIL_FROM); // remetente vem do env (varia entre local e CI)
    expect(payload.to).toBe('maria@example.com');
    expect(payload.subject).toContain('Bem-vindo');
    expect(payload.html).toContain('Maria');
    expect(payload.text).toContain('Maria');
  });

  it('envia redefinição de senha com o link e a validade no corpo', async () => {
    const sender = new ResendEmailSender(fakeClient);

    await sender.send({
      to: 'joao@example.com',
      template: 'password-reset',
      data: { nome: 'João', resetUrl: 'https://portal.test/redefinir-senha?token_hash=abc', expiraEmHoras: 24 },
    });

    const payload = sendMock.mock.calls[0]?.[0] as SendPayload;
    expect(payload.subject).toContain('Redefinição de senha');
    expect(payload.html).toContain('https://portal.test/redefinir-senha?token_hash=abc');
    expect(payload.html).toContain('24 horas');
    expect(payload.text).toContain('https://portal.test/redefinir-senha?token_hash=abc');
  });

  it('envia boas-vindas de reivindicação com o link de definição de senha e a validade', async () => {
    const sender = new ResendEmailSender(fakeClient);

    await sender.send({
      to: 'maria@example.com',
      template: 'credential-claim-welcome',
      data: {
        nome: 'Maria',
        setPasswordUrl: 'https://portal.test/redefinir-senha?token_hash=abc&type=recovery',
        expiraEmHoras: 24,
      },
    });

    const payload = sendMock.mock.calls[0]?.[0] as SendPayload;
    expect(payload.subject).toContain('credencial');
    expect(payload.html).toContain('https://portal.test/redefinir-senha?token_hash=abc&amp;type=recovery');
    expect(payload.html).toContain('24 horas');
    expect(payload.text).toContain('https://portal.test/redefinir-senha?token_hash=abc&type=recovery');
  });

  it('erro do provedor → { ok: false } (não lança)', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const sender = new ResendEmailSender(fakeClient);

    const result = await sender.send({ to: 'x@example.com', template: 'welcome', data: { nome: 'X' } });

    expect(result.ok).toBe(false);
  });
});

describe('templates de e-mail', () => {
  it('boas-vindas: assunto, html e texto com o nome', () => {
    const email = renderWelcomeEmail({ nome: 'Ana' });
    expect(email.subject).toContain('Bem-vindo');
    expect(email.html).toContain('Ana');
    expect(email.text).toContain('Ana');
  });

  it('boas-vindas com papel: menciona o papel e o próximo passo, escapando HTML', () => {
    const email = renderWelcomeEmail({ nome: 'João', papel: '<b>candidato(a)</b>' });
    expect(email.html).toContain('João');
    expect(email.html).toContain('próximo passo é aceitar os termos');
    // Papel é interpolado no HTML escapado (anti-injeção).
    expect(email.html).not.toContain('<b>candidato(a)</b>');
    expect(email.html).toContain('&lt;b&gt;candidato(a)&lt;/b&gt;');
    // No texto plano o papel aparece sem escape (sem parser de markup).
    expect(email.text).toContain('Seu cadastro como <b>candidato(a)</b> foi realizado');
  });

  it('redefinição: inclui URL e validade, e escapa HTML do nome (anti-injeção)', () => {
    const email = renderPasswordResetEmail({
      nome: '<script>alert(1)</script>',
      resetUrl: 'https://portal.test/redefinir-senha?token_hash=xyz',
      expiraEmHoras: 24,
    });
    expect(email.html).toContain('https://portal.test/redefinir-senha?token_hash=xyz');
    expect(email.html).toContain('24 horas');
    // Nome malicioso não aparece como tag executável — foi escapado.
    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('boas-vindas de reivindicação: assunto, link de senha, validade e escape do nome (anti-injeção)', () => {
    const email = renderCredentialClaimWelcomeEmail({
      nome: '<script>alert(1)</script>',
      setPasswordUrl: 'https://portal.test/redefinir-senha?token_hash=abc&type=recovery',
      expiraEmHoras: 24,
    });
    expect(email.subject).toContain('credencial');
    // Link presente no HTML (com `&` escapado) e no texto plano (cru).
    expect(email.html).toContain('token_hash=abc&amp;type=recovery');
    expect(email.text).toContain('https://portal.test/redefinir-senha?token_hash=abc&type=recovery');
    expect(email.html).toContain('24 horas');
    // Nome malicioso escapado no HTML; cru no texto plano (sem parser de markup).
    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.text).toContain('<script>alert(1)</script>');
  });
});
