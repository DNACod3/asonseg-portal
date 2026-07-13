/**
 * Fonte única de rótulos PT-BR e ordem de exibição dos tipos de Empresa
 * (EMP-4 / USP-055). Client-safe: não importa `@prisma/client` nem código
 * server — união de literais local (padrão `EDUCATION_LEVELS` em
 * `persons/domain/candidate.ts`, AD-019), para não arrastar Prisma ao bundle
 * do client. Consumida por `CreateCompanyForm` e `EditCompanyForm` (fonte
 * única evita re-divergência enum↔UI).
 */

/** Os 5 valores do enum `CompanyType` (`prisma/schema.prisma`), duplicados aqui de propósito (client-safe). */
export const COMPANY_TYPES = [
  'MEI',
  'SIMPLES_NACIONAL',
  'LUCRO_PRESUMIDO',
  'LUCRO_REAL',
  'SA',
] as const;

export type CompanyType = (typeof COMPANY_TYPES)[number];

/** Rótulos PT-BR de exibição — expansões canônicas do regime fiscal/tipo societário (USP-010/ADR-0031). */
export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  MEI: 'MEI (Microempreendedor Individual)',
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  SA: 'Sociedade Anônima (S.A.)',
};

/** Opções ordenadas para renderização dos radios de "Tipo" nos forms de Empresa. */
export const COMPANY_TYPE_OPTIONS: ReadonlyArray<{ value: CompanyType; label: string }> =
  COMPANY_TYPES.map((value) => ({ value, label: COMPANY_TYPE_LABELS[value] }));
