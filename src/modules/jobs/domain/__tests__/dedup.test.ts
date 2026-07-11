import { describe, it, expect } from 'vitest';
import { isJobDedupViolation } from '../dedup';

/**
 * Regra pura de detecção da violação do índice parcial `job_dedup_alive`
 * (P-003 / ADR-0021) — matriz exaustiva de `isJobDedupViolation`. Cobre os dois
 * lados de cada ramo do predicado `err instanceof Error && code === 'P2002'`:
 * não-Error curto-circuita (`instanceof` falso), Error com código
 * ausente/divergente (`===` falso) e Error com `code === 'P2002'` (ambos
 * verdadeiros → única entrada que retorna true).
 */
describe('jobs/domain/dedup — isJobDedupViolation', () => {
  it('retorna true para Error do Prisma com code "P2002" (violação de unicidade)', () => {
    const err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    expect(isJobDedupViolation(err)).toBe(true);
  });

  it('retorna false para Error com outro code (ex.: P2025) — não é dedup', () => {
    const err = Object.assign(new Error('Record not found'), { code: 'P2025' });
    expect(isJobDedupViolation(err)).toBe(false);
  });

  it('retorna false para Error sem code (erro comum de aplicação)', () => {
    expect(isJobDedupViolation(new Error('boom'))).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', 'P2002'],
    ['objeto com code mas não-Error', { code: 'P2002' }],
  ])('retorna false para não-Error (%s) — curto-circuita no instanceof', (_label, value) => {
    expect(isJobDedupViolation(value)).toBe(false);
  });
});
