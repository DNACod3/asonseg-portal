import { describe, it, expect } from 'vitest';
import { requireActiveConsent } from '../domain/require-active-consent';

/**
 * `requireActiveConsent` recebe um cliente injetável — testamos a regra de
 * decisão com um fake que distingue a query "vigente" (`revokedAt: null`) da
 * query "qualquer registro". Sem mock de módulo (issue #37).
 */
type Row = { id: string; termVersion: string };

function fakeClient(opts: { active?: Row | null; any?: Row | null }) {
  return {
    consent: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        const filtersNonRevoked = args.where.revokedAt === null;
        return filtersNonRevoked ? (opts.active ?? null) : (opts.any ?? null);
      },
    },
  } as never;
}

describe('consents/requireActiveConsent', () => {
  it('ativo quando há registro vigente na versão atual', async () => {
    const check = await requireActiveConsent(
      'p1',
      'JOB_APPLICATION',
      fakeClient({ active: { id: 'c1', termVersion: 'v1.0' } }),
    );
    expect(check).toEqual({ active: true, consentId: 'c1' });
  });

  it('aceita a versão no formato legado slug@vN.M como vigente', async () => {
    const check = await requireActiveConsent(
      'p1',
      'JOB_APPLICATION',
      fakeClient({ active: { id: 'c1', termVersion: 'job-application@v1.0' } }),
    );
    expect(check.active).toBe(true);
  });

  it('OUTDATED quando o aceite vigente é de versão antiga (mudança major)', async () => {
    const check = await requireActiveConsent(
      'p1',
      'JOB_APPLICATION',
      fakeClient({ active: { id: 'c1', termVersion: 'v0.9' } }),
    );
    expect(check).toEqual({ active: false, reason: 'OUTDATED', consentId: 'c1' });
  });

  it('REVOKED quando não há vigente mas existe histórico', async () => {
    const check = await requireActiveConsent(
      'p1',
      'JOB_APPLICATION',
      fakeClient({ active: null, any: { id: 'old', termVersion: 'v1.0' } }),
    );
    expect(check).toEqual({ active: false, reason: 'REVOKED' });
  });

  it('ABSENT quando nunca houve consentimento', async () => {
    const check = await requireActiveConsent(
      'p1',
      'CV_AI_EXTRACTION',
      fakeClient({ active: null, any: null }),
    );
    expect(check).toEqual({ active: false, reason: 'ABSENT' });
  });
});
