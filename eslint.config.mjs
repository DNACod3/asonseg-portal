import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Regra canônica (CLAUDE.md): imports de módulos só via barrel `@/modules/<mod>`.
      // Proíbe caminhos profundos como `@/modules/persons/actions/foo`.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*/*'],
              message:
                'Importe módulos apenas via barrel: `@/modules/<modulo>`. Caminhos profundos são proibidos (CLAUDE.md).',
            },
          ],
        },
      ],
      // Convenção: vars/args/caught errors com prefixo `_` são intencionalmente
      // não usados (ex.: assinaturas de stubs como middleware Next).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'docs/**',
      'coverage/**',
      'playwright-report/**',
      // Diretórios de tooling/agents (não são código-fonte da app): com `eslint .`
      // o escopo abrange a raiz, então ignoramos explicitamente o que `next lint`
      // não cobria.
      '.claude/**',
      '.cursor/**',
      '.agents/**',
      '.specs/**',
      '.wolf/**',
    ],
  },
];

export default eslintConfig;
