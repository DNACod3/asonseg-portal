import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Caminhos de erro do loader com `node:fs` mockado — não dependem dos arquivos
 * reais. Cobre adulteração de conteúdo (hash divergente) e falha de leitura
 * (arquivo ausente), ambos exigidos pela DoD da issue #35.
 */
const fsState = vi.hoisted(() => ({
  readFile: vi.fn<(...args: unknown[]) => Promise<Buffer>>(),
}));

vi.mock('node:fs/promises', () => {
  const readFile = (...args: unknown[]) => fsState.readFile(...args);
  return { readFile, default: { readFile } };
});

const { loadTerm } = await import('../adapters/term-loader');

beforeEach(() => {
  fsState.readFile.mockReset();
});

describe('consents/term-loader — integridade (fs mockado)', () => {
  it('conteúdo adulterado na versão vigente bloqueia com TERM_HASH_MISMATCH', async () => {
    fsState.readFile.mockResolvedValue(Buffer.from('conteúdo adulterado do termo', 'utf8'));
    await expect(loadTerm('JOB_APPLICATION')).rejects.toMatchObject({
      name: 'TermLoaderError',
      code: 'TERM_HASH_MISMATCH',
    });
  });

  it('falha de leitura do arquivo bloqueia com TERM_NOT_FOUND', async () => {
    fsState.readFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    await expect(loadTerm('PORTAL_ACCESS')).rejects.toMatchObject({
      name: 'TermLoaderError',
      code: 'TERM_NOT_FOUND',
    });
  });
});
