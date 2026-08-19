'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitServiceForModeration } from '@/modules/services';
import { Button } from '@/shared/ui';

export interface ResubmitServiceButtonProps {
  serviceId: string;
}

/**
 * "Corrigir e reenviar" do card "Meus serviços" (USP-067 — PNL-02, P1.2-3).
 * Chama `submitServiceForModeration({ serviceId })` direto — mesmo padrão de
 * `CompanyJobActions.runSubmit` (jobs), mas isolado num botão dedicado (o
 * painel só precisa desta ação, não o pacote inteiro de pausar/retomar/
 * arquivar de `ServiceActions`).
 */
export function ResubmitServiceButton({ serviceId }: Readonly<ResubmitServiceButtonProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await submitServiceForModeration({ serviceId });
      if (!res.ok) setError(res.error.message);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={isPending}>
        {isPending ? 'Reenviando…' : 'Corrigir e reenviar'}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
