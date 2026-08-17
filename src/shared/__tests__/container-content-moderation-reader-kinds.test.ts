import { describe, it, expect } from 'vitest';
import { container } from '@/shared/container';
import { CONTENT_MODERATION_READER_TOKEN } from '@/modules/moderation/ports/content-moderation-reader.port';
import { CONTENT_KINDS_WITH_READER } from '@/modules/moderation/domain/content-moderation-reader-kinds';
import { DispatchingContentModerationReader } from '@/modules/moderation/adapters/dispatching-content-moderation-reader';

/**
 * L-024 (USP-066 / A2 PR#294): antes desta suíte, a sincronia entre
 * `CONTENT_KINDS_WITH_READER` (moderation/domain/content-moderation-reader-kinds.ts
 * — usada por `moderation-queue.tsx` para decidir quais kinds exigem "conteúdo
 * carregado" antes de habilitar Aprovar, P-001) e o mapa de readers realmente
 * registrado no container era garantida só por comentário. Um kind com reader
 * registrado e esquecido na constante deixaria o gate de Aprovar fail-open
 * (trava para sempre); um kind na constante sem reader registrado deixaria o
 * gate fail-closed sem chance de destravar — o mesmo formato do bug A2 que a
 * USP-066 corrigiu para `CV`.
 *
 * Este teste amarra as duas fontes: as chaves efetivamente registradas no
 * `DispatchingContentModerationReader` do container de produção têm que ser
 * EXATAMENTE o conjunto de `CONTENT_KINDS_WITH_READER` — nem mais, nem menos.
 */
describe('container: readers de moderação registrados == CONTENT_KINDS_WITH_READER (L-024)', () => {
  it('as chaves do dispatcher de produção são exatamente CONTENT_KINDS_WITH_READER', () => {
    const reader = container.resolve(CONTENT_MODERATION_READER_TOKEN);
    expect(reader).toBeInstanceOf(DispatchingContentModerationReader);

    // `byKind` é privado em TS, mas acessível em runtime (privado é apagado na
    // compilação) — é a única forma de introspectar o mapa realmente montado
    // no container sem duplicar o registro de produção no teste.
    const registeredKinds = Object.keys(
      (reader as unknown as { byKind: Record<string, unknown> }).byKind,
    ).sort();

    expect(registeredKinds).toEqual([...CONTENT_KINDS_WITH_READER].sort());
  });
});
