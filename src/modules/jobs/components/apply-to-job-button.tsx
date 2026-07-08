'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
// Server Action importada direto pelo caminho relativo (dentro do próprio módulo
// `jobs` — mesmo padrão de `CompanyJobActions`/`JobForm`).
import { applyToJob } from '../actions/apply-to-job';
import { Button } from '@/shared/ui';

export interface ApplyToJobButtonProps {
  jobId: string;
}

/**
 * CTA "Candidatar-se" (USP-025 / CAN-025-06). `useTransition` + `applyToJob` →
 * erro mostra `error.message`; sucesso dispara `router.refresh()` para a página
 * reler `getMyActiveApplication` e trocar o botão pelo estado "já candidatado".
 */
export function ApplyToJobButton({ jobId }: Readonly<ApplyToJobButtonProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await applyToJob({ jobId });
      if (!res.ok) setError(res.error.message);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="primary"
        className="w-full sm:w-auto"
        onClick={run}
        disabled={isPending}
      >
        {isPending ? 'Candidatando…' : 'Candidatar-se'}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
