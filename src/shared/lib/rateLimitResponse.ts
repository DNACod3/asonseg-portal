/**
 * Sinais de request + página 429 do rate limit — remediação USP-050
 * (PUB-1b/PUB-1c). Funções puras de `Headers`/número → boolean/string,
 * Edge-safe (sem Node/`Buffer`/fs), usadas pelo `middleware.ts`.
 */

/**
 * Reconhece um **fetch de dados do client router** do Next.js App Router
 * (RSC) — cobre TANTO prefetch (hover/viewport de `<Link>`) QUANTO uma
 * navegação client-side real (clique que completa a rota).
 *
 * **Correção pós-verificação (USP-050, ciclo de fix — achado empírico do
 * Verifier, Next 15.5.18):** a doc do Next 15 promete o header
 * `Next-Router-Prefetch: 1` como sinal de prefetch, mas ele — junto com `RSC`
 * e o query param `_rsc` — **nunca chega a `request.headers`/`request.nextUrl`
 * dentro do Edge Middleware** neste servidor real. Confirmado com
 * instrumentação temporária (revertida) + `curl -v` + um browser Chromium
 * real (Playwright): um header de controle arbitrário chega, esses não —
 * são consumidos/normalizados pelo Next internamente antes de invocar o
 * middleware do usuário. Como prefetch e navegação client-side real usam a
 * MESMA função de fetch (`fetchServerResponse`) e **nenhum sinal sobrevive
 * para diferenciá-las** no middleware desta versão, esta função
 * deliberadamente NÃO tenta separar as duas (decisão ancorada na intenção de
 * PUB-1b: "navegar normalmente pelo portal não deve estourar o teto
 * anônimo" — ver spec.md Assumptions).
 *
 * O sinal que **sobrevive de fato** (confirmado empiricamente) é o header
 * `Next-Url`: o client router o define em toda fetch de dados RSC (prefetch
 * **e** navegação real), mas NUNCA em navegação de documento real (hard
 * load/endereço — confirmado: `Accept: text/html` + `Sec-Fetch-Mode:
 * navigate`, sem `Next-Url`) nem em clientes fora do Next (curl, scrapers —
 * confirmado: um Server Action POST real chega com `Next-Action`/
 * `Content-Type: text/plain`, também sem `Next-Url`). Por isso é seguro para
 * excluir prefetch+soft-nav do rate limit sem abrir uma brecha de scraping
 * anônimo (GET) nem de abuso de mutação (POST — adicionalmente protegido
 * pelo gate de método em `middleware.ts`, que só aplica este bypass a
 * GET/HEAD).
 *
 * Fallback secundário: header `Purpose: prefetch` (mecanismo legado de outro
 * ecossistema/CDN; não confirmado no Next 15.5, mantido por não ter custo
 * caso nunca dispare).
 */
export function isRouterDataRequest(headers: Headers): boolean {
  if (headers.get('next-url') !== null) return true;
  return headers.get('purpose') === 'prefetch';
}

/**
 * Reconhece uma **navegação de documento** (hard load / barra de endereço),
 * para decidir se o 429 deve ser servido como HTML em vez de JSON.
 *
 * Navegação de documento sempre manda `Accept: text/html,…` (confirmado
 * empiricamente: `Sec-Fetch-Mode: navigate`, `Sec-Fetch-Dest: document`).
 * Requests RSC/fetch/Server Action mandam um `Accept` genérico (wildcard ou
 * `text/x-component` — confirmado tanto para prefetch/soft-nav quanto para um
 * Server Action POST real). Falha segura: sem `Accept` (ou sem `text/html`),
 * cai no ramo JSON.
 *
 * **Correção pós-verificação (USP-050):** o check anterior (`rsc === '1'`)
 * era código morto — o header `rsc` nunca chega a `request.headers` nesta
 * versão do Next (mesma raiz de `isRouterDataRequest` acima) — removido.
 * `Accept` sozinho já é o único sinal confiável disponível e é suficiente na
 * prática (nenhum caso real observado de RSC/Server-Action mandando
 * `Accept: text/html`).
 */
export function isDocumentRequest(headers: Headers): boolean {
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
