import { z } from 'zod';
import { INCOME_BRACKETS, HOUSING_SITUATIONS } from '../domain/socioeconomic-record';

/**
 * Schema de entrada da ficha socioeconômica (USP-036 / SOC-01).
 *
 * Todos os 4 campos declarados são **opcionais** (edge case: "campos enviados
 * vazios/parciais THEN o sistema SHALL aceitar"). `personId` identifica a
 * Pessoa-alvo (a AS opera sobre outra Pessoa, diferente do padrão P-002 de
 * `candidateProfileSchema`).
 *
 * Campos de formulário (selects/inputs) chegam como `''` quando vazios, não
 * `undefined` — normaliza `''` (após trim) para `undefined` antes de validar,
 * mesmo padrão de `providerProfileSchema`.
 */
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const SOCIAL_BENEFIT_MAX = 200;
export const FAMILY_COMPOSITION_MAX = 500;

export const socioeconomicRecordSchema = z.object({
  personId: z.string().uuid('Pessoa inválida.'),
  incomeBracket: z.preprocess(
    emptyToUndefined,
    z.enum(INCOME_BRACKETS, { message: 'Selecione uma faixa de renda válida.' }).optional(),
  ),
  socialBenefit: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(SOCIAL_BENEFIT_MAX, `Máximo de ${SOCIAL_BENEFIT_MAX} caracteres.`)
      .optional(),
  ),
  housingSituation: z.preprocess(
    emptyToUndefined,
    z.enum(HOUSING_SITUATIONS, { message: 'Selecione uma situação de moradia válida.' }).optional(),
  ),
  familyComposition: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(FAMILY_COMPOSITION_MAX, `Máximo de ${FAMILY_COMPOSITION_MAX} caracteres.`)
      .optional(),
  ),
});

/** Tipo de entrada (o que o formulário/caller envia). */
export type SocioeconomicRecordInput = z.input<typeof socioeconomicRecordSchema>;
/** Tipo de saída (normalizado, após o parse). */
export type SocioeconomicRecordData = z.output<typeof socioeconomicRecordSchema>;
