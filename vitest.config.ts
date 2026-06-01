import { defineConfig, configDefaults } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // jsdom: o setup carrega `@testing-library/jest-dom` e o include cobre `.tsx`,
    // então testes de componente precisam de DOM. Glue puro (node) roda igual aqui.
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Testes de integração (`*.int.test.ts`) precisam de Postgres local e rodam
    // num run separado (`npm run test:integration`, vitest.integration.config.ts).
    exclude: [...configDefaults.exclude, 'src/**/*.int.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Fundação pura/testável: `shared/` + os módulos de domínio já implementados.
      // Glue de IO (Prisma/Supabase/logger), páginas do App Router e config ficam
      // fora do gate até terem testes próprios.
      include: ['src/shared/**/*.ts', 'src/modules/**/*.ts', 'src/middleware.ts'],
      exclude: [
        'src/shared/lib/prisma.ts',
        'src/shared/lib/logger.ts',
        'src/shared/lib/supabase/**',
        'src/**/*.{test,spec}.ts',
        'src/**/index.ts',
      ],
      // Gate de CI: alvo 70%, falha abaixo de 65% (task #103 / #104).
      thresholds: {
        lines: 65,
        statements: 65,
        functions: 65,
        branches: 65,
      },
    },
  },
});
