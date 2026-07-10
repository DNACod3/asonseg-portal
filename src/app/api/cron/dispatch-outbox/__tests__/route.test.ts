import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Unit da rota de cron `dispatch-outbox` (USP-044 / T4 / U44-MN-02). `dispatchOutbox`
 * é mockado — este teste cobre só o contrato fail-closed da rota (503/401/200/500),
 * não o motor do dreno (coberto pela integração de T3). Espelha o teste da rota
 * irmã `expire-jobs`.
 */

const mockEnv: { CRON_SECRET: string | undefined } = { CRON_SECRET: 'segredo-cron-dispatch-teste' };

vi.mock('@/shared/env', async (orig) => {
  const actual = (await orig()) as { env: Record<string, unknown> };
  return {
    env: new Proxy(actual.env, {
      get: (target, prop) => (prop === 'CRON_SECRET' ? mockEnv.CRON_SECRET : target[prop as keyof typeof target]),
    }),
  };
});

const dispatchOutboxMock = vi.fn();
vi.mock('@/shared/lib/outbox/dispatch-outbox', () => ({
  dispatchOutbox: (...args: unknown[]) => dispatchOutboxMock(...args),
}));

const { GET } = await import('../route');

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/cron/dispatch-outbox', { headers });
}

describe('GET /api/cron/dispatch-outbox — U44-MN-02 (fail-closed)', () => {
  beforeEach(() => {
    mockEnv.CRON_SECRET = 'segredo-cron-dispatch-teste';
    dispatchOutboxMock.mockReset();
    dispatchOutboxMock.mockResolvedValue({ sent: 2, failed: 1, skipped: 0, claimed: 3 });
  });

  it('CRON_SECRET não configurado no ambiente → 503 (fail-closed), dispatchOutbox NÃO chamado', async () => {
    mockEnv.CRON_SECRET = undefined;

    const res = await GET(makeRequest({ 'x-cron-secret': 'qualquer-coisa' }));

    expect(res.status).toBe(503);
    expect(dispatchOutboxMock).not.toHaveBeenCalled();
  });

  it('segredo ausente → 401, dispatchOutbox NÃO chamado', async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(dispatchOutboxMock).not.toHaveBeenCalled();
  });

  it('segredo incorreto → 401, dispatchOutbox NÃO chamado', async () => {
    const res = await GET(makeRequest({ 'x-cron-secret': 'errado' }));

    expect(res.status).toBe(401);
    expect(dispatchOutboxMock).not.toHaveBeenCalled();
  });

  it('segredo correto → 200 com { sent, failed, skipped }, dispatchOutbox chamado uma vez', async () => {
    const res = await GET(makeRequest({ 'x-cron-secret': 'segredo-cron-dispatch-teste' }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; sent: number; failed: number; skipped: number };
    expect(body).toEqual({ ok: true, sent: 2, failed: 1, skipped: 0 });
    expect(dispatchOutboxMock).toHaveBeenCalledTimes(1);
  });

  it('aceita o segredo via Authorization: Bearer', async () => {
    const res = await GET(makeRequest({ authorization: 'Bearer segredo-cron-dispatch-teste' }));

    expect(res.status).toBe(200);
    expect(dispatchOutboxMock).toHaveBeenCalledTimes(1);
  });

  it('dispatchOutbox rejeita → 500 com corpo genérico, sem vazar detalhe do erro', async () => {
    dispatchOutboxMock.mockRejectedValueOnce(new Error('dispatchOutbox falhou (teste — caminho 500)'));

    const res = await GET(makeRequest({ 'x-cron-secret': 'segredo-cron-dispatch-teste' }));

    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: false, error: 'Falha ao executar o dispatcher de e-mail' });
    expect(Object.keys(body).sort()).toEqual(['error', 'ok']);
    expect(JSON.stringify(body)).not.toContain('dispatchOutbox falhou');
  });
});
