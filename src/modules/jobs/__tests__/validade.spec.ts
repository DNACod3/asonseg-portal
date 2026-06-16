import { describe, it, expect } from 'vitest';
import { MAX_VALIDADE_DIAS, validadeStatus } from '../domain/validade';

// FACTS (USP-020 / #163) — regra pura de validade (E-004 / E-005 / P-005).
// Fonte: .specs/features/vagas/usp-020-publicar-vaga/tests/unit/usp-020-publicar-vaga.spec.ts
const HOJE_SP = new Date('2026-06-16T12:00:00-03:00');

describe('validadeStatus — regra pura (E-004 / E-005 / P-005)', () => {
  it('retorna "ok" para data futura dentro do teto (E-001)', () => {
    expect(validadeStatus(new Date('2026-09-01'), HOJE_SP)).toBe('ok');
  });

  it('retorna "passado" quando a validade é anterior a hoje em America/Sao_Paulo (E-004)', () => {
    expect(validadeStatus(new Date('2026-06-10'), HOJE_SP)).toBe('passado');
  });

  it('retorna "passado" quando a validade é igual a hoje no fuso America/Sao_Paulo (E-004 — borda)', () => {
    expect(validadeStatus(new Date('2026-06-16'), HOJE_SP)).toBe('passado');
  });

  it('retorna "excede_teto" quando a validade ultrapassa 180 dias (E-005 / P-005)', () => {
    expect(validadeStatus(new Date('2027-06-16'), HOJE_SP)).toBe('excede_teto');
  });

  it('aceita exatamente o teto de 180 dias como "ok" (E-005 — borda)', () => {
    const teto = new Date(HOJE_SP);
    teto.setDate(teto.getDate() + MAX_VALIDADE_DIAS);
    expect(validadeStatus(teto, HOJE_SP)).toBe('ok');
  });
});
