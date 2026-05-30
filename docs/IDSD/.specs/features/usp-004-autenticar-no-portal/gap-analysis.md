# gap-analysis.md — USP-004 vs código atual

> Análise gerada em 2026-05-30 a partir do estado real do repo (`docs/IDSD/.specs/codebase/`) e dos artefatos IDSD da USP-004 ([spec.md](./spec.md), [design.md](./design.md), [tasks.md](./tasks.md)). Comprovação cruzada com `IDSD/architecture/technical-design.md §4.4, §4.5, §7.1` e `IDSD/architecture/pending-decisions.md`.

## 1. Veredito

**USP-004 NÃO está pronta para iniciar.** Não há bloqueador conceitual ou arquitetural — apenas **6 ações de preparação técnica** (~4–6h de 1 dev) e **1 ação de compliance assíncrona**. Após isso, T-00 pode rodar sem retrabalho.

Findings principais:
- **3 bloqueadores estruturais** — schema sem `Person`/`Credential`, módulo `identity` não existe, `withAudit` não implementado.
- **3 bloqueadores menores** — `INVALID_CREDENTIALS` ausente em `ActionErrorCode`, 2 env vars faltando, `middleware.ts` inexistente.
- **0 conflitos** — código existente é fundação que **se encaixa** no design; nada precisa ser jogado fora.
- **1 gate compliance** — DEC-012 (retenção 90 dias de `auth_attempts`) pendente da DPO; não bloqueia código, bloqueia produção.

## 2. Inconsistências entre código e IDSD

> Severidades: **BLOQUEANTE** (impede uma task USP-004 começar), **ALTA** (causa retrabalho se ignorada), **MÉDIA** (qualidade), **BAIXA** (cosmético).

