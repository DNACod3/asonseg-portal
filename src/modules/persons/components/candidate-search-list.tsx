import { Badge, Card } from '@/shared/ui';
import type { SearchCandidateView } from '../views/view-candidate-for-search';

export interface CandidateSearchListProps {
  items: SearchCandidateView[];
}

/**
 * Lista de cards da busca ativa de candidatos (USP-028 / T5). Consome **só**
 * `SearchCandidateView[]` — nunca a linha crua do Prisma (USP028-MN-05): o
 * componente não tem como enxergar `fullName`/`cpf`/`emailLogin`/`phone`/
 * `fullAddress`/`cvStoragePath` porque eles nem chegam a este tipo.
 */
export function CandidateSearchList({ items }: Readonly<CandidateSearchListProps>) {
  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-fg-muted">Nenhum candidato encontrado.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <Card key={item.candidatePersonId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-fg">{item.firstName}</p>
            {item.primaryArea && <Badge variant="gray">{item.primaryArea}</Badge>}
          </div>

          <p className="text-sm text-fg-muted">{item.location ?? 'Região não informada'}</p>

          {item.educationLevelLabel && (
            <p className="text-sm text-fg-muted">{item.educationLevelLabel}</p>
          )}

          {item.qualificationsSummary && (
            <p className="text-sm text-fg">{item.qualificationsSummary}</p>
          )}
        </Card>
      ))}
    </div>
  );
}
