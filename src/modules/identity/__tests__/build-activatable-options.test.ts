import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit de `buildActivatableOptions` (USP-006) — a montagem das opções da página
 * `(app)/perfil/papeis`. Cobre: só papéis não-ativos; campos faltantes por papel
 * (E-001); e o caminho de termo indisponível/adulterado, em que o papel afetado é
 * **omitido** da lista sem derrubar os demais (P-004). `@/modules/consents` é
 * mockado para não tocar o filesystem dos termos.
 */
const termState = vi.hoisted(() => ({ loadTerm: vi.fn() }));

vi.mock('@/modules/consents', () => ({
  loadTerm: (...a: unknown[]) => termState.loadTerm(...a),
  purposeMetadata: (purpose: string) => ({
    humanName: `HN-${purpose}`,
    description: `DESC-${purpose}`,
  }),
  stripTermFrontMatter: (content: string) => content,
}));

const { buildActivatableOptions } = await import('../server/build-activatable-options');

function fakeTerm(purpose: string) {
  return {
    purpose,
    version: 'v1.0',
    content: `CORPO ${purpose}`,
    hash: `hash-${purpose}`,
    effectiveDate: null,
    legalBasis: null,
    status: null,
  };
}

beforeEach(() => {
  termState.loadTerm.mockReset().mockImplementation(async (purpose: string) => fakeTerm(purpose));
});

describe('identity/server/buildActivatableOptions', () => {
  it('monta uma opção por papel público não-ativo, com campos faltantes e termo', async () => {
    const options = await buildActivatableOptions(
      { phone: null, fullAddress: null },
      new Set<string>(),
    );

    expect(options.map((o) => o.role)).toEqual(['CANDIDATE', 'PROVIDER', 'CLIENT']);
    const candidate = options.find((o) => o.role === 'CANDIDATE')!;
    expect(candidate.label).toBeTruthy();
    expect(candidate.purposeHumanName).toBe('HN-JOB_APPLICATION');
    expect(candidate.missingFields).toEqual(['phone', 'fullAddress']);
    expect(candidate.term).toEqual({ version: 'v1.0', contentHash: 'hash-JOB_APPLICATION', body: 'CORPO JOB_APPLICATION' });
    // CLIENT exige só telefone.
    expect(options.find((o) => o.role === 'CLIENT')!.missingFields).toEqual(['phone']);
  });

  it('omite papéis já ativos', async () => {
    const options = await buildActivatableOptions(
      { phone: '11999990000', fullAddress: 'Rua X' },
      new Set(['CANDIDATE', 'CLIENT']),
    );
    expect(options.map((o) => o.role)).toEqual(['PROVIDER']);
  });

  it('campos já preenchidos não entram em missingFields', async () => {
    const options = await buildActivatableOptions(
      { phone: '11999990000', fullAddress: 'Rua X, 123' },
      new Set<string>(),
    );
    for (const o of options) expect(o.missingFields).toEqual([]);
  });

  it('P-004: termo indisponível/adulterado omite só o papel afetado (os demais continuam)', async () => {
    termState.loadTerm.mockImplementation(async (purpose: string) => {
      if (purpose === 'SERVICE_OFFERING') throw new Error('TERM_HASH_MISMATCH');
      return fakeTerm(purpose);
    });

    const options = await buildActivatableOptions(
      { phone: null, fullAddress: null },
      new Set<string>(),
    );

    // PROVIDER (SERVICE_OFFERING) cai fora; CANDIDATE e CLIENT permanecem.
    expect(options.map((o) => o.role)).toEqual(['CANDIDATE', 'CLIENT']);
  });

  it('lista vazia quando todos os papéis públicos já estão ativos', async () => {
    const options = await buildActivatableOptions(
      { phone: '11999990000', fullAddress: 'Rua X' },
      new Set(['CANDIDATE', 'PROVIDER', 'CLIENT']),
    );
    expect(options).toEqual([]);
    expect(termState.loadTerm).not.toHaveBeenCalled();
  });
});
