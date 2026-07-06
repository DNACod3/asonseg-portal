import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

/**
 * Suíte de integração — exercita as garantias que vivem no Postgres
 * (trigger/REVOKE append-only do `audit_log`, máquinas de estado, etc.).
 *
 * Requer a stack local do Supabase CLI no ar (`supabase start`) e o env de
 * `.env.local` (DATABASE_URL/DIRECT_URL). Rode via `npm run test:integration`.
 * Os testes fazem `describe.skipIf(!process.env.DATABASE_URL)`, então degradam
 * com graça quando não há banco (ex.: CI sem serviço de Postgres).
 *
 * `react()` espelha o config unitário: o barrel `@/modules/identity` reexporta
 * componentes `.tsx`; sem o plugin, o esbuild respeita `jsx: preserve` do
 * tsconfig e aborta o transform dos testes que importam o barrel (issue #247).
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    globals: true,
    // `prisma/__tests__/*.integration.test.ts` fica fora de `src/**` (não é
    // código de módulo) — padrão de sufixo próprio (`.integration.test.ts`, não
    // `.int.test.ts`) para o teste do seed, que testa `prisma/seeds/` e não um
    // módulo de `src/modules/**` (F0B-01 / AC-111-1).
    include: ['src/**/*.int.test.ts', 'prisma/**/*.integration.test.ts'],
    // Sem gate de cobertura aqui — a cobertura é medida no run unitário.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // IO real contra um único banco: evita corrida entre arquivos.
    fileParallelism: false,
  },
});
