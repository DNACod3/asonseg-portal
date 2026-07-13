import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Binding condicional do EmailSender por `EMAIL_DEV_SMTP` (USP-060 / HYG-05),
 * espelhando o seam do `CVExtractor` (`CV_EXTRACTOR_FAKE`). `container.ts` e
 * `env.ts` são módulos com estado no import (registro de factories / parse do
 * env); `vi.resetModules()` + reimport dinâmico força uma reavaliação fresca
 * do binding sob cada valor da flag, dentro do mesmo arquivo de teste.
 */
describe('container: binding do EmailSender por EMAIL_DEV_SMTP (USP-060 / HYG-05)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('flag off (default) ⇒ container resolve ResendEmailSender (comportamento de produção idêntico)', async () => {
    vi.stubEnv('EMAIL_DEV_SMTP', 'false');
    const { container } = await import('@/shared/container');
    const { EMAIL_SENDER_TOKEN } = await import('@/shared/lib/email/email-sender.port');
    const { ResendEmailSender } = await import('@/shared/lib/email/resend-email-sender');

    const sender = container.resolve(EMAIL_SENDER_TOKEN);

    expect(sender).toBeInstanceOf(ResendEmailSender);
  });

  it('flag on ⇒ container resolve DevSmtpEmailSender', async () => {
    vi.stubEnv('EMAIL_DEV_SMTP', 'true');
    const { container } = await import('@/shared/container');
    const { EMAIL_SENDER_TOKEN } = await import('@/shared/lib/email/email-sender.port');
    const { DevSmtpEmailSender } = await import('@/shared/lib/email/dev-smtp-email-sender');

    const sender = container.resolve(EMAIL_SENDER_TOKEN);

    expect(sender).toBeInstanceOf(DevSmtpEmailSender);
  });
});
