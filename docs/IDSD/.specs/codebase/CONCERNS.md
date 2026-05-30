# CONCERNS.md — Fragilidades e tech debt observados

> Cada item: descrição, evidência (file:linha quando aplicável), severidade, recomendação.

## C-01 — `docker-compose.yml` legado vs README desatualizado (🔴 ALTA)

- `docker-compose.yml:1-34` traz Postgres + MailHog, marcado como descontinuado em comentário no topo.
- `README.md:23-41` ainda manda `docker compose up -d` como passo 1.
- `CLAUDE.md` e `IDSD/architecture/0016-ambiente-local-supabase-cli.md` declaram Supabase CLI como o padrão.

**Risco:** dev novo sobe ambos, ocorre conflito de porta com Supabase local, dados em DBs paralelos. Confusão consome horas.

**Recomendação:** ou **remover** `docker-compose.yml` (ADR-0016 já decidiu), ou ao menos reescrever o `README.md §Setup` para instruir `supabase start`. Adicionar aviso `CONTRIBUTING.md` se houver.

## C-02 — `src/middleware.ts` ausente (🔴 ALTA)

- Arquivo não existe.
- `ADR-0030` (`architecture/adrs/0030-revalidacao-de-status-e-permissao-por-requisicao.md`) exige revalidação por request.
- `(app)/*` está marcado `force-dynamic` mas **nada** valida sessão / status da Pessoa.

**Risco:** Pessoa inativada (USP-007) continua operando 12h. Bypass do gate de autenticação. **Impede T-08 da USP-004.**

**Recomendação:** scaffoldar `src/middleware.ts` na USP-004 T-08 com matcher para `(app|auth)/*` + leitura de cookie Supabase.

## C-03 — Schema Prisma sem models de domínio (🔴 ALTA)

- `prisma/schema.prisma:1-66` — só `HealthCheck`, `JobArea`, `ServiceCategory`, `Region`.
- IDSD `technical-design.md §4.5` lista ~15 entidades (`persons`, `credential`, `roles`, `role_grants`, `companies`, `consents`, `auth_attempts`, `audit_log`, `jobs`, `services`, etc.).

**Risco:** qualquer USP autenticada (USP-001/004/043/...) trava na primeira tentativa de migration. Cascata enorme.

**Recomendação:** parte vem natural da USP-004 (T-00 cria `Person`+`Credential`, T-01 cria `auth_attempts`). USP-043 trará `consents`/`audit_log`. Considerar uma única migration "domain bootstrap" antes de iniciar USPs em massa.

## C-04 — Coverage gate 65% vs alvo IDSD 70% (🟡 MÉDIA)

- `vitest.config.ts:27-33` define thresholds 65%.
- `CLAUDE.md` e `project-guideline §9.4` falam de 70% como alvo (CI falha < 65%). É **piso aceito**, não conflito direto.

**Risco:** com modules vazios, 65% de uma superfície minúscula é trivial. Quando módulos sensíveis chegarem, threshold baixo encobre lacunas reais.

**Recomendação:** subir thresholds para 70% quando primeira Server Action sensível chegar (USP-004 T-06). Adicionar override `domain/**` para 90% e `actions/**` para 80% via `coverage.thresholds.perFile`.

## C-05 — `ActionErrorCode` sem variante `INVALID_CREDENTIALS` (🟠 MÉDIA p/ USP-004)

