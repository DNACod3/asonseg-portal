import { describe, it, expect } from 'vitest';
import { MAX_VALIDADE_DIAS, validadeStatus, diasAteExpiracao } from '../domain/validade';

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

// FACTS (USP-024 / T2) — diasAteExpiracao, cálculo puro do badge "expira em N dias" (E-004).
describe('diasAteExpiracao — dias de calendário até a expiração (P-002/P-003)', () => {
  it('retorna N dias corretos para uma vaga que expira no futuro', () => {
    expect(diasAteExpiracao(new Date('2026-06-19'), HOJE_SP)).toBe(3);
  });

  it('retorna 0 quando validUntil é hoje (America/Sao_Paulo)', () => {
    expect(diasAteExpiracao(new Date('2026-06-16'), HOJE_SP)).toBe(0);
  });

  it('retorna negativo para uma vaga já vencida (ainda não materializada pelo job)', () => {
    expect(diasAteExpiracao(new Date('2026-06-10'), HOJE_SP)).toBe(-6);
  });

  it('fronteira de meia-noite BRT: "hoje" perto da virada do dia não desloca o resultado (P-002)', () => {
    // 23h59 BRT de 15/06 ainda é dia-calendário 15/06 em SP, mesmo já sendo 16/06 em UTC.
    const hojeQuaseMeiaNoiteBRT = new Date('2026-06-16T02:59:00.000Z'); // 15/06 23:59 BRT (UTC-3)
    expect(diasAteExpiracao(new Date('2026-06-18'), hojeQuaseMeiaNoiteBRT)).toBe(3);
  });

  it('mesma fronteira de validadeStatus: diasAteExpiracao=0 corresponde a validadeStatus="passado" (consistência)', () => {
    const validUntil = new Date('2026-06-16');
    expect(diasAteExpiracao(validUntil, HOJE_SP)).toBe(0);
    expect(validadeStatus(validUntil, HOJE_SP)).toBe('passado');
  });
});
