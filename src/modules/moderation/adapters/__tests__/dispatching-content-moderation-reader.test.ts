// Unit do DispatchingContentModerationReader (USP-066 / T5) — adapters fakes.

import { describe, it, expect, vi } from 'vitest';
import { ContentKind } from '../../domain/content-status';
import { DispatchingContentModerationReader } from '../dispatching-content-moderation-reader';
import type { ContentModerationReader } from '../../ports/content-moderation-reader.port';

function fakeReader(view: unknown): ContentModerationReader {
  return { readContent: vi.fn().mockResolvedValue(view) };
}

describe('DispatchingContentModerationReader (T5)', () => {
  it('despacha ao adapter registrado do kind e devolve o que ele resolver', async () => {
    const jobView = { kind: 'JOB', title: 'Vaga X' };
    const jobReader = fakeReader(jobView);
    const dispatcher = new DispatchingContentModerationReader({
      [ContentKind.JOB]: jobReader,
      [ContentKind.SERVICE]: null,
      [ContentKind.CANDIDATE_PROFILE]: null,
      [ContentKind.CV]: null,
    });

    const result = await dispatcher.readContent(ContentKind.JOB, 'job-1');

    expect(result).toBe(jobView);
    expect(jobReader.readContent).toHaveBeenCalledWith(ContentKind.JOB, 'job-1');
  });

  it('despacha cada kind ao seu próprio adapter (não cruza readers)', async () => {
    const jobReader = fakeReader({ kind: 'JOB' });
    const serviceReader = fakeReader({ kind: 'SERVICE' });
    const dispatcher = new DispatchingContentModerationReader({
      [ContentKind.JOB]: jobReader,
      [ContentKind.SERVICE]: serviceReader,
      [ContentKind.CANDIDATE_PROFILE]: null,
      [ContentKind.CV]: null,
    });

    await dispatcher.readContent(ContentKind.SERVICE, 'svc-1');

    expect(serviceReader.readContent).toHaveBeenCalledWith(ContentKind.SERVICE, 'svc-1');
    expect(jobReader.readContent).not.toHaveBeenCalled();
  });

  it('kind com entrada null (ex.: CV isolado) ⇒ null, sem lançar', async () => {
    const dispatcher = new DispatchingContentModerationReader({
      [ContentKind.JOB]: fakeReader({ kind: 'JOB' }),
      [ContentKind.SERVICE]: null,
      [ContentKind.CANDIDATE_PROFILE]: null,
      [ContentKind.CV]: null,
    });

    const result = await dispatcher.readContent(ContentKind.CV, 'cv-1');

    expect(result).toBeNull();
  });

  // C3 (PR#294 rodada 2) — `supportedKinds()`/`readerFor()` públicos: fecham o
  // achado de que o teste de sincronia do container introspeccionava um campo
  // privado via `as unknown as`. Cobertos aqui no dispatcher isolado; o teste
  // de sincronia real (`container-content-moderation-reader-kinds.test.ts`)
  // usa a mesma API pública contra o container de produção.
  it('supportedKinds() lista só os kinds com reader não-nulo', () => {
    const dispatcher = new DispatchingContentModerationReader({
      [ContentKind.JOB]: fakeReader({ kind: 'JOB' }),
      [ContentKind.SERVICE]: fakeReader({ kind: 'SERVICE' }),
      [ContentKind.CANDIDATE_PROFILE]: null,
      [ContentKind.CV]: null,
    });

    expect([...dispatcher.supportedKinds()].sort()).toEqual([ContentKind.JOB, ContentKind.SERVICE].sort());
  });

  it('readerFor() devolve a instância registrada, ou null quando ausente', () => {
    const jobReader = fakeReader({ kind: 'JOB' });
    const dispatcher = new DispatchingContentModerationReader({
      [ContentKind.JOB]: jobReader,
      [ContentKind.SERVICE]: null,
      [ContentKind.CANDIDATE_PROFILE]: null,
      [ContentKind.CV]: null,
    });

    expect(dispatcher.readerFor(ContentKind.JOB)).toBe(jobReader);
    expect(dispatcher.readerFor(ContentKind.CV)).toBeNull();
  });
});
