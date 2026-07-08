'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
// Server Actions importadas direto pelo caminho relativo (dentro do próprio
// módulo `services` — não cruza barrel de outro módulo, então
// `no-restricted-imports` não se aplica; mesmo padrão de `CompanyJobActions`).
import { pauseService } from '../actions/pause-service';
import { resumeService } from '../actions/resume-service';
import { archiveService } from '../actions/archive-service';
import type { ProviderServiceRowActions as RowActions } from '../views/provider-service-row.view';
import { Button } from '@/shared/ui';

export interface ServiceActionsProps {
  serviceId: string;
  actions: RowActions;
}

/**
 * Ações leves de ciclo de vida do serviço na lista de gestão (USP-032):
 * pausar/retomar via `Button`; arquivar via `Button variant="danger"` +
 * confirmação hand-rolled (padrão `CompanyJobActions`, `role="dialog"
 * aria-modal`, terminal). `router.refresh()` em todo sucesso para a lista
 * refletir o novo status/badge.
 */
export function ServiceActions({ serviceId, actions }: ServiceActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!confirmArchive) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) setConfirmArchive(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmArchive, isPending]);

  function runPause() {
    setError(null);
    startTransition(async () => {
      const res = await pauseService({ serviceId });
      if (!res.ok) setError(res.error.message);
      else router.refresh();
    });
  }

  function runResume() {
    setError(null);
    startTransition(async () => {
      const res = await resumeService({ serviceId });
      if (!res.ok) setError(res.error.message);
      else router.refresh();
    });
  }

  function runArchive() {
    setError(null);
    startTransition(async () => {
      const res = await archiveService({ serviceId });
      if (!res.ok) setError(res.error.message);
      else {
        setConfirmArchive(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {actions.canPause && (
          <Button variant="outline" size="sm" onClick={runPause} disabled={isPending}>
            {isPending ? 'Pausando…' : 'Pausar'}
          </Button>
        )}
        {actions.canResume && (
          <Button variant="outline" size="sm" onClick={runResume} disabled={isPending}>
            {isPending ? 'Retomando…' : 'Retomar'}
          </Button>
        )}
        {actions.canArchive && (
          <Button variant="danger" size="sm" onClick={() => setConfirmArchive(true)} disabled={isPending}>
            Arquivar
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      {confirmArchive && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isPending && setConfirmArchive(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-title"
            className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="archive-title" className="text-lg font-bold text-fg">
              Arquivar este serviço?
            </h2>
            <p className="text-sm text-fg-muted">
              O serviço sairá de qualquer listagem pública e não poderá ser reativado — arquivar é
              permanente.
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmArchive(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="button" variant="danger" onClick={runArchive} disabled={isPending}>
                {isPending ? 'Arquivando…' : 'Confirmar arquivamento'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
