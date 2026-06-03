import { describe, it, expect } from 'vitest';
import { CONSENT_PURPOSES, type ConsentPurpose } from '../domain/purposes';
import { PURPOSE_ROLE_MAP } from '../domain/purpose-role-map';
import {
  CASCADE_EFFECTS,
  CASCADE_CROSS_CUTTING,
  REVOCATION_CASCADE_MATRIX,
  revocationCascadeFor,
} from '../domain/revocation-cascade';

/**
 * Matriz finalidade→efeitos da cascata de revogação (ADR-0025), aprovada pela
 * DPO + jurídico em 2026-06-03. Estes testes travam os invariantes da semântica
 * aprovada e impedem divergência com `PURPOSE_ROLE_MAP`.
 */
describe('REVOCATION_CASCADE_MATRIX', () => {
  it('cobre exatamente as 8 finalidades do MVP', () => {
    expect(Object.keys(REVOCATION_CASCADE_MATRIX).sort()).toEqual([...CONSENT_PURPOSES].sort());
  });

  it('deriva o papel desativado de PURPOSE_ROLE_MAP (sem divergência)', () => {
    for (const purpose of CONSENT_PURPOSES) {
      expect(REVOCATION_CASCADE_MATRIX[purpose].role).toBe(PURPOSE_ROLE_MAP[purpose]);
    }
  });

  it('cada regra tem ao menos um efeito de artefato, e todo efeito é do vocabulário', () => {
    for (const purpose of CONSENT_PURPOSES) {
      const rule = REVOCATION_CASCADE_MATRIX[purpose];
      expect(rule.purpose).toBe(purpose);
      expect(rule.artifactEffects.length).toBeGreaterThan(0);
      for (const ae of rule.artifactEffects) {
        expect(ae.effects.length).toBeGreaterThan(0);
        expect(ae.note.trim().length).toBeGreaterThan(0);
        for (const eff of ae.effects) {
          expect(CASCADE_EFFECTS).toContain(eff);
        }
      }
    }
  });

  it('só PORTAL_ACCESS inativa a conta e suspende os demais consentimentos', () => {
    for (const purpose of CONSENT_PURPOSES) {
      const rule = REVOCATION_CASCADE_MATRIX[purpose];
      const isPortal = purpose === 'PORTAL_ACCESS';
      expect(rule.accountInactivation).toBe(isPortal);
      expect(rule.suspendOtherConsents).toBe(isPortal);
    }
  });

  it('só as finalidades sociais notificam a equipe interna', () => {
    const social: ReadonlySet<ConsentPurpose> = new Set([
      'SOCIAL_ASSISTANCE',
      'SOCIAL_REFERRAL_TO_JOB',
    ]);
    for (const purpose of CONSENT_PURPOSES) {
      expect(REVOCATION_CASCADE_MATRIX[purpose].notifyInternalTeam).toBe(social.has(purpose));
    }
  });

  it('não-retroatividade: finalidades que compartilham dados com terceiros preservam (MANTER) o já compartilhado', () => {
    const sharesWithThirdParties: ConsentPurpose[] = [
      'JOB_APPLICATION',
      'SERVICE_HIRING',
      'CV_AI_EXTRACTION',
      'SOCIAL_REFERRAL_TO_JOB',
    ];
    for (const purpose of sharesWithThirdParties) {
      const keeps = REVOCATION_CASCADE_MATRIX[purpose].artifactEffects.some((ae) =>
        ae.effects.includes('MANTER'),
      );
      expect(keeps, `${purpose} deve MANTER o que já foi licitamente compartilhado`).toBe(true);
    }
  });

  it('finalidades sem papel (null) não cascateiam role grant', () => {
    const noRole: ConsentPurpose[] = [
      'PORTAL_ACCESS',
      'SOCIAL_ASSISTANCE',
      'CV_AI_EXTRACTION',
      'SOCIAL_REFERRAL_TO_JOB',
    ];
    for (const purpose of noRole) {
      expect(REVOCATION_CASCADE_MATRIX[purpose].role).toBeNull();
    }
  });

  it('revocationCascadeFor devolve a regra da finalidade', () => {
    expect(revocationCascadeFor('JOB_APPLICATION')).toBe(REVOCATION_CASCADE_MATRIX.JOB_APPLICATION);
    expect(revocationCascadeFor('SOCIAL_ASSISTANCE').notifyInternalTeam).toBe(true);
  });

  it('regras transversais aprovadas: efeito imediato, re-aceite obrigatório, sem notificar terceiros', () => {
    expect(CASCADE_CROSS_CUTTING.graceWindowDays).toBe(0);
    expect(CASCADE_CROSS_CUTTING.reGrantRequiresNewConsent).toBe(true);
    expect(CASCADE_CROSS_CUTTING.notifyThirdParties).toBe(false);
  });
});
