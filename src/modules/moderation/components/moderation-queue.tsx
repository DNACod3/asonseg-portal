'use client';

import { useState, useTransition } from 'react';
import { ContentKind } from '../domain/content-status';
import { MIN_JUSTIFICATION_LENGTH } from '../domain/justification';
import { approveContent, rejectContent, returnForAdjustments } from '../actions/decide';

/** Item da fila já formatado pelo Server Component (data em fuso de SP). */
export interface ModerationQueueRow {
  contentKind: ContentKind;
  contentId: string;
  title: string;
  authorName: string | null;
  submittedAtLabel: string;
  companyUnverified?: boolean;
}

const KIND_LABELS: Record<ContentKind, string> = {
  [ContentKind.JOB]: 'Vaga',
  [ContentKind.CV]: 'Currículo',
  [ContentKind.SERVICE]: 'Serviço',
};

type ReasonMode = 'return' | 'reject';

const textareaClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

const btnBase =
  'rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Fila do coordenador (E-001..E-004). Para cada rascunho `IN_MODERATION`:
 * aprovar (sem motivo), devolver para ajustes ou rejeitar (motivo ≥ 20 chars
 * significativos — P-003). O resultado da Server Action remove o item da fila
 * e exibe confirmação; erros aparecem inline por item.
 */
export function ModerationQueue({ items }: { items: ModerationQueueRow[] }) {
  const [rows, setRows] = useState(items);
  const [doneCount, setDoneCount] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Estado do formulário de motivo aberto, por item.
  const [reason, setReason] = useState<Record<string, { mode: ReasonMode; text: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resolve(id: string) {
    setRows((prev) => prev.filter((r) => r.contentId !== id));
    setReason((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDoneCount((n) => n + 1);
  }

  function run(id: string, action: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setErrors((prev) => ({ ...prev, [id]: '' }));
    setPendingId(id);
    startTransition(async () => {
      const result = await action();
      setPendingId(null);
      if (result.ok) resolve(id);
      else setErrors((prev) => ({ ...prev, [id]: result.error?.message ?? 'Não foi possível concluir.' }));
    });
  }

  function onApprove(row: ModerationQueueRow) {
    run(row.contentId, () =>
      approveContent({ contentKind: row.contentKind, contentId: row.contentId }),
    );
  }

  function onSubmitReason(row: ModerationQueueRow) {
    const entry = reason[row.contentId];
    if (!entry) return;
    const text = entry.text.trim();
    if (text.length < MIN_JUSTIFICATION_LENGTH) {
      setErrors((prev) => ({
        ...prev,
        [row.contentId]: `O motivo deve ter ao menos ${MIN_JUSTIFICATION_LENGTH} caracteres descritivos.`,
      }));
      return;
    }
    const payload = { contentKind: row.contentKind, contentId: row.contentId, justification: text };
    run(row.contentId, () =>
      entry.mode === 'return' ? returnForAdjustments(payload) : rejectContent(payload),
    );
  }

  function openReason(id: string, mode: ReasonMode) {
    setErrors((prev) => ({ ...prev, [id]: '' }));
    setReason((prev) => ({ ...prev, [id]: { mode, text: prev[id]?.text ?? '' } }));
  }

  if (rows.length === 0) {
    return (
      <div role="status" className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
        {doneCount > 0
          ? `Tudo certo — ${doneCount} rascunho(s) processado(s). Não há mais itens na fila.`
          : 'Não há rascunhos aguardando moderação no momento.'}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => {
        const rowPending = isPending && pendingId === row.contentId;
        const reasonEntry = reason[row.contentId];
        const error = errors[row.contentId];
        return (
          <li
            key={row.contentId}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {KIND_LABELS[row.contentKind]}
              </span>
              {row.companyUnverified && (
                <span
                  className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700"
                  title="A verificação de Empresa é tratada na USP-017"
                >
                  Empresa não verificada
                </span>
              )}
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-gray-900">{row.title}</span>
              <span className="text-xs text-gray-600">Autor: {row.authorName ?? '—'}</span>
              <span className="text-xs text-gray-500">Enviado em {row.submittedAtLabel}</span>
            </div>

            {reasonEntry ? (
              <div className="flex flex-col gap-2">
                <label htmlFor={`reason-${row.contentId}`} className="text-xs font-medium text-gray-700">
                  {reasonEntry.mode === 'return'
                    ? 'Motivo da devolução (enviado ao autor)'
                    : 'Motivo da rejeição (enviado ao autor)'}
                </label>
                <textarea
                  id={`reason-${row.contentId}`}
                  rows={3}
                  className={textareaClass}
                  value={reasonEntry.text}
                  onChange={(e) =>
                    setReason((prev) => ({
                      ...prev,
                      [row.contentId]: { mode: reasonEntry.mode, text: e.target.value },
                    }))
                  }
                  placeholder="Descreva de forma clara o que precisa ser ajustado ou o motivo da rejeição."
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSubmitReason(row)}
                    disabled={rowPending}
                    className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-300`}
                  >
                    {rowPending ? 'Enviando…' : 'Confirmar'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReason((prev) => {
                        const next = { ...prev };
                        delete next[row.contentId];
                        return next;
                      })
                    }
                    disabled={rowPending}
                    className={`${btnBase} bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onApprove(row)}
                  disabled={rowPending}
                  className={`${btnBase} bg-green-600 text-white hover:bg-green-700 focus:ring-green-300`}
                >
                  {rowPending ? 'Processando…' : 'Aprovar'}
                </button>
                <button
                  type="button"
                  onClick={() => openReason(row.contentId, 'return')}
                  disabled={rowPending}
                  className={`${btnBase} bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-300`}
                >
                  Devolver para ajustes
                </button>
                <button
                  type="button"
                  onClick={() => openReason(row.contentId, 'reject')}
                  disabled={rowPending}
                  className={`${btnBase} bg-red-600 text-white hover:bg-red-700 focus:ring-red-300`}
                >
                  Rejeitar
                </button>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
