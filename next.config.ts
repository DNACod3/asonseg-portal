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
  // CAND-5 / RF-05 / RF-MN-04: default 1 MB < 5 MB (MAX_CV_BYTES, CVE-01) — um CV
  // válido estourava o transporte da Server Action (HTTP 413) antes de chegar à
  // action. '6mb' cobre 5 MB + folga do `state` do RSC sem afrouxar demais a
  // proteção contra payloads abusivos.
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
