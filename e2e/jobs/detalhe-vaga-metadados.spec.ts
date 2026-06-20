import { test, expect } from '@playwright/test';

/**
 * E2E dos metadados do detalhe (USP-022 — #278 / P-002). O detalhe é uma rota pública
 * indexável: nenhum canal servido ao crawler/social pode conter o nome real da Empresa —
 * nem `<title>`, meta description, Open Graph, Twitter Card, JSON-LD ou URL canônica
 * (P-002/E-001/D-001). A anonimização vive no View Model (`viewJobDetail`), única fonte.
 *
 * Depende do seed: Empresa "Lojas Guadalupe (demo)" verificada, vaga "Vendedor(a) de loja".
 */

const JOB = '00000000-0000-0000-0000-00000000d002';
const REAL_NAME = 'Lojas Guadalupe';

test.describe('Detalhe da vaga — metadados anonimizados (USP-022 / P-002)', () => {
  test('@p-002 @e-001 @d-001 nenhum canal de metadados contém o nome real da Empresa', async ({
    page,
  }) => {
    await page.goto(`/vagas/${JOB}`);

    const html = await page.content();
    // O nome real não pode aparecer em NENHUM lugar do documento servido ao anônimo.
    expect(html).not.toContain(REAL_NAME);

    // Open Graph e Twitter Card presentes e anonimizados.
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    const twTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content');
    expect(ogTitle).not.toContain(REAL_NAME);
    expect(twTitle).not.toContain(REAL_NAME);

    // JSON-LD JobPosting: hiringOrganization anonimizado por setor.
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(jsonLd).toBeTruthy();
    const data = JSON.parse(jsonLd!);
    expect(data['@type']).toBe('JobPosting');
    expect(JSON.stringify(data)).not.toContain(REAL_NAME);
    expect(data.hiringOrganization.name).toMatch(/Empresa do setor de/i);
  });

  test('vaga indisponível: metadados sem dado sensível e noindex', async ({ page }) => {
    await page.goto('/vagas/00000000-0000-0000-0000-0000000000ff');
    await expect(page).toHaveTitle(/indisponível/i);
    expect(await page.content()).not.toContain(REAL_NAME);
    // Vaga não-detalhável não pode ser indexada (generateMetadata ⇒ robots.index=false).
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toMatch(/noindex/i);
  });
});
