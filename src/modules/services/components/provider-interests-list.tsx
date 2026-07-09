import { formatDate } from '@/shared/lib/time';
import { Card } from '@/shared/ui';
import type { ProviderInterestView } from '../views/client-for-provider.view';

export interface ProviderInterestsListProps {
  items: ProviderInterestView[];
}

/**
 * Lista de manifestações de interesse recebidas por um prestador (USP-035 —
 * T2). Espelha `JobApplicantsList` (empregador vê candidatos). Consome **só**
 * `ProviderInterestView[]` — nunca a linha crua do Prisma (AC-035-2): o
 * componente não tem como enxergar `cpf`/`birthDate`/`fullAddress` porque nem
 * chegam a este tipo.
 */
export function ProviderInterestsList({ items }: Readonly<ProviderInterestsListProps>) {
  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-fg-muted">Nenhuma manifestação ainda.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <Card key={item.interestId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-fg">{item.clientName}</p>
            <span className="text-xs text-fg-muted">{item.service.title}</span>
          </div>

          <dl className="grid grid-cols-1 gap-1 text-sm text-fg-muted sm:grid-cols-2">
            <div>
              <dt className="sr-only">E-mail</dt>
              <dd>{item.contact.email ?? 'não informado'}</dd>
            </div>
            <div>
              <dt className="sr-only">Telefone</dt>
              <dd>{item.contact.phone ?? 'não informado'}</dd>
            </div>
          </dl>

          <time dateTime={item.interestedAt.toISOString()} className="text-sm text-fg-muted">
            Manifestou interesse em {formatDate(item.interestedAt)}
          </time>
        </Card>
      ))}
    </div>
  );
}
