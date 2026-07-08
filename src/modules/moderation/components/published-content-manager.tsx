'use client';

import { useState, useTransition } from 'react';
import { ContentKind } from '../domain/content-status';
import { MIN_JUSTIFICATION_LENGTH } from '../domain/justification';
import { inactivateContent } from '../actions/inactivate';
import { Badge, Button, Card, Label, Textarea } from '@/shared/ui';

/** Item da listagem já formatado pelo Server Component (data em fuso de SP). */
export interface PublishedContentRow {
  contentId: string;
  title: string;
  companyName: string;
  areaName: string | null;
  publishedAtLabel: string;
}

/**
 * Superfície de gestão de conteúdo publicado (USP-018 / INACT-06). Lista vagas
 * `ACTIVE` e permite inativar cada uma com motivo obrigatório (≥ 20 caracteres
 * significativos — P-003), via `inactivateContent`. Padrão inline-expandível
 * (mesma UX de `ModerationQueue`), sem overlay de diálogo (DS-MN-05).
 */
export function PublishedContentManager({ items }: { items: PublishedContentRow[] }) {
  const [rows, setRows] = useState(items);
  const [doneCount, setDoneCount] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function openReason(id: string) {
    setErrors((prev) => ({ ...prev, [id]: '' }));
    setOpenId(id);
    setReasonText('');
  }

  function closeReason() {
    setOpenId(null);
    setReasonText('');
  }

  function resolve(id: string) {
    setRows((prev) => prev.filter((r) => r.contentId !== id));
    setDoneCount((n) => n + 1);
    closeReason();
  }

  function onConfirm(contentId: string) {
    const text = reasonText.trim();
    if (text.length < MIN_JUSTIFICATION_LENGTH) {
      setErrors((prev) => ({
        ...prev,
        [contentId]: `O motivo deve ter ao menos ${MIN_JUSTIFICATION_LENGTH} caracteres descritivos.`,
      }));
      return;
    }
    setErrors((prev) => ({ ...prev, [contentId]: '' }));
    setPendingId(contentId);
    startTransition(async () => {
      const result = await inactivateContent({
        contentKind: ContentKind.JOB,
        contentId,
        justification: text,
      });
      setPendingId(null);
      if (result.ok) {
        resolve(contentId);
      } else {
        setErrors((prev) => ({
          ...prev,
          [contentId]: result.error?.message ?? 'Não foi possível concluir.',
        }));
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div
        role="status"
        className="rounded-xl border border-border bg-surface p-6 text-sm text-fg-muted"
      >
        {doneCount > 0
          ? `${doneCount} vaga(s) inativada(s). Não há mais vagas publicadas nesta lista.`
          : 'Não há vagas publicadas no momento.'}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => {
        const rowPending = isPending && pendingId === row.contentId;
        const error = errors[row.contentId];
        const reasonOpen = openId === row.contentId;
        return (
          <li key={row.contentId}>
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="blue">{row.companyName}</Badge>
                {row.areaName && <Badge variant="orange">{row.areaName}</Badge>}
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-fg">{row.title}</span>
                <span className="text-xs text-fg-muted">Publicada em {row.publishedAtLabel}</span>
              </div>

              {reasonOpen ? (
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor={`reason-${row.contentId}`}
                    className="text-xs font-medium text-fg-muted"
                  >
                    Motivo da inativação (enviado ao autor)
                  </Label>
                  <Textarea
                    id={`reason-${row.contentId}`}
                    rows={3}
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder="Descreva de forma clara o motivo da inativação."
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => onConfirm(row.contentId)}
                      disabled={rowPending}
                    >
                      {rowPending ? 'Inativando…' : 'Confirmar'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={closeReason}
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
                    variant="danger"
                    size="sm"
                    onClick={() => openReason(row.contentId)}
                  >
                    Inativar
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
