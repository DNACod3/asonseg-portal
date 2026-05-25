import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace tem múltiplos lockfiles acima da raiz; fixa a raiz de inferência.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
