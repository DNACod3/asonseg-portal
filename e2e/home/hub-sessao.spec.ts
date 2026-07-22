import { test, expect } from '@playwright/test';

/**
 * E2E de "Casca autenticada — sidebar/menu de perfil" (USP-064/065 round 2,
 * PR #293 fix 3). Antes (USP-063) a navegação desktop era um hambúrguer
 * opcional; agora a `AppSidebar` (USP-064) e o `ProfileMenu` (USP-065) são
 * chrome **permanente** de toda rota `(app)/*` — montados uma única vez no
 * composition-root (`(app)/layout.tsx`) — e o Menu de Perfil é o único
 * caminho de produção para "Sair" (PROF-MN-05).
 *
 * Decisão de pirâmide de testes (mesmo padrão de `e2e/ativar-papel.spec.ts`,
 * `e2e/candidato.spec.ts` e `e2e/login.spec.ts`; precedente L-007/AD-025/
 * AD-027): o comportamento interativo da sidebar/menu — collapse/expand,
 * abrir/fechar o disclosure, Esc/clique fora, Sair — é verificado de forma
 * autoritativa, sem semear sessão Supabase nem esbarrar no rate limit
 * anônimo, em:
 *   - `src/app/(app)/_components/__tests__/app-sidebar.test.tsx`,
 *   - `src/app/(app)/_components/__tests__/profile-menu.test.tsx`,
 *   - `src/app/(app)/_components/__tests__/app-shell.test.tsx`.
 * `/inicio` não está nos Top 8 fluxos críticos (architecture-document §6),
 * mas é a rota hub onde a casca (sidebar + menu de perfil) monta para
 * **toda** `(app)/*` — aqui travamos o que só o E2E garante: o confinamento
 * da rota (middleware de borda + `requireActivePerson` no layout `(app)`)
 * continua valendo mesmo com a sidebar/menu como chrome permanente.
 */

test.describe('Casca autenticada — sidebar/menu de perfil (USP-064/065)', () => {
  test('rota autenticada: acesso sem sessão a /inicio redireciona para /login', async ({ page }) => {
    await page.goto('/inicio');
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.locator('h1')).toContainText('Entrar');
  });
});
