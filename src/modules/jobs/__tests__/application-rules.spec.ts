import { describe, it, expect } from 'vitest';
import {
  isJobOpenForApplication,
  isProfileApplicable,
  canCancelApplication,
} from '../domain/application-rules';

// FACTS (USP-025 / CAN-025-04 / CAN-025-E1) — regras puras de elegibilidade de
// candidatura. Espelham o `where` on-read de `search-jobs.ts` (buildWhere):
// status='ACTIVE' AND valid_until>=hoje(SP) AND company.is_verified.
const TODAY = new Date('2026-07-08T00:00:00.000Z');

describe('isJobOpenForApplication — regra pura (CAN-025-E1)', () => {
  it('@ac-can-025-e1 vaga ACTIVE, não expirada e Empresa verificada → true', () => {
    expect(
      isJobOpenForApplication(
        { status: 'ACTIVE', validUntil: new Date('2026-08-01'), companyIsVerified: true },
        TODAY,
      ),
    ).toBe(true);
  });

  it('@ac-can-025-e1 vaga PAUSED (não-ACTIVE) → false', () => {
    expect(
      isJobOpenForApplication(
        { status: 'PAUSED', validUntil: new Date('2026-08-01'), companyIsVerified: true },
        TODAY,
      ),
    ).toBe(false);
  });

  it('@ac-can-025-e1 vaga expirada (validUntil < hoje) → false', () => {
    expect(
      isJobOpenForApplication(
        { status: 'ACTIVE', validUntil: new Date('2026-07-01'), companyIsVerified: true },
        TODAY,
      ),
    ).toBe(false);
  });

  it('vaga com validUntil exatamente hoje (borda) → true', () => {
    expect(
      isJobOpenForApplication(
        { status: 'ACTIVE', validUntil: new Date('2026-07-08T00:00:00.000Z'), companyIsVerified: true },
        TODAY,
      ),
    ).toBe(true);
  });

  it('@ac-can-025-e1 Empresa não verificada → false', () => {
    expect(
      isJobOpenForApplication(
        { status: 'ACTIVE', validUntil: new Date('2026-08-01'), companyIsVerified: false },
        TODAY,
      ),
    ).toBe(false);
  });

  it('validUntil nulo → false (falha segura)', () => {
    expect(
      isJobOpenForApplication({ status: 'ACTIVE', validUntil: null, companyIsVerified: true }, TODAY),
    ).toBe(false);
  });
});

describe('isProfileApplicable — regra pura (CAN-025-04)', () => {
  it('@ac-can-025-04 perfil null (Pessoa sem papel candidato) → false', () => {
    expect(isProfileApplicable(null)).toBe(false);
  });

  it('@ac-can-025-04 perfil DRAFT → false', () => {
    expect(isProfileApplicable({ publicationStatus: 'DRAFT' })).toBe(false);
  });

  it('perfil IN_MODERATION → false', () => {
    expect(isProfileApplicable({ publicationStatus: 'IN_MODERATION' })).toBe(false);
  });

  it('@ac-can-025-04 perfil ACTIVE → true', () => {
    expect(isProfileApplicable({ publicationStatus: 'ACTIVE' })).toBe(true);
  });
});

// FACTS (USP-026 / CAN-026-E1 / CAN-026-MN-02) — regra pura de elegibilidade
// de cancelamento. A checagem de dono/existência NÃO é desta função (é da
// query escopada em cancelApplication) — aqui só o estado da linha.
describe('canCancelApplication — regra pura (CAN-026-E1)', () => {
  it('candidatura ativa (cancelledAt null) → { ok: true }', () => {
    expect(canCancelApplication({ cancelledAt: null })).toEqual({ ok: true });
  });

  it('@ac-can-026-e1 candidatura já cancelada → { ok: false, reason: ALREADY_CANCELLED }', () => {
    expect(canCancelApplication({ cancelledAt: new Date('2026-07-01T00:00:00Z') })).toEqual({
      ok: false,
      reason: 'ALREADY_CANCELLED',
    });
  });
});