### INC-001 — Schema Prisma sem models de domínio · **BLOQUEANTE**
- **Fonte IDSD:** `technical-design.md §4.5` lista ~15 entidades.
- **Evidência:** [`prisma/schema.prisma`](prisma/schema.prisma) tem apenas `HealthCheck`, `JobArea`, `ServiceCategory`, `Region`. Sem `Person`, `Credential`, `AuthAttempt`.
- **Impacto:** T-00 e T-01 não podem rodar.
- **Recomendação:** Adicionar `Person` (com `PersonStatus` enum), `Credential` (com `primeiroAcesso`) e `AuthAttempt` (+ enum `AuthOutcome`) conforme [design.md §3](./design.md#3-modelo-de-dados). Migration única.

### INC-002 — Módulo `identity` não existe · **BLOQUEANTE**
- **Fonte IDSD:** `architecture-document.md §6`, `project-guideline.md §2.1`.
- **Evidência:** [`src/modules/`](src/modules/) contém apenas `README.md`. Zero subdiretórios.
- **Impacto:** T-02..T-09 precisam da estrutura canônica.
- **Recomendação:** scaffoldar `src/modules/identity/{actions,queries,domain,schemas,components,views,ports,adapters,server,__tests__}/` + `index.ts` barrel.

### INC-003 — `withAudit` não implementado · **BLOQUEANTE**
- **Fonte IDSD:** `project-guideline.md §7.1` (Server Action sensível) + `ADR-0023` (append-only).
- **Evidência:** zero ocorrências de `withAudit` no codebase; `src/modules/audit/` não existe.
- **Impacto:** T-06 (`loginAction`) depende de `withAudit('AUTH_LOGIN_SUCCESS', ...)`.
- **Recomendação:** scaffoldar `src/modules/audit/` com `events.ts` + `withAudit.ts` stub mínimo (chama callback dentro de `prisma.$transaction` e escreve em `audit_log` quando o model existir). Refatoração canônica depois.

### INC-004 — `.env.example` sem `AUTH_ATTEMPTS_RETENTION_DAYS` / `AUTH_LOGIN_ENABLED` · **ALTA**
- **Fonte IDSD:** `project-guideline.md §10` + `design.md §8`.
- **Evidência:** [`.env.example`](.env.example) tem 16 vars; **nenhuma das duas auth**.
- **Impacto:** T-06 não tem feature flag, T-11 não tem retenção parametrizada.
- **Recomendação:**
  ```
  # USP-004 — Autenticação
  AUTH_ATTEMPTS_RETENTION_DAYS=90
  AUTH_LOGIN_ENABLED=true
  ```

### INC-005 — `src/shared/env.ts` não valida as 2 vars novas · **ALTA**
- **Evidência:** [`src/shared/env.ts`](src/shared/env.ts) tem schema Zod das 16 atuais. Sem as novas.
- **Impacto:** mesmo de INC-004 mas no boundary de tipos (build falha).
- **Recomendação:** estender `envSchema`:
  ```ts
  AUTH_ATTEMPTS_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  AUTH_LOGIN_ENABLED: z.coerce.boolean().default(true),
  ```

### INC-006 — `src/middleware.ts` ausente · **ALTA** (bloqueia T-08)
- **Fonte IDSD:** `ADR-0030`, `technical-design.md §7.1`.
- **Evidência:** arquivo não existe.
- **Impacto:** T-08 (revalidação de sessão por request) não tem alvo de edição.
- **Recomendação:** scaffoldar com stub que apenas chama `NextResponse.next()` + `config.matcher = ['/(app|auth)/:path*']`. T-08 implementa a lógica real.

### INC-007 — `ActionErrorCode` sem `INVALID_CREDENTIALS` · **ALTA**
- **Fonte:** [design.md §4](./design.md#4-contratos--server-action).
- **Evidência:** [`src/shared/errors.ts:13-19`](src/shared/errors.ts) — enum sem essa variante. Tem `UNAUTHENTICATED` que é semanticamente diferente (sem sessão vs credencial errada).
- **Impacto:** T-06 retornaria um erro semanticamente errado, ou precisaria reuso confuso de `UNAUTHENTICATED`.
- **Recomendação:** adicionar `'INVALID_CREDENTIALS'` ao tipo.

### INC-008 — Página `/login` placeholder vazio · **MÉDIA** (cosmético)
- **Evidência:** [`src/app/(auth)/login/page.tsx`](src/app/(auth)/login/page.tsx) — só cabeçalho "Placeholder do route group".
- **Impacto:** T-07 substituirá. Não há conflito real (placeholder não tem lógica).
- **Recomendação:** ignorar; T-07 sobrescreve.

### INC-009 — `ANTHROPIC_MODEL` default `claude-sonnet-4-6` desalinhado com ADR-0027 · **BAIXA p/ USP-004** (mas relevante)
- **Fonte:** `ADR-0018`, `ADR-0027` falam de **Haiku** (custo + ZDR).
- **Evidência:** [`.env.example`](.env.example) → `ANTHROPIC_MODEL=claude-sonnet-4-6` (mais caro, ZDR diferente).
- **Impacto na USP-004:** zero. **Impacto em USP-040:** custo ~10x + risco contratual ZDR.
- **Recomendação:** trocar default para um Haiku quando USP-040 começar. Documentar.

### INC-010 — `README.md` instrui `docker compose up` · **MÉDIA** (DX)
- **Evidência:** [`README.md:23-41`](README.md) ainda manda `docker compose up -d` para subir Postgres + MailHog.
- **Fonte:** `ADR-0016` declara Supabase CLI como padrão.
- **Impacto:** dev novo segue caminho errado, dois Postgres podem coexistir (porta 5432 docker vs 55322 supabase) — não bate na USP-004 imediatamente, mas atrapalha onboarding.
- **Recomendação:** atualizar README — Step 1: `supabase start`.

## 3. Pré-requisitos para iniciar a USP-004

> Cada linha: PR-NN | descrição | status hoje | bloqueante? | resolução.

| ID | Pré-requisito | Status | Bloqueia? | Resolução |
|----|---------------|--------|-----------|-----------|
| PR-001 | Models `Person`, `Credential` no Prisma | ❌ | ✅ | Cobre INC-001 — adicionar + migration |
| PR-002 | Tabela `auth_attempts` + enum `AuthOutcome` | ❌ | ✅ | Mesma migration de PR-001 ou subsequente (T-01) |
| PR-003 | Catálogo `AUTH_*` no `audit/events.ts` | ❌ | ✅ | Cobre INC-003 (stub) |
| PR-004 | Módulo `src/modules/identity/` scaffoldado | ❌ | ✅ | Cobre INC-002 |
| PR-005 | Módulo `src/modules/audit/` + stub `withAudit` | ❌ | ✅ | Cobre INC-003 |
| PR-006 | Supabase server client | ✅ | ❌ | Pronto em [`src/shared/lib/supabase/server.ts`](src/shared/lib/supabase/server.ts) |
| PR-007 | Helper `requirePermission()` (stub) | ❌ | ⚠️ parcial | T-08 implementa real; stub pode coexistir |
| PR-008 | Página `/login` (placeholder) | ✅ | ❌ | T-07 sobrescreve |
| PR-009 | `src/middleware.ts` | ❌ | ✅ | Cobre INC-006 — criar stub |
| PR-010 | Variáveis `AUTH_*` em `.env.example` + `env.ts` | ❌ | ✅ | Cobre INC-004 + INC-005 |
| PR-011 | `ActionErrorCode` com `INVALID_CREDENTIALS` | ❌ | ✅ | Cobre INC-007 |
| PR-012 | Cron Vercel para retenção (`vercel.json`) | ❌ | ⚠️ T-11 | Só na T-11; não bloqueia T-00 |
| PR-013 | Supabase Auth habilitado em `config.toml` | ⚠️ presumido | ⚠️ T-05 | Validar manualmente via `supabase status` antes da T-05 |
| PR-014 | Dependência `bcryptjs` (anti-timing D-A) | ❌ | ⚠️ T-06 | `npm i bcryptjs @types/bcryptjs` (ou usar `crypto.timingSafeEqual` se preferir nativo) |
| PR-015 | Termos de consentimento das 8 finalidades | ⚠️ folders existem | ❌ | USP-004 **não** consome consentimento — gate só para USP-043 |
| PR-016 | E2E `login.spec.ts` | ❌ | ❌ | Criado na T-07 |

## 4. Impedimentos externos (decisões pendentes)

### DEC-012 — Retenção de `auth_attempts` 90 dias
- **Owner:** DPO Angélica.
- **Status:** aberto, ainda não solicitado.
- **Bloqueia código?** ❌ Não. `AUTH_ATTEMPTS_RETENTION_DAYS=90` segue como default tunável; T-11 pode ficar atrás de feature flag.
- **Bloqueia produção?** ✅ Sim. Sem aprovação da DPO, o job de retenção não pode ir a prod (princípio da minimização LGPD).
- **Ação:** enviar e-mail à Angélica com pergunta objetiva ("retenção de 90 dias de tentativas de login — email + IP, sem dados sensíveis — é proporcional à finalidade anti-bot/DoS?"). Registrar status em `pending-decisions.md`.

### DEC-001 — DPO designada
- **Status:** ✅ resolvido (Angélica), conforme `technical-design.md §12`. Sem ação.

### Demais decisões pendentes da Fase 1 (DEC-002, 011, 013, 015, 016, 021)
- **Impactam:** USP-043 (consentimentos), USP-007 (inativação), USP-008 (permissões).
- **Impactam USP-004?** ❌ Não. Login é operação técnica de identidade; não consome consentimento, não delega permissão.

## 5. Plano de desbloqueio (pre-T-00)

Sequência sugerida, com paralelização possível em paralelo entre 1-3 e 4-6:

### Sprint pré-USP-004 (~4–6h, 1 dev)

1. **`chore(identity): scaffold módulos identity + audit`** [INC-002, INC-003, PR-004, PR-005]
   - `src/modules/identity/{actions,queries,domain,schemas,components,views,ports,adapters,server,__tests__}/` + `index.ts`
   - `src/modules/audit/{events.ts,withAudit.ts,__tests__,index.ts}` — `withAudit` é stub funcional (transaction + log)

2. **`feat(infra): vars de ambiente auth (USP-004)`** [INC-004, INC-005, PR-010]
   - Adicionar `AUTH_ATTEMPTS_RETENTION_DAYS=90` e `AUTH_LOGIN_ENABLED=true` em `.env.example`, `.env.local`, `.env.staging`
   - Estender `envSchema` em `src/shared/env.ts`
   - Atualizar `src/shared/__tests__/env.test.ts`

3. **`feat(shared): adiciona INVALID_CREDENTIALS ao ActionErrorCode`** [INC-007, PR-011]
   - `src/shared/errors.ts` — `'INVALID_CREDENTIALS'` no enum
   - Atualizar `src/shared/__tests__/errors.test.ts`

4. **`feat(identity): schema base Person + Credential + AuthAttempt`** [INC-001, PR-001, PR-002]
   - Atualizar `prisma/schema.prisma` (Person + Credential + AuthAttempt + enums)
   - `npx prisma migrate dev --name init-identity-and-auth-attempts`
   - Commit do diff de migration + schema

5. **`feat(infra): middleware Next stub para sessão`** [INC-006, PR-009]
   - Criar `src/middleware.ts` com `NextResponse.next()` + matcher `(app|auth)/*`
   - Comentário TODO referenciando ADR-0030 + T-08 USP-004

6. **`chore(infra): bcryptjs para anti-timing dummy hash`** [PR-014]
   - `npm i bcryptjs @types/bcryptjs`
   - Constante `DUMMY_HASH` em `src/modules/identity/domain/anti-timing.ts` (gera 1x no boot)

### Paralelo (compliance assíncrono)

7. **Solicitar DEC-012 à DPO Angélica** [DEC-012]
   - Não bloqueia código.
   - Registrar `solicitado_em: 2026-05-30` em `IDSD/architecture/pending-decisions.md` + `STATE.md`.

### Validação manual antes de T-05

8. **`supabase start` + verificar Auth ativo** [PR-013]
   - Studio (http://127.0.0.1:55323) → Auth → Email provider habilitado
   - Se não: editar `supabase/config.toml` `[auth]`, re-start

## 6. PRONTO QUANDO

✅ os 8 itens abaixo estiverem verdes simultaneamente, T-00 pode começar:

1. `npx prisma migrate status` → `Database schema is up to date.` com `Person`, `Credential`, `AuthAttempt` aplicados.
2. `grep AUTH_ATTEMPTS_RETENTION_DAYS .env.example` retorna linha.
3. `npm run typecheck` passa com `env.AUTH_LOGIN_ENABLED` acessível.
4. `grep INVALID_CREDENTIALS src/shared/errors.ts` retorna linha.
5. `ls src/modules/identity/index.ts src/modules/audit/index.ts` ambos existem.
6. `ls src/middleware.ts` existe.
7. `npm list bcryptjs` mostra versão instalada.
8. `supabase status` retorna `Auth: http://127.0.0.1:55321/auth/v1` ativo.

DEC-012 fica como **gate de produção**, não de desenvolvimento — anotar no PR de T-11 que merge para `main` é OK, mas o cron job só liga quando DPO aprovar.

## 7. Riscos secundários observados

- **C-07** (DI container sem bindings): USP-004 T-05 é o primeiro consumidor real. Validar o padrão `container.register(AuthProviderToken, () => new SupabaseAuthAdapter(...))` aqui.
- **C-08** (logger sem uso): T-06 deve usar `childLogger({ module: 'identity', action: 'login' })` em ≥2 pontos para exercitar o redaction PII em código real.
- **C-04** (coverage gate 65% vs 70%): considerar subir o threshold para 70% quando T-06 introduzir a primeira Server Action sensível, com override `domain/**=90%`, `actions/**=80%`.
