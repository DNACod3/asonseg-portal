import Link from 'next/link';
import { formatDateOnly } from '@/shared/lib/time';
import { Badge, Button, Card } from '@/shared/ui';
import { CompanyJobActions } from './company-job-actions';
import type { CompanyJobRowView } from '../views/company-job-row.view';

export interface CompanyJobListProps {
  empresaId: string;
  rows: CompanyJobRowView[];
}

/**
 * Lista de gestão de vagas da Empresa (USP-023 / T8-T9; USP-054 / EMP-2 / MOD-3 —
 * painel). Cada vaga mostra status (`Badge`) e ações contextuais por status
 * (spec.md — Painel de gestão): "Editar" é navegação (rota real, para
 * `DRAFT`/`AWAITING_ADJUSTMENTS`/`ACTIVE`); "Enviar"/"Reenviar para moderação"
 * (canSubmit — `DRAFT`/`AWAITING_ADJUSTMENTS`) e pausar/despausar/prorrogar/
 * arquivar são ações diretas via `CompanyJobActions` (componente cliente) — o
 * antigo `Link` de `canSubmit` para `.../editar` era um caminho errado (USP-054/
 * EMP-2: submeter não exige editar). `AWAITING_ADJUSTMENTS` também exibe o motivo
 * da última devolução (MOD-3), com fallback quando o registro legado não existe.
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
              {/* USP-024 / E-004 / P-003: sinal in-portal de validade próxima, independente do e-mail. */}
              {row.expiraEmDias != null && (
                <Badge variant="orange">
                  {row.expiraEmDias === 0
                    ? 'expira hoje'
                    : `expira em ${row.expiraEmDias} dia${row.expiraEmDias === 1 ? '' : 's'}`}
                </Badge>
              )}
            </div>
            <p className="text-xs text-fg-muted">
              {row.validUntil ? `Válida até ${formatDateOnly(row.validUntil)}` : 'Sem data de validade'}
            </p>
            {/* USP-054/MOD-3: motivo da última devolução, visível só p/ AWAITING_ADJUSTMENTS.
                Fallback neutro quando não há registro (USP054-E2 — nunca aborta a render). */}
            {row.status === 'AWAITING_ADJUSTMENTS' && (
              <p className="text-xs text-fg-muted">
                <span className="font-medium text-fg">Motivo da devolução:</span>{' '}
                {row.returnReason ?? 'Sem motivo registrado'}
              </p>
            )}
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              {row.actions.canEdit && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/empresa/${empresaId}/vagas/${row.id}/editar`}>Editar</Link>
                </Button>
              )}
            </div>
            <CompanyJobActions jobId={row.id} actions={row.actions} status={row.status} />
          </div>
        </Card>
      ))}
    </div>
  );
}
