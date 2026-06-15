'use client';

import { useState, useTransition } from 'react';
import { aceitarVinculoResponsavel } from '../actions/accept-responsible-link';
import type { PendingResponsibleLink } from '../queries/list-pending-responsible-links';

/**
 * Lista de convites de vínculo de responsável PENDENTES da própria Pessoa
 * (USP-013). Para cada convite, a Pessoa confirma o aceite; ao aceitar, o vínculo
 * vira ACTIVE e o item sai da lista. A identidade vem da sessão (P-002) — o
 * `empresaId` é só a chave do convite, não autentica nada.
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
      <div
        role="status"
        className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600"
      >
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
          <li
            key={link.empresaId}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-gray-900">{link.empresaNome}</span>
              <span className="text-xs text-gray-500">Convite enviado em {link.pendingAtLabel}</span>
            </div>

            <button
              type="button"
              onClick={() => onAccept(link.empresaId)}
              disabled={linkPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60 self-start"
            >
              {linkPending ? 'Aceitando…' : 'Aceitar vínculo'}
            </button>

            {errors[link.empresaId] && (
              <p role="alert" className="text-xs text-red-600">
                {errors[link.empresaId]}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
