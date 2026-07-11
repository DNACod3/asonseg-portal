/**
 * Sinais de request + página 429 do rate limit — remediação USP-050
 * (PUB-1b/PUB-1c). Funções puras de `Headers`/número → boolean/string,
 * Edge-safe (sem Node/`Buffer`/fs), usadas pelo `middleware.ts`.
 */

/**
 * Reconhece um request de **prefetch** disparado pelo `<Link>` do Next.js
 * App Router. O header `Next-Router-Prefetch: 1` é o único sinal confiável —
 * `RSC: 1`/`?_rsc=` aparecem em todo request RSC (prefetch **e** navegação
 * soft), logo não distinguem prefetch sozinhos (confirmado na doc do Next 15).
 *
 * Fallback secundário: header `Purpose: prefetch` (usado por alguns clientes/
 * proxies para sinalizar prefetch fora do ecossistema Next).
 */
export function isPrefetchRequest(headers: Headers): boolean {
  if (headers.get('next-router-prefetch') === '1') return true;
  return headers.get('purpose') === 'prefetch';
}

/**
 * Reconhece uma **navegação de documento** (hard load / barra de endereço),
 * para decidir se o 429 deve ser servido como HTML em vez de JSON.
 *
 * Navegação de documento sempre manda `Accept: text/html,…` e **sem** header
 * `rsc`. Requests RSC/Server Action mandam `rsc: 1`/`Next-Action` e um
 * `Accept` genérico (ex.: wildcard ou `text/x-component`). Falha segura: sem
 * `Accept` (ou sem `text/html`), cai no ramo JSON.
 */
export function isDocumentRequest(headers: Headers): boolean {
  if (headers.get('rsc') === '1') return false;
  const accept = headers.get('accept') ?? '';
  return accept.includes('text/html');
}

/**
 * Renderiza a página 429 (HTML PT-BR, casca mínima, self-contained). Servida
 * diretamente do Edge Middleware — o middleware retorna antes do roteamento
 * Next, então não há como usar uma rota/RSC (`app/**` fica fora desta
 * unidade). Sem asset externo (fonte/CDN/imagem remota) — compatível com a
 * CSP `default-src 'self'` / `style-src 'unsafe-inline'`.
 */
export function renderRateLimitedHtml(retryAfterSeconds: number): string {
  const seconds = Math.max(1, Math.round(retryAfterSeconds));
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Muitas requisições — Portal ASONSEG</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1.5rem; color: #1f2937; text-align: center; }
  h1 { font-size: 1.5rem; }
  a { color: #1d4ed8; }
</style>
</head>
<body>
<h1>Muitas requisições</h1>
<p>Você fez muitas requisições em pouco tempo. Aguarde cerca de ${seconds} segundos e tente novamente.</p>
<p><a href="/">Voltar ao início</a></p>
</body>
</html>`;
}
