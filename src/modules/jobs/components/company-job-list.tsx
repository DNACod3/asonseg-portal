import Link from 'next/link';
import { formatDate } from '@/shared/lib/time';
import { Badge, Button, Card } from '@/shared/ui';
import type { CompanyJobRowView } from '../views/company-job-row.view';

export interface CompanyJobListProps {
  empresaId: string;
  rows: CompanyJobRowView[];
}

/**
 * Lista de gestão de vagas da Empresa (USP-023 / T8 — painel). Cada vaga mostra
 * status (`Badge`) e ações contextuais por status (spec.md — Painel de gestão).
 *
 * T8 entrega a lista com "Editar"/"Enviar para moderação" navegáveis (rotas
 * reais); as ações leves de ciclo de vida (pausar/despausar/prorrogar/arquivar)
 * aparecem como placeholders — a T9 as cabeia aos Server Actions
 * (`pauseJob`/`unpauseJob`/`extendJobValidity`/`archiveJob`) num componente
 * cliente com confirmação para arquivar (padrão `EditCompanyForm`).
 */
export function CompanyJobList({ empresaId, rows }: CompanyJobListProps) {
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <p className="text-sm text-fg-muted">Sua Empresa ainda não publicou nenhuma vaga.</p>
        <Button variant="primary" asChild>
          <Link href={`/empresa/${empresaId}/vagas/nova`}>Publicar vaga</Link>
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
              {row.validUntil ? `Válida até ${formatDate(row.validUntil)}` : 'Sem data de validade'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {row.actions.canEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/empresa/${empresaId}/vagas/${row.id}/editar`}>Editar</Link>
              </Button>
            )}
            {row.actions.canSubmit && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/empresa/${empresaId}/vagas/${row.id}/editar`}>Enviar para moderação</Link>
              </Button>
            )}
            {row.actions.canPause && (
              <Button variant="outline" size="sm" disabled aria-disabled title="Ação disponível em breve">
                Pausar
              </Button>
            )}
            {row.actions.canUnpause && (
              <Button variant="outline" size="sm" disabled aria-disabled title="Ação disponível em breve">
                Despausar
              </Button>
            )}
            {row.actions.canExtend && (
              <Button variant="outline" size="sm" disabled aria-disabled title="Ação disponível em breve">
                Prorrogar
              </Button>
            )}
            {row.actions.canArchive && (
              <Button variant="danger" size="sm" disabled aria-disabled title="Ação disponível em breve">
                Arquivar
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
