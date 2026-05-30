# TESTING.md — Estratégia de testes (estado atual)

## Configurações

**Vitest** (`vitest.config.ts`):
- `environment: jsdom` · `globals: true`
- `include: src/**/*.{test,spec}.{ts,tsx}`
- `setupFiles: vitest.setup.ts`
- Coverage v8: inclui `src/shared/**/*.ts`; exclui `prisma.ts`, `logger.ts`, `supabase/`, `index.ts`, `*test*`
- **Threshold CI: 65%** (lines/statements/functions/branches)
- `vitest.setup.ts`: `process.env.TZ = 'UTC'` + injeção de `TEST_ENV` dummy

**Playwright** (`playwright.config.ts`):
- `testDir: e2e/`, `baseURL: http://localhost:3000`
- `fullyParallel: true`, `forbidOnly: true` em CI
- Workers/retries: CI `1/2`, dev `auto/0`
- Browsers: Chromium Desktop apenas (suficiente para MVP PT-BR)
- `webServer`: `npm run dev` (dev) / `npm run build && npm run start` (CI)

## Localização dos testes

Co-localizados em `__tests__/`:

| Arquivo | Cobertura |
|---------|-----------|
| `src/shared/__tests__/errors.test.ts` | 3 testes — ok(), fail(), fieldErrors |
| `src/shared/__tests__/env.test.ts` | 5 testes — schema, enums, defaults |
| `src/shared/__tests__/container.test.ts` | 4 testes — register, singleton, reset, not-found |
| `src/shared/__tests__/smoke.test.ts` | 1 dummy (sanity) |
| `src/shared/lib/__tests__/time.test.ts` | 9 testes — TZ conversion, round-trip, formatos |
| `e2e/smoke.spec.ts` | 1 E2E — home carrega |

**Total atual:** 22 unit + 1 E2E.

## Resultado atual

```
Test Files: 5 passed
Tests:     22 passed
Coverage:  ~100% nas linhas incluídas no scope (errors/env/container)
```

Lib `time.ts` excluída do gate (coverage não conta). Resto da app não conta pois `src/app/**` e `src/modules/**` estão fora do `coverage.include`.

## Gaps vs requisito IDSD (`project-guideline §9`)

| Requisito IDSD | Estado atual | Gap |
|----------------|--------------|-----|
| Cobertura geral 70% (CI falha < 65%) | gate 65% → alvo 70% | ⚠️ piso aceito; subir threshold quando módulos forem entregues |
| Cobertura ≥ 90% em regras de domínio | n/a (sem módulos) | ❌ a exercitar |
| Cobertura ≥ 80% em Server Actions sensíveis | n/a (sem actions) | ❌ a exercitar |
| Top-8 E2E flows (auth→cadastro→vaga→...) | 1 smoke (home) | ❌ falta plano de E2E |
| Test fixtures / factories | inexistente | ❌ a criar na 1ª implementação |
| Teste happy + 4 sad paths (validação, permissão, consentimento, concorrência) | n/a | ❌ template não exercitado |

**Top-8 flows IDSD** (de `technical-design.md §6.3`):
1. Auto-cadastro → login (USP-001 + USP-004)
2. Ativar papel candidato + CV (USP-006 + USP-009)
3. Publicar vaga → moderar → buscar → candidatar (USP-020 → 016 → 021 → 025)
4. Publicar serviço → buscar → manifestar (USP-029 → 030 → 033)
5. Encaminhar Pessoa → badge na lista (USP-037)
6. Consentimento + revogação → papel desativado (USP-043)
7. Anonimização da Empresa para anônimo (USP-021/030 sem login)
8. Ficha social invisível ao coordenador (USP-036/039)

## Recomendações imediatas

- **Subir threshold para 70%** quando primeira Server Action sensível for adicionada (USP-004 T-06).
- **Adicionar `e2e/login.spec.ts`** como parte de USP-004 T-07/T-08 — primeiro flow real do top-8.
- **Criar factory de Pessoa** em `src/modules/identity/__tests__/factories.ts` para reuso em todos os módulos downstream.
- Adicionar um teste de integração com `TZ='America/Sao_Paulo'` (não só UTC do setup) para pegar bugs de DST.
