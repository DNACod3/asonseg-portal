import { describe, it, expect } from 'vitest';
import { ContentStatus } from '@/modules/moderation';
import { deriveCandidateApplicationKpis } from '../domain/candidate-application-kpis';

/**
 * Unit test de `deriveCandidateApplicationKpis` (USP-067 — T9 / PNL-01,
 * A-01). Import direto do arquivo (não do barrel `@/modules/jobs`) — lição
 * MEMORY `coverage-gate-branch-loading-drop`.
 */
describe('deriveCandidateApplicationKpis (T9)', () => {
  it('conta ativas e, entre as ativas, as que têm vaga ACTIVE ("em análise")', () => {
    const result = deriveCandidateApplicationKpis([
      { active: true, jobStatus: ContentStatus.ACTIVE },
      { active: true, jobStatus: ContentStatus.PAUSED },
      { active: false, jobStatus: ContentStatus.ACTIVE }, // cancelada — não conta em nenhum dos dois
      { active: true, jobStatus: ContentStatus.ACTIVE },
    ]);
    expect(result).toEqual({ totalActive: 3, underReview: 2 });
  });

  it('sem candidaturas → zeros', () => {
    const result = deriveCandidateApplicationKpis([]);
    expect(result).toEqual({ totalActive: 0, underReview: 0 });
  });

  it('todas ativas mas vaga não-ACTIVE (ex.: PAUSED) → underReview 0', () => {
    const result = deriveCandidateApplicationKpis([
      { active: true, jobStatus: ContentStatus.PAUSED },
      { active: true, jobStatus: ContentStatus.EXPIRED },
    ]);
    expect(result).toEqual({ totalActive: 2, underReview: 0 });
  });
});
