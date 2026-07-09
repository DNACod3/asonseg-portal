import { describe, expect, it, vi } from 'vitest';

/**
 * `revalidateHomeIndicators` (USP-041 / T6 — E-002/D-005). Mocka
 * `next/cache` (fora de request, `revalidatePath` real lançaria).
 */
const revalidatePathSpy = vi.hoisted(() => vi.fn());

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathSpy,
}));

const { revalidateHomeIndicators } = await import('../server/revalidate-home');

describe('revalidateHomeIndicators', () => {
  it('chama revalidatePath com "/" (a home pública)', () => {
    revalidatePathSpy.mockClear();

    revalidateHomeIndicators();

    expect(revalidatePathSpy).toHaveBeenCalledTimes(1);
    expect(revalidatePathSpy).toHaveBeenCalledWith('/');
  });
});
