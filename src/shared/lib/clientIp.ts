/**
 * Extrai o IP real do cliente a partir dos headers da request.
 *
 * Prioriza headers que a Vercel injeta a partir da conexão real
 * (`x-vercel-forwarded-for`, `x-real-ip`) — não forjáveis pelo cliente.
 * O `x-forwarded-for` é spoofável (cliente pode enviar qualquer valor, e a
 * Vercel apenas anexa o IP real à direita), então só é usado como último
 * recurso e lendo o valor mais à direita (appended pela borda confiável).
 *
 * Reutilizado pelo Edge Middleware e pelos Server Actions para garantir
 * consistência entre rate limiting e audit log.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  const vercel = headers.get('x-vercel-forwarded-for');
  if (vercel) return (vercel.split(',').at(0) ?? vercel).trim();

  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.at(-1) ?? 'unknown';
  }

  return 'unknown';
}
