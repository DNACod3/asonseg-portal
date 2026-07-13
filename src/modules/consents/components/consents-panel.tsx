'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, TermMarkdown, type BadgeProps } from '@/shared/ui';
import { formatSaoPaulo } from '@/shared/lib/time';
import { revokeConsent } from '../actions/revoke-consent';
import type { OwnConsentView } from '../views/own-consents.view';

/** Item do painel: o View Model + o corpo do termo aceito (para "Ver termo"). */
export interface ConsentsPanelItem extends OwnConsentView {
  /** Corpo do termo aceito (markdown sem front-matter), para exibição. */
  readonly termBody: string;
}

const STATUS_BADGE: Record<OwnConsentView['status'], { label: string; variant: BadgeProps['variant'] }> = {
  vigente: { label: 'Vigente', variant: 'green' },
  desatualizado: { label: 'Requer novo aceite', variant: 'orange' },
  revogado: { label: 'Revogado', variant: 'gray' },
};

export function ConsentsPanel({ items }: { items: readonly ConsentsPanelItem[] }) {
  const active = items.filter((i) => i.status !== 'revogado');
  const revoked = items.filter((i) => i.status === 'revogado');

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="vigentes-heading" className="flex flex-col gap-3">
        <h2 id="vigentes-heading" className="text-lg font-semibold text-fg">
          Consentimentos vigentes
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-fg-muted">Você não tem consentimentos vigentes no momento.</p>
        ) : (
          active.map((item) => <ConsentCard key={item.consentId} item={item} revocable />)
        )}
      </section>

      {revoked.length > 0 && (
        <section aria-labelledby="revogados-heading" className="flex flex-col gap-3">
          <h2 id="revogados-heading" className="text-lg font-semibold text-fg">
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
    <article className="rounded-md border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-fg">{item.humanName}</h3>
          <p className="mt-1 text-sm text-fg-muted">{item.description}</p>
        </div>
        <Badge variant={badge.variant} className="shrink-0">
          {badge.label}
        </Badge>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-fg-muted sm:grid-cols-2">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowTerm((v) => !v)}
          aria-expanded={showTerm}
        >
          {showTerm ? 'Ocultar termo' : 'Ver termo aceito'}
        </Button>
        {revocable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirming(true)}
            className="border-danger text-danger hover:border-danger hover:text-danger"
          >
            Revogar
          </Button>
        )}
      </div>

      {showTerm && (
        <TermMarkdown
          source={item.termBody}
          className="mt-3 max-h-80 overflow-auto rounded-lg bg-background p-4 text-xs leading-relaxed text-fg"
        />
      )}

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`confirm-${item.consentId}`}
          className="mt-4 rounded-lg border border-danger bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-4"
        >
          <p id={`confirm-${item.consentId}`} className="text-sm font-semibold text-danger">
            Tem certeza que deseja revogar?
          </p>
          <p className="mt-1 text-sm text-danger">
            Isso vai desativar a funcionalidade vinculada a <strong>{item.humanName}</strong>. Seus
            dados de perfil são preservados e as demais finalidades não são afetadas. Você pode aceitar
            novamente depois.
          </p>
          {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onConfirmRevoke}
              disabled={isPending}
              className="border-danger bg-danger text-white hover:border-danger hover:text-white"
            >
              {isPending ? 'Revogando…' : 'Sim, revogar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              disabled={isPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
