import { describe, it, expect, vi } from 'vitest';
import { verifyTurnstileToken } from '@/shared/lib/turnstile';

function fakeFetch(payload: unknown, init?: { ok?: boolean; status?: number }) {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: init?.status ?? (init?.ok === false ? 500 : 200),
    }),
  ) as unknown as typeof fetch;
}

const SECRET = 'test-secret';

describe('verifyTurnstileToken', () => {
  it('retorna ok=true quando o Cloudflare confirma o desafio', async () => {
    const fetchImpl = fakeFetch({ success: true });
    const result = await verifyTurnstileToken('valid-token', { fetchImpl, secret: SECRET });
    expect(result.ok).toBe(true);
    expect(result.errorCode).toBeUndefined();
  });

  it('retorna ok=false com error-code quando o token é inválido', async () => {
    const fetchImpl = fakeFetch({ success: false, 'error-codes': ['invalid-input-response'] });
    const result = await verifyTurnstileToken('bad-token', { fetchImpl, secret: SECRET });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('invalid-input-response');
  });

  it('rejeita token ausente sem chamar a rede', async () => {
    const fetchImpl = fakeFetch({ success: true });
    const result = await verifyTurnstileToken(undefined, { fetchImpl, secret: SECRET });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('missing-input-response');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('envia secret, response e remoteip no corpo', async () => {
    const fetchImpl = fakeFetch({ success: true });
    await verifyTurnstileToken('tok', { fetchImpl, secret: SECRET, remoteIp: '203.0.113.5' });
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain('secret=test-secret');
    expect(body).toContain('response=tok');
    expect(body).toContain('remoteip=203.0.113.5');
  });

  it('fail-closed quando a API responde não-2xx', async () => {
    const fetchImpl = fakeFetch({}, { status: 503 });
    const result = await verifyTurnstileToken('tok', { fetchImpl, secret: SECRET });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('http-503');
  });

  it('fail-closed em erro de rede (sem lançar)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const result = await verifyTurnstileToken('tok', { fetchImpl, secret: SECRET });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('network-error');
  });
});
