'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
// Server Actions importadas direto pelo caminho relativo (dentro do próprio
// módulo `jobs` — não cruza barrel de outro módulo, então `no-restricted-imports`
// não se aplica; mesmo motivo de `create-job-draft`/`submit-job-for-moderation`
// em `JobForm`).
import { pauseJob } from '../actions/pause-job';
import { unpauseJob } from '../actions/unpause-job';
import { archiveJob } from '../actions/archive-job';
import { extendJobValidity } from '../actions/extend-job-validity';
import type { CompanyJobRowActions as RowActions } from '../views/company-job-row.view';
import { Button, Input } from '@/shared/ui';

export interface CompanyJobActionsProps {
  jobId: string;
  actions: RowActions;
}

/** yyyy-MM-dd de amanhã — piso do input de prorrogação (mesmo padrão de JobForm). */
function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Ações leves de ciclo de vida da vaga na lista de gestão (USP-023 / T9): pausar/
 * despausar/prorrogar via `Button`; arquivar via `Button variant="danger"` +
 * confirmação hand-rolled (padrão `EditCompanyForm`, `role="dialog" aria-modal`,
 * terminal — P-006). `router.refresh()` em todo sucesso para a lista refletir o
 * novo status/badge.
 */
export function CompanyJobActions({ jobId, actions }: CompanyJobActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [extending, setExtending] = useState(false);
  const [validUntil, setValidUntil] = useState('');

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
      const res = await pauseJob({ jobId });
      if (!res.ok) setError(res.error.message);
      else router.refresh();
    });
  }

  function runUnpause() {
    setError(null);
    startTransition(async () => {
      const res = await unpauseJob({ jobId });
      if (!res.ok) setError(res.error.message);
      else router.refresh();
    });
  }

  function runArchive() {
    setError(null);
    startTransition(async () => {
      const res = await archiveJob({ jobId });
      if (!res.ok) setError(res.error.message);
      else {
        setConfirmArchive(false);
        router.refresh();
      }
    });
  }

  function runExtend() {
    if (!validUntil) return;
    setError(null);
    startTransition(async () => {
      const res = await extendJobValidity({ jobId, validUntil });
      if (!res.ok) setError(res.error.message);
      else {
        setExtending(false);
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
        {actions.canUnpause && (
          <Button variant="outline" size="sm" onClick={runUnpause} disabled={isPending}>
            {isPending ? 'Despausando…' : 'Despausar'}
          </Button>
        )}
        {actions.canExtend && (
          <Button variant="outline" size="sm" onClick={() => setExtending((v) => !v)} disabled={isPending}>
            Prorrogar
          </Button>
        )}
        {actions.canArchive && (
          <Button variant="danger" size="sm" onClick={() => setConfirmArchive(true)} disabled={isPending}>
            Arquivar
          </Button>
        )}
      </div>

      {extending && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Nova data de validade"
            min={tomorrowIso()}
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-auto"
          />
          <Button variant="secondary" size="sm" onClick={runExtend} disabled={isPending || !validUntil}>
            {isPending ? 'Salvando…' : 'Confirmar'}
          </Button>
        </div>
      )}

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
              Arquivar esta vaga?
            </h2>
            <p className="text-sm text-fg-muted">
              A vaga sairá de qualquer listagem pública e não poderá ser reativada — arquivar é
              permanente. O histórico de candidaturas é preservado.
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
