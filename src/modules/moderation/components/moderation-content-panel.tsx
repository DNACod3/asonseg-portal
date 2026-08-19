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
        {/*
          C7 (PR#294 rodada 2) — a URL assinada do CV tem TTL de 300s
          (SIGNED_URL_TTL_SECONDS/ADR-0005); uma vez `loaded`, o painel não
          tinha nenhum caminho para recarregar, então um painel aberto há
          mais de 5min entregava um link morto ao moderador — cenário comum,
          já que ele costuma abrir e ler antes de decidir. "Recarregar"
          reinvoca a mesma Server Action, o que também renova a URL assinada
          (E-004) sem perder o gate de Aprovar em caso de sucesso.
        */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={isPending}>
            {isPending ? 'Atualizando…' : 'Recarregar conteúdo'}
          </Button>
          {view.kind === 'CANDIDATE_PROFILE' && view.cvUrl != null && (
            <span className="text-xs text-fg-muted">
              O link do currículo expira em 5 minutos — recarregue se o link estiver indisponível.
            </span>
          )}
        </div>
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
