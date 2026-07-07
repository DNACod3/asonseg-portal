'use client';

import { useState, useTransition } from 'react';
import { Button, Card } from '@/shared/ui';
import { verifyCredentialClaim } from '../actions/verify-credential-claim';
import {
  CREDENTIAL_VERIFICATION_METHODS,
  VERIFICATION_METHOD_LABELS,
  type CredentialVerificationMethod,
} from '../schemas/credential-claim.schema';

/** Item da fila, já formatado pelo Server Component (data em fuso de SP). */
export interface CredentialClaimReviewItem {
  id: string;
  personId: string;
  fullName: string;
  requestedEmail: string;
  verificationMethod: CredentialVerificationMethod;
  requestedAtLabel: string;
}

const selectClass =
  'w-full rounded-sm border-[1.5px] border-border bg-surface px-4 py-3 text-[0.95rem] text-fg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary';

/**
 * Fila interna de verificação de reivindicações de credencial (USP-003 / D-004).
 * Para cada solicitação PENDENTE, o aprovador registra o meio efetivamente
 * utilizado na verificação (P-001) e confirma a ativação.
 */
export function CredentialClaimReview({ items }: { items: CredentialClaimReviewItem[] }) {
  const [claims, setClaims] = useState(items);
  const [methods, setMethods] = useState<Record<string, CredentialVerificationMethod>>(
    Object.fromEntries(items.map((i) => [i.id, i.verificationMethod])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [doneCount, setDoneCount] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onConfirm(id: string) {
    setErrors((prev) => ({ ...prev, [id]: '' }));
    setPendingId(id);
    startTransition(async () => {
      const result = await verifyCredentialClaim({
        claimId: id,
        verificationMethod: methods[id] ?? 'AS_CONFIRMATION',
      });
      setPendingId(null);
      if (result.ok) {
        setClaims((prev) => prev.filter((c) => c.id !== id));
        setDoneCount((n) => n + 1);
      } else {
        setErrors((prev) => ({ ...prev, [id]: result.error.message }));
      }
    });
  }

  if (claims.length === 0) {
    return (
      <Card role="status" className="text-sm text-fg-muted">
        {doneCount > 0
          ? `Tudo certo — ${doneCount} solicitação(ões) processada(s). Não há mais reivindicações pendentes.`
          : 'Não há reivindicações de credencial pendentes no momento.'}
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {claims.map((claim) => {
        const claimPending = isPending && pendingId === claim.id;
        return (
          <li
            key={claim.id}
            className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 shadow-sm"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-fg">{claim.fullName}</span>
              <span className="text-xs text-fg-muted">
                E-mail desejado: {claim.requestedEmail}
              </span>
              <span className="text-xs text-fg-muted">
                Solicitado em {claim.requestedAtLabel} · preferência:{' '}
                {VERIFICATION_METHOD_LABELS[claim.verificationMethod]}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor={`method-${claim.id}`} className="text-xs font-medium text-fg">
                  Meio de verificação utilizado
                </label>
                <select
                  id={`method-${claim.id}`}
                  className={selectClass}
                  value={methods[claim.id]}
                  onChange={(e) =>
                    setMethods((prev) => ({
                      ...prev,
                      [claim.id]: e.target.value as CredentialVerificationMethod,
                    }))
                  }
                >
                  {CREDENTIAL_VERIFICATION_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {VERIFICATION_METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="button"
                variant="primary"
                onClick={() => onConfirm(claim.id)}
                disabled={claimPending}
              >
                {claimPending ? 'Ativando…' : 'Confirmar e ativar'}
              </Button>
            </div>

            {errors[claim.id] && (
              <p role="alert" className="text-xs text-danger">
                {errors[claim.id]}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
