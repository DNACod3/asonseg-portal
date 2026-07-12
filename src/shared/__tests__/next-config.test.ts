import { describe, expect, it } from 'vitest';
import { MAX_CV_BYTES } from '@/modules/cv-extraction';
import nextConfig from '../../../next.config';

/**
 * CAND-5 / RF-05 / RF-MN-04 — `next.config.ts` precisa liberar
 * `experimental.serverActions.bodySizeLimit` com folga sobre `MAX_CV_BYTES`
 * (CVE-01, 5 MB); o default do Next (1 MB) faz um CV válido de 1–5 MB estourar
 * o transporte (HTTP 413) antes de chegar à Server Action `uploadCv`.
 */

/** Converte um valor de `bodySizeLimit` (string `'6mb'`/`'512kb'` ou número em bytes) para bytes. */
function toBytes(limit: string | number): number {
  if (typeof limit === 'number') return limit;
  const match = /^(\d+(?:\.\d+)?)\s*(kb|mb|gb)$/i.exec(limit.trim());
  if (!match) throw new Error(`bodySizeLimit em formato inesperado: ${limit}`);
  const value = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const multiplier = unit === 'kb' ? 1024 : unit === 'mb' ? 1024 * 1024 : 1024 * 1024 * 1024;
  return value * multiplier;
}

describe('next.config.ts — serverActions.bodySizeLimit (CAND-5)', () => {
  it('define bodySizeLimit e mantém outputFileTracingRoot/Includes existentes', () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBeDefined();
    expect(nextConfig.outputFileTracingRoot).toBeDefined();
    expect(nextConfig.outputFileTracingIncludes).toBeDefined();
  });

  it('RF-MN-04: bodySizeLimit (bytes) >= MAX_CV_BYTES (5 MB, CVE-01)', () => {
    const limit = nextConfig.experimental!.serverActions!.bodySizeLimit!;
    expect(toBytes(limit)).toBeGreaterThanOrEqual(MAX_CV_BYTES);
  });

  it("bodySizeLimit é '6mb' (folga de ~1 MB sobre os 5 MB de CVE-01)", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe('6mb');
  });
});
