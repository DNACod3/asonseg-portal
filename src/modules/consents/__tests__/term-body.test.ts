import { describe, it, expect } from 'vitest';
import { stripTermFrontMatter, TERM_BODY_UNAVAILABLE } from '../domain/term-body';

/**
 * `stripTermFrontMatter` é a regra pura de apresentação extraída da página do
 * painel (USP-043 / #39): remove o front-matter YAML dos arquivos de termo para
 * exibir só o corpo legível ao titular.
 */
describe('consents/stripTermFrontMatter', () => {
  it('remove o front-matter YAML e apara o corpo', () => {
    const content = '---\nversao: v1.0\nhash: abc123\n---\n\n# Termo de uso\n\nCorpo do termo.\n';
    expect(stripTermFrontMatter(content)).toBe('# Termo de uso\n\nCorpo do termo.');
  });

  it('suporta CRLF no front-matter', () => {
    const content = '---\r\nversao: v1.0\r\n---\r\nCorpo CRLF.';
    expect(stripTermFrontMatter(content)).toBe('Corpo CRLF.');
  });

  it('é idempotente para conteúdo sem front-matter (apenas apara)', () => {
    expect(stripTermFrontMatter('  Texto solto.  ')).toBe('Texto solto.');
  });

  it('só remove o PRIMEIRO bloco --- (separadores no corpo são preservados)', () => {
    const content = '---\nv: 1\n---\nIntro\n\n---\n\nSeção 2';
    expect(stripTermFrontMatter(content)).toBe('Intro\n\n---\n\nSeção 2');
  });

  it('expõe um texto de fallback estável', () => {
    expect(TERM_BODY_UNAVAILABLE).toMatch(/não foi possível carregar/i);
  });
});
