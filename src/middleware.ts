import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware do Next.js — gancho para revalidação de sessão por request
 * (ADR-0030 — fecha a janela de "sessão zumbi" após USP-007 inativar Pessoa).
 *
 * **STUB MÍNIMO.** Esta versão apenas deixa a request passar; a lógica real
 * (ler cookie Supabase, validar JWT, checar Person.status + session_version,
 * cache LRU 30s) será implementada pela task T-08 da USP-004
 * (ver IDSD/.specs/features/usp-004-autenticar-no-portal/tasks.md T-08).
 *
 * Já existir como stub no master destrava T-08 e permite que outras tasks
 * (T-07 LoginForm, T-09 trocar-senha) presumam o ponto de extensão.
 */
export function middleware(_request: NextRequest): NextResponse {
  return NextResponse.next();
}

/**
 * Aplica o middleware a rotas autenticadas e ao fluxo de auth.
 * Exclui arquivos estáticos, API internas e Next.js assets.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, manifest, robots, sitemap
     * - api (route handlers protegem-se por si)
     * - arquivos com extensão (favicon, fontes, imagens)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest|robots|sitemap|api|.*\\..*).+)',
  ],
};
