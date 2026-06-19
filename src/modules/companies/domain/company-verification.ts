/**
 * Regras puras da verificação de Empresa (USP-017). Sem IO — o hook de moderação
 * carrega a Empresa **dentro do tx** (P-004 — dados vigentes, não do rascunho) e
 * delega a montagem do snapshot e o diff a estas funções (testáveis isoladamente).
 */

/** Campos identitários/de contato capturados no instante da verificação (L-002). */
export interface CompanyVerificationSnapshot {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  setor: string;
  endereco: string | null;
  /** Instante da captura (ISO). Igual ao `verifiedAt` da Empresa. */
  capturedAt: string;
}

/** Subconjunto da Empresa lido para montar o snapshot — espelha as colunas vigentes. */
export interface CompanyVerificationFields {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  setor: string;
  endereco: string | null;
}

/**
 * Monta o snapshot dos dados **vigentes** da Empresa no momento da verificação
 * (P-004 / L-002 / ADR-0008). Retido por toda a retenção; é a foto auditável de
 * "o que o coordenador verificou". `phone` não existe no model Company do MVP —
 * o contato fica fora do snapshot (sem coluna a capturar).
 */
export function buildVerificationSnapshot(
  company: CompanyVerificationFields,
  capturedAt: Date,
): CompanyVerificationSnapshot {
  return {
    cnpj: company.cnpj,
    razaoSocial: company.razaoSocial,
    nomeFantasia: company.nomeFantasia,
    setor: company.setor,
    endereco: company.endereco,
    capturedAt: capturedAt.toISOString(),
  };
}

/** Campos do snapshot comparáveis no diff (D-006) — exclui `capturedAt`. */
export type SnapshotField = Exclude<keyof CompanyVerificationSnapshot, 'capturedAt'>;

const DIFFABLE_FIELDS: readonly SnapshotField[] = [
  'cnpj',
  'razaoSocial',
  'nomeFantasia',
  'setor',
  'endereco',
];

/**
 * Campos alterados desde o snapshot da verificação anterior (D-006) — usado pela
 * UI da re-verificação (Empresa rebaixada por edição via USP-015) para destacar o
 * que mudou. Retorna `[]` quando não há snapshot anterior (1ª verificação) ou nada
 * mudou. `capturedAt` é ignorado (sempre difere).
 */
export function diffVerificationSnapshot(
  previous: CompanyVerificationSnapshot | null,
  current: CompanyVerificationFields,
): SnapshotField[] {
  if (!previous) return [];
  return DIFFABLE_FIELDS.filter((field) => previous[field] !== current[field]);
}
