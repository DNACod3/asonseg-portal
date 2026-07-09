import { describe, expect, it } from 'vitest';
import { revalidate } from '@/app/(public)/page';

/**
 * Guard estático do TTL de cache da home pública (USP-041 / T3 —
 * REL41-MN-03 / E-002). A home NÃO PODE manter TTL acima da janela acordada
 * (600s, D-012). Este teste fixa a constante em código: se alguém trocar
 * `export const revalidate = 600` por um valor maior (ou `false`, que
 * desativa o ISR), a asserção abaixo fica vermelha — mutação viva.
 *
 * Padrão de guard estático do repo (mesma família de `no-external-verify.
 * test.ts` / `DS-MN-*`): não exercita comportamento, só fixa uma invariante
 * estrutural do arquivo de rota.
 */
describe('REL41-MN-03 — guard estático do TTL ISR da home pública', () => {
  it('`revalidate` exportado por app/(public)/page.tsx é numérico, positivo e <= 600s', () => {
    expect(typeof revalidate).toBe('number');
    expect(revalidate).toBeGreaterThan(0);
    expect(revalidate).toBeLessThanOrEqual(600);
  });

  it('negativo (REL41-MN-03): documenta a mutação que quebraria o guard — 86400 (24h) ou false não passam', () => {
    // `revalidate = 86400` (24h) ou `revalidate = false` (sem ISR, cache
    // indefinido) violam a janela acordada — a asserção acima é o
    // discriminador; este teste só documenta o cenário de mutação vivo.
    const oneDayInSeconds = 86400;
    expect(oneDayInSeconds).toBeGreaterThan(600);
    expect(revalidate).not.toBe(false);
    expect(revalidate).not.toBe(oneDayInSeconds);
  });
});
