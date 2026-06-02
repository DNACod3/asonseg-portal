import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace tem múltiplos lockfiles acima da raiz; fixa a raiz de inferência.
  outputFileTracingRoot: __dirname,
  // Os termos de consentimento (USP-043) são lidos do disco em runtime pelo
  // `term-loader` (Server Actions / RSC). Garante que os arquivos sigam no bundle
  // serverless das rotas que consomem `loadTerm` (Vercel não os inclui sozinho).
  outputFileTracingIncludes: {
    '/**': ['./legal/consent-terms/**/*.md'],
  },
};

export default nextConfig;
