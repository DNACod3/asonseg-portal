// Domain puro + schemas de sugestão de taxonomia (USP-019 / T2).
import { describe, it, expect } from 'vitest';
import { foldForDedup, TAXONOMY_NAME_MIN, TAXONOMY_NAME_MAX } from '../domain/taxonomy-suggestion';
import { suggestTaxonomySchema, resolveTaxonomySuggestionSchema } from '../schemas/taxonomy-suggestion';

describe('USP-019 — foldForDedup (SUGG-05/SUGG-MN-03)', () => {
  it('normaliza caso, acento e espaços internos/externos para o mesmo valor', () => {
    const target = foldForDedup('Tecnologia');
    expect(foldForDedup('tecnologia')).toBe(target);
    expect(foldForDedup('tecnologìa')).toBe(target);
    expect(foldForDedup('  tecnologia  ')).toBe(target);
    expect(foldForDedup('Tecno   logia')).toBe(foldForDedup('tecno logia'));
  });

  it('distingue nomes semanticamente diferentes ("TI" vs "Tecnologia")', () => {
    expect(foldForDedup('TI')).not.toBe(foldForDedup('Tecnologia'));
  });

  it('é determinístico (mesma entrada, mesma saída)', () => {
    expect(foldForDedup('Comércio')).toBe(foldForDedup('Comércio'));
  });
});

describe('USP-019 — suggestTaxonomySchema (edges de tamanho/vazio)', () => {
  it('aceita nome válido (2..60 chars) para JOB_AREA e SERVICE_CATEGORY', () => {
    expect(suggestTaxonomySchema.safeParse({ kind: 'JOB_AREA', name: 'Jardinagem' }).success).toBe(true);
    expect(suggestTaxonomySchema.safeParse({ kind: 'SERVICE_CATEGORY', name: 'Jardinagem' }).success).toBe(
      true,
    );
  });

  it('rejeita nome vazio, só espaços, ou 1 caractere', () => {
    expect(suggestTaxonomySchema.safeParse({ kind: 'JOB_AREA', name: '' }).success).toBe(false);
    expect(suggestTaxonomySchema.safeParse({ kind: 'JOB_AREA', name: '   ' }).success).toBe(false);
    expect(suggestTaxonomySchema.safeParse({ kind: 'JOB_AREA', name: 'x' }).success).toBe(false);
  });

  it('rejeita nome acima do limite (60 chars)', () => {
    const tooLong = 'x'.repeat(TAXONOMY_NAME_MAX + 1);
    expect(suggestTaxonomySchema.safeParse({ kind: 'JOB_AREA', name: tooLong }).success).toBe(false);
  });

  it('aceita exatamente no limite mínimo e máximo (inclusivo)', () => {
    expect(
      suggestTaxonomySchema.safeParse({ kind: 'JOB_AREA', name: 'x'.repeat(TAXONOMY_NAME_MIN) }).success,
    ).toBe(true);
    expect(
      suggestTaxonomySchema.safeParse({ kind: 'JOB_AREA', name: 'x'.repeat(TAXONOMY_NAME_MAX) }).success,
    ).toBe(true);
  });

  it('rejeita kind inválido', () => {
    expect(suggestTaxonomySchema.safeParse({ kind: 'BOGUS', name: 'Jardinagem' }).success).toBe(false);
  });
});

describe('USP-019 — resolveTaxonomySuggestionSchema (approve/reject)', () => {
  const ID = '00000000-0000-0000-0000-000000000010';

  it('aceita sem motivo (aprovar não exige motivo; rejeitar tem motivo opcional)', () => {
    expect(resolveTaxonomySuggestionSchema.safeParse({ kind: 'JOB_AREA', id: ID }).success).toBe(true);
  });

  it('aceita com motivo (≤280 chars)', () => {
    expect(
      resolveTaxonomySuggestionSchema.safeParse({ kind: 'JOB_AREA', id: ID, reason: 'Duplicata de Tecnologia' })
        .success,
    ).toBe(true);
  });

  it('rejeita id não-uuid', () => {
    expect(resolveTaxonomySuggestionSchema.safeParse({ kind: 'JOB_AREA', id: 'nope' }).success).toBe(false);
  });

  it('rejeita motivo acima de 280 chars', () => {
    expect(
      resolveTaxonomySuggestionSchema.safeParse({ kind: 'JOB_AREA', id: ID, reason: 'x'.repeat(281) }).success,
    ).toBe(false);
  });
});
