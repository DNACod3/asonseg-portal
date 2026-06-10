// Schemas de decisão de moderação (#123 / P-003).
import { describe, it, expect } from 'vitest';
import { ContentKind } from '@/modules/moderation';
import { approveSchema, returnForAdjustmentsSchema, rejectSchema } from '../decision';

const CONTENT_ID = '00000000-0000-0000-0000-000000000010';
const ref = { contentKind: ContentKind.JOB, contentId: CONTENT_ID };

describe('USP-016 #123 — schema de decisão (P-003 motivo significativo)', () => {
  it('approve não exige motivo', () => {
    expect(approveSchema.safeParse(ref).success).toBe(true);
  });

  it('approve rejeita contentId não-uuid', () => {
    expect(approveSchema.safeParse({ ...ref, contentId: 'abc' }).success).toBe(false);
  });

  it.each(['', 'x', '—', 'ok', 'ajustar', '   ', '------------------------'])(
    'devolver/rejeitar rejeita motivo insignificante "%s"',
    (motivo) => {
      expect(returnForAdjustmentsSchema.safeParse({ ...ref, justification: motivo }).success).toBe(false);
      expect(rejectSchema.safeParse({ ...ref, justification: motivo }).success).toBe(false);
    },
  );

  it('devolver/rejeitar aceita motivo ≥ 20 caracteres significativos', () => {
    const motivo = 'Faltou descrever as atividades exercidas no cargo anterior';
    expect(returnForAdjustmentsSchema.safeParse({ ...ref, justification: motivo }).success).toBe(true);
    expect(rejectSchema.safeParse({ ...ref, justification: motivo }).success).toBe(true);
  });

  it('mensagem de erro do motivo é PT-BR', () => {
    const res = rejectSchema.safeParse({ ...ref, justification: 'curto' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toMatch(/caracteres/i);
    }
  });
});
