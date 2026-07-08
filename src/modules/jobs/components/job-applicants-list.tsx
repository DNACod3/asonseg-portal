import { formatSaoPaulo } from '@/shared/lib/time';
import { Badge, Card } from '@/shared/ui';
import type { EmployerCandidateView } from '@/modules/persons';

export interface JobApplicantsListProps {
  applicants: EmployerCandidateView[];
}

/**
 * Lista de candidatos de uma vaga para o responsável de Empresa (USP-027 / T4).
 * Consome **só** `EmployerCandidateView[]` — nunca a linha crua do Prisma
 * (USP027-MN-05): o componente não tem como enxergar `cpf`/`birthDate`/
 * `fullAddress` porque eles nem chegam a este tipo.
 */
export function JobApplicantsList({ applicants }: Readonly<JobApplicantsListProps>) {
  if (applicants.length === 0) {
    return (
      <Card>
        <p className="text-sm text-fg-muted">Nenhuma candidatura ativa.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {applicants.map((applicant) => (
        <Card key={applicant.candidatePersonId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-fg">{applicant.fullName}</p>
            {applicant.viaEncaminhamento && (
              <Badge variant="blue">Candidato encaminhado pela ASONSEG</Badge>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-1 text-sm text-fg-muted sm:grid-cols-2">
            <div>
              <dt className="sr-only">E-mail</dt>
              <dd>{applicant.contact.email ?? 'não informado'}</dd>
            </div>
            <div>
              <dt className="sr-only">Telefone</dt>
              <dd>{applicant.contact.phone ?? 'não informado'}</dd>
            </div>
          </dl>

          <div className="flex items-center justify-between text-sm">
            {applicant.cv.available && applicant.cv.url ? (
              <a
                href={applicant.cv.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Ver currículo
              </a>
            ) : (
              <span className="text-fg-muted">Currículo não disponível</span>
            )}
            <time dateTime={applicant.appliedAt.toISOString()} className="text-fg-muted">
              Candidatou-se em {formatSaoPaulo(applicant.appliedAt)}
            </time>
          </div>
        </Card>
      ))}
    </div>
  );
}
