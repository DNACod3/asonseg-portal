'use client';

import { useState, useTransition } from 'react';
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
  'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

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
      <div
        role="status"
        className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600"
      >
        {doneCount > 0
          ? `Tudo certo — ${doneCount} solicitação(ões) processada(s). Não há mais reivindicações pendentes.`
          : 'Não há reivindicações de credencial pendentes no momento.'}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {claims.map((claim) => {
        const claimPending = isPending && pendingId === claim.id;
        return (
          <li
            key={claim.id}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-gray-900">{claim.fullName}</span>
              <span className="text-xs text-gray-600">E-mail desejado: {claim.requestedEmail}</span>
              <span className="text-xs text-gray-500">
                Solicitado em {claim.requestedAtLabel} · preferência:{' '}
                {VERIFICATION_METHOD_LABELS[claim.verificationMethod]}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1">
                <label
                  htmlFor={`method-${claim.id}`}
                  className="text-xs font-medium text-gray-700"
                >
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

              <button
                type="button"
                onClick={() => onConfirm(claim.id)}
                disabled={claimPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {claimPending ? 'Ativando…' : 'Confirmar e ativar'}
              </button>
            </div>

            {errors[claim.id] && (
              <p role="alert" className="text-xs text-red-600">
                {errors[claim.id]}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
