// Testes da máquina de estados de moderação (AC6 / #121).
// Derivados dos facts da USP-016 (tests/unit/usp-016-moderar-rascunho.spec.ts).
// Cada transição válida ✓ e uma amostra de inválidas ✗ por tipo; requiresJustification true/false.

import { describe, it, expect } from 'vitest';
import {
  ContentKind,
  ContentStatus,
  TRANSITIONS,
  isValidTransition,
  requiresJustification,
  findTransition,
} from '@/modules/moderation';

const { JOB, CV, SERVICE } = ContentKind;
const S = ContentStatus;

describe('USP-016 #121 — máquina de estados (TRANSITIONS + regras puras)', () => {
  describe('isValidTransition — transições válidas declaradas em TRANSITIONS', () => {
    it.each([
      [JOB, S.DRAFT, S.IN_MODERATION, 'AUTHOR_ACTION'],
      [JOB, S.IN_MODERATION, S.ACTIVE, 'MODERATOR_ACTION'],
      [JOB, S.IN_MODERATION, S.AWAITING_ADJUSTMENTS, 'MODERATOR_ACTION'],
      [JOB, S.IN_MODERATION, S.REJECTED, 'MODERATOR_ACTION'],
      [JOB, S.AWAITING_ADJUSTMENTS, S.IN_MODERATION, 'AUTHOR_ACTION'],
      [JOB, S.ACTIVE, S.EXPIRED, 'SYSTEM_JOB'], // só JOB
      [JOB, S.ACTIVE, S.INACTIVATED, 'COORDINATOR_INACTIVATION'],
      [CV, S.IN_MODERATION, S.ACTIVE, 'MODERATOR_ACTION'],
      [SERVICE, S.IN_MODERATION, S.ACTIVE, 'MODERATOR_ACTION'],
    ] as const)('aceita %s %s→%s (%s)', (kind, from, to, trigger) => {
      expect(isValidTransition(kind, from, to, trigger)).toBe(true);
    });

    it.each([
      [JOB, S.REJECTED, S.ACTIVE, 'MODERATOR_ACTION'],
      [JOB, S.ACTIVE, S.IN_MODERATION, 'MODERATOR_ACTION'],
      [JOB, S.DRAFT, S.ACTIVE, 'MODERATOR_ACTION'],
      [CV, S.ACTIVE, S.EXPIRED, 'SYSTEM_JOB'], // CV/SERVICE não têm EXPIRED
      [SERVICE, S.ACTIVE, S.EXPIRED, 'SYSTEM_JOB'],
      [JOB, S.IN_MODERATION, S.ACTIVE, 'AUTHOR_ACTION'], // trigger errado
    ] as const)('rejeita %s %s→%s (%s)', (kind, from, to, trigger) => {
      expect(isValidTransition(kind, from, to, trigger)).toBe(false);
    });
  });

  describe('requiresJustification — devolver/rejeitar/inativar exigem motivo', () => {
    it('exige justificativa em devolver/rejeitar/inativar', () => {
      expect(requiresJustification(JOB, S.IN_MODERATION, S.AWAITING_ADJUSTMENTS, 'MODERATOR_ACTION')).toBe(true);
      expect(requiresJustification(JOB, S.IN_MODERATION, S.REJECTED, 'MODERATOR_ACTION')).toBe(true);
      expect(requiresJustification(JOB, S.ACTIVE, S.INACTIVATED, 'COORDINATOR_INACTIVATION')).toBe(true);
    });

    it('não exige justificativa em aprovar/enviar/pausar', () => {
      expect(requiresJustification(JOB, S.IN_MODERATION, S.ACTIVE, 'MODERATOR_ACTION')).toBe(false);
      expect(requiresJustification(JOB, S.DRAFT, S.IN_MODERATION, 'AUTHOR_ACTION')).toBe(false);
      expect(requiresJustification(JOB, S.ACTIVE, S.PAUSED, 'AUTHOR_ACTION')).toBe(false);
    });

    it('retorna false (não lança) para transição inexistente', () => {
      expect(requiresJustification(JOB, S.REJECTED, S.ACTIVE, 'MODERATOR_ACTION')).toBe(false);
    });
  });

  describe('findTransition — regra casada ou null', () => {
    it('retorna a regra exata quando existe', () => {
      expect(findTransition(JOB, S.IN_MODERATION, S.REJECTED, 'MODERATOR_ACTION')).toMatchObject({
        from: S.IN_MODERATION,
        to: S.REJECTED,
        requiresJustification: true,
      });
    });

    it('retorna null quando a transição não está declarada', () => {
      expect(findTransition(JOB, S.DRAFT, S.ACTIVE, 'MODERATOR_ACTION')).toBeNull();
    });
  });

  describe('coerência da tabela', () => {
    it('CV e SERVICE não declaram EXPIRED; JOB declara', () => {
      expect(TRANSITIONS[JOB].some((r) => r.to === S.EXPIRED)).toBe(true);
      expect(TRANSITIONS[CV].some((r) => r.to === S.EXPIRED)).toBe(false);
      expect(TRANSITIONS[SERVICE].some((r) => r.to === S.EXPIRED)).toBe(false);
    });

    it('tipo de conteúdo sem tabela: findTransition é null e isValidTransition false (sem lançar)', () => {
      const bogus = 'UNKNOWN' as ContentKind;
      expect(findTransition(bogus, S.IN_MODERATION, S.ACTIVE, 'MODERATOR_ACTION')).toBeNull();
      expect(isValidTransition(bogus, S.IN_MODERATION, S.ACTIVE, 'MODERATOR_ACTION')).toBe(false);
      expect(requiresJustification(bogus, S.IN_MODERATION, S.ACTIVE, 'MODERATOR_ACTION')).toBe(false);
    });
  });
});
