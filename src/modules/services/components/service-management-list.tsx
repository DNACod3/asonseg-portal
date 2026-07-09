import Link from 'next/link';
import { formatDate } from '@/shared/lib/time';
import { Badge, Button, Card } from '@/shared/ui';
import { ServiceActions } from './service-actions';
import type { ProviderServiceRowView } from '../views/provider-service-row.view';

export interface ServiceManagementListProps {
  rows: ProviderServiceRowView[];
}

/**
 * Lista de gestão de serviços do prestador (USP-032 — painel). Cada serviço
 * mostra status (`Badge`) e ações contextuais por status: "Editar" é
 * navegação (rota real); pausar/retomar/arquivar são cabeadas aos Server
 * Actions via `ServiceActions` (componente cliente) com confirmação
 * hand-rolled para arquivar. Espelha `CompanyJobList`.
 */
export function ServiceManagementList({ rows }: ServiceManagementListProps) {
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <p className="text-sm text-fg-muted">Você ainda não publicou nenhum serviço.</p>
        <Button variant="primary" asChild>
          <Link href="/prestador/servicos/nova">Publicar serviço</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <Card key={row.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-fg">{row.title}</p>
              <Badge variant={row.badgeVariant}>{row.statusLabel}</Badge>
            </div>
            <p className="text-xs text-fg-muted">
              {row.publishedAt ? `Publicado em ${formatDate(row.publishedAt)}` : 'Ainda não publicado'}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            {row.actions.canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/prestador/servicos/${row.id}/editar`}>Editar</Link>
              </Button>
            )}
            <ServiceActions serviceId={row.id} actions={row.actions} />
          </div>
        </Card>
      ))}
    </div>
  );
}
