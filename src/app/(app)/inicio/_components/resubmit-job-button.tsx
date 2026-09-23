'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
// Import direto do arquivo-fonte (não do barrel `@/modules/jobs`) — Client
// Component fora do módulo `jobs` que precisa de uma Server Action; o barrel
// reexporta código server-only (`next/headers` via outras queries/actions),
// que o Next recusa empacotar para o client (`Failed to compile`). Mesmo
// carve-out documentado em `no-deep-module-imports.test.ts` para
// `jobs/components/job-form.tsx`.
// eslint-disable-next-line no-restricted-imports
import { submitJobForModeration } from '@/modules/jobs/actions/submit-job-for-moderation';
import { Button } from '@/shared/ui';

export interface ResubmitJobButtonProps {
  jobId: string;
}

/**
 * "Corrigir e reenviar" do card "Minhas vagas" (USP-067 — PNL-04, P1.4-2).
 * Chama `submitJobForModeration({ jobId })` direto — mesmo padrão de
 * `ResubmitServiceButton`/`CompanyJobActions.runSubmit`, isolado num botão
 * dedicado (o painel só precisa desta ação).
 */
export function ResubmitJobButton({ jobId }: Readonly<ResubmitJobButtonProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await submitJobForModeration({ jobId });
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
