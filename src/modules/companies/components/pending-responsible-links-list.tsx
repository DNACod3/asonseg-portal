'use client';

import { useState, useTransition } from 'react';
import { Button, Card } from '@/shared/ui';
import { aceitarVinculoResponsavel } from '../actions/accept-responsible-link';
import type { PendingResponsibleLink } from '../queries/list-pending-responsible-links';

/**
 * Lista de convites de vínculo de responsável PENDENTES da própria Pessoa
 * (USP-013). Para cada convite, a Pessoa confirma o aceite; ao aceitar, o vínculo
 * vira ACTIVE e o item sai da lista. A identidade vem da sessão (P-002) — o
 * `empresaId` é só a chave do convite, não autentica nada.
 *
 * Fundação de Design System da Fase 2 (AD-014/AD-015): restilizado com os
 * primitivos (`Card`/`Button`) e tokens — comportamento (aceitarVinculoResponsavel/
 * filtro otimista/doneCount) preservado.
 */
export function PendingResponsibleLinksList({ items }: { items: PendingResponsibleLink[] }) {
  const [links, setLinks] = useState(items);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [doneCount, setDoneCount] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onAccept(empresaId: string) {
    setErrors((prev) => ({ ...prev, [empresaId]: '' }));
    setPendingId(empresaId);
    startTransition(async () => {
      const result = await aceitarVinculoResponsavel({ empresaId });
      setPendingId(null);
      if (result.ok) {
        setLinks((prev) => prev.filter((l) => l.empresaId !== empresaId));
        setDoneCount((n) => n + 1);
      } else {
        setErrors((prev) => ({ ...prev, [empresaId]: result.error.message }));
      }
    });
  }

  if (links.length === 0) {
    return (
      <div role="status" className="rounded-md border border-border bg-background p-6 text-sm text-fg-muted">
        {doneCount > 0
          ? `Tudo certo — ${doneCount} vínculo(s) aceito(s). Você não tem mais convites pendentes.`
          : 'Você não tem convites de vínculo pendentes.'}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {links.map((link) => {
        const linkPending = isPending && pendingId === link.empresaId;
        return (
          <li key={link.empresaId}>
            <Card className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-fg">{link.empresaNome}</span>
                <span className="text-xs text-fg-muted">Convite enviado em {link.pendingAtLabel}</span>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => onAccept(link.empresaId)}
                disabled={linkPending}
                className="self-start"
              >
                {linkPending ? 'Aceitando…' : 'Aceitar vínculo'}
              </Button>

              {errors[link.empresaId] && (
                <p role="alert" className="text-xs text-danger">
                  {errors[link.empresaId]}
                </p>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
