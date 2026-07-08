import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Sobe a app para os testes E2E. Em CI roda contra o build de produção
  // (`build && start`) para exercitar o comportamento real de ISR/route groups;
  // em dev local usa `dev` e reaproveita um server já rodando.
  webServer: {
    command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // O rate limiting de hardening (US #200) tem teto anônimo de 10/min, que o
    // volume de requests do Next + Playwright estoura. Desligado no E2E (dev e
    // CI). É seguro: o guard de `shared/env.ts` mira `VERCEL_ENV` (deploy real),
    // e nem o dev local nem o CI são deploy Vercel — só num deploy de
    // produção/preview a flag travaria o boot.
    //
    // CV_EXTRACTOR_FAKE (USP-040 / A-12): liga o `FakeCVExtractor` no lugar do
    // adapter Anthropic real — mesmo guard de `VERCEL_ENV` (nunca ativo num
    // deploy real). Sem chamada real ao LLM no E2E.
    env: { RATE_LIMIT_DISABLED: 'true', CV_EXTRACTOR_FAKE: 'true' },
  },
});
