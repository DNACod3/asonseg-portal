'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
// Server Action importada direto pelo caminho relativo (exceção documentada do
// repo — mesmo padrão de `CancelApplicationButton`/`ManifestInterestButton`).
import { cancelInterest } from '../actions/cancel-interest';
import { Button } from '@/shared/ui';

export interface CancelInterestButtonProps {
  interestId: string;
}

/**
 * CTA "Cancelar manifestação" (USP-034 — AC-034-1). `useTransition` +
 * `cancelInterest` → erro mostra `error.message`; sucesso dispara
 * `router.refresh()` — a página relê `getMyActiveServiceInterest` (USP-033),
 * que volta a `null`, o contato do prestador some e o CTA "Entrar em contato"
 * reaparece (design USP-033 §D6).
 */
export function CancelInterestButton({ interestId }: Readonly<CancelInterestButtonProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await cancelInterest({ interestId });
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
        {isPending ? 'Cancelando…' : 'Cancelar manifestação'}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
