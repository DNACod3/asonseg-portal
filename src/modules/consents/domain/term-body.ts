/**
 * Helpers puros (sem IO) de apresentação do texto de um termo de consentimento.
 *
 * Os arquivos em `legal/consent-terms/` trazem um front-matter YAML
 * (`---\n...\n---`) com metadados (versão, hash, base legal). Para exibir o termo
 * ao titular no painel (USP-043 / #39) queremos só o corpo legível.
 */

/** Texto de fallback quando o corpo de uma versão do termo não pôde ser lido. */
export const TERM_BODY_UNAVAILABLE =
  'Não foi possível carregar o texto desta versão do termo.';

/**
 * Remove o front-matter YAML (`---...---`) do conteúdo de um termo, devolvendo
 * apenas o corpo legível (sem espaços nas pontas). Idempotente e seguro para
 * conteúdo sem front-matter (retorna o texto original aparado).
 */
export function stripTermFrontMatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
}
