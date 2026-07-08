import { firstNameOf } from '../domain/candidate-display';
import { EDUCATION_LEVEL_LABELS, type EducationLevel } from '../domain/candidate';

/**
 * View Model do candidato para a busca ativa da Empresa (USP-028 / CAN-04).
 *
 * Serializer **puro** (sem IO/Prisma): projeta um candidato para a Empresa que
 * ainda **não** tem relação de candidatura com ele — por isso expõe **só** dados
 * não sensíveis (primeiro nome, cidade/região, área, escolaridade, resumo).
 * `SearchCandidateRow` é o `Row` mínimo que este serializer consome — a query
 * (`persons/queries/search-candidates.ts`) faz o `select` explícito deste shape,
 * que **estruturalmente não contém** `cpf`/`emailLogin`/`phone`/`fullAddress`/
 * `cvStoragePath` (USP028-MN-01): é impossível vazá-los por engano de template.
 * `fullName` é carregado só para derivar o primeiro nome — **nunca** é emitido
 * (USP028-MN-02).
 *
 * Molde: `viewJobForVisitor` (`jobs/views/job-list-item.view.ts`).
 */

/** Teto de caracteres do resumo de qualificações quando cai no fallback (`skillsText`). */
export const QUALIFICATIONS_SUMMARY_MAX = 200;

/** Shape mínimo que o serializer consome — SEM cpf/emailLogin/phone/fullAddress/cv*. */
export interface SearchCandidateRow {
  personId: string;
  /** Usado só p/ derivar o primeiro nome — NUNCA emitido no View Model. */
  fullName: string;
  headline: string | null;
  skillsText: string | null;
  educationLevel: string | null;
  availability: string | null;
  primaryAreaOfInterest: { name: string } | null;
  region: { name: string; cityName: string } | null;
}

export interface SearchCandidateView {
  candidatePersonId: string;
  firstName: string;
  primaryArea: string | null;
  educationLevel: string | null;
  educationLevelLabel: string | null;
  /** `"${cityName} — ${name}"`, ou `null` quando o candidato não tem região. */
  location: string | null;
  availability: string | null;
  /** `headline` (resumo curto) — se ausente, cai para `skillsText` truncado. */
  qualificationsSummary: string | null;
}

/** `headline` (resumo próprio) se presente; senão `skillsText` truncado em {@link QUALIFICATIONS_SUMMARY_MAX}. */
function qualificationsSummaryOf(row: Pick<SearchCandidateRow, 'headline' | 'skillsText'>): string | null {
  if (row.headline) return row.headline;
  if (!row.skillsText) return null;
  return row.skillsText.length > QUALIFICATIONS_SUMMARY_MAX
    ? `${row.skillsText.slice(0, QUALIFICATIONS_SUMMARY_MAX)}…`
    : row.skillsText;
}

/** Rótulo PT-BR da escolaridade, ou `null` quando o valor não está na taxonomia conhecida. */
function educationLevelLabelOf(educationLevel: string | null): string | null {
  if (!educationLevel) return null;
  return EDUCATION_LEVEL_LABELS[educationLevel as EducationLevel] ?? null;
}

export function viewCandidateForSearch(row: SearchCandidateRow): SearchCandidateView {
  return {
    candidatePersonId: row.personId,
    firstName: firstNameOf(row.fullName),
    primaryArea: row.primaryAreaOfInterest?.name ?? null,
    educationLevel: row.educationLevel,
    educationLevelLabel: educationLevelLabelOf(row.educationLevel),
    location: row.region ? `${row.region.cityName} — ${row.region.name}` : null,
    availability: row.availability,
    qualificationsSummary: qualificationsSummaryOf(row),
  };
}
