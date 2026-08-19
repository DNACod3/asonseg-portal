// Unit de `drift`/`bucketOptions` (B5/PR#294) — promovidos de
// `scripts/ensure-buckets.ts`, onde eram a única lógica pura do script e a
// única inalcançável por teste (o topo do script roda `requireEnv()` +
// `createClient()`, então importar o arquivo num teste lançava antes de
// chegar em `drift`). Aqui, sem IO, os 4 ramos ficam diretamente testáveis.

import { describe, it, expect } from 'vitest';
import { drift, bucketOptions, STORAGE_BUCKETS, type StorageBucketSpec } from '../storage-buckets';

const spec: StorageBucketSpec = {
  name: STORAGE_BUCKETS.CVS,
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ['application/pdf', 'application/msword'],
};

describe('drift (B5/PR#294)', () => {
  it('sem divergência ⇒ []', () => {
    const diffs = drift(
      {
        name: spec.name,
        public: false,
        file_size_limit: spec.fileSizeLimit,
        allowed_mime_types: ['application/pdf', 'application/msword'],
      },
      spec,
    );
    expect(diffs).toEqual([]);
  });

  it('MIMEs em ordem diferente ⇒ sem divergência (comparação ordena antes de comparar)', () => {
    const diffs = drift(
      {
        name: spec.name,
        public: false,
        file_size_limit: spec.fileSizeLimit,
        allowed_mime_types: ['application/msword', 'application/pdf'],
      },
      spec,
    );
    expect(diffs).toEqual([]);
  });

  it('visibilidade (public) divergente ⇒ reporta o diff', () => {
    const diffs = drift(
      { name: spec.name, public: true, file_size_limit: spec.fileSizeLimit, allowed_mime_types: [...spec.allowedMimeTypes] },
      spec,
    );
    expect(diffs).toEqual(['public: true → false']);
  });

  it('file_size_limit divergente (incl. remoto nulo) ⇒ reporta o diff', () => {
    const diffs = drift(
      { name: spec.name, public: false, file_size_limit: null, allowed_mime_types: [...spec.allowedMimeTypes] },
      spec,
    );
    expect(diffs).toEqual([`file_size_limit: null → ${spec.fileSizeLimit}`]);
  });

  it('MIMEs efetivamente divergentes ⇒ reporta o diff', () => {
    const diffs = drift(
      {
        name: spec.name,
        public: false,
        file_size_limit: spec.fileSizeLimit,
        allowed_mime_types: ['application/pdf'],
      },
      spec,
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatch(/allowed_mime_types/);
  });

  it('múltiplos campos divergentes ⇒ reporta todos', () => {
    const diffs = drift(
      { name: spec.name, public: true, file_size_limit: 1, allowed_mime_types: [] },
      spec,
    );
    expect(diffs).toHaveLength(3);
  });
});

describe('bucketOptions (B5/PR#294)', () => {
  it('mapeia a spec para o shape do SDK (camelCase, cópia defensiva do array)', () => {
    const opts = bucketOptions(spec);
    expect(opts).toEqual({
      public: false,
      fileSizeLimit: spec.fileSizeLimit,
      allowedMimeTypes: ['application/pdf', 'application/msword'],
    });
    expect(opts.allowedMimeTypes).not.toBe(spec.allowedMimeTypes); // cópia, não referência
  });
});
