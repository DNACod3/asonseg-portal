'use client';

import { useState, useTransition } from 'react';
import { ContentKind } from '../domain/content-status';
import { openModerationContent } from '../actions/open-content';
import { ModerationContentDetails } from './moderation-content-details';
import type { ModerationContentView } from '../views/moderation-content';
import { Button } from '@/shared/ui';

export type ModerationContentPanelState = 'idle' | 'loaded' | 'error';

export interface ModerationContentPanelProps {
  contentKind: ContentKind;
  contentId: string;
  /** Reportado ao card da fila (`ModerationQueue`) — gate de Aprovar (E-006/P-001). */
  onStateChange: (state: ModerationContentPanelState) => void;
}

/**
 * Painel de conteúdo por item da fila (USP-066 / E-001/E-006/P-004). Carrega
 * o conteúdo **só ao clicar** em "Ver conteúdo" (`openModerationContent`) —
 * NUNCA em `useEffect`/mount, para preservar P-004 (a fila não pode disparar
 * N leituras no render). Reporta `idle|loaded|error` ao pai via `onStateChange`,
 * que usa isso para gatear o botão Aprovar (P-001).
 */
export function ModerationContentPanel({
  contentKind,
  contentId,
  onStateChange,
}: Readonly<ModerationContentPanelProps>) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [view, setView] = useState<ModerationContentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function load() {
    setStatus('loading');
    setError(null);
    startTransition(async () => {
      const result = await openModerationContent({ contentKind, contentId });
      if (result.ok) {
        setView(result.data);
        setStatus('loaded');
        onStateChange('loaded');
      } else {
        setError(result.error.message);
        setStatus('error');
        onStateChange('error');
      }
    });
  }

  if (status === 'loaded' && view) {
    return (
      <div className="rounded-lg border border-border bg-background p-4">
        <ModerationContentDetails view={view} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={load}
        disabled={isPending}
      >
        {isPending ? 'Carregando…' : status === 'error' ? 'Tentar novamente' : 'Ver conteúdo'}
      </Button>
      {status === 'error' && error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
