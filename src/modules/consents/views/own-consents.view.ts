import type { ConsentPurpose } from '../domain/purposes';
import { purposeMetadata } from '../domain/purposes';
import { isCurrentTermVersion, normalizeTermVersion } from '../domain/terms-registry';
import type { OwnConsentRow } from '../queries/list-own-consents';

/**
 * View Model do painel "Meus consentimentos" (E-003 / P-005). Mostra nome humano
 * da finalidade, descrição e base legal — nunca apenas o código (P-005).
 *
 * Função **pura** (sem IO): mapeia as linhas do próprio titular para exibição,
 * derivando o status de cada registro.
 */
export type OwnConsentStatus = 'vigente' | 'revogado' | 'desatualizado';

export interface OwnConsentView {
  readonly consentId: string;
  readonly purpose: ConsentPurpose;
  readonly humanName: string;
  readonly description: string;
  readonly legalBasis: string;
  readonly termVersion: string;
  readonly acceptedAt: Date;
  readonly revokedAt: Date | null;
  /** `vigente` (ativo na versão atual) · `desatualizado` (re-aceite — E-005) · `revogado`. */
  readonly status: OwnConsentStatus;
}

function statusOf(row: OwnConsentRow): OwnConsentStatus {
  if (row.revokedAt) return 'revogado';
  return isCurrentTermVersion(row.purpose, row.termVersion) ? 'vigente' : 'desatualizado';
}

/** Mapeia as linhas de consentimento do titular para o View Model do painel. */
export function buildOwnConsentsView(rows: readonly OwnConsentRow[]): OwnConsentView[] {
  return rows.map((row) => {
    const meta = purposeMetadata(row.purpose);
    return {
      consentId: row.id,
      purpose: row.purpose,
      humanName: meta.humanName,
      description: meta.description,
      legalBasis: meta.legalBasis,
      termVersion: normalizeTermVersion(row.termVersion),
      acceptedAt: row.acceptedAt,
      revokedAt: row.revokedAt,
      status: statusOf(row),
    };
  });
}
