'use client';

import { useCallback, useState, useTransition } from 'react';
import { ContentKind } from '../domain/content-status';
import { CONTENT_KINDS_WITH_READER } from '../domain/content-moderation-reader-kinds';
import { MIN_JUSTIFICATION_LENGTH } from '../domain/justification';
import { approveContent, rejectContent, returnForAdjustments } from '../actions/decide';
import type { VerificationChecklistItem } from '../domain/verification-checklist';
import { VerificationPanel, type VerificationPanelData } from './verification-panel';
import { ModerationContentPanel, type ModerationContentPanelState } from './moderation-content-panel';
import { Badge, Button, Label, Textarea } from '@/shared/ui';

/** Item da fila já formatado pelo Server Component (data em fuso de SP). */
export interface ModerationQueueRow {
  contentKind: ContentKind;
  contentId: string;
  title: string;
  authorName: string | null;
  submittedAtLabel: string;
  companyUnverified?: boolean;
  /** Contexto de verificação da Empresa (só vagas — USP-017). Dispara o painel. */
  verification?: VerificationPanelData;
}

const KIND_LABELS: Record<ContentKind, string> = {
  [ContentKind.JOB]: 'Vaga',
  [ContentKind.CV]: 'Currículo',
  [ContentKind.SERVICE]: 'Serviço',
  [ContentKind.CANDIDATE_PROFILE]: 'Perfil de candidato',
};

type ReasonMode = 'return' | 'reject';

/**
 * Fila do coordenador (E-001..E-004). Para cada rascunho `IN_MODERATION`:
 * aprovar (sem motivo), devolver para ajustes ou rejeitar (motivo ≥ 20 chars
 * significativos — P-003). O resultado da Server Action remove o item da fila
 * e exibe confirmação; erros aparecem inline por item.
 */
export function ModerationQueue({
  items,
  checklistItems,
  viewerModeratableKinds,
}: {
  items: ModerationQueueRow[];
  /** Itens da checklist de verificação (F0B-01 — fonte seedável, carregada pelo Server Component). */
  checklistItems?: readonly VerificationChecklistItem[];
  /**
   * `ContentKind` que o viewer pode moderar (USP-056 / MOD-7 / P-007). **Opcional**
   * — quando omitido, todos os tipos são considerados moderáveis (backward-compat:
   * uso existente e coordenador, que não passa o prop, seguem vendo todas as ações
   * — MOD7-03). Itens de tipo fora do conjunto não exibem controles acionáveis; a
   * checagem autoritativa (`requirePermission`, P-007) permanece na Server Action,
   * inalterada — este prop só evita oferecer uma ação fadada ao erro na UI.
   */
  viewerModeratableKinds?: readonly ContentKind[];
}) {
  const [rows, setRows] = useState(items);
  const [doneCount, setDoneCount] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Estado do formulário de motivo aberto, por item.
  const [reason, setReason] = useState<Record<string, { mode: ReasonMode; text: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Prontidão da checklist de verificação por item (P-001) — reportada pelo painel.
  const [verifyReady, setVerifyReady] = useState<Record<string, boolean>>({});
  // Prontidão do CONTEÚDO por item (USP-066 / P-001) — reportada pelo
  // ModerationContentPanel; Aprovar só habilita com 'loaded' (E-006).
  const [contentState, setContentState] = useState<Record<string, ModerationContentPanelState>>({});

  const setReady = useCallback((id: string, ready: boolean) => {
    setVerifyReady((prev) => (prev[id] === ready ? prev : { ...prev, [id]: ready }));
  }, []);

  const setContentReady = useCallback((id: string, state: ModerationContentPanelState) => {
    setContentState((prev) => (prev[id] === state ? prev : { ...prev, [id]: state }));
  }, []);

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
      <div role="status" className="rounded-xl border border-border bg-surface p-6 text-sm text-fg-muted">
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
        // P-001 — vaga de Empresa não verificada exige checklist concluída p/ aprovar.
        const needsChecklist = Boolean(row.verification && !row.verification.isVerified);
        // MOD7-02/USP056-MN-04 — prop ausente (undefined) = todos moderáveis (MOD7-03).
        const canModerate =
          !viewerModeratableKinds || viewerModeratableKinds.includes(row.contentKind);
        // A2 (PR#294) — só kinds com reader real (JOB/SERVICE/CANDIDATE_PROFILE)
        // têm conteúdo para carregar; exigir 'loaded' para um kind sem reader
        // (hoje só CV) travaria Aprovar para sempre (E-006 vira beco sem saída).
        const hasContentReader = CONTENT_KINDS_WITH_READER.includes(row.contentKind);
        return (
          <li
            key={row.contentId}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="blue">{KIND_LABELS[row.contentKind]}</Badge>
              {row.companyUnverified && (
                <Badge
                  variant="orange"
                  title="Verifique os dados da Empresa no painel abaixo antes de aprovar."
                >
                  Empresa não verificada
                </Badge>
              )}
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-fg">{row.title}</span>
              <span className="text-xs text-fg-muted">Autor: {row.authorName ?? '—'}</span>
              <span className="text-xs text-fg-muted">Enviado em {row.submittedAtLabel}</span>
            </div>

            {/* Bloco "Verificação da Empresa", separado da decisão da vaga (P-002/AD-6). */}
            {row.verification && (
              <VerificationPanel
                data={row.verification}
                checklistItems={checklistItems}
                onReadinessChange={(ready) => setReady(row.contentId, ready)}
              />
            )}

            {/* Conteúdo integral sob demanda (USP-066 / E-001) — só no ramo canModerate,
                e só para kinds com reader real (A2/PR#294); antes dos controles de
                decisão; page.tsx nunca carrega conteúdo (P-004). */}
            {canModerate && hasContentReader && (
              <ModerationContentPanel
                contentKind={row.contentKind}
                contentId={row.contentId}
                onStateChange={(s) => setContentReady(row.contentId, s)}
              />
            )}

            {!canModerate ? (
              // MOD7-02/USP056-MN-04 — sem ação acionável para tipo fora da permissão do viewer.
              <p className="text-sm text-fg-muted">Você não tem permissão para moderar este tipo.</p>
            ) : reasonEntry ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor={`reason-${row.contentId}`} className="text-xs font-medium text-fg-muted">
                  {reasonEntry.mode === 'return'
                    ? 'Motivo da devolução (enviado ao autor)'
                    : 'Motivo da rejeição (enviado ao autor)'}
                </Label>
                <Textarea
                  id={`reason-${row.contentId}`}
                  rows={3}
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
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => onSubmitReason(row)}
                    disabled={rowPending}
                  >
                    {rowPending ? 'Enviando…' : 'Confirmar'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setReason((prev) => {
                        const next = { ...prev };
                        delete next[row.contentId];
                        return next;
                      })
                    }
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
                  disabled={
                    rowPending ||
                    (needsChecklist && !verifyReady[row.contentId]) ||
                    (hasContentReader && contentState[row.contentId] !== 'loaded')
                  }
                  title={
                    hasContentReader && contentState[row.contentId] !== 'loaded'
                      ? 'Abra o conteúdo antes de aprovar.'
                      : needsChecklist && !verifyReady[row.contentId]
                        ? 'Conclua a checklist de verificação da Empresa para aprovar (P-001).'
                        : undefined
                  }
                >
                  {rowPending ? 'Processando…' : 'Aprovar'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openReason(row.contentId, 'return')}
                  disabled={rowPending}
                >
                  Devolver para ajustes
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => openReason(row.contentId, 'reject')}
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
          </li>
        );
      })}
    </ul>
  );
}
