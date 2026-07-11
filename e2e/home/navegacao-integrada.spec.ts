import { test, expect } from '@playwright/test';

/**
 * E2E público (USP-048 — NAV-01/NAV-05/NAV-06). Remediação do finding ⚠️ da
 * revisão da PR #289: os testes RTL de `home-search.test.tsx` só reafirmavam
 * o contrato estático do form (já coberto por HOME-03) sem exercitar o
 * round-trip real — nem `/vagas` consumindo `?q=`, nem um card de categoria
 * chegando em `/servicos?categoria=…`. Este spec fecha essa lacuna com um
 * fluxo vivo contra o servidor Next.js (mesmo padrão de promoção
 * skeleton→E2E de L-007).
 *
 * **DB-resiliente** (mesmo padrão de `e2e/home/indicadores.spec.ts`): asserta
 * a MECÂNICA de navegação (URL final + landmark/heading visível + status <
 * 400), nunca contagens/conteúdo dependentes de seed — a home degrada com
 * graça (fallback estático) quando `searchJobs`/`listServiceCategories`
 * falham ou o banco de teste está vazio (ADR-0026), e este spec precisa
 * passar nos dois cenários.
 *
 * Nota de design: a busca do hero (`home-search.tsx`) é um `<form method="get"
 * action="/vagas">` **sem** handler client — submeter dispara uma navegação
 * de página inteira de verdade (não uma transição client do `<Link>`), então
 * `page.waitForResponse` é seguro ali. Já os links de nav/categoria são
 * `<Link>` do Next (client transition + prefetch) — em vez de correr atrás do
 * response exato (sujeito a cache de prefetch), a prova de "sem dead-end" é a
 * combinação href real (nunca `#`) + URL final + heading renderizado; o
 * "resolve com status < 400" desses alvos é verificado à parte, por
 * navegação direta (`page.goto`), no mesmo padrão de `indicadores.spec.ts`.
 */
test.describe('USP-048 — navegação integrada das telas públicas (anônimo)', () => {
  test('@nav-01 busca do hero com termo: chega em /vagas?q=<termo> e a listagem renderiza o termo', async ({
    page,
  }) => {
    await page.goto('/');

    const searchInput = page.getByRole('searchbox', { name: /buscar vagas/i });
    await expect(searchInput).toBeVisible();
    await searchInput.fill('eletricista');

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === 'GET' && new URL(res.url()).pathname === '/vagas',
      ),
      page.getByRole('button', { name: /^buscar$/i }).click(),
    ]);

    expect(response.status()).toBeLessThan(400);
    expect(new URL(page.url()).searchParams.get('q')).toBe('eletricista');
    await expect(page.getByRole('heading', { name: /vagas de emprego/i })).toBeVisible();
    // O termo submetido volta preenchido no próprio input de busca da
    // listagem — confirma que `/vagas` de fato CONSOME `?q=` (não só que a
    // URL mudou), sem depender de haver resultado nenhum no seed.
    await expect(page.getByRole('searchbox').first()).toHaveValue('eletricista');
  });

  test('@nav-01 busca do hero com termo vazio ainda navega para /vagas sem erro', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.getByRole('searchbox', { name: /buscar vagas/i });
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveValue('');

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.request().method() === 'GET' && new URL(res.url()).pathname === '/vagas',
      ),
      page.getByRole('button', { name: /^buscar$/i }).click(),
    ]);

    expect(response.status()).toBeLessThan(400);
    await expect(page.getByRole('heading', { name: /vagas de emprego/i })).toBeVisible();
  });

  test('@nav-03 card de categoria de serviço (href real, nunca dead-end) leva a /servicos e a página renderiza', async ({
    page,
  }) => {
    await page.goto('/');

    const categoryCard = page.getByRole('link', { name: /serviços domésticos/i });
    await expect(categoryCard).toBeVisible();

    const href = await categoryCard.getAttribute('href');
    // Nunca dead-end (NAV-MN-02) e sempre dentro do escopo /servicos — com ou
    // sem `?categoria=…`, conforme o fallback determinístico do design §5.
    expect(href).toMatch(/^\/servicos(\?.*)?$/);

    await categoryCard.click();
    await expect(page).toHaveURL(/\/servicos/);
    expect(new URL(page.url()).pathname).toBe('/servicos');
    // `level: 1` evita colidir com o `<h4>Serviços</h4>` da coluna do footer
    // (presente em toda página da casca pública).
    await expect(page.getByRole('heading', { name: 'Serviços', level: 1 })).toBeVisible();
  });

  test('@nav-05 header/footer/nav primária: hrefs reais na home (sem dead-end) e as rotas resolvem < 400', async ({
    page,
  }) => {
    const homeResponse = await page.goto('/');
    expect(homeResponse?.status()).toBeLessThan(400);

    // Prova estática (sem dead-end): os alvos primários existem na home com
    // href real, nunca "#"/vazio — nav do header, footer e CTAs de entrar/cadastrar.
    await expect(page.getByRole('link', { name: /^vagas$/i }).first()).toHaveAttribute('href', '/vagas');
    await expect(page.getByRole('link', { name: /^serviços$/i }).first()).toHaveAttribute(
      'href',
      '/servicos',
    );
    await expect(page.getByRole('link', { name: /^entrar$/i }).first()).toHaveAttribute('href', '/login');
    await expect(page.getByRole('link', { name: /^cadastrar$/i }).first()).toHaveAttribute(
      'href',
      '/cadastro',
    );
    await expect(page.getByRole('link', { name: /buscar vagas/i }).first()).toHaveAttribute(
      'href',
      '/vagas',
    );
    await expect(page.getByRole('link', { name: /buscar serviços/i }).first()).toHaveAttribute(
      'href',
      '/servicos',
    );

    // Cada rota primária de fato resolve (< 400), mesmo anônimo — mesmo padrão
    // de `e2e/home/indicadores.spec.ts` (goto direto, sem depender de sessão/seed).
    // `/` já foi verificada acima (homeResponse); `/vagas` e `/servicos` já são
    // exercitados AO VIVO (com heading real renderizado, prova mais forte que
    // só o status) pelos testes `@nav-01`/`@nav-03` deste mesmo arquivo — este
    // teste completa a cobertura navegando só a `/login` (categoria `anonymous`
    // do rate limiter, `src/shared/lib/rateLimit.ts`, folgada em 10/min).
    // `/cadastro` fica de fora do `goto` aqui de propósito: a rota cai na
    // categoria `registration` do MESMO limiter — teto duro de 3 req/15min por
    // IP (anti-spam de auto-cadastro) — e já é exercitada ao vivo, repetidas
    // vezes, por `e2e/auto-cadastro.spec.ts`; um `goto` a mais aqui só
    // consumiria essa cota apertada sem ganho de cobertura. O href real de
    // `/cadastro` (nunca dead-end) já foi confirmado estaticamente acima.
    const response = await page.goto('/login');
    expect(response?.status()).toBeLessThan(400);
  });
});
