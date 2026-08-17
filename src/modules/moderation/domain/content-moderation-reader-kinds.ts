import { ContentKind } from './content-status';

/**
 * `ContentKind` que têm um {@link ContentModerationReader} real registrado no
 * container (USP-066 — correção A2 do review da PR #294).
 *
 * `ContentKind.CV` fica de fora de propósito: é um kind isolado, sem model
 * próprio (o conteúdo de candidato — inclusive o arquivo de CV — é servido
 * por `CANDIDATE_PROFILE`; premissa §6 da spec). `_moderation_fixture`
 * (backing store de `CV`) só guarda `id/kind/status/title/authorPersonId` —
 * não há corpo de conteúdo para ler, então um reader "completo" para `CV` é
 * estruturalmente impossível hoje.
 *
 * **Por que este arquivo existe:** antes desta correção, `moderation-queue.tsx`
 * exigia `contentState === 'loaded'` para **qualquer** kind antes de habilitar
 * "Aprovar". Para um kind sem reader (`CV`), o painel de conteúdo sempre
 * resolve `NOT_FOUND` → `error`, e "Aprovar" ficava **permanentemente**
 * desabilitado — um beco sem saída, não uma falha retentável (achado A2 do
 * review da PR #294). A correção: o gate de "conteúdo carregado" (P-001) só
 * se aplica aos kinds **que têm o que carregar** — listados aqui, fonte única
 * entre o dispatcher (`shared/container.ts`) e o gate de Aprovar da fila
 * (`moderation-queue.tsx`).
 */
export const CONTENT_KINDS_WITH_READER: readonly ContentKind[] = [
  ContentKind.JOB,
  ContentKind.SERVICE,
  ContentKind.CANDIDATE_PROFILE,
];
