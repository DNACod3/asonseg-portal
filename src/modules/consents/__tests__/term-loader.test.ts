import { describe, it, expect } from 'vitest';
import { loadTerm, TermLoaderError } from '../adapters/term-loader';
import { CONSENT_PURPOSES } from '../domain/purposes';
import { TERMS_REGISTRY, currentTermVersion } from '../domain/terms-registry';

/**
 * Lê os arquivos reais de `legal/consent-terms/` (sem mocks). Garante que o
 * registro de hashes não diverge do conteúdo versionado em Git — se alguém
 * editar um `v1.0.md` sem subir a versão/hash, este teste quebra (issue #35).
 */
describe('consents/term-loader — termos reais', () => {
  it('carrega as 8 finalidades e o hash bate com o registro', async () => {
    for (const purpose of CONSENT_PURPOSES) {
      const term = await loadTerm(purpose);
      expect(term.purpose).toBe(purpose);
      expect(term.version).toBe(currentTermVersion(purpose));
      expect(term.content.length).toBeGreaterThan(0);
      expect(term.hash).toBe(TERMS_REGISTRY[purpose].expectedHash);
    }
  });

  it('expõe versão, base legal e status do front-matter', async () => {
    const term = await loadTerm('JOB_APPLICATION');
    expect(term.version).toBe('v1.0');
    expect(term.legalBasis).toMatch(/LGPD art\. 7/);
    expect(term.status).toBeTruthy();
    expect(term.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('o termo CV_AI_EXTRACTION menciona o provedor de IA externo', async () => {
    const term = await loadTerm('CV_AI_EXTRACTION');
    expect(term.content.toLowerCase()).toMatch(/intelig[êe]ncia artificial|provedor de ia/);
    expect(term.content).toMatch(/Anthropic|Claude/);
  });

  it('versão inexistente bloqueia com TERM_NOT_FOUND', async () => {
    await expect(loadTerm('JOB_APPLICATION', 'v9.9')).rejects.toMatchObject({
      name: 'TermLoaderError',
      code: 'TERM_NOT_FOUND',
    });
    await expect(loadTerm('JOB_APPLICATION', 'v9.9')).rejects.toBeInstanceOf(TermLoaderError);
  });

  it('aceita o formato de versão legado (slug@vN.M) normalizando para o arquivo', async () => {
    const term = await loadTerm('JOB_APPLICATION', 'job-application@v1.0');
    expect(term.version).toBe('v1.0');
    expect(term.hash).toBe(TERMS_REGISTRY.JOB_APPLICATION.expectedHash);
  });

  it('rejeita versão fora do formato vN.M (defesa de path traversal)', async () => {
    await expect(loadTerm('JOB_APPLICATION', '../../etc/passwd')).rejects.toMatchObject({
      name: 'TermLoaderError',
      code: 'TERM_NOT_FOUND',
    });
  });
});
