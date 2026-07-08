'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
// Server Action importada direto pelo caminho relativo (mesmo padrão de
// `ApplyToJobButton`/`CompanyJobActions`).
import { cancelApplication } from '../actions/cancel-application';
import { Button } from '@/shared/ui';

export interface CancelApplicationButtonProps {
  applicationId: string;
}

/**
 * CTA "Cancelar candidatura" (USP-026 / CAN-026-03). `useTransition` +
 * `cancelApplication` → erro mostra `error.message`; sucesso dispara
 * `router.refresh()` — a página relê `getMyActiveApplication` (USP-025), que
 * volta a `null`, e o CTA "Candidatar-se" reaparece.
 */
export function CancelApplicationButton({ applicationId }: Readonly<CancelApplicationButtonProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await cancelApplication({ applicationId });
      if (!res.ok) setError(res.error.message);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:w-auto"
        onClick={run}
        disabled={isPending}
      >
        {isPending ? 'Cancelando…' : 'Cancelar candidatura'}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
