import { describe, it, expect } from 'vitest';
import { ContentStatus } from '@/modules/moderation';
import { CONTENT_STATUS_LABELS, MANIFESTATIONS_STATUS_LABEL, labelContentStatus } from '../domain/report-labels';

/**
 * USP-058/T1 (REL-3, G2) — guard de completude do mapa de rótulos PT-BR de
 * `ContentStatus` (USP058-15/MN-01) + comportamento de `labelContentStatus`.
 */

describe('CONTENT_STATUS_LABELS — guard de completude (USP058-15 / MN-01)', () => {
  it('cobre 1:1 todo valor de ContentStatus — nenhum token cru sem rótulo', () => {
    const enumValues = Object.values(ContentStatus);
    for (const value of enumValues) {
      expect(CONTENT_STATUS_LABELS).toHaveProperty(value);
      expect(typeof CONTENT_STATUS_LABELS[value]).toBe('string');
      expect(CONTENT_STATUS_LABELS[value].length).toBeGreaterThan(0);
      // Nunca o próprio token cru como "rótulo" (provaria que o mapa não traduz).
      expect(CONTENT_STATUS_LABELS[value]).not.toBe(value);
    }
  });

  it('mapa não tem chaves extras além do enum (exaustivo, não superconjunto)', () => {
    const enumValues = new Set(Object.values(ContentStatus) as string[]);
    for (const key of Object.keys(CONTENT_STATUS_LABELS)) {
      expect(enumValues.has(key)).toBe(true);
    }
  });

  it('rótulos PT-BR canônicos (idênticos ao map de services/views/provider-service-row.view.ts — spec A1)', () => {
    expect(CONTENT_STATUS_LABELS.DRAFT).toBe('Rascunho');
    expect(CONTENT_STATUS_LABELS.IN_MODERATION).toBe('Em moderação');
    expect(CONTENT_STATUS_LABELS.AWAITING_ADJUSTMENTS).toBe('Aguardando ajustes');
    expect(CONTENT_STATUS_LABELS.ACTIVE).toBe('Ativo');
    expect(CONTENT_STATUS_LABELS.REJECTED).toBe('Rejeitado');
    expect(CONTENT_STATUS_LABELS.PAUSED).toBe('Pausado');
    expect(CONTENT_STATUS_LABELS.EXPIRED).toBe('Expirado');
    expect(CONTENT_STATUS_LABELS.ARCHIVED).toBe('Arquivado');
    expect(CONTENT_STATUS_LABELS.INACTIVATED).toBe('Inativado');
  });
});

describe('MANIFESTATIONS_STATUS_LABEL', () => {
  it('é o rótulo PT-BR do marcador sintético de manifestações (R3/MP7)', () => {
    expect(MANIFESTATIONS_STATUS_LABEL).toBe('Manifestações de interesse');
  });
});

describe('labelContentStatus — fallback nunca lança (USP058-15)', () => {
  it('resolve o rótulo PT-BR para cada valor válido de ContentStatus', () => {
    expect(labelContentStatus('ACTIVE')).toBe('Ativo');
    expect(labelContentStatus('IN_MODERATION')).toBe('Em moderação');
  });

  it('valor fora do mapa (enum futuro sem rótulo) → devolve o próprio token, nunca lança', () => {
    expect(() => labelContentStatus('SOME_FUTURE_STATUS')).not.toThrow();
    expect(labelContentStatus('SOME_FUTURE_STATUS')).toBe('SOME_FUTURE_STATUS');
  });
});
