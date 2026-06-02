'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatSaoPaulo } from '@/shared/lib/time';
import { revokeConsent } from '../actions/revoke-consent';
import type { OwnConsentView } from '../views/own-consents.view';

/** Item do painel: o View Model + o corpo do termo aceito (para "Ver termo"). */
export interface ConsentsPanelItem extends OwnConsentView {
  /** Corpo do termo aceito (markdown sem front-matter), para exibição. */
  readonly termBody: string;
}

const STATUS_BADGE: Record<OwnConsentView['status'], { label: string; className: string }> = {
  vigente: { label: 'Vigente', className: 'bg-green-100 text-green-800' },
  desatualizado: { label: 'Requer novo aceite', className: 'bg-amber-100 text-amber-800' },
  revogado: { label: 'Revogado', className: 'bg-gray-200 text-gray-600' },
};

export function ConsentsPanel({ items }: { items: readonly ConsentsPanelItem[] }) {
  const active = items.filter((i) => i.status !== 'revogado');
  const revoked = items.filter((i) => i.status === 'revogado');

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="vigentes-heading" className="flex flex-col gap-3">
        <h2 id="vigentes-heading" className="text-lg font-semibold text-gray-900">
          Consentimentos vigentes
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-gray-500">Você não tem consentimentos vigentes no momento.</p>
        ) : (
          active.map((item) => <ConsentCard key={item.consentId} item={item} revocable />)
        )}
      </section>

      {revoked.length > 0 && (
        <section aria-labelledby="revogados-heading" className="flex flex-col gap-3">
          <h2 id="revogados-heading" className="text-lg font-semibold text-gray-900">
            Consentimentos revogados
          </h2>
          {revoked.map((item) => (
            <ConsentCard key={item.consentId} item={item} revocable={false} />
          ))}
        </section>
      )}
    </div>
  );
}

function ConsentCard({ item, revocable }: { item: ConsentsPanelItem; revocable: boolean }) {
  const [showTerm, setShowTerm] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const badge = STATUS_BADGE[item.status];

  function onConfirmRevoke() {
    setError(null);
    startTransition(async () => {
      const result = await revokeConsent({ purpose: item.purpose });
      if (result.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  }

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{item.humanName}</h3>
          <p className="mt-1 text-sm text-gray-600">{item.description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-gray-500 sm:grid-cols-2">
        <div>
          <dt className="inline font-medium">Base legal: </dt>
          <dd className="inline">{item.legalBasis}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Versão do termo: </dt>
          <dd className="inline">{item.termVersion}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Aceito em: </dt>
          <dd className="inline">{formatSaoPaulo(item.acceptedAt)}</dd>
        </div>
        {item.revokedAt && (
          <div>
            <dt className="inline font-medium">Revogado em: </dt>
            <dd className="inline">{formatSaoPaulo(item.revokedAt)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowTerm((v) => !v)}
          aria-expanded={showTerm}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {showTerm ? 'Ocultar termo' : 'Ver termo aceito'}
        </button>
        {revocable && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Revogar
          </button>
        )}
      </div>

      {showTerm && (
        <div className="mt-3 max-h-80 overflow-auto rounded-lg bg-gray-50 p-4 text-xs leading-relaxed whitespace-pre-wrap text-gray-700">
          {item.termBody}
        </div>
      )}

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`confirm-${item.consentId}`}
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <p id={`confirm-${item.consentId}`} className="text-sm font-semibold text-red-800">
            Tem certeza que deseja revogar?
          </p>
          <p className="mt-1 text-sm text-red-700">
            Isso vai desativar a funcionalidade vinculada a <strong>{item.humanName}</strong>. Seus
            dados de perfil são preservados e as demais finalidades não são afetadas. Você pode aceitar
            novamente depois.
          </p>
          {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onConfirmRevoke}
              disabled={isPending}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isPending ? 'Revogando…' : 'Sim, revogar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
