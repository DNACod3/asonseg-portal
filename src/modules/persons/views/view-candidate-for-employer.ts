/**
 * View Model do candidato para a Empresa dona da vaga (USP-027 / CAN-03).
 *
 * Serializer **puro** (sem IO/Prisma): projeta uma candidatura+candidato para o
 * responsável de Empresa, expondo **só** nome+contato+CV+meta da candidatura.
 * `EmployerCandidateRow` é o `Row` mínimo que este serializer consome — a query
 * (`jobs/queries/list-job-applicants.ts`) faz o `select` explícito deste shape, que
 * **estruturalmente não contém** `cpf`/`birthDate`/`fullAddress` (USP027-MN-01):
 * é impossível vazá-los por engano de template, porque nem chegam a este arquivo.
 *
 * Molde: `viewJobForVisitor` (`jobs/views/job-list-item.view.ts`).
 */

/** Shape mínimo que o serializer consome — SEM `cpf`/`birthDate`/`fullAddress`. */
export interface EmployerCandidateRow {
  candidatePersonId: string;
  fullName: string;
  emailLogin: string | null;
  phone: string | null;
  appliedAt: Date;
  viaEncaminhamento: boolean;
  cvStoragePath: string | null;
  cvUploadedAt: Date | null;
  /** URL assinada já resolvida pela query (IO fica fora do View Model puro). */
  cvSignedUrl: string | null;
}

export interface EmployerCandidateView {
  candidatePersonId: string;
  fullName: string;
  contact: { email: string | null; phone: string | null };
  cv: { available: boolean; url: string | null; uploadedAt: Date | null };
  appliedAt: Date;
  viaEncaminhamento: boolean;
}

/**
 * Projeta a linha de candidatura para o View Model servido à Empresa.
 *
 * `cv.available` reflete se uma URL assinada foi de fato resolvida — não apenas
 * se `cvStoragePath` existe: se o storage estiver indisponível, a query já
 * resolve `cvSignedUrl=null` (try/catch), e este serializer projeta
 * `available=false` do mesmo jeito (degradação limpa, sem quebrar o item).
 */
export function viewCandidateForEmployer(row: EmployerCandidateRow): EmployerCandidateView {
  return {
    candidatePersonId: row.candidatePersonId,
    fullName: row.fullName,
    contact: { email: row.emailLogin, phone: row.phone },
    cv: {
      available: row.cvSignedUrl != null,
      url: row.cvSignedUrl,
      uploadedAt: row.cvUploadedAt,
    },
    appliedAt: row.appliedAt,
    viaEncaminhamento: row.viaEncaminhamento,
  };
}
