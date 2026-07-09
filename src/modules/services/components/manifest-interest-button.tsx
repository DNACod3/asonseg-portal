'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
// Server Action importada direto pelo caminho relativo (exceção documentada do
// repo — mesmo padrão de `ApplyToJobButton`/`JobForm`).
import { manifestInterest } from '../actions/manifest-interest';
import { Button } from '@/shared/ui';

export interface ManifestInterestButtonProps {
  serviceId: string;
  /** Termo `SERVICE_HIRING` carregado server-side (página) para exibição
   *  quando o consentimento ainda não está ativo (AC-033-4). */
  consentTerm: { humanName: string; body: string };
}

/**
 * CTA "Entrar em contato" (USP-033 — AC-033-1). Primeiro clique tenta
 * `manifestInterest` sem aceite; se o consentimento `SERVICE_HIRING` não
 * estiver ativo, a action retorna `CONSENT_REQUIRED` e o componente passa a
 * exibir o termo + checkbox de aceite (P-002) — o re-submit então envia
 * `consentAccepted: true`. Sucesso dispara `router.refresh()` (a página relê
 * `getMyActiveServiceInterest`/`getProviderContactForService` e revela o
 * contato do prestador).
 */
export function ManifestInterestButton({ serviceId, consentTerm }: Readonly<ManifestInterestButtonProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [accepted, setAccepted] = useState(false);

  function submit(consentAccepted?: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await manifestInterest({ serviceId, consentAccepted });
      if (res.ok) {
        router.refresh();
        return;
      }
      if (res.error.code === 'CONSENT_REQUIRED') {
        setNeedsConsent(true);
        return;
      }
      setError(res.error.message);
    });
  }

  if (!needsConsent) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="primary"
          className="w-full sm:w-auto"
          onClick={() => submit(undefined)}
          disabled={isPending}
        >
          {isPending ? 'Enviando…' : 'Entrar em contato'}
        </Button>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg">Termo da finalidade</span>
        <div className="max-h-72 overflow-auto rounded-lg border border-border bg-background p-4 text-xs leading-relaxed whitespace-pre-wrap text-fg-muted">
          {consentTerm.body}
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 accent-primary"
        />
        <span>
          Li e aceito o termo da finalidade <strong>{consentTerm.humanName}</strong>.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="primary"
        className="w-full sm:w-auto"
        onClick={() => submit(true)}
        disabled={!accepted || isPending}
      >
        {isPending ? 'Enviando…' : 'Aceitar e entrar em contato'}
      </Button>
    </div>
  );
}
