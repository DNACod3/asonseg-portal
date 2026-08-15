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
    const dispatcher = new DispatchingContentModerationReader({ [ContentKind.JOB]: jobReader });

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
    });

    await dispatcher.readContent(ContentKind.SERVICE, 'svc-1');

    expect(serviceReader.readContent).toHaveBeenCalledWith(ContentKind.SERVICE, 'svc-1');
    expect(jobReader.readContent).not.toHaveBeenCalled();
  });

  it('kind sem entrada no mapa (ex.: CV isolado) ⇒ null, sem lançar', async () => {
    const dispatcher = new DispatchingContentModerationReader({
      [ContentKind.JOB]: fakeReader({ kind: 'JOB' }),
    });

    const result = await dispatcher.readContent(ContentKind.CV, 'cv-1');

    expect(result).toBeNull();
  });
});
