import { ContentKind } from '../domain/content-status';
import type { ContentModerationReader } from '../ports/content-moderation-reader.port';
import type { ModerationContentView } from '../views/moderation-content';

/**
 * Registro por `ContentKind`, **exaustivo** (não `Partial`): todo membro do
 * enum precisa de uma entrada explícita, `null` quando o kind não tem reader
 * (ex.: `CV` isolado). C3/PR#294 rodada 2 — antes o registro era
 * `Partial<Record<...>>`, então esquecer um kind novo no `container.ts`
 * compilava sem erro e degradava em silêncio para "sem reader" (fail-open
 * vacuamente aceitável só se de fato não houver conteúdo — mas o TypeScript
 * não tinha como cobrar essa decisão). Com o tipo exaustivo, adicionar um
 * membro a `ContentKind` sem decidir sua entrada aqui é erro de compilação em
 * `container.ts`, não um gap silencioso.
 */
export type ContentModerationReaderRegistry = Record<ContentKind, ContentModerationReader | null>;

/**
 * Despacha `readContent` ao {@link ContentModerationReader} do `ContentKind`
 * correspondente (USP-066 / E-002..E-004). Espelha
 * `DispatchingContentStatusRepository` (status): aqui o mapa é montado só na
 * composição (`shared/container`) — este dispatcher **genérico** não conhece
 * nenhum módulo de conteúdo.
 *
 * `kind` sem entrada real no mapa (ex.: `CV` isolado, sem model real —
 * premissa §6 da spec) devolve `null`, o mesmo contrato de "item não
 * encontrado" (E-006 gracioso a cargo da Server Action).
 */
export class DispatchingContentModerationReader implements ContentModerationReader {
  constructor(private readonly byKind: ContentModerationReaderRegistry) {}

  /**
   * Reader concreto registrado para `kind`, ou `null`. Público (C3/PR#294
   * rodada 2) para que testes de sincronia (`container-content-moderation-
   * reader-kinds.test.ts`) verifiquem a **identidade** do adapter sem
   * introspeccionar o campo privado `byKind` via cast.
   */
  readerFor(kind: ContentKind): ContentModerationReader | null {
    return this.byKind[kind];
  }

  /** `ContentKind` com reader real registrado (exclui entradas `null`). */
  supportedKinds(): readonly ContentKind[] {
    return (Object.values(ContentKind) as ContentKind[]).filter((kind) => this.byKind[kind] != null);
  }

  readContent(kind: ContentKind, contentId: string): Promise<ModerationContentView | null> {
    const reader = this.byKind[kind];
    return reader ? reader.readContent(kind, contentId) : Promise.resolve(null);
  }
}
