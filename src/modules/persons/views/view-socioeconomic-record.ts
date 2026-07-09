import type { IncomeBracket, HousingSituation } from '../domain/socioeconomic-record';

/**
 * View Model puro (sem IO) da ficha socioeconômica (USP-036 / SOC-01).
 *
 * `SocioeconomicRow` é o shape mínimo que este serializer consome — a query
 * (`queries/get-socioeconomic-record.ts`) faz o `select` explícito deste shape,
 * estruturalmente só com os campos da ficha (sem nada cross-Person). Reusável
 * pela USP-039 (`viewPersonForSocialAssistant`), que compõe este View Model.
 *
 * Molde: `view-candidate-for-employer.ts`.
 */
export interface SocioeconomicRow {
  personId: string;
  incomeBracket: IncomeBracket | null;
  socialBenefit: string | null;
  housingSituation: HousingSituation | null;
  familyComposition: string | null;
  updatedAt: Date | null;
  updatedByPersonId: string | null;
}

export interface SocioeconomicRecordView {
  personId: string;
  incomeBracket: IncomeBracket | null;
  socialBenefit: string | null;
  housingSituation: HousingSituation | null;
  familyComposition: string | null;
  updatedAt: Date | null;
  updatedByPersonId: string | null;
}

/** Projeta a linha da ficha para o View Model servido a AS/BOARD. */
export function viewSocioeconomicRecord(row: SocioeconomicRow): SocioeconomicRecordView {
  return {
    personId: row.personId,
    incomeBracket: row.incomeBracket,
    socialBenefit: row.socialBenefit,
    housingSituation: row.housingSituation,
    familyComposition: row.familyComposition,
    updatedAt: row.updatedAt,
    updatedByPersonId: row.updatedByPersonId,
  };
}
