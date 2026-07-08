// Schema de inativação administrativa (USP-018 / INACT-02 / INACT-MN-02).
import { describe, it, expect } from 'vitest';
import { ContentKind } from '@/modules/moderation';
import { inactivateSchema } from '../inactivate';

const CONTENT_ID = '00000000-0000-0000-0000-000000000010';
const ref = { contentKind: ContentKind.JOB, contentId: CONTENT_ID };

describe('USP-018 — inactivateSchema (motivo obrigatório e significativo)', () => {
  it('aceita motivo ≥ 20 caracteres significativos', () => {
    const motivo = 'Vaga enganosa, empresa não localizada no endereço informado';
    expect(inactivateSchema.safeParse({ ...ref, justification: motivo }).success).toBe(true);
  });

  it('rejeita motivo ausente', () => {
    expect(inactivateSchema.safeParse(ref).success).toBe(false);
  });

  it.each(['', 'x', '—', 'ok', '   ', '------------------------'])(
    'rejeita motivo insignificante "%s"',
    (motivo) => {
      expect(inactivateSchema.safeParse({ ...ref, justification: motivo }).success).toBe(false);
    },
  );

  it('rejeita motivo com menos de 20 caracteres', () => {
    expect(inactivateSchema.safeParse({ ...ref, justification: 'curto demais' }).success).toBe(false);
  });

  it('rejeita contentId não-uuid', () => {
    const motivo = 'Vaga enganosa, empresa não localizada no endereço informado';
    expect(
      inactivateSchema.safeParse({ contentKind: ContentKind.JOB, contentId: 'abc', justification: motivo })
        .success,
    ).toBe(false);
  });
});
