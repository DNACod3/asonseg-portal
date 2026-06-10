/**
 * Regras puras do cadastro de candidato (USP-009 / CAD-01).
 *
 * Sem IO — apenas taxonomia de escolaridade e normalização de telefone. Isolar
 * aqui mantém a regra testável sem banco e reaproveitável pela Server Action e
 * pelo schema Zod (`schemas/candidate.ts`).
 */

/**
 * Níveis de escolaridade aceitos no perfil de candidato. Mantidos como `string`
 * no banco (`CandidateProfile.educationLevel`) — a obrigatoriedade e o domínio de
 * valores são validados na fronteira (Zod), evitando migration por mudança de
 * taxonomia.
 */
export const EDUCATION_LEVELS = [
  'ENSINO_FUNDAMENTAL',
  'ENSINO_MEDIO',
  'ENSINO_TECNICO',
  'ENSINO_SUPERIOR',
  'POS_GRADUACAO',
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

/** Rótulos PT-BR para exibição na UI (sem i18n no MVP). */
export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  ENSINO_FUNDAMENTAL: 'Ensino Fundamental',
  ENSINO_MEDIO: 'Ensino Médio',
  ENSINO_TECNICO: 'Ensino Técnico',
  ENSINO_SUPERIOR: 'Ensino Superior',
  POS_GRADUACAO: 'Pós-graduação',
};

/**
 * Normaliza um telefone brasileiro para apenas dígitos (remove espaços,
 * parênteses, hífens e o prefixo `+`). Ex.: `"(11) 98888-7777"` → `"11988887777"`.
 * Não valida tamanho — isso é responsabilidade do schema Zod.
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}
