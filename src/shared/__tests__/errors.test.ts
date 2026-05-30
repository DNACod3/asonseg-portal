import { describe, it, expect } from 'vitest';
import { ok, fail, type ActionResult } from '@/shared/errors';

describe('shared/errors', () => {
  it('ok() embrulha dados como sucesso', () => {
    const r: ActionResult<number> = ok(42);
    expect(r).toEqual({ ok: true, data: 42 });
  });

  it('fail() cria um erro com código e mensagem', () => {
    const r = fail('FORBIDDEN', 'Sem permissão');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('FORBIDDEN');
      expect(r.error.message).toBe('Sem permissão');
      expect(r.error.fieldErrors).toBeUndefined();
    }
  });

  it('fail() inclui fieldErrors quando fornecidos', () => {
    const r = fail('VALIDATION', 'Inválido', { email: ['obrigatório'] });
    if (!r.ok) {
      expect(r.error.fieldErrors).toEqual({ email: ['obrigatório'] });
    }
  });

  it('INVALID_CREDENTIALS é um código válido (USP-004 — anti-enumeração)', () => {
    // Garante mensagem genérica única para evitar enumeração de e-mails (P-002).
    const r = fail('INVALID_CREDENTIALS', 'Credenciais inválidas');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('INVALID_CREDENTIALS');
    }
  });
});
