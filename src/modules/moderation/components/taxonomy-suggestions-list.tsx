'use client';

import { useState, useTransition } from 'react';
import type { TaxonomyKind } from '../domain/taxonomy-suggestion';
import { approveTaxonomySuggestion, rejectTaxonomySuggestion } from '../actions/resolve-taxonomy-suggestion';
import { Badge, Button, Card, Label, Textarea } from '@/shared/ui';

/** Item da fila já formatado pelo Server Component (data em fuso de SP). */
export interface TaxonomySuggestionRow {
  id: string;
  kind: TaxonomyKind;
  name: string;
  suggestedByName: string | null;
  createdAtLabel: string;
}

const KIND_LABELS: Record<TaxonomyKind, string> = {
  JOB_AREA: 'Área',
  SERVICE_CATEGORY: 'Serviço',
};

/**
 * Fila de sugestões de taxonomia pendentes (USP-019 / SUGG-06). Cada item pode
 * ser aprovado (promove ao catálogo — segue **1 clique**, sem motivo) ou
 * rejeitado (remove). Rejeitar exige uma etapa de confirmação inline com
 * motivo **opcional** (≤ 280 caracteres → `audit_log.justification` — SUGG-04
 * / USP-056 MOD-8): "Rejeitar" só abre a etapa; nada é chamado até "Confirmar
 * rejeição". "Cancelar" fecha a etapa sem disparar a action, mantendo o item
 * na fila. Padrão inline-expandível de `PublishedContentManager` (sem overlay
 * de diálogo — DS-MN-05). O resultado da Server Action remove o item da lista
 * e mostra confirmação; erros aparecem inline por item.
 */
export function TaxonomySuggestionsList({ items }: { items: TaxonomySuggestionRow[] }) {
  const [rows, setRows] = useState(items);
  const [doneCount, setDoneCount] = useState(0);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resolve(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setDoneCount((n) => n + 1);
    if (rejectingId === id) closeReject();
  }

  function run(row: TaxonomySuggestionRow, action: () => ReturnType<typeof approveTaxonomySuggestion>) {
    setErrors((prev) => ({ ...prev, [row.id]: '' }));
    setPendingId(row.id);
    startTransition(async () => {
      const result = await action();
      setPendingId(null);
      if (result.ok) resolve(row.id);
      else setErrors((prev) => ({ ...prev, [row.id]: result.error?.message ?? 'Não foi possível concluir.' }));
    });
  }

  function onApprove(row: TaxonomySuggestionRow) {
    run(row, () => approveTaxonomySuggestion({ kind: row.kind, id: row.id }));
  }

  // MOD8-01/USP056-MN-05 — abre a confirmação; NÃO chama a action ainda.
  function openReject(id: string) {
    setErrors((prev) => ({ ...prev, [id]: '' }));
    setRejectingId(id);
    setReasonText('');
  }

  // MOD8-03 — fecha sem chamar a action; o item permanece na fila.
  function closeReject() {
    setRejectingId(null);
    setReasonText('');
  }

  // MOD8-02 — reason omitido quando vazio (trim), incluído só quando preenchido.
  function onConfirmReject(row: TaxonomySuggestionRow) {
    const reason = reasonText.trim();
    run(row, () =>
      rejectTaxonomySuggestion({ kind: row.kind, id: row.id, ...(reason ? { reason } : {}) }),
    );
  }

  if (rows.length === 0) {
    return (
      <div role="status" className="rounded-xl border border-border bg-surface p-6 text-sm text-fg-muted">
        {doneCount > 0
          ? `${doneCount} sugestão(ões) processada(s). Não há mais itens na fila.`
          : 'Não há sugestões pendentes no momento.'}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => {
        const rowPending = isPending && pendingId === row.id;
        const error = errors[row.id];
        const rejectOpen = rejectingId === row.id;
        return (
          <li key={row.id}>
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="blue">{KIND_LABELS[row.kind]}</Badge>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-fg">{row.name}</span>
                <span className="text-xs text-fg-muted">Sugerido por {row.suggestedByName ?? '—'}</span>
                <span className="text-xs text-fg-muted">Em {row.createdAtLabel}</span>
              </div>

              {rejectOpen ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`reject-reason-${row.id}`} className="text-xs font-medium text-fg-muted">
                    Motivo (opcional) enviado à auditoria
                  </Label>
                  <Textarea
                    id={`reject-reason-${row.id}`}
                    rows={3}
                    maxLength={280}
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder="Descreva, se quiser, por que esta sugestão está sendo rejeitada."
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => onConfirmReject(row)}
                      disabled={rowPending}
                    >
                      {rowPending ? 'Rejeitando…' : 'Confirmar rejeição'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={closeReject}
                      disabled={rowPending}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => onApprove(row)}
                    disabled={rowPending}
                  >
                    {rowPending ? 'Processando…' : 'Aprovar'}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => openReject(row.id)}
                    disabled={rowPending}
                  >
                    Rejeitar
                  </Button>
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
