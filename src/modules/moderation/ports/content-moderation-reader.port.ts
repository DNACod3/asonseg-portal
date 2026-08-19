import { createToken } from '@/shared/container';
import type { ContentKind } from '../domain/content-status';
import type { ModerationContentView } from '../views/moderation-content';

/**
 * Leitura do conteúdo integral de um item de moderação, por `ContentKind`
 * (USP-066 / E-001). Espelha `ContentStatusRepository` (status): aqui o dado
 * é o **conteúdo**, não o estado da FSM.
 *
 * Resolvido por tipo no `DispatchingContentModerationReader` (container) —
 * cada módulo dono (`jobs`/`services`/`persons`) registra seu adapter Prisma.
 * `readContent` nunca lança: item inexistente ou kind sem reader registrado
 * (`CV` isolado) devolvem `null` (E-006, falha graciosa a cargo da action).
 *
 * **Contrato (C4/PR#294 rodada 2): implementações DEVEM escopar a leitura a
 * `ContentStatus.IN_MODERATION`** — fora desse estado, `readContent` DEVE
 * devolver `null` como se o item não existisse. `contentId` chega de um
 * cliente HTTP e só é validado como UUID (Zod); sem esse escopo, qualquer
 * portador da permissão do `kind` conseguiria ler conteúdo (incl. PII +
 * URL assinada de CV) de um item fora do que a fila jamais listaria (achado
 * A1/PR#294). Os 3 adapters registrados hoje cumprem via `findFirst` com
 * `status`/`publicationStatus: IN_MODERATION` no `where`. Essa checagem é
 * **defesa em profundidade**, não a única linha: `openModerationContent`
 * (a action) também verifica o status via `CONTENT_STATUS_REPOSITORY_TOKEN`
 * **antes** de chamar `readContent` — um adapter novo que esqueça o filtro
 * não reabre o vazamento, mas ainda assim deve implementá-lo (não depender
 * só da action).
 */
export interface ContentModerationReader {
  readContent(kind: ContentKind, contentId: string): Promise<ModerationContentView | null>;
}

export const CONTENT_MODERATION_READER_TOKEN =
  createToken<ContentModerationReader>('ContentModerationReader');
