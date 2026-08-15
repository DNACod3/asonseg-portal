import type { ContentKind } from '../domain/content-status';
import type { ContentModerationReader } from '../ports/content-moderation-reader.port';
import type { ModerationContentView } from '../views/moderation-content';

/**
 * Despacha `readContent` ao {@link ContentModerationReader} do `ContentKind`
 * correspondente (USP-066 / E-002..E-004). Espelha
 * `DispatchingContentStatusRepository` (status): aqui o mapa é montado só na
 * composição (`shared/container`) — este dispatcher **genérico** não conhece
 * nenhum módulo de conteúdo.
 *
 * `kind` sem entrada no mapa (ex.: `CV` isolado, sem model real — premissa
 * §6 da spec) devolve `null`, o mesmo contrato de "item não encontrado"
 * (E-006 gracioso a cargo da Server Action).
 */
export class DispatchingContentModerationReader implements ContentModerationReader {
  constructor(private readonly byKind: Partial<Record<ContentKind, ContentModerationReader>>) {}

  readContent(kind: ContentKind, contentId: string): Promise<ModerationContentView | null> {
    const reader = this.byKind[kind];
    return reader ? reader.readContent(kind, contentId) : Promise.resolve(null);
  }
}
