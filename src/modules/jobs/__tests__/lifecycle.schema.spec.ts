import { describe, it, expect } from 'vitest';
import { jobIdSchema, extendJobValiditySchema } from '../schemas/lifecycle.schema';
import { MAX_VALIDADE_DIAS } from '../domain/validade';
import { hojeSaoPaulo } from '@/shared/lib/time';

/**
 * FACTS (USP-023 / T5) — validação Zod dos schemas de ciclo de vida de vaga.
 * `jobIdSchema` (base de pause/unpause/archive) e `extendJobValiditySchema`
 * (E-004: data futura ≤ MAX_VALIDADE_DIAS via `validadeStatus`).
 */

const UUID = '11111111-1111-4111-8111-111111111111';

/**
 * `days` a partir do dia-calendário de São Paulo, ancorado em `hojeSaoPaulo()`
 * (UTC midnight do dia SP) + `setUTCDate` — imune ao fuso do runner (L-006),
 * necessário aqui porque os testes de borda usam offsets exatos (0/180/181 dias).
 */
function dateStr(days: number): string {
  const d = hojeSaoPaulo();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('jobIdSchema', () => {
  it('aceita um jobId UUID válido', () => {
    expect(jobIdSchema.safeParse({ jobId: UUID }).success).toBe(true);
  });

  it('rejeita jobId não-UUID', () => {
    expect(jobIdSchema.safeParse({ jobId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('extendJobValiditySchema (AC-023-4 / E-004)', () => {
  it('aceita data futura dentro do teto (happy path)', () => {
    const res = extendJobValiditySchema.safeParse({ jobId: UUID, validUntil: dateStr(30) });
    expect(res.success).toBe(true);
  });

  it('aceita a borda exata do teto (MAX_VALIDADE_DIAS dias)', () => {
    const res = extendJobValiditySchema.safeParse({ jobId: UUID, validUntil: dateStr(MAX_VALIDADE_DIAS) });
    expect(res.success).toBe(true);
  });

  it('rejeita data no passado', () => {
    const res = extendJobValiditySchema.safeParse({ jobId: UUID, validUntil: dateStr(-1) });
    expect(res.success).toBe(false);
  });

  it(`rejeita data acima de ${MAX_VALIDADE_DIAS} dias`, () => {
    const res = extendJobValiditySchema.safeParse({ jobId: UUID, validUntil: dateStr(MAX_VALIDADE_DIAS + 1) });
    expect(res.success).toBe(false);
  });

  it('rejeita data com formato inválido', () => {
    const res = extendJobValiditySchema.safeParse({ jobId: UUID, validUntil: 'não-é-uma-data' });
    expect(res.success).toBe(false);
  });
});
