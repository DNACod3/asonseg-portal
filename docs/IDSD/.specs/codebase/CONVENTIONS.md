# CONVENTIONS.md — Padrões adotados no repo

> Convenções já em vigor (com evidência) vs convenções declaradas em IDSD/CLAUDE.md mas ainda **não exercitadas em código real** (porque não há módulos implementados).

## Imports — barrel obrigatório

**Regra** (ESLint flat config, `eslint.config.mjs`):
```js
'no-restricted-imports': ['error', { patterns: [{
  group: ['@/modules/*/*'],
  message: 'Importe módulos apenas via barrel: @/modules/<modulo>',
}] }]
```

- ✅ `import { x } from '@/modules/persons'`
- ❌ `import { x } from '@/modules/persons/actions/foo'` — quebra CI
- Interno ao próprio módulo: caminhos relativos OK
- Para `shared/`: `@/shared/lib/prisma`, `@/shared/errors`, etc. (alias `@`)

## ActionResult / mapa de erros

`src/shared/errors.ts`:
```ts
type ActionResult<T> = { ok:true; data:T } | { ok:false; error: ActionError }
type ActionErrorCode = 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN'
                     | 'CONSENT_REQUIRED' | 'NOT_FOUND' | 'CONFLICT'
                     | 'PRECONDITION_FAILED' | 'INTERNAL'
ok<T>(data)         // helper success
fail(code, message, fieldErrors?)  // helper failure
```

**Gap descoberto:** o enum **não inclui `INVALID_CREDENTIALS`**, necessário para USP-004 (resposta genérica anti-enumeração). Adicionar — ver `features/usp-004-autenticar-no-portal/gap-analysis.md INC-009`.

Padrão canônico de Server Action sensível (`CLAUDE.md` + `project-guideline.md §7.1`):
1. Zod input
2. `requirePermission(...)`
3. `requireActiveConsent(personId, purpose)` (quando aplicável)
4. Pré-condições
5. `withAudit('EVENT', async tx => { ... })`
6. Retorno `ActionResult<T>` — **nunca throw**

Status real: padrão **documentado**, **zero Server Actions implementadas**. Validação só na USP-004.

## Logger (pino)

`src/shared/lib/logger.ts`:
- Nível via `LOG_LEVEL` (default `info`)
- Redaction de 35+ campos sensíveis (password, cpf, email, token...) com `[REDACTED]`
- `pino-pretty` em dev (legível), JSON em prod
- `childLogger(bindings)` para contexto fixo

**Em uso real:** ❌ nenhum consumidor ainda. Primeira validação vem na `loginAction` da USP-004.

## Validação de env por Zod

`src/shared/env.ts`:
- Esquema Zod completo das 16 variáveis
- `parseEnv()` agrega erros em mensagem PT-BR
- `export const env = parseEnv()` no load — **build falha se inválido**

## Conventional Commits

Evidência nos últimos 6 commits do `master`:

```
58bbaf7 docs(consents): termos de consentimento LGPD v1.0 das 8 finalidades (#230)
4ccbc8c US #111 — Seed de taxonomia e checklists (#113 #115) (#229)
39d5ab5 US #105 — Spikes técnicos + drill de restore (...) (#228)
7cdf8b9 docs(infra): provisionamento de ambientes (US #95) (#227)
4281982 chore(infra): hardening pós-bootstrap (logger PII, eslint ., ISR por rota) (#226)
896cbea feat(infra): bootstrap do monolito modular (US #100) (#225)
```

- Tipo `(escopo)`: subject em PT-BR, imperativo, minúsculo
- Escopos vistos: `consents`, `infra`, `docs`. Catálogo válido em CLAUDE.md inclui também `identity`, `persons`, `companies`, `moderation`, `jobs`, `services`, `referrals`, `cv-extraction`, `audit`, `reporting`, `tests`, `ci`
- Merge strategy: squash (commits mensais sempre `(#NNN)`)

## Timezone

CLAUDE.md exige `timestamptz` UTC no DB, conversão para `America/Sao_Paulo` no boundary com `date-fns-tz`. Utilities em `src/shared/lib/time.ts` (`saoPauloToUtc`, `utcToSaoPaulo`, `formatSaoPaulo`, `formatDate`). **Testado** (9 testes em `shared/lib/__tests__/time.test.ts`).

## Prisma

CLAUDE.md exige: `take` sempre (paginação obrigatória), `select`/`include` explícitos, evitar N+1, never throw. **Não exercitado em queries de domínio ainda** — só taxonomia (seed).

## Aderência consolidada

| Convenção | Documentada? | Implementada? | Exercitada? |
|-----------|--------------|---------------|-------------|
| Barrel imports | ✅ ESLint enforça | ✅ regra ativa | ⚠️ pouca superfície (modules vazio) |
| ActionResult | ✅ | ✅ helpers ok/fail | ❌ zero actions usam |
| Server Action sequência | ✅ | ❌ `requirePermission` etc. não existem | ❌ |
| pino logger | ✅ | ✅ configurado | ❌ não chamado |
| Zod env | ✅ | ✅ validação em load | ✅ build-time |
| Conventional Commits | ✅ | ✅ últimos 6 commits ok | ✅ |
| date-fns-tz boundary | ✅ | ✅ utils completos | ✅ (testes) |
| `take` + `select` Prisma | ✅ | n/a | ❌ |