- `src/shared/errors.ts:13-19` — enum tem `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `CONSENT_REQUIRED`, `NOT_FOUND`, `CONFLICT`, `PRECONDITION_FAILED`, `INTERNAL`.
- USP-004 P-002 (anti-enumeração) exige resposta **única** para "e-mail desconhecido" e "senha errada" → precisa de um código novo, ou reaproveitar `UNAUTHENTICATED` com mensagem genérica.

**Recomendação:** adicionar `'INVALID_CREDENTIALS'` ao enum. Ver `features/usp-004-autenticar-no-portal/gap-analysis.md INC-009`.

## C-06 — Variáveis de env ausentes para USP-004 (🟠 MÉDIA p/ USP-004)

- `.env.example` e `src/shared/env.ts` não declaram `AUTH_ATTEMPTS_RETENTION_DAYS` nem `AUTH_LOGIN_ENABLED`.
- Ambas pedidas pelo `features/usp-004-autenticar-no-portal/design.md §8` e `tasks.md T-11`.

**Recomendação:** adicionar em PR de scaffolding (pré-T-00):
```
AUTH_ATTEMPTS_RETENTION_DAYS=90
AUTH_LOGIN_ENABLED=true
```
e estender o schema Zod em `env.ts`.

## C-07 — DI container sem bindings reais (🟡 MÉDIA)

- `src/shared/container.ts` completo (lazy + singleton + reset), mas zero `register(token, factory)` no código.
- Conforme módulos crescerem, padrão DI pode ter divergência entre uses (alguém usa container, outro instancia direto).

**Recomendação:** USP-004 T-05 deve **registrar** `AuthProviderToken` no container, exercitando o padrão. Adicionar teste de integração que faz `container.resolve()` no fluxo real.

## C-08 — Logger pino sem consumidor real (🟡 MÉDIA)

- `src/shared/lib/logger.ts` configurado com redaction agressiva.
- Nenhuma chamada `logger.info` / `childLogger` em código de feature.

**Risco:** descobrir só na primeira feature que algum campo sensível escapa do redact pattern, ou que o `childLogger` precisa de extra binding.

**Recomendação:** USP-004 T-06 deve usar `childLogger({ module: 'identity', action: 'login' })` em 2+ pontos (entrada, falha, sucesso).

## C-09 — `ANTHROPIC_MODEL` default `claude-sonnet-4-6` desalinhado (🟡 MÉDIA)

- `.env.example` default = `claude-sonnet-4-6`.
- IDSD `ADR-0018` e `ADR-0027` falam de **Claude Haiku** para CV extraction (custo + ZDR).

**Risco:** custo de extração ~10x maior se default ficar; potencial issue de ZDR (Sonnet ZDR ≠ Haiku ZDR contrato).

**Recomendação:** trocar default para `claude-haiku-4-5` (ou `claude-3-5-haiku`) **antes** da USP-040 começar. Não bloqueia USP-004.

## C-10 — Smoke tests insuficientes (🟡 MÉDIA)

- 1 teste E2E (`e2e/smoke.spec.ts`: home carrega).
- IDSD pede top-8 flows.

**Recomendação:** mapa de top-8 (já listado em `TESTING.md`) com 1 task de E2E por flow conforme USPs forem concluídas. USP-004 T-07/T-08 entrega o 1º (`login + sessão`).

## C-11 — `.env.staging` no repo (🟠 MÉDIA — segurança)

- Arquivo presente no diretório.
- `.gitignore` cobre `.env.*` então **não está commitado**, mas existe localmente.

**Risco:** ferramentas que indexam o workspace (Copilot, certos LSPs) podem ler conteúdo. Vazamento acidental por screen share ou screenshot.

**Recomendação:** mover para gerenciador de segredos (1Password, Vault). Confirmar em `git ls-files | grep .env.staging` que de fato não está tracked.

## C-12 — `vitest.setup.ts` força `TZ=UTC` (🟢 BAIXA)

- `vitest.setup.ts:6` — `process.env.TZ = 'UTC'` para determinismo.
- Produção roda em `America/Sao_Paulo` (Vercel sa-east-1 não é garantia, mas a app converte com `time.ts`).

**Risco:** bugs sutis de DST mascarados.

**Recomendação:** 1 teste de integração paralelo com `TZ=America/Sao_Paulo` para gold-path de timezone (criar quando lib `time.ts` for usada por feature real).

## C-13 — Nenhum TODO/FIXME no código (🟢 OK)

`grep -r 'TODO\|FIXME' src/` → 0 matches. Boa higiene de bootstrap.

## C-14 — Ausência de `dependabot.yml` / `renovate.json` (🟢 BAIXA)

- Stack inteiro novinho (Next 15.5, Prisma 5.22 já não é a major mais recente, etc.).
- Sem automação, drift começa cedo.

**Recomendação:** adicionar `dependabot.yml` weekly antes da fase 1 começar.

## Severidade x impacto na USP-004

| Concern | Bloqueia USP-004? |
|---------|--------------------|
| C-01 docker-compose | ❌ não (cosmético) |
| C-02 middleware | ✅ bloqueia T-08 |
| C-03 schema vazio | ✅ bloqueia T-00, T-01 |
| C-04 coverage gate | ❌ não (recomendação) |
| C-05 enum sem `INVALID_CREDENTIALS` | ✅ bloqueia T-06 |
| C-06 env vars ausentes | ✅ bloqueia T-06, T-11 |
| C-07 DI sem bindings | ❌ (USP-004 mesma vai ser primeiro consumidor) |
| C-08 logger sem uso | ❌ (USP-004 será primeira) |
| C-09 modelo Anthropic | ❌ não (USP-040) |
| C-10 e2e insuficiente | ❌ (USP-004 começa a popular) |
| C-11 `.env.staging` | ❌ não |
| C-12 TZ=UTC | ❌ não |
